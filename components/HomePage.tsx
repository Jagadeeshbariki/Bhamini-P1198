
import React, { useState, useEffect, useMemo, useRef } from 'react';
import PhotoSlider from './PhotoSlider';
import PhotoGallery from './PhotoGallery';
import { 
    GOOGLE_SHEET_PHOTOS_URL 
} from '../config';

interface ImageData {
    url: string;
    description: string;
    activity: string;
}

const HomePage: React.FC = () => {
    const [sliderImages, setSliderImages] = useState<ImageData[]>([]);
    const [galleryImages, setGalleryImages] = useState<ImageData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    const getDriveDirectUrl = (input: string) => {
        if (!input || typeof input !== 'string') return '';
        const trimmed = input.trim();
        if (trimmed.includes('drive.google.com') || trimmed.includes('google.com/open')) {
            const idMatch = trimmed.match(/(?:id=|\/d\/|folders\/|file\/d\/|open\?id=)([-\w]{25,})/);
            const id = idMatch ? idMatch[1] : '';
            return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1600` : '';
        }
        return trimmed.startsWith('http') ? trimmed : '';
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

    useEffect(() => {
        const fetchPhotos = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${GOOGLE_SHEET_PHOTOS_URL}&t=${Date.now()}`);
                const csvText = await response.text();
                const rows = parseCSVToObjects(csvText);
                const slider: ImageData[] = [];
                const gallery: ImageData[] = [];

                rows.forEach(row => {
                    const urlRaw = getFuzzy(row, ['URL', 'LINK', 'IMAGE', 'PHOTO']);
                    const typeRaw = getFuzzy(row, ['TYPE', 'CATEGORY', 'PLACEMENT']) || 'gallery';
                    const descRaw = getFuzzy(row, ['DESCRIPTION', 'DESC', 'CAPTION']) || '';
                    const activityRaw = getFuzzy(row, ['ACTIVITY', 'ACT', 'WORK']) || 'Uncategorized';
                    
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
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchPhotos();
    }, []);

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
            <section className="animate-fade-in">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Project Highlights</h2>
                </div>
                {sliderImages.length > 0 && <PhotoSlider images={sliderImages} />}
            </section>
            
            <section className="animate-fade-in">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 px-4 gap-4">
                    <div className="text-left">
                        <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight leading-none">Field Gallery</h2>
                        <div className="h-1 w-12 bg-emerald-500 mt-2 rounded-full"></div>
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
                    <PhotoGallery images={filteredGallery} />
                ) : (
                    <div className="text-center py-24 bg-gray-50 dark:bg-gray-900 rounded-[2.5rem] border-4 border-dashed border-gray-100 dark:border-gray-800 mx-4">
                        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">No documentation matches filter</p>
                    </div>
                )}
            </section>
            
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
