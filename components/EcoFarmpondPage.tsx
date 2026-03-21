
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { 
    Search, Filter, PieChart as PieChartIcon, 
    Target, TrendingUp, Users, DollarSign, MapPin, Globe, Camera, RefreshCw,
    ChevronDown, ChevronUp, Info
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

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#f97316'];

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
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
                const key = h.trim() || `COL_${i}`; // Handle empty headers
                obj[key] = vals[i] || '';
            });
            return obj;
        });
    };

    const normalizeId = (id: any): string => {
        if (!id) return '';
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
            // Using the thumbnail endpoint is more reliable for small previews
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

            // Map contributions by HH_id (FARMERID in contrib sheet)
            const contribMap = new Map<string, number>();
            rawContribs.forEach(row => {
                const rawId = getFuzzyValue(row, ['FARMERID', 'FID', 'ID', 'FARMER ID', 'HH_id', 'HH ID', 'HHID']);
                const normId = normalizeId(rawId);
                
                // Find ECO-FARMPOND column
                const pondCol = Object.keys(row).find(k => k.toUpperCase().includes('ECO-FARMPOND') || k.toUpperCase().includes('FARMPOND'));
                
                if (normId && pondCol) {
                    const amount = parseFloat(row[pondCol].toString().replace(/[^0-9.]/g, '')) || 0;
                    if (amount > 0) {
                        // Accumulate if multiple entries (though usually one per farmer in this context)
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
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) return;

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
        
        // Cluster distribution
        const clusterMap: Record<string, number> = {};
        filteredData.forEach(d => {
            clusterMap[d.cluster] = (clusterMap[d.cluster] || 0) + 1;
        });
        const clusterDist = Object.entries(clusterMap).map(([name, value]) => ({ name, value }));

        // Map data
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
    useEffect(() => {
        if (mapLoaded && mapRef.current && stats.mapPoints.length > 0) {
            const map = new window.google.maps.Map(mapRef.current, {
                center: { lat: stats.mapPoints[0].y, lng: stats.mapPoints[0].x },
                zoom: 12,
                mapTypeId: 'satellite',
                disableDefaultUI: false,
                zoomControl: true,
                mapTypeControl: true,
                scaleControl: true,
                streetViewControl: false,
                rotateControl: true,
                fullscreenControl: true
            });

            const bounds = new window.google.maps.LatLngBounds();
            
            const markers = stats.mapPoints.map(p => {
                const marker = new window.google.maps.Marker({
                    position: { lat: p.y, lng: p.x },
                    title: p.name
                });

                const infoWindow = new window.google.maps.InfoWindow({
                    content: `
                        <div style="padding: 12px; font-family: 'Inter', sans-serif; min-width: 180px;">
                            <p style="font-size: 10px; font-weight: 900; color: #6366f1; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">${p.hhId}</p>
                            <p style="font-size: 14px; font-weight: 800; color: #1e293b; margin: 4px 0;">${p.name}</p>
                            <div style="margin-top: 8px; border-top: 1px solid #f1f5f9; padding-top: 8px; display: flex; flex-direction: column; gap: 4px;">
                                <p style="font-size: 11px; color: #64748b; margin: 0; display: flex; justify-content: space-between;"><span style="font-weight: 900; text-transform: uppercase; font-size: 9px; opacity: 0.6;">Village:</span> <span style="font-weight: 600;">${p.village}</span></p>
                                <p style="font-size: 11px; color: #64748b; margin: 0; display: flex; justify-content: space-between;"><span style="font-weight: 900; text-transform: uppercase; font-size: 9px; opacity: 0.6;">GP:</span> <span style="font-weight: 600;">${p.gp}</span></p>
                                <p style="font-size: 11px; color: #6366f1; margin: 0; display: flex; justify-content: space-between;"><span style="font-weight: 900; text-transform: uppercase; font-size: 9px; opacity: 0.6;">Cluster:</span> <span style="font-weight: 700;">${p.cluster}</span></p>
                            </div>
                        </div>
                    `
                });

                marker.addListener('click', () => {
                    infoWindow.open(map, marker);
                });

                bounds.extend({ lat: p.y, lng: p.x });
                return marker;
            });

            // Add Marker Clustering
            new MarkerClusterer({ markers, map });

            if (stats.mapPoints.length > 1) {
                map.fitBounds(bounds);
            }
        }
    }, [mapLoaded, stats.mapPoints]);

    const clusters = useMemo(() => ['All', ...Array.from(new Set(data.map(d => d.cluster)))], [data]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">Loading Farmpond Data...</p>
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <p className="text-sm font-black uppercase tracking-widest text-gray-900 mb-2">Sync Error</p>
            <p className="text-xs text-gray-500 max-w-xs">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg">Retry</button>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Eco-farmpond Dashboard</h1>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Project Monitoring & Contribution Analysis</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4">
                        <button 
                            onClick={() => fetchData()}
                            disabled={loading}
                            className="p-2 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>

                        {user?.isAdmin && (
                            <button 
                                onClick={() => setIsPhotoModalOpen(true)}
                                className="flex items-center gap-2 bg-indigo-600 px-6 py-2 rounded-2xl text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                            >
                                <Camera className="w-4 h-4" />
                                Add Photo
                            </button>
                        )}

                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto">
                            <Search className="w-4 h-4 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search beneficiary..." 
                                className="bg-transparent border-none focus:ring-0 text-xs font-bold w-full md:w-48"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto">
                            <Filter className="w-4 h-4 text-slate-400" />
                            <select 
                                className="bg-transparent border-none focus:ring-0 text-xs font-bold cursor-pointer"
                                value={selectedCluster}
                                onChange={(e) => setSelectedCluster(e.target.value)}
                            >
                                {clusters.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-indigo-50 rounded-2xl">
                                <Target className="w-6 h-6 text-indigo-600" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Target</span>
                        </div>
                        <div className="text-3xl font-black text-gray-900">{stats.target}</div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-emerald-50 rounded-2xl">
                                <TrendingUp className="w-6 h-6 text-emerald-600" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Achieved</span>
                        </div>
                        <div className="text-3xl font-black text-emerald-600">{stats.achieved}</div>
                        <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                style={{ width: `${(stats.achieved / stats.target) * 100}%` }}
                            />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-amber-50 rounded-2xl">
                                <DollarSign className="w-6 h-6 text-amber-600" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Contribution</span>
                        </div>
                        <div className="text-3xl font-black text-amber-600">₹{stats.totalContribution.toLocaleString()}</div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-slate-50 rounded-2xl">
                                <Users className="w-6 h-6 text-slate-600" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Beneficiaries</span>
                        </div>
                        <div className="text-3xl font-black text-gray-900">{filteredData.length}</div>
                    </div>
                </div>

                {/* Cluster Distribution Section */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm mb-8">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="w-full md:w-1/3">
                            <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 mb-6 flex items-center gap-2">
                                <PieChartIcon className="w-4 h-4 text-indigo-500" />
                                Cluster Distribution
                            </h3>
                            <div className="space-y-3">
                                {stats.clusterDist.map((c, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}></div>
                                            <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">{c.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-slate-900">{c.value}</span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">Farmers</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="w-full md:w-2/3 h-64 md:h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.clusterDist}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={8}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {stats.clusterDist.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}
                                        cursor={{ fill: 'transparent' }}
                                    />
                                    <Legend 
                                        verticalAlign={windowWidth < 768 ? "bottom" : "middle"} 
                                        align={windowWidth < 768 ? "center" : "right"} 
                                        layout={windowWidth < 768 ? "horizontal" : "vertical"}
                                        iconType="circle"
                                        formatter={(value) => <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Map Section */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8 relative">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <Globe className="w-5 h-5 text-indigo-600" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-gray-900">Live Beneficiary Map</h3>
                        </div>
                        <span className="text-[10px] font-black px-3 py-1 bg-indigo-100 text-indigo-600 rounded-full uppercase tracking-widest">
                            Satellite View
                        </span>
                    </div>
                    
                    <div className="relative">
                        <div 
                            ref={mapRef} 
                            className="h-[400px] md:h-[600px] w-full bg-slate-100"
                        />
                        
                        {!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 backdrop-blur-sm z-20">
                                <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-200 text-center max-w-md">
                                    <MapPin className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
                                    <h4 className="text-lg font-black text-gray-900 mb-2">Google Maps API Key Required</h4>
                                    <p className="text-xs text-gray-500 font-medium leading-relaxed mb-6">
                                        To view the satellite GPS map, please provide your Google Maps API key in the environment variables.
                                    </p>
                                    <div className="bg-slate-50 p-4 rounded-2xl text-left">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Setup Instructions:</p>
                                        <ol className="text-[10px] text-slate-600 space-y-1 font-medium list-decimal pl-4">
                                            <li>Go to Google Cloud Console</li>
                                            <li>Enable Maps JavaScript API</li>
                                            <li>Create an API Key</li>
                                            <li>Add <code className="bg-slate-200 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code> to your settings</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Data Table / Mobile List */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-900">Beneficiary Details</h3>
                        <span className="text-[10px] font-black px-3 py-1 bg-slate-100 text-slate-500 rounded-full uppercase tracking-widest">
                            {filteredData.length} Records
                        </span>
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">HH ID</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Name</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cluster</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">GP / Village</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Contribution</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Photo</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Location</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-black text-indigo-600 font-mono">{row.hhId}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-900">{row.name}</span>
                                                <span className="text-[10px] text-slate-400">Age: {row.age}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-[10px] font-black px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg uppercase tracking-wider">
                                                {row.cluster}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-medium text-slate-600">{row.gp}</span>
                                                <span className="text-[10px] text-slate-400">{row.village}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`text-xs font-black ${row.contribution ? 'text-emerald-600' : 'text-slate-300'}`}>
                                                {row.contribution ? `₹${row.contribution.toLocaleString()}` : '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center">
                                                {row.photo ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <a 
                                                            href={row.photo}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="group relative"
                                                        >
                                                            <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-indigo-100 group-hover:border-indigo-500 transition-all">
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
                                                                <div className="hidden w-full h-full bg-indigo-50 flex items-center justify-center">
                                                                    <Camera className="w-4 h-4 text-indigo-400" />
                                                                </div>
                                                            </div>
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-black text-slate-300 uppercase">No Photo</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center">
                                                {row.lat !== 0 && row.lng !== 0 ? (
                                                    <a 
                                                        href={`https://www.google.com/maps?q=${row.lat},${row.lng}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 bg-slate-100 text-slate-400 hover:bg-indigo-600 hover:text-white rounded-xl transition-all"
                                                    >
                                                        <MapPin className="w-4 h-4" />
                                                    </a>
                                                ) : (
                                                    <span className="text-[10px] font-black text-slate-300 uppercase">N/A</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile List View */}
                    <div className="md:hidden divide-y divide-slate-100">
                        {filteredData.map((row, idx) => (
                            <div key={idx} className="p-4 bg-white">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded">
                                                {row.hhId}
                                            </span>
                                            <h4 className="text-sm font-bold text-slate-900">{row.name}</h4>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                                            <MapPin className="w-3 h-3" />
                                            <span>{row.village}, {row.gp}</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setExpandedId(expandedId === row.hhId ? null : row.hhId)}
                                        className={`p-2 rounded-xl transition-all ${expandedId === row.hhId ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}
                                    >
                                        {expandedId === row.hhId ? <ChevronUp className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                                    </button>
                                </div>

                                {/* Expanded Content */}
                                {expandedId === row.hhId && (
                                    <div className="mt-4 pt-4 border-t border-slate-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div className="bg-slate-50 p-3 rounded-2xl">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Cluster</p>
                                                <p className="text-xs font-bold text-slate-700">{row.cluster}</p>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-2xl">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Contribution</p>
                                                <p className="text-xs font-black text-emerald-600">
                                                    {row.contribution ? `₹${row.contribution.toLocaleString()}` : '₹0'}
                                                </p>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-2xl">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Age</p>
                                                <p className="text-xs font-bold text-slate-700">{row.age || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-2xl">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Location</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs font-bold text-slate-700">
                                                        {row.lat !== 0 ? 'GPS Ready' : 'No GPS'}
                                                    </p>
                                                    {row.lat !== 0 && (
                                                        <a 
                                                            href={`https://www.google.com/maps?q=${row.lat},${row.lng}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1 bg-indigo-600 text-white rounded-md"
                                                        >
                                                            <MapPin className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {row.photo && (
                                            <div className="relative rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                                                <img 
                                                    src={getGoogleDriveThumbnail(row.photo)} 
                                                    alt={row.name}
                                                    className="w-full h-48 object-cover"
                                                    referrerPolicy="no-referrer"
                                                />
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                                                    <a 
                                                        href={row.photo}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-center gap-2 bg-white/20 backdrop-blur-md border border-white/30 py-2 rounded-xl text-white text-[10px] font-black uppercase tracking-widest"
                                                    >
                                                        <Camera className="w-3 h-3" />
                                                        View Full Image
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {isPhotoModalOpen && (
                <AddFarmpondPhotoModal 
                    data={data}
                    onClose={() => setIsPhotoModalOpen(false)}
                    onSuccess={() => {
                        fetchData(); // Refresh data to show new photo link if available
                    }}
                />
            )}
        </div>
    );
};

export default EcoFarmpondPage;
