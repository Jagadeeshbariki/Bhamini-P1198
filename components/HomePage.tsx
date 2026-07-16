
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Maximize, Minimize } from 'lucide-react';
import PhotoSlider from './PhotoSlider';
import PhotoGallery from './PhotoGallery';
import MediaUploadModal from './MediaUploadModal';
import { useAuth } from '../hooks/useAuth';
import { 
    GOOGLE_SHEET_PHOTOS_URL,
    GOOGLE_APPS_SCRIPT_URL,
    VILLAGES_DATA_URL,
    getProxyUrl
} from '../config';

// Map resizer to trigger invalidateSize when fullscreen changes
const MapResizer = ({ isFullScreen }: { isFullScreen: boolean }) => {
    const map = useMap();
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (map) map.invalidateSize();
        }, 100);
        return () => clearTimeout(timeout);
    }, [isFullScreen, map]);
    return null;
};

// Fix Leaflet's default icon path issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface ImageData {

    url: string;
    description: string;
    activity: string;
}

interface VillageData {
    district: string;
    block: string;
    cluster: string;
    gp: string;
    village: string;
    lat: number;
    lng: number;
}

const HomePage: React.FC = () => {
    const { user } = useAuth();
    const [sliderImages, setSliderImages] = useState<ImageData[]>([]);
    const [galleryImages, setGalleryImages] = useState<ImageData[]>([]);
    const [villagesData, setVillagesData] = useState<VillageData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isMapFullScreen, setIsMapFullScreen] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const filterRef = useRef<HTMLDivElement>(null);

    const getCustomIcon = useCallback((color: string) => {
        return L.divIcon({
            className: 'custom-cluster-marker bg-transparent border-none',
            html: `<svg width="28" height="40" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 3px 4px rgba(0,0,0,0.4));">
                <path d="M12 0C5.37258 0 0 5.37258 0 12C0 21 12 36 12 36C12 36 24 21 24 12C24 5.37258 18.6274 0 12 0ZM12 16.2C9.6804 16.2 7.8 14.3196 7.8 12C7.8 9.6804 9.6804 7.8 12 7.8C14.3196 7.8 16.2 9.6804 16.2 12C16.2 14.3196 14.3196 16.2 12 16.2Z" fill="${color}" stroke="white" stroke-width="1.5"/>
            </svg>`,
            iconSize: [28, 40],
            iconAnchor: [14, 40],
            popupAnchor: [0, -40]
        });
    }, []);

    // Create a cache for icons
    const iconCache = useRef<Record<string, L.DivIcon>>({});

    const getIconForColor = (color: string) => {
        if (!iconCache.current[color]) {
            iconCache.current[color] = getCustomIcon(color);
        }
        return iconCache.current[color];
    };
    const getDriveDirectUrl = (url: string) => {
        if (!url) return '';
        if (url.includes('drive.google.com') || url.includes('google.com/open')) {
            const idMatch = url.match(/(?:id=|\/d\/|folders\/|file\/d\/|open\?id=)([-\w]{25,})/);
            if (idMatch) {
                return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1600`;
            }
        }
        return url;
    };

    const parseCSVToObjects = (csv: string): Record<string, string>[] => {
        if (!csv) return [];
        const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 1) return [];
        const parseLine = (line: string) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                    result.push(current.trim().replace(/^"|"$/g, ''));
                    current = '';
                } else current += char;
            }
            result.push(current.trim().replace(/^"|"$/g, ''));
            return result;
        };
        const rawHeaders = parseLine(lines[0]);
        const headers = rawHeaders.map(h => h.trim().toUpperCase().replace(/[\s_]+/g, ''));
        return lines.slice(1).map(line => {
            const vals = parseLine(line);
            const row: Record<string, string> = {};
            headers.forEach((h, i) => { if (h) row[h] = (vals[i] || '').trim(); });
            return row;
        });
    };

    const getFuzzy = (row: Record<string, string>, keywords: string[]) => {
        const keys = Object.keys(row);
        for (const keyword of keywords) {
            const upperK = keyword.toUpperCase();
            if (row[upperK] !== undefined) return row[upperK];
        }
        for (const keyword of keywords) {
            const upperK = keyword.toUpperCase();
            const match = keys.find(k => k.includes(upperK));
            if (match && row[match]) return row[match];
        }
        return '';
    };

    const fetchPhotosAndVillages = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const safeFetch = (url: string) => fetch(getProxyUrl(url)).catch(err => {
                console.warn("Fetch failed for " + url, err);
                return { ok: false, text: async () => '' } as any;
            });
            const [photosRes, villagesRes] = await Promise.all([
                safeFetch(`${GOOGLE_SHEET_PHOTOS_URL}&t=${Date.now()}`),
                safeFetch(`${VILLAGES_DATA_URL}&t=${Date.now()}`)
            ]);
            
            const [csvText, villagesText] = await Promise.all([
                photosRes.text(),
                villagesRes.text()
            ]);
            
            const rows = parseCSVToObjects(csvText);
            const slider: ImageData[] = [];
            const gallery: ImageData[] = [];

            rows.forEach(row => {
                const urlRaw = getFuzzy(row, ['URL', 'LINK', 'IMAGE', 'PHOTO']);
                const typeRaw = getFuzzy(row, ['TYPE', 'CATEGORY', 'PLACEMENT']) || 'gallery';
                const descRaw = getFuzzy(row, ['DESCRIPTION', 'DESC', 'CAPTION']) || '';
                const activityRaw = (getFuzzy(row, ['ACTIVITY', 'ACT', 'WORK']) || 'Uncategorized').trim().replace(/^(BYP-|BFE-|AFT-)/, '');
                
                const directUrl = getDriveDirectUrl(urlRaw);
                if (directUrl) {
                    const imgData = { url: directUrl, description: descRaw, activity: activityRaw };
                    const type = typeRaw.toLowerCase();
                    if (type.includes('slider') || type.includes('hero')) {
                        slider.push(imgData);
                    } else {
                        gallery.push(imgData);
                    }
                }
            });
            setSliderImages(slider.reverse());
            setGalleryImages(gallery.reverse());

            const villageRows = parseCSVToObjects(villagesText);
            const vData: VillageData[] = [];
            villageRows.forEach(row => {
                const lat = parseFloat(row['LAT']);
                const lng = parseFloat(row['LONG']);
                if (!isNaN(lat) && !isNaN(lng)) {
                    vData.push({
                        district: row['DISTRICT'] || '',
                        block: row['BLOCK'] || '',
                        cluster: row['CLUSTER'] || row['Cluster'] || '',
                        gp: row['GP'] || '',
                        village: row['NAMEOFVILLAGE'] || row['VILLAGE'] || '',
                        lat,
                        lng
                    });
                }
            });
            setVillagesData(vData);
        } catch (err) {
            console.warn(err);
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPhotosAndVillages();
    }, [fetchPhotosAndVillages]);

    const availableActivities = useMemo(() => {
        return Array.from(new Set(galleryImages.map(img => img.activity))).sort();
    }, [galleryImages]);

    const filteredGallery = useMemo(() => {
        if (selectedActivities.length === 0) return galleryImages;
        return galleryImages.filter(img => selectedActivities.includes(img.activity));
    }, [galleryImages, selectedActivities]);

    const handleCheckboxChange = (activity: string) => {
        setSelectedActivities(prev => 
            prev.includes(activity) ? prev.filter(a => a !== activity) : [...prev, activity]
        );
    };

    const handleDeleteMedia = async (imageUrl: string) => {
        if (!window.confirm('Permanently remove this documentation from the registry?')) return;
        setIsDeleting(imageUrl);
        try {
            const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'deletePhoto', url: imageUrl })
            });
            const raw = await response.text();
            let data;
            try {
                data = JSON.parse(raw);
            } catch {
                throw new Error('Invalid server response: ' + raw.substring(0, 100));
            }

            if (data.status === 'success') {
                setGalleryImages(prev => prev.filter(item => item.url !== imageUrl));
            } else {
                alert('Deletion failed: ' + (data.message || 'Unknown error'));
            }
        } catch (err) {
            alert('Error while deleting: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setIsDeleting(null);
        }
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="space-y-12">
            
            {villagesData.length > 0 && (
                <section className={isMapFullScreen ? "fixed inset-0 z-[9999] bg-white dark:bg-gray-900" : "animate-fade-in"}>
                    {!isMapFullScreen && (
                        <div className="text-center mb-6 mt-12">
                            <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Working Villages</h2>
                            <div className="h-1 w-12 bg-indigo-500 mt-2 mx-auto rounded-full"></div>
                        </div>
                    )}
                    <div className={
                        isMapFullScreen 
                        ? "h-full w-full relative" 
                        : "mx-4 overflow-hidden rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 h-[600px] relative"
                    }>
                        <button 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsMapFullScreen(!isMapFullScreen);
                            }}
                            className="bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 rounded shadow border border-gray-200 dark:border-gray-700 flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                            style={{ position: 'absolute', top: '15px', left: '60px', zIndex: 10000, padding: '0.5rem 0.75rem' }}
                            aria-label="Toggle Fullscreen"
                        >
                            {isMapFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
                            <span className="text-xs font-bold">{isMapFullScreen ? 'Exit Full Screen' : 'Full Screen'}</span>
                        </button>
                        <MapContainer 
                            bounds={villagesData.map(v => [v.lat, v.lng] as [number, number])}
                            scrollWheelZoom={true} 
                            style={{ height: '100%', width: '100%' }}
                            className="z-0 h-full w-full"
                        >
                            <MapResizer isFullScreen={isMapFullScreen} />
                            <LayersControl position="topright">
                                <LayersControl.BaseLayer checked name="Map">
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                </LayersControl.BaseLayer>
                                <LayersControl.BaseLayer name="Satellite">
                                    <TileLayer
                                        attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                    />
                                </LayersControl.BaseLayer>
                            </LayersControl>
                            {villagesData.map((v, i) => {
                                let color = '#6B7280';
                                if (v.cluster.toLowerCase() === 'cluster_1') color = '#EF4444';
                                else if (v.cluster.toLowerCase() === 'cluster_2') color = '#3B82F6';
                                else if (v.cluster.toLowerCase() === 'cluster_3') color = '#10B981';
                                else if (v.cluster) color = '#F59E0B'; // fallback color

                                const customIcon = getIconForColor(color);

                                return (
                                <Marker key={i} position={[v.lat, v.lng]} icon={customIcon}>
                                    <Popup className="rounded-xl overflow-hidden shadow-lg">
                                        <div className="p-2 space-y-1">
                                            <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs border-b pb-1 mb-2">{v.village}</h3>
                                            <p className="text-[10px] text-gray-500"><strong>GP:</strong> {v.gp}</p>
                                            <p className="text-[10px] text-gray-500"><strong>Block:</strong> {v.block}</p>
                                            <p className="text-[10px] text-gray-500"><strong>District:</strong> {v.district}</p>
                                            {v.cluster && <p className="text-[10px] text-gray-500"><strong>Cluster:</strong> <span style={{color, fontWeight: 'bold'}}>{v.cluster}</span></p>}
                                        </div>
                                    </Popup>
                                </Marker>
                                );
                            })}
                        </MapContainer>
                        <div className="absolute bottom-6 left-6 z-[400] bg-white dark:bg-gray-800 p-3 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 pointer-events-auto">
                            <h4 className="text-[10px] font-black uppercase mb-3 text-gray-800 dark:text-gray-200 tracking-widest border-b pb-1">Legend</h4>
                            <div className="space-y-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                <div className="flex items-center gap-3"><div className="w-3 h-3 bg-[#EF4444] rounded-full border-2 border-white/80 shadow-sm"></div>Cluster 1</div>
                                <div className="flex items-center gap-3"><div className="w-3 h-3 bg-[#3B82F6] rounded-full border-2 border-white/80 shadow-sm"></div>Cluster 2</div>
                                <div className="flex items-center gap-3"><div className="w-3 h-3 bg-[#10B981] rounded-full border-2 border-white/80 shadow-sm"></div>Cluster 3</div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            <section className="animate-fade-in mt-12">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Project Highlights</h2>
                </div>
                {sliderImages.length > 0 && <PhotoSlider images={sliderImages} />}
            </section>

            <section className="animate-fade-in mt-12">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 px-4 gap-4">
                    <div className="text-left flex items-center gap-6">
                        <div>
                            <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight leading-none">Field Gallery</h2>
                            <div className="h-1 w-12 bg-emerald-500 mt-2 rounded-full"></div>
                        </div>
                        {(user?.role === 'project' || user?.role === 'admin' || user?.role === 'da') && (
                            <button 
                                onClick={() => setIsUploadModalOpen(true)}
                                className="px-5 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 transform active:scale-95"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                                </svg>
                                Upload Photo
                            </button>
                        )}
                    </div>

                    {/* Compact Multi-select Dropdown Filter */}
                    {availableActivities.length > 0 && (
                        <div className="relative" ref={filterRef}>
                            <button 
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border-2 ${
                                    selectedActivities.length > 0 
                                    ? 'bg-indigo-600 text-white border-indigo-600' 
                                    : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-100 dark:border-gray-700 hover:border-indigo-500'
                                }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
                                </svg>
                                {selectedActivities.length > 0 ? `Filtering: ${selectedActivities.length}` : 'Filter Activities'}
                                <svg className={`w-3 h-3 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                            </button>

                            {isFilterOpen && (
                                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden animate-dropdown-in">
                                    <div className="p-4 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Select Multiple</span>
                                        {selectedActivities.length > 0 && (
                                            <button 
                                                onClick={() => setSelectedActivities([])}
                                                className="text-[9px] font-black uppercase text-red-500 hover:underline"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-64 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                                        {availableActivities.map(activity => (
                                            <label key={activity} className="flex items-center gap-3 cursor-pointer group p-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                                                <div className="relative">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedActivities.includes(activity)}
                                                        onChange={() => handleCheckboxChange(activity)}
                                                        className="w-5 h-5 rounded-lg border-2 border-gray-200 dark:border-gray-600 checked:bg-indigo-600 checked:border-indigo-600 transition-all cursor-pointer appearance-none"
                                                    />
                                                    <svg className={`absolute inset-0 m-auto w-3 h-3 text-white pointer-events-none transition-opacity ${selectedActivities.includes(activity) ? 'opacity-100' : 'opacity-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>
                                                </div>
                                                <span className={`text-[10px] font-bold uppercase transition-colors ${selectedActivities.includes(activity) ? 'text-indigo-600' : 'text-gray-500 group-hover:text-gray-700'}`}>
                                                    {activity}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="p-3 bg-gray-50 dark:bg-gray-900/80 border-t border-gray-100 dark:border-gray-700">
                                        <button 
                                            onClick={() => setIsFilterOpen(false)}
                                            className="w-full py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg"
                                        >
                                            Apply Filter
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {filteredGallery.length > 0 ? (
                    <PhotoGallery 
                        images={filteredGallery} 
                        onDelete={user?.role === 'admin' ? handleDeleteMedia : undefined}
                        deletingUrl={isDeleting}
                    />
                ) : (
                    <div className="text-center py-24 bg-gray-50 dark:bg-gray-900 rounded-[2.5rem] border-4 border-dashed border-gray-100 dark:border-gray-800 mx-4">
                        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">No documentation matches filter</p>
                    </div>
                )}
            </section>

            <MediaUploadModal 
                isOpen={isUploadModalOpen} 
                onClose={() => setIsUploadModalOpen(false)} 
                onUploadSuccess={fetchPhotosAndVillages} 
            />
            
            <style>{`
                @keyframes dropdown-in {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-dropdown-in { animation: dropdown-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; }
            `}</style>
        </div>
    );
};

export default HomePage;
