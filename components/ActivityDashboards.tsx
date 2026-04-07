
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
    Search, PieChart as PieChartIcon, 
    TrendingUp, Users, IndianRupee, Globe, Camera, RefreshCw,
    ChevronDown, LayoutDashboard, ExternalLink, Loader2, ArrowLeft,
    Download
} from 'lucide-react';
import { 
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip, 
    Legend
} from 'recharts';
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { BENEFICIARY_DATA_URL, CONTRIBUTION_DATA_URL } from '../config';
import ActivityPhotoUploadModal from './ActivityPhotoUploadModal';

declare global {
  interface Window {
    google: any;
  }
}

interface BeneficiaryRecord {
    hhId: string;
    name: string;
    activity: string;
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

interface ActivityDashboardsProps {
    onBack?: () => void;
}

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#f97316'];

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

const normalizeActivity = (act: string) => {
    const upper = (act || '').trim().toUpperCase();
    if (upper.includes('GOAT')) return 'Goatery';
    return act.trim();
};

const normalizeId = (id: any): string => {
    if (!id) return '';
    const str = id.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^\d+$/.test(str)) {
        return parseInt(str, 10).toString();
    }
    return str;
};

const ActivityDashboardContent: React.FC<{ 
    data: BeneficiaryRecord[]; 
    onRefresh: (url?: string, hhId?: string) => void;
}> = ({ data, onRefresh }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [selectedCluster, setSelectedCluster] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBeneficiary, setSelectedBeneficiary] = useState<BeneficiaryRecord | null>(null);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

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
            // Use a small timeout to avoid synchronous setState in effect
            const timer = setTimeout(() => setMapLoaded(true), 0);
            return () => clearTimeout(timer);
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
                lat: d.lat,
                lng: d.lng,
                name: d.name,
                village: d.village,
                gp: d.gp,
                cluster: d.cluster,
                hhId: d.hhId
            }));

        return { achieved, totalContribution, clusterDist, mapPoints };
    }, [filteredData]);

    // Initialize Map
    const mapInstance = useRef<any>(null);
    const markerClusterer = useRef<any>(null);

    useEffect(() => {
        if (!mapLoaded || !mapRef.current) return;

        if (!mapInstance.current) {
            mapInstance.current = new window.google.maps.Map(mapRef.current, {
                center: { lat: 20.5937, lng: 78.9629 },
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
                const position = { lat: p.lat, lng: p.lng };
                bounds.extend(position);
                
                const marker = new window.google.maps.Marker({
                    position,
                    map,
                    title: p.name,
                });

                const infoWindow = new window.google.maps.InfoWindow({
                    content: `
                        <div style="padding: 8px; font-family: sans-serif;">
                            <p style="font-weight: 900; font-size: 12px; margin: 0; color: #4f46e5;">${p.name}</p>
                            <p style="font-size: 10px; color: #6b7280; margin: 4px 0;">ID: ${p.hhId}</p>
                            <p style="font-size: 10px; color: #374151; margin: 0;">${p.village}, ${p.gp}</p>
                        </div>
                    `
                });

                marker.addListener('click', () => {
                    infoWindow.open(map, marker);
                });

                return marker;
            });

            markerClusterer.current = new MarkerClusterer({ map, markers });
            map.fitBounds(bounds);
        }
    }, [mapLoaded, stats.mapPoints]);

    const clusters = useMemo(() => ['All', ...Array.from(new Set(data.map(d => d.cluster))).sort()], [data]);

    const downloadCSV = () => {
        const headers = ['HH ID', 'Name', 'Activity', 'GP', 'Village', 'Age', 'Ben ID', 'Cluster', 'Contribution', 'Lat', 'Lng', 'Photo'];
        const csvContent = [
            headers.join(','),
            ...filteredData.map(d => [
                `"${d.hhId}"`, `"${d.name}"`, `"${d.activity}"`, `"${d.gp}"`, `"${d.village}"`, 
                `"${d.age}"`, `"${d.benId}"`, `"${d.cluster}"`, d.contribution || 0,
                d.lat, d.lng, `"${d.photo}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `activity_report_${data[0]?.activity || 'data'}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-4 md:space-y-6 p-2 md:p-4">
            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 flex items-center gap-3 md:gap-4">
                    <div className="p-3 md:p-4 bg-indigo-50 dark:bg-indigo-900/40 rounded-xl md:rounded-2xl text-indigo-600">
                        <Users className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div>
                        <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Beneficiaries</p>
                        <p className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">{stats.achieved}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 flex items-center gap-3 md:gap-4">
                    <div className="p-3 md:p-4 bg-emerald-50 dark:bg-emerald-900/40 rounded-xl md:rounded-2xl text-emerald-600">
                        <IndianRupee className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div>
                        <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Contribution</p>
                        <p className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">₹{stats.totalContribution.toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 flex items-center gap-3 md:gap-4">
                    <div className="p-3 md:p-4 bg-amber-50 dark:bg-amber-900/40 rounded-xl md:rounded-2xl text-amber-600">
                        <Globe className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div>
                        <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Mapped Locations</p>
                        <p className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">{stats.mapPoints.length}</p>
                    </div>
                </div>
            </div>

            {/* Charts & Map */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                            <PieChartIcon className="w-4 h-4 text-indigo-600" />
                            Cluster Distribution
                        </h3>
                    </div>
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
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                                />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-2 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden min-h-[300px]">
                    <div ref={mapRef} className="w-full h-full min-h-[300px] rounded-2xl" />
                </div>
            </div>

            {/* Table & Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by ID or Name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                        <button 
                            onClick={downloadCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm mr-2"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Export
                        </button>
                        {clusters.map(c => {
                            const count = c === 'All' ? stats.achieved : (stats.clusterDist.find(d => d.name === c)?.value || 0);
                            return (
                                <button
                                    key={c}
                                    onClick={() => setSelectedCluster(c)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${
                                        selectedCluster === c 
                                        ? 'bg-indigo-600 text-white shadow-lg' 
                                        : 'bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100'
                                    }`}
                                >
                                    {c}
                                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${selectedCluster === c ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50">
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Beneficiary</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Location</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Contribution</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Media</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {filteredData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{row.name}</p>
                                        <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-0.5">{row.hhId}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase">{row.village}</p>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">{row.gp} • {row.cluster}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black">
                                            ₹{row.contribution?.toLocaleString() || 0}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {row.photo ? (
                                            <a 
                                                href={row.photo} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 transition-colors"
                                            >
                                                <div className="w-8 h-8 rounded-lg overflow-hidden border border-indigo-100">
                                                    <img src={row.photo} alt="Activity" className="w-full h-full object-cover" />
                                                </div>
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        ) : (
                                            <span className="text-[9px] font-black text-gray-300 uppercase italic">No Photo</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => {
                                                setSelectedBeneficiary(row);
                                                setIsPhotoModalOpen(true);
                                            }}
                                            className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                        >
                                            <Camera className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isPhotoModalOpen && selectedBeneficiary && (
                <ActivityPhotoUploadModal 
                    beneficiary={selectedBeneficiary}
                    onClose={() => setIsPhotoModalOpen(false)}
                    onSuccess={(url) => onRefresh(url, selectedBeneficiary.hhId)}
                />
            )}
        </div>
    );
};

const ActivityDashboards: React.FC<ActivityDashboardsProps> = ({ onBack }) => {
    const [data, setData] = useState<BeneficiaryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedActivity, setExpandedActivity] = useState<string | null>(null);

    const parseCSV = (csv: string): any[] => {
        const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 1) return [];
        
        const rawHeaders = parseLine(lines[0]);
        const normalize = (h: string) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        const normalizedHeaders = rawHeaders.map(normalize);

        const getVal = (row: string[], search: string) => {
            const searchNorm = normalize(search);
            let idx = normalizedHeaders.findIndex(h => h === searchNorm);
            if (idx === -1) {
                idx = normalizedHeaders.findIndex(h => h.includes(searchNorm));
            }
            return idx !== -1 ? row[idx] : '';
        };
        
        const beneficiaries = lines.slice(1).map(line => {
            const vals = parseLine(line);
            return {
                hhId: getVal(vals, 'Farmer ID') || getVal(vals, 'HH_id') || getVal(vals, 'HH ID') || getVal(vals, 'HHID') || '',
                name: getVal(vals, 'Beneficiary name') || getVal(vals, 'Farmer Name') || getVal(vals, 'Name') || '',
                activity: normalizeActivity((getVal(vals, 'Activity') || getVal(vals, 'activity') || '').trim().replace(/^(BYP-|BFE-|AFT-)/, '')),
                gp: getVal(vals, 'GP') || getVal(vals, 'Beneficiary_GP') || '',
                village: getVal(vals, 'Village') || getVal(vals, 'Beneficiary_village') || '',
                age: getVal(vals, 'Age') || getVal(vals, 'Beneficiary_age') || '',
                benId: getVal(vals, 'Ben_id') || getVal(vals, 'ID') || '',
                cluster: getVal(vals, 'Cluster') || getVal(vals, 'cluster') || 'Unknown',
                lat: parseFloat(getVal(vals, 'Lat') || getVal(vals, 'Latitude')) || 0,
                lng: parseFloat(getVal(vals, 'long') || getVal(vals, 'Longitude') || getVal(vals, 'Lng')) || 0,
                photo: getVal(vals, 'Photo_link') || getVal(vals, 'Photo') || getVal(vals, 'Image') || getVal(vals, 'Picture') || getVal(vals, 'PhotoLink') || '',
            };
        }).filter(b => b.hhId && b.activity);

        // Deduplicate by normalized hhId and activity to prevent double-counting contributions
        const uniqueBens = new Map<string, any>();
        beneficiaries.forEach(b => {
            const normId = normalizeId(b.hhId);
            const key = `${normId}-${b.activity.toUpperCase()}`;
            if (!uniqueBens.has(key)) {
                uniqueBens.set(key, b);
            }
        });

        return Array.from(uniqueBens.values());
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [benRes, contribRes] = await Promise.all([
                fetch(`${BENEFICIARY_DATA_URL}&cb=${Date.now()}`),
                fetch(`${CONTRIBUTION_DATA_URL}&cb=${Date.now()}`)
            ]);

            if (!benRes.ok || !contribRes.ok) throw new Error("Failed to fetch data.");

            const benText = await benRes.text();
            const contribText = await contribRes.text();

            const parsedBens = parseCSV(benText);
            
            const rawContribs = (csv: string) => {
                const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
                if (lines.length < 1) return [];
                const headers = parseLine(lines[0]).map(h => h.trim().toUpperCase());
                return lines.slice(1).map(line => {
                    const vals = parseLine(line);
                    const obj: any = {};
                    headers.forEach((h, i) => obj[h] = vals[i] || '');
                    return obj;
                });
            };
            const parsedContribs = rawContribs(contribText);

            const contribMap = new Map<string, Record<string, number>>();
            parsedContribs.forEach(row => {
                const hhId = row['FARMERID'] || row['FID'] || row['ID'] || row['FARMER ID'] || row['HHID'] || row['HH ID'] || row['HH_ID'];
                if (hhId) {
                    const normId = normalizeId(hhId);
                    const current = contribMap.get(normId) || {};
                    const idHeaders = [
                        'FARMERID', 'FID', 'ID', 'FARMER ID', 'HHID', 'HH ID', 'HH_ID', 
                        'BENID', 'BEN_ID', 'FARMER_ID', 'DATE', 'TIMESTAMP', 'TIME', 
                        'SUBMISSIONDATE', 'VILLAGE', 'GP', 'CLUSTER', 'NAME', 'FARMER NAME',
                        'HHHEADNAME', 'BENEFICIARYNAME', 'CASTE', 'CATEGORY'
                    ];
                    Object.entries(row).forEach(([key, val]) => {
                        const kUpper = key.toUpperCase();
                        if (!idHeaders.includes(kUpper)) {
                            const amount = parseFloat((val?.toString() || '').replace(/[^0-9.]/g, '') || '0') || 0;
                            if (amount > 0) {
                                current[key] = (current[key] || 0) + amount;
                            }
                        }
                    });
                    contribMap.set(normId, current);
                }
            });

            const finalData = parsedBens.map(b => {
                const normId = normalizeId(b.hhId);
                const userContribs = contribMap.get(normId) || {};
                
                // Find contribution matching activity
                const activityUpper = b.activity.toUpperCase();
                const isGoatActivity = activityUpper.includes('GOAT');
                
                const activityKey = Object.keys(userContribs).find(k => {
                    const keyUpper = k.toUpperCase();
                    const isKeyGoat = keyUpper.includes('GOAT');
                    
                    // Match if keys are similar or both are goat-related
                    return keyUpper.includes(activityUpper) || 
                           activityUpper.includes(keyUpper) || 
                           (isGoatActivity && isKeyGoat);
                });
                
                const contribution = activityKey ? userContribs[activityKey] : 0;

                return { ...b, contribution };
            });

            setData(finalData);
        } catch (err: any) {
            console.error("Fetch error:", err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRefresh = (newPhotoUrl?: string, hhId?: string) => {
        if (newPhotoUrl && hhId) {
            setData(prev => prev.map(b => 
                b.hhId === hhId ? { ...b, photo: newPhotoUrl } : b
            ));
            // Delay fetchData to allow spreadsheet to update and avoid immediate overwrite with cached old data
            setTimeout(() => fetchData(), 5000);
        } else {
            fetchData();
        }
    };

    const activities = useMemo(() => {
        const unique = Array.from(new Set(data.map(d => d.activity))).sort();
        return unique;
    }, [data]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] animate-pulse">Synchronizing Activity Dashboards...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            {onBack && (
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 transition-colors mb-4 group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Dashboards
                </button>
            )}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">
                        Activity Dashboards
                    </h1>
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                        <LayoutDashboard className="w-3 h-3" />
                        Unified Project Monitoring System
                    </p>
                </div>
                <button 
                    onClick={fetchData}
                    className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 hover:scale-110 active:rotate-180 transition-all duration-500 group"
                >
                    <RefreshCw className="w-5 h-5 text-indigo-600 group-hover:animate-spin" />
                </button>
            </div>

            <div className="space-y-4">
                {activities.map((activity) => {
                    const activityData = data.filter(d => d.activity === activity);
                    const isExpanded = expandedActivity === activity;

                    return (
                        <div 
                            key={activity}
                            className={`bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl border transition-all duration-500 overflow-hidden ${
                                isExpanded 
                                ? 'border-indigo-500 ring-4 ring-indigo-500/10' 
                                : 'border-gray-100 dark:border-gray-800 hover:border-indigo-200'
                            }`}
                        >
                            <button
                                onClick={() => setExpandedActivity(isExpanded ? null : activity)}
                                className="w-full flex items-center justify-between p-8 text-left group"
                            >
                                <div className="flex items-center gap-6">
                                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-500 ${
                                        isExpanded ? 'bg-indigo-600 text-white rotate-12' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 group-hover:rotate-12'
                                    }`}>
                                        <TrendingUp className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{activity}</h2>
                                        <div className="flex items-center gap-4 mt-1">
                                            <span className="flex items-center gap-1 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                                <Users className="w-3 h-3" />
                                                {activityData.length} Beneficiaries
                                            </span>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                            <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                                <IndianRupee className="w-3 h-3" />
                                                ₹{activityData.reduce((sum, d) => sum + (d.contribution || 0), 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`p-4 rounded-2xl transition-all duration-500 ${isExpanded ? 'bg-indigo-600 text-white rotate-180' : 'bg-gray-50 dark:bg-gray-800 text-gray-400'}`}>
                                    <ChevronDown className="w-6 h-6" />
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="border-t border-gray-50 dark:border-gray-800 animate-in slide-in-from-top-4 duration-500">
                                    <ActivityDashboardContent 
                                        data={activityData} 
                                        onRefresh={handleRefresh}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ActivityDashboards;
