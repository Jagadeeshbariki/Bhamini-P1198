import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { 
    Search, Filter, PieChart as PieChartIcon, 
    Target, TrendingUp, Users, IndianRupee, MapPin, Globe, Camera, RefreshCw
} from 'lucide-react';
import { 
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip, 
    Legend
} from 'recharts';
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { ECO_FARMPOND_URL, CONTRIBUTION_DATA_URL } from '../config';
import AddFarmpondPhotoModal from './AddFarmpondPhotoModal';

declare global {
  interface Window {
    google: any;
  }
}

interface FarmpondRecord {
    hhId: string;
    name: string;
    gp: string;
    village: string;
    age: string;
    benId: string;
    cluster: string;
    lat: number;
    lng: number;
    photo: string;
    contribution?: number;
}

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#f97316'];

const EcoFarmpondPage: React.FC = () => {
    const { user } = useAuth();
    const [data, setData] = useState<FarmpondRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const mapRef = useRef<HTMLDivElement>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    
    // Filters
    const [selectedCluster, setSelectedCluster] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

    const parseCSV = (csv: string): any[] => {
        const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 1) return [];
        
        const parseLine = (line: string): string[] => {
            const values = [];
            let inQuote = false, val = '';
            for (let j = 0; j < line.length; j++) {
                if (line[j] === '"') inQuote = !inQuote;
                else if (line[j] === ',' && !inQuote) { values.push(val.trim()); val = ''; }
                else val += line[j];
            }
            values.push(val.trim().replace(/^"|"$/g, ''));
            return values;
        };

        const rawHeaders = parseLine(lines[0]);
        
        return lines.slice(1).map(line => {
            const vals = parseLine(line);
            const obj: any = {};
            rawHeaders.forEach((h, i) => {
                const key = h.trim() || `COL_${i}`;
                obj[key] = vals[i] || '';
            });
            return obj;
        });
    };

    const normalizeId = (id: any): string => {
        if (id === null || id === undefined) return '';
        const str = id.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (/^\d+$/.test(str)) {
            return parseInt(str, 10).toString();
        }
        return str;
    };

    const getFuzzyValue = (row: any, keys: string[]) => {
        const rowKeys = Object.keys(row);
        for (const k of keys) {
            const match = rowKeys.find(rk => rk.toUpperCase() === k.toUpperCase() || rk.toUpperCase().includes(k.toUpperCase()) || k.toUpperCase().includes(rk.toUpperCase()));
            if (match) return row[match];
        }
        return '';
    };

    const getGoogleDriveThumbnail = (url: string) => {
        if (!url || !url.includes('drive.google.com')) return url;
        
        let id = '';
        if (url.includes('id=')) {
            id = url.split('id=')[1].split('&')[0];
        } else if (url.includes('file/d/')) {
            id = url.split('file/d/')[1].split('/')[0].split('?')[0];
        }
        
        if (id) {
            return `https://drive.google.com/thumbnail?id=${id}&sz=w400`;
        }
        return url;
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [pondRes, contribRes] = await Promise.all([
                fetch(`${ECO_FARMPOND_URL}&cb=${Date.now()}`),
                fetch(`${CONTRIBUTION_DATA_URL}&cb=${Date.now()}`)
            ]);

            if (!pondRes.ok || !contribRes.ok) throw new Error("Failed to fetch data.");

            const pondText = await pondRes.text();
            const contribText = await contribRes.text();

            const rawPonds = parseCSV(pondText);
            const rawContribs = parseCSV(contribText);

            const contribMap = new Map<string, number>();
            rawContribs.forEach(row => {
                const rawId = getFuzzyValue(row, ['FARMERID', 'FID', 'ID', 'FARMER ID', 'HH_id', 'HH ID', 'HHID']);
                const normId = normalizeId(rawId);
                
                const pondCol = Object.keys(row).find(k => k.toUpperCase().includes('ECO-FARMPOND') || k.toUpperCase().includes('FARMPOND'));
                
                if (normId && pondCol) {
                    const amount = parseFloat((row[pondCol] || '').toString().replace(/[^0-9.]/g, '')) || 0;
                    if (amount > 0) {
                        contribMap.set(normId, (contribMap.get(normId) || 0) + amount);
                    }
                }
            });

            const parsedPonds: FarmpondRecord[] = rawPonds.map(row => {
                const hhId = getFuzzyValue(row, ['HH_id', 'HH ID', 'HHID', 'Farmer ID', 'FARMERID']) || '';
                const normHhId = normalizeId(hhId);
                
                return {
                    hhId: hhId,
                    name: getFuzzyValue(row, ['Benficiary_name', 'Farmer Name', 'Name']) || '',
                    gp: getFuzzyValue(row, ['Beneficiary_GP', 'GP']) || '',
                    village: getFuzzyValue(row, ['Beneficiary_village', 'Village']) || '',
                    age: getFuzzyValue(row, ['Beneficiary_age', 'Age']) || '',
                    benId: getFuzzyValue(row, ['Ben_id', 'ID']) || '',
                    cluster: getFuzzyValue(row, ['COL_6', 'Cluster']) || 'Unknown',
                    lat: parseFloat(getFuzzyValue(row, ['Lat', 'Latitude'])) || 0,
                    lng: parseFloat(getFuzzyValue(row, ['long', 'Longitude', 'Long'])) || 0,
                    photo: getFuzzyValue(row, ['Photo_link', 'Photo', 'PHOTO_LINK', 'PHOTO', 'IMAGE', 'PICTURE', 'FARM_PHOTO', 'FARMPOND_PHOTO']) || '',
                    contribution: contribMap.get(normHhId) || 0
                };
            }).filter(p => p.hhId);

            setData(parsedPonds);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Load Google Maps Script
    useEffect(() => {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
        if (!window.google && !document.getElementById('google-maps-script')) {
            const script = document.createElement('script');
            script.id = 'google-maps-script';
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
            script.async = true;
            script.defer = true;
            script.onload = () => setMapLoaded(true);
            document.head.appendChild(script);
        } else if (window.google) {
            setMapLoaded(true);
        }
    }, []);

    const filteredData = useMemo(() => {
        return data.filter(d => {
            const matchesCluster = selectedCluster === 'All' || d.cluster === selectedCluster;
            const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 d.hhId.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCluster && matchesSearch;
        });
    }, [data, selectedCluster, searchQuery]);

    const stats = useMemo(() => {
        const target = 62;
        const achieved = filteredData.length;
        const totalContribution = filteredData.reduce((sum, d) => sum + (d.contribution || 0), 0);
        
        const clusterMap: Record<string, number> = {};
        filteredData.forEach(d => {
            clusterMap[d.cluster] = (clusterMap[d.cluster] || 0) + 1;
        });
        const clusterDist = Object.entries(clusterMap).map(([name, value]) => ({ name, value }));

        const mapPoints = filteredData
            .filter(d => d.lat !== 0 && d.lng !== 0)
            .map(d => ({
                x: d.lng,
                y: d.lat,
                name: d.name,
                village: d.village,
                gp: d.gp,
                cluster: d.cluster,
                hhId: d.hhId
            }));

        return { target, achieved, totalContribution, clusterDist, mapPoints };
    }, [filteredData]);

    // Initialize Map
    const mapInstance = useRef<any>(null);
    const markerClusterer = useRef<any>(null);

    useEffect(() => {
        if (!mapLoaded || !mapRef.current) return;

        if (!mapInstance.current) {
            mapInstance.current = new window.google.maps.Map(mapRef.current, {
                center: { lat: 20.5937, lng: 78.9629 }, // Default center
                zoom: 5,
                mapTypeId: 'satellite',
            });
        }

        const map = mapInstance.current;

        if (markerClusterer.current) {
            markerClusterer.current.clearMarkers();
        }

        if (stats.mapPoints.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            
            const markers = stats.mapPoints.map(p => {
                const marker = new window.google.maps.Marker({
                    position: { lat: p.y, lng: p.x },
                    title: p.name
                });

                const infoWindow = new window.google.maps.InfoWindow({
                    content: `
                        <div style="padding: 8px; font-family: sans-serif;">
                            <strong style="font-size: 14px;">${p.name}</strong><br/>
                            <span style="font-size: 12px; color: #666;">${p.hhId}</span><br/>
                            <span style="font-size: 12px;">${p.village}, ${p.gp}</span><br/>
                            <span style="font-size: 12px; color: #4f46e5;">Cluster: ${p.cluster}</span>
                        </div>
                    `
                });

                marker.addListener('click', () => {
                    infoWindow.open(map, marker);
                });

                bounds.extend({ lat: p.y, lng: p.x });
                return marker;
            });

            markerClusterer.current = new MarkerClusterer({ markers, map });

            if (stats.mapPoints.length > 1) {
                map.fitBounds(bounds);
            } else {
                map.setCenter({ lat: stats.mapPoints[0].y, lng: stats.mapPoints[0].x });
                map.setZoom(12);
            }
        }
    }, [mapLoaded, stats.mapPoints]);

    const clusters = useMemo(() => ['All', ...Array.from(new Set(data.map(d => d.cluster)))], [data]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-medium text-gray-500">Loading Farmpond Data...</p>
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <p className="text-lg font-bold text-gray-900 mb-2">Sync Error</p>
            <p className="text-sm text-gray-500 max-w-md">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-sm">Retry</button>
        </div>
    );

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Eco-farmpond Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1">Project Monitoring & Contribution Analysis</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <button 
                        onClick={() => fetchData()}
                        disabled={loading}
                        className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    {user?.isAdmin && (
                        <button 
                            onClick={() => setIsPhotoModalOpen(true)}
                            className="flex items-center gap-2 bg-indigo-600 px-4 py-2 rounded-lg text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                        >
                            <Camera className="w-4 h-4" />
                            Add Photo
                        </button>
                    )}

                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                        <Search className="w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search beneficiary..." 
                            className="bg-transparent border-none focus:ring-0 text-sm w-full md:w-48"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <select 
                            className="bg-transparent border-none focus:ring-0 text-sm cursor-pointer"
                            value={selectedCluster}
                            onChange={(e) => setSelectedCluster(e.target.value)}
                        >
                            {clusters.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <Target className="w-5 h-5 text-indigo-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-500">Total Target</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{stats.target}</div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-50 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-500">Achieved</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{stats.achieved}</div>
                    <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                            style={{ width: `${(stats.achieved / stats.target) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-amber-50 rounded-lg">
                            <IndianRupee className="w-5 h-5 text-amber-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-500">Total Contribution</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">₹{stats.totalContribution.toLocaleString()}</div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-500">Beneficiaries</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{filteredData.length}</div>
                </div>
            </div>

            {/* Charts & Map Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cluster Distribution */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:col-span-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <PieChartIcon className="w-5 h-5 text-indigo-600" />
                        Cluster Distribution
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.clusterDist}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.clusterDist.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Map Section */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Globe className="w-5 h-5 text-indigo-600" />
                            Live Beneficiary Map
                        </h3>
                    </div>
                    <div className="relative rounded-lg overflow-hidden border border-gray-200">
                        <div 
                            ref={mapRef} 
                            className="w-full h-[300px] bg-gray-100"
                        />
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-900">Beneficiary Details</h3>
                    <span className="text-xs font-medium px-2.5 py-1 bg-white border border-gray-200 text-gray-600 rounded-md">
                        {filteredData.length} Records
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">HH ID</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Cluster</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">GP / Village</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Contribution</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">Photo</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">Location</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <span className="text-sm font-medium text-indigo-600">{row.hhId}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-gray-900">{row.name}</span>
                                            <span className="text-xs text-gray-500">Age: {row.age}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-medium px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md">
                                            {row.cluster}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="text-sm text-gray-900">{row.gp}</span>
                                            <span className="text-xs text-gray-500">{row.village}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`text-sm font-medium ${row.contribution ? 'text-emerald-600' : 'text-gray-400'}`}>
                                            {row.contribution ? `₹${row.contribution.toLocaleString()}` : '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex justify-center">
                                            {row.photo ? (
                                                <a 
                                                    href={row.photo}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block w-10 h-10 rounded-md overflow-hidden border border-gray-200 hover:border-indigo-500 transition-colors"
                                                >
                                                    <img 
                                                        src={getGoogleDriveThumbnail(row.photo)} 
                                                        alt="Farmer" 
                                                        className="w-full h-full object-cover"
                                                        referrerPolicy="no-referrer"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                        }}
                                                    />
                                                    <div className="hidden w-full h-full bg-gray-100 flex items-center justify-center">
                                                        <Camera className="w-4 h-4 text-gray-400" />
                                                    </div>
                                                </a>
                                            ) : (
                                                <span className="text-xs text-gray-400">No Photo</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex justify-center">
                                            {row.lat !== 0 && row.lng !== 0 ? (
                                                <a 
                                                    href={`https://www.google.com/maps?q=${row.lat},${row.lng}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                                >
                                                    <MapPin className="w-4 h-4" />
                                                </a>
                                            ) : (
                                                <span className="text-xs text-gray-400">N/A</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isPhotoModalOpen && (
                <AddFarmpondPhotoModal 
                    data={data}
                    onClose={() => setIsPhotoModalOpen(false)}
                    onSuccess={() => {
                        fetchData();
                    }}
                />
            )}
        </div>
    );
};

export default EcoFarmpondPage;
