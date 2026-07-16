
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
    Search, PieChart as PieChartIcon, 
    TrendingUp, Users, IndianRupee, Globe, Camera, RefreshCw,
    ChevronDown, LayoutDashboard, ExternalLink, Loader2, ArrowLeft,
    Download, X
} from 'lucide-react';
import { 
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip, 
    Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { BENEFICIARY_DATA_URL, CONTRIBUTION_DATA_URL, CROPS_DATA_URL, CROPS_MATERIAL_TARGETS_URL, ASSET_DISTRIBUTION_URL, BIO_INPUTS_DATA_URL, HARVEST_DATA_URL, getProxyUrl } from '../config';
import ActivityPhotoUploadModal from './ActivityPhotoUploadModal';

declare global {
  interface Window {
    google: any;
  }
}

interface CropRecord {
    hhId: string;
    cropType: string;
    extent: number;
    sowingDate: string;
    soilType: string;
    irrigationSource: string;
    cropModel: string;
    mainCrop: string;
    interCrops: string;
    area: string;
    season: string;
}

interface BioInputRecord {
    date: string;
    type: string;
    photo: string;
    parentKey?: string;
}

interface HarvestRecord {
    date: string;
    yieldQty: string;
    photo: string;
    parentKey?: string;
    cropName?: string;
    yieldKgs?: number;
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
    cropDetails?: CropRecord[];
    materialsReceived?: Record<string, number>;
    materialTargets?: Record<string, number>;
    bioInputs?: BioInputRecord[];
    harvests?: HarvestRecord[];
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

const formatDriveUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com') || url.includes('google.com/open')) {
        const idMatch = url.match(/(?:id=|\/d\/|folders\/|file\/d\/|open\?id=)([-\w]{25,})/);
        if (idMatch) {
            return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1600`;
        }
    }
    return url;
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
    const [showCropDetails, setShowCropDetails] = useState<BeneficiaryRecord | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [chartFilter, setChartFilter] = useState<{ chart: string, category: string } | null>(null);

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

    const baseFilteredData = useMemo(() => {
        return data.filter(d => {
            const matchesCluster = selectedCluster === 'All' || d.cluster === selectedCluster;
            const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 d.hhId.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCluster && matchesSearch;
        });
    }, [data, selectedCluster, searchQuery]);

    const filteredData = useMemo(() => {
        return baseFilteredData.filter(d => {
            if (!chartFilter) return true;
            
            if (chartFilter.chart === 'cluster') {
                return d.cluster === chartFilter.category;
            } else if (chartFilter.chart === 'bio') {
                const hasBio = d.bioInputs && d.bioInputs.length > 0;
                return chartFilter.category === 'Data Received' ? !!hasBio : !hasBio;
            } else if (chartFilter.chart === 'harvest') {
                const hasHarvest = d.harvests && d.harvests.length > 0;
                return chartFilter.category === 'Data Received' ? !!hasHarvest : !hasHarvest;
            } else if (chartFilter.chart === 'expectedCrop') {
                return d.cropDetails && d.cropDetails.some(c => (c.mainCrop || 'UNKNOWN').toUpperCase() === chartFilter.category);
            } else if (chartFilter.chart === 'harvestedCrop') {
                return d.harvests && d.harvests.some(h => (h.cropName || 'UNKNOWN').toUpperCase() === chartFilter.category);
            }
            return true;
        });
    }, [baseFilteredData, chartFilter]);

    const stats = useMemo(() => {
        const achieved = baseFilteredData.length;
        const totalContribution = baseFilteredData.reduce((sum, d) => sum + (d.contribution || 0), 0);
        
        let bioInputsCount = 0;
        let harvestsCount = 0;
        baseFilteredData.forEach(d => {
            if (d.bioInputs && d.bioInputs.length > 0) bioInputsCount++;
            if (d.harvests && d.harvests.length > 0) harvestsCount++;
        });

        // Calculate total acres if this is the Crops dashboard
        const totalAcres = baseFilteredData.reduce((sum, d) => {
            const cropSum = d.cropDetails?.reduce((s, c) => s + (c.extent || 0), 0) || 0;
            return sum + cropSum;
        }, 0);

        const clusterMap: Record<string, number> = {};
        const cropYields: Record<string, number> = {};
        const cropAcres: Record<string, number> = {};

        baseFilteredData.forEach(d => {
            clusterMap[d.cluster] = (clusterMap[d.cluster] || 0) + 1;
            
            if (d.harvests) {
                d.harvests.forEach(h => {
                    const cname = h.cropName || 'UNKNOWN';
                    cropYields[cname.toUpperCase()] = (cropYields[cname.toUpperCase()] || 0) + (h.yieldKgs || 0);
                });
            }
            if (d.cropDetails) {
                d.cropDetails.forEach(c => {
                    const mname = c.mainCrop || 'UNKNOWN';
                    cropAcres[mname.toUpperCase()] = (cropAcres[mname.toUpperCase()] || 0) + (c.extent || 0);
                });
            }
        });
        
        const clusterDist = Object.entries(clusterMap).map(([name, value]) => ({ name, value }));
        
        const topExpectedCrops = Object.entries(cropAcres)
            .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8); // top 8 to fit in chart
            
        const topHarvestedCrops = Object.entries(cropYields)
            .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8); // top 8

        const mapPoints = filteredData
            .filter(d => d.lat !== 0 && d.lng !== 0)
            .map(d => ({
                lat: d.lat,
                lng: d.lng,
                name: d.name,
                village: d.village,
                gp: d.gp,
                cluster: d.cluster,
                hhId: d.hhId,
                benId: d.benId
            }));

        return { achieved, totalContribution, clusterDist, mapPoints, totalAcres, bioInputsCount, harvestsCount, topExpectedCrops, topHarvestedCrops };
    }, [baseFilteredData, filteredData]);

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
                        <div style="padding: 12px; font-family: 'Inter', sans-serif; min-width: 180px;">
                            <div style="margin-bottom: 8px;">
                                <p style="font-weight: 900; font-size: 14px; margin: 0; color: #111827; text-transform: uppercase;">${p.name}</p>
                                <p style="font-size: 10px; font-weight: 700; color: #4f46e5; margin: 2px 0; letter-spacing: 0.05em;">BEN ID: ${p.benId || 'N/A'}</p>
                                <p style="font-size: 10px; font-weight: 700; color: #6b7280; margin: 0; letter-spacing: 0.05em;">HH ID: ${p.hhId}</p>
                            </div>
                            <div style="padding-top: 8px; border-top: 1px solid #f3f4f6;">
                                <p style="font-size: 11px; font-weight: 800; color: #374151; margin: 0; text-transform: uppercase;">${p.village}</p>
                                <p style="font-size: 10px; font-weight: 600; color: #9ca3af; margin: 2px 0; text-transform: uppercase;">${p.gp} • ${p.cluster}</p>
                            </div>
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
        let csvContent = '';
        const isCrops = data[0]?.activity === 'crops';
        
        if (isCrops) {
            // Find all unique material names to create dynamic columns
            const materialSet = new Set<string>();
            filteredData.forEach(d => {
                if (d.materialsReceived) {
                    Object.keys(d.materialsReceived).forEach(k => materialSet.add(k));
                }
                if (d.materialTargets) {
                    Object.keys(d.materialTargets).forEach(k => materialSet.add(k));
                }
            });
            const materialHeaders = Array.from(materialSet).sort();
            
            const headers = [
                'Cluster', 'GP', 'Village', 'Beneficiary Name', 'HH ID', 'Ben ID', 
                'Main Crop', 'Extent', ...materialHeaders.flatMap(m => [`${m} (Target)`, `${m} (Issued)`])
            ];
            
            const rows: any[][] = [];
            filteredData.forEach(d => {
                const crops = d.cropDetails && d.cropDetails.length > 0 
                    ? d.cropDetails 
                    : [{ mainCrop: 'N/A', extent: 0 }];
                
                crops.forEach(c => {
                    const baseRow = [
                        `"${d.cluster}"`, `"${d.gp}"`, `"${d.village}"`, `"${d.name}"`, 
                        `"${d.hhId}"`, `"${d.benId}"`, `"${c.mainCrop || 'N/A'}"`, c.extent || 0
                    ];
                    
                    const materialRow = materialHeaders.flatMap(m => [d.materialTargets?.[m] || 0, d.materialsReceived?.[m] || 0]);
                    rows.push([...baseRow, ...materialRow]);
                });
            });
            
            csvContent = [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.join(','))].join('\n');
        } else {
            const headers = ['HH ID', 'Name', 'Activity', 'GP', 'Village', 'Age', 'Ben ID', 'Cluster', 'Contribution', 'Lat', 'Lng', 'Photo'];
            csvContent = [
                headers.join(','),
                ...filteredData.map(d => [
                    `"${d.hhId}"`, `"${d.name}"`, `"${d.activity}"`, `"${d.gp}"`, `"${d.village}"`, 
                    `"${d.age}"`, `"${d.benId}"`, `"${d.cluster}"`, d.contribution || 0,
                    d.lat, d.lng, `"${d.photo}"`
                ].join(','))
            ].join('\n');
        }

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg text-indigo-600">
                        <Users className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div>
                        <p className="text-[8px] md:text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Beneficiaries</p>
                        <p className="text-lg md:text-xl font-black text-gray-900 dark:text-white">{stats.achieved}</p>
                    </div>
                </div>

                {stats.totalAcres > 0 ? (
                    <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 flex items-center gap-2">
                        <div className="p-2 bg-amber-50 dark:bg-amber-900/40 rounded-lg text-amber-600">
                            <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <div>
                            <p className="text-[8px] md:text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Acres Covered</p>
                            <p className="text-lg md:text-xl font-black text-gray-900 dark:text-white">{stats.totalAcres.toFixed(2)} Ac</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 flex items-center gap-2">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/40 rounded-lg text-emerald-600">
                            <IndianRupee className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <div>
                            <p className="text-[8px] md:text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Contribution</p>
                            <p className="text-lg md:text-xl font-black text-gray-900 dark:text-white">₹{stats.totalContribution.toLocaleString()}</p>
                        </div>
                    </div>
                )}

                <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 flex items-center gap-2">
                    <div className="p-2 bg-amber-50 dark:bg-amber-900/40 rounded-lg text-amber-600">
                        <Globe className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div>
                        <p className="text-[8px] md:text-[9px] font-black text-gray-400 uppercase tracking-widest">Mapped Locations</p>
                        <p className="text-lg md:text-xl font-black text-gray-900 dark:text-white">{stats.mapPoints.length}</p>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className={`grid grid-cols-1 ${data[0]?.activity?.toLowerCase() === 'crops' ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-2 md:gap-3`}>
                <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-1.5">
                            <PieChartIcon className="w-3 h-3 text-indigo-600" />
                            Cluster Distribution
                        </h3>
                    </div>
                    <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.clusterDist}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={55}
                                    paddingAngle={5}
                                    dataKey="value"
                                    onClick={(data) => setChartFilter({ chart: 'cluster', category: data.name })}
                                    style={{ cursor: 'pointer' }}
                                    label={({ cx, cy, midAngle, innerRadius, outerRadius, value, index }) => {
                                        const RADIAN = Math.PI / 180;
                                        const radius = outerRadius + 10;
                                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                        return value > 0 ? (
                                            <text x={x} y={y} fill="currentColor" className="text-gray-600 dark:text-gray-300" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10} fontWeight="bold">
                                                {value}
                                            </text>
                                        ) : null;
                                    }}
                                    labelLine={false}
                                >
                                    {stats.clusterDist.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={CHART_COLORS[index % CHART_COLORS.length]} 
                                            opacity={chartFilter && (chartFilter.chart !== 'cluster' || chartFilter.category !== entry.name) ? 0.3 : 1}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                                    itemStyle={{ fontSize: '10px' }}
                                />
                                <Legend verticalAlign="bottom" height={20} iconSize={8} wrapperStyle={{ fontSize: '9px' }}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {data[0]?.activity?.toLowerCase() === 'crops' && (
                    <>
                        <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-1.5">
                                    <PieChartIcon className="w-3 h-3 text-emerald-600" />
                                    Bio Inputs Apply Data Status
                                </h3>
                            </div>
                            <div className="h-40">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Data Received', value: stats.bioInputsCount },
                                                { name: 'Pending', value: stats.achieved > stats.bioInputsCount ? stats.achieved - stats.bioInputsCount : 0 }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={40}
                                            outerRadius={55}
                                            paddingAngle={5}
                                            dataKey="value"
                                            onClick={(data) => setChartFilter({ chart: 'bio', category: data.name })}
                                            style={{ cursor: 'pointer' }}
                                            label={({ cx, cy, midAngle, innerRadius, outerRadius, value, index }) => {
                                                const RADIAN = Math.PI / 180;
                                                const radius = outerRadius + 10;
                                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                                return value > 0 ? (
                                                    <text x={x} y={y} fill="currentColor" className="text-gray-600 dark:text-gray-300" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10} fontWeight="bold">
                                                        {value}
                                                    </text>
                                                ) : null;
                                            }}
                                            labelLine={false}
                                        >
                                            <Cell fill="#10b981" opacity={chartFilter && (chartFilter.chart !== 'bio' || chartFilter.category !== 'Data Received') ? 0.3 : 1} />
                                            <Cell fill="#f3f4f6" opacity={chartFilter && (chartFilter.chart !== 'bio' || chartFilter.category !== 'Pending') ? 0.3 : 1} />
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} itemStyle={{ fontSize: '10px' }} />
                                        <Legend verticalAlign="bottom" height={20} iconSize={8} wrapperStyle={{ fontSize: '9px' }}/>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        
                        <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-1.5">
                                    <PieChartIcon className="w-3 h-3 text-amber-600" />
                                    Harvest Data Status
                                </h3>
                            </div>
                            <div className="h-40">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Data Received', value: stats.harvestsCount },
                                                { name: 'Pending', value: stats.achieved > stats.harvestsCount ? stats.achieved - stats.harvestsCount : 0 }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={40}
                                            outerRadius={55}
                                            paddingAngle={5}
                                            dataKey="value"
                                            onClick={(data) => setChartFilter({ chart: 'harvest', category: data.name })}
                                            style={{ cursor: 'pointer' }}
                                            label={({ cx, cy, midAngle, innerRadius, outerRadius, value, index }) => {
                                                const RADIAN = Math.PI / 180;
                                                const radius = outerRadius + 10;
                                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                                return value > 0 ? (
                                                    <text x={x} y={y} fill="currentColor" className="text-gray-600 dark:text-gray-300" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10} fontWeight="bold">
                                                        {value}
                                                    </text>
                                                ) : null;
                                            }}
                                            labelLine={false}
                                        >
                                            <Cell fill="#f59e0b" opacity={chartFilter && (chartFilter.chart !== 'harvest' || chartFilter.category !== 'Data Received') ? 0.3 : 1} />
                                            <Cell fill="#f3f4f6" opacity={chartFilter && (chartFilter.chart !== 'harvest' || chartFilter.category !== 'Pending') ? 0.3 : 1} />
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} itemStyle={{ fontSize: '10px' }} />
                                        <Legend verticalAlign="bottom" height={20} iconSize={8} wrapperStyle={{ fontSize: '9px' }}/>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Added Crops Insights Bar Charts */}
            {data[0]?.activity?.toLowerCase() === 'crops' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-3 mb-2 md:gap-3 mb-2 md:mb-3">
                    {stats.topExpectedCrops.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                    Top Crops by Area (Acres)
                                </h3>
                            </div>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.topExpectedCrops} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" className="dark:stroke-gray-700" />
                                        <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} />
                                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10, fill: '#374151', fontWeight: 600 }} />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 700 }}
                                            cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} 
                                        />
                                        <Bar 
                                            dataKey="value" 
                                            fill="#3b82f6" 
                                            radius={[0, 4, 4, 0]} 
                                            barSize={20} 
                                            onClick={(data) => setChartFilter({ chart: 'expectedCrop', category: data.name })}
                                            style={{ cursor: 'pointer' }}
                                            label={{ position: 'right', fill: '#3b82f6', fontSize: 10, fontWeight: 'bold' }} 
                                        >
                                            {stats.topExpectedCrops.map((entry, index) => (
                                                <Cell 
                                                    key={`cell-${index}`} 
                                                    opacity={chartFilter && (chartFilter.chart !== 'expectedCrop' || chartFilter.category !== entry.name) ? 0.3 : 1}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                    
                    {stats.topHarvestedCrops.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                    Top Harvested Crops (KG)
                                </h3>
                            </div>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.topHarvestedCrops} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" className="dark:stroke-gray-700" />
                                        <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} />
                                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10, fill: '#374151', fontWeight: 600 }} />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 700 }}
                                            cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }} 
                                        />
                                        <Bar 
                                            dataKey="value" 
                                            fill="#10b981" 
                                            radius={[0, 4, 4, 0]} 
                                            barSize={20} 
                                            onClick={(data) => setChartFilter({ chart: 'harvestedCrop', category: data.name })}
                                            style={{ cursor: 'pointer' }}
                                            label={{ position: 'right', fill: '#10b981', fontSize: 10, fontWeight: 'bold' }} 
                                        >
                                            {stats.topHarvestedCrops.map((entry, index) => (
                                                <Cell 
                                                    key={`cell-${index}`} 
                                                    opacity={chartFilter && (chartFilter.chart !== 'harvestedCrop' || chartFilter.category !== entry.name) ? 0.3 : 1}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Map */}
            <div className={`bg-white dark:bg-gray-800 p-2 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 mb-2 md:mb-3 overflow-hidden ${data[0]?.activity?.toLowerCase() === 'crops' ? 'h-[200px] lg:w-1/2 mx-auto' : 'h-[300px] min-h-[300px]'}`}>
                <div ref={mapRef} className="w-full h-full rounded-lg" />
            </div>

            {/* Table & Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
                        <div className="relative w-full md:w-64 flex-shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by ID or Name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        {chartFilter && (
                            <button
                                onClick={() => setChartFilter(null)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl transition-colors text-[10px] font-black uppercase tracking-wider whitespace-nowrap"
                            >
                                <X className="w-3 h-3" />
                                Clear Filter ({chartFilter.category})
                            </button>
                        )}
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
                                    <td className="px-6 py-4 cursor-pointer" onClick={() => (row.cropDetails || row.bioInputs || row.harvests) && setShowCropDetails(row)}>
                                        <div className="flex items-center gap-2">
                                            <div>
                                                <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{row.name}</p>
                                                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-0.5">{row.hhId}</p>
                                            </div>
                                            {row.cropDetails && (
                                                <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 text-[8px] font-black rounded uppercase">
                                                    {row.cropDetails.length} Plots
                                                </span>
                                            )}
                                            {row.bioInputs && row.bioInputs.length > 0 && (
                                                <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 text-[8px] font-black rounded uppercase">
                                                    Bio Applied
                                                </span>
                                            )}
                                            {row.harvests && row.harvests.length > 0 && (() => {
                                                const totalYield = row.harvests.reduce((acc, h) => acc + (h.yieldKgs || 0), 0);
                                                return (
                                                    <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 text-[8px] font-black rounded uppercase">
                                                        Harvested {totalYield > 0 ? `(${Number(totalYield).toFixed(1)} KG)` : ''}
                                                    </span>
                                                );
                                            })()}
                                        </div>
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
                                            <div 
                                                onClick={() => setPreviewImage(formatDriveUrl(row.photo))}
                                                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer group/photo"
                                            >
                                                <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-indigo-100 group-hover/photo:border-indigo-500 transition-all shadow-sm">
                                                    <img 
                                                        src={formatDriveUrl(row.photo)} 
                                                        alt="Activity" 
                                                        className="w-full h-full object-cover" 
                                                        referrerPolicy="no-referrer"
                                                    />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black uppercase tracking-tighter">View</span>
                                                    <ExternalLink className="w-3 h-3 opacity-40 group-hover/photo:opacity-100 transition-opacity" />
                                                </div>
                                            </div>
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

            {showCropDetails && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Crop Details</h2>
                                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mt-1">{showCropDetails.name} • {showCropDetails.hhId}</p>
                            </div>
                            <button 
                                onClick={() => setShowCropDetails(null)}
                                className="p-3 bg-gray-100 dark:bg-gray-800 rounded-2xl hover:bg-gray-200 transition-colors"
                            >
                                <ChevronDown className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-6">
                            {showCropDetails.cropDetails?.map((crop, i) => (
                                <div key={i} className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Main Crop</p>
                                            <p className="text-lg font-black text-indigo-600 uppercase">{crop.mainCrop || 'N/A'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Extent</p>
                                            <p className="text-lg font-black text-emerald-600 uppercase">{crop.extent} Acres</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Sowing Date</p>
                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{crop.sowingDate || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Crop Model</p>
                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{crop.cropModel || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Soil Type</p>
                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{crop.soilType || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Irrigation</p>
                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{crop.irrigationSource || 'N/A'}</p>
                                        </div>
                                    </div>
                                    {crop.interCrops && (
                                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Inter Crops</p>
                                            <p className="text-xs font-bold text-gray-600 dark:text-gray-400">{crop.interCrops}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                            
                            {(() => {
                                const allMaterials = {...(showCropDetails.materialTargets || {}), ...(showCropDetails.materialsReceived || {})};
                                if (Object.keys(allMaterials).length === 0) return null;
                                
                                return (
                                    <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Material Distribution</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {Object.keys(allMaterials).map(materialName => {
                                                const target = (showCropDetails.materialTargets && showCropDetails.materialTargets[materialName]) || 0;
                                                const issued = (showCropDetails.materialsReceived && showCropDetails.materialsReceived[materialName]) || 0;
                                                const progress = target > 0 ? Math.min(100, Math.round((issued / target) * 100)) : 100;
                                                return (
                                                    <div key={materialName} className="bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{materialName}</p>
                                                        <div className="flex justify-between items-end mt-2">
                                                            <div>
                                                                <p className="text-[9px] font-bold text-gray-400 uppercase">Target (Total)</p>
                                                                <p className="text-sm font-black text-indigo-600">{target > 0 ? target.toFixed(1) : '—'}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[9px] font-bold text-gray-400 uppercase">Issued</p>
                                                                <p className="text-sm font-black text-emerald-600">{issued > 0 ? issued.toFixed(1) : '—'}</p>
                                                            </div>
                                                        </div>
                                                        {target > 0 && (
                                                            <div className="mt-3 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={`h-full rounded-full transition-all duration-500 ${issued >= target ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                                                                    style={{ width: `${progress}%` }} 
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {showCropDetails.bioInputs && showCropDetails.bioInputs.length > 0 && (
                                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Bio Inputs Applied</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {showCropDetails.bioInputs.map((bio, i) => (
                                            <div key={i} className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 flex gap-4">
                                                {bio.photo && (
                                                    <div 
                                                        className="w-16 h-16 rounded-xl overflow-hidden cursor-pointer flex-shrink-0"
                                                        onClick={(e) => { e.stopPropagation(); setPreviewImage(bio.photo); }}
                                                    >
                                                        <img src={bio.photo} alt="Bio Input" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                    </div>
                                                )}
                                                <div className="flex flex-col justify-center">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{bio.date || 'Unknown Date'}</p>
                                                    <p className="text-sm font-black text-emerald-600 uppercase">{bio.type}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {showCropDetails.harvests && showCropDetails.harvests.length > 0 && (() => {
                                const consolidated = showCropDetails.harvests.reduce((acc: Record<string, number>, h) => {
                                    const crop = h.cropName || 'Unknown Crop';
                                    acc[crop] = (acc[crop] || 0) + (h.yieldKgs || 0);
                                    return acc;
                                }, {});

                                return (
                                    <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Harvest Data</h3>
                                        
                                        {Object.keys(consolidated).length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {Object.entries(consolidated).map(([crop, totalKgs], i) => (
                                                    <div key={i} className="bg-amber-100 dark:bg-amber-900/40 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-2">
                                                        <span className="font-bold text-amber-900 dark:text-amber-100 text-[11px] uppercase tracking-wider">{crop}</span>
                                                        <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{Number(totalKgs).toFixed(1)} KG</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {showCropDetails.harvests!.map((harvest, i) => (
                                                <div key={i} className="bg-amber-50/50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex gap-4">
                                                    {harvest.photo && (
                                                        <div 
                                                            className="w-16 h-16 rounded-xl overflow-hidden cursor-pointer flex-shrink-0"
                                                            onClick={(e) => { e.stopPropagation(); setPreviewImage(harvest.photo); }}
                                                        >
                                                            <img src={harvest.photo} alt="Harvest" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col justify-center">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{harvest.date || 'Unknown Date'}</p>
                                                        <p className="text-sm font-black text-amber-600 uppercase">{harvest.yieldQty}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {previewImage && (
                <div 
                    className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setPreviewImage(null)}
                >
                    <div 
                        className="relative max-w-4xl w-full"
                        onClick={e => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setPreviewImage(null)}
                            className="absolute -top-12 right-0 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <img 
                            src={previewImage} 
                            alt="Preview Full" 
                            className="w-full h-auto max-h-[80vh] rounded-3xl shadow-2xl object-contain border border-white/10" 
                            referrerPolicy="no-referrer"
                        />
                    </div>
                </div>
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

        const getVal = (row: string[], terms: string[], allowFuzzy: boolean = true) => {
            // Priority 1: Exact matches
            for (const term of terms) {
                const searchNorm = normalize(term);
                const idx = normalizedHeaders.findIndex(h => h === searchNorm);
                if (idx !== -1) return row[idx];
            }
            // Priority 2: Fuzzy matches (if allowed)
            if (allowFuzzy) {
                for (const term of terms) {
                    const searchNorm = normalize(term);
                    const idx = normalizedHeaders.findIndex(h => h.includes(searchNorm));
                    if (idx !== -1) return row[idx];
                }
            }
            return '';
        };
        
        const beneficiaries = lines.slice(1).map(line => {
            const vals = parseLine(line);
            return {
                hhId: getVal(vals, ['HH_Id', 'HH_ID', 'HH ID', 'HHID', 'Farmer ID', 'FID']),
                name: getVal(vals, ['Name', 'Beneficiary name', 'Farmer Name']),
                activity: normalizeActivity((getVal(vals, ['activity', 'Activity']) || '').trim().replace(/^(BYP-|BFE-|AFT-)/, '')),
                gp: getVal(vals, ['GP', 'Gram Panchayat', 'location-gp']),
                village: getVal(vals, ['Village', 'location-village']),
                age: getVal(vals, ['age', 'Age']),
                benId: getVal(vals, ['Beneficiary ID', 'Ben_id', 'ID', 'location-farmer_id']),
                cluster: getVal(vals, ['cluster', 'Cluster']),
                lat: parseFloat(getVal(vals, ['lat', 'Latitude', 'gps-Latitude'])) || 0,
                lng: parseFloat(getVal(vals, ['long', 'Longitude', 'gps-Longitude', 'lng'])) || 0,
                photo: getVal(vals, ['photo', 'Photo_link', 'Image', 'Picture', 'photo_link', 'PhotoLink']),
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
            const fetchSafe = async (url: string) => {
                if (!url) return { ok: true, text: async () => '' };
                try {
                    return await fetch(getProxyUrl(`${url}&cb=${Date.now()}`));
                } catch {
                    return { ok: false, text: async () => '' };
                }
            };

            const [benRes, contribRes, cropsRes, assetRes, bioRes, harvRes, targetsRes] = await Promise.all([
                fetchSafe(BENEFICIARY_DATA_URL),
                fetchSafe(CONTRIBUTION_DATA_URL),
                fetchSafe(CROPS_DATA_URL),
                fetchSafe(ASSET_DISTRIBUTION_URL),
                fetchSafe(BIO_INPUTS_DATA_URL),
                fetchSafe(HARVEST_DATA_URL),
                fetchSafe(CROPS_MATERIAL_TARGETS_URL)
            ]);

            if (!benRes.ok || !contribRes.ok || !cropsRes.ok) throw new Error("Failed to fetch primary data.");

            const benText = await benRes.text();
            const contribText = await contribRes.text();
            const cropsText = await cropsRes.text();
            const assetText = (assetRes.ok && assetRes.text) ? await assetRes.text() : '';
            const bioText = await bioRes.text();
            const harvestText = await harvRes.text();
            const targetsText = await targetsRes.text();

            const parsedBens = parseCSV(benText);
            const parsedTargets = (() => {
                if (!targetsText) return [];
                const lines = targetsText.trim().split(/\r?\n/).filter(l => l.trim());
                if (lines.length < 1) return [];
                const headers = parseLine(lines[0]).map(h => h.trim().toUpperCase());
                return lines.slice(1).map(line => {
                    const vals = parseLine(line);
                    const obj: any = {};
                    headers.forEach((h, i) => { if (h) obj[h] = vals[i] || ''; });
                    return obj;
                });
            })();

            const materialTargetsByCode = new Map<string, { targetPerAcre: number, unit: string, name: string }>();
            parsedTargets.forEach(row => {
                const code = (row['MATERIAL ID'] || '').trim().toUpperCase();
                const materialName = row['MATERIAL NAME'] || '';
                const targetStr = row['TARGET'];
                const units = row['UNITS'] || '';
                if (code && targetStr) {
                    const targetPerAcre = parseFloat(targetStr);
                    if (!isNaN(targetPerAcre)) {
                        materialTargetsByCode.set(code, { targetPerAcre, unit: units, name: materialName });
                    }
                }
            });
            
            // Create a lookup for village -> cluster to assign clusters to "crops-only" farmers
            const villageClusterMap = new Map<string, string>();
            parsedBens.forEach(b => {
                const vNorm = b.village.toUpperCase();
                if (vNorm && b.cluster && b.cluster !== 'N/A' && b.cluster !== 'All') {
                    villageClusterMap.set(vNorm, b.cluster);
                }
            });

            const rawCsv = (csv: string) => {
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
            const parsedContribs = rawCsv(contribText);
            const parsedCropsRaw = rawCsv(cropsText);
            const parsedAssets = rawCsv(assetText);
            const parsedBio = rawCsv(bioText);
            const parsedHarvest = rawCsv(harvestText);

        const bioMap = new Map<string, BioInputRecord[]>();
        parsedBio.forEach(row => {
            const hhId = row['HH_Id'] || row['HH_ID'] || row['FARMER_ID'] || row['HH ID'] || row['HHID'] || row['FARMER ID'] || row['FID'] || Object.values(row).find((v:any) => normalizeId(v).startsWith('F'));
            if (hhId) {
                const normId = normalizeId(hhId);
                const current = bioMap.get(normId) || [];
                
                // Construct type including quantity if available
                let typeStr = row['INPUTS_APPLIED'] || row['TYPE'] || row['BIO_INPUT_TYPE'] || row['BIO INPUT TYPE'] || row['BIOINPUT'] || 'Unknown';
                const qtyKeys = Object.keys(row).filter(k => k.includes('QUANTITY') || k.includes('KGS'));
                const qtyStrs = qtyKeys.map(k => row[k]).filter(v => v);
                if (qtyStrs.length > 0) {
                    typeStr += ` (${qtyStrs.join(', ')})`;
                }
                if (row['BIOINPUTS_SOURCE']) {
                    typeStr += ` - Source: ${row['BIOINPUTS_SOURCE']}`;
                }

                let finalPhoto = formatDriveUrl(row['PHOTOS'] || row['PHOTO'] || row['IMAGE'] || row['PICTURE'] || row['PHOTO_LINK'] || '');
                if (finalPhoto && !finalPhoto.startsWith('http') && row['PARENT_KEY']) {
                    finalPhoto = `/api/odk/image?form=${encodeURIComponent('NF- Activities')}&submissionId=${encodeURIComponent(row['PARENT_KEY'])}&filename=${encodeURIComponent(finalPhoto)}`;
                }

                current.push({
                    date: row['APPLICATION_DATE_BIO_INPUT'] || row['DATE'] || row['SUBMISSIONDATE'] || row['SUBMISSION DATE'] || '',
                    type: typeStr,
                    photo: finalPhoto,
                    parentKey: row['PARENT_KEY']
                });
                bioMap.set(normId, current);
            }
        });

        const harvestMap = new Map<string, HarvestRecord[]>();
        parsedHarvest.forEach(row => {
            const hhId = row['HH_Id'] || row['HH_ID'] || row['FARMER_ID'] || row['HH ID'] || row['HHID'] || row['FARMER ID'] || row['FID'] || Object.values(row).find((v:any) => normalizeId(v).startsWith('F'));
            if (hhId) {
                const normId = normalizeId(hhId);
                const current = harvestMap.get(normId) || [];
                
                // Fetch quantity
                const yieldRaw = row['YIELD_QNTL'] || row['YIELD'] || row['QTY'] || row['QUANTITY'] || row['HARVEST_AMT'] || '0';
                const yieldKgs = parseFloat(yieldRaw) || 0;
                
                const cropName = row['CROP_HARVESTED'] || row['CROP_TYPE'] || row['CROP'] || 'Unknown Crop';
                const yieldStr = yieldKgs > 0 ? `${cropName} - ${yieldKgs} KG` : cropName;

                let finalPhoto = formatDriveUrl(row['PHOTO'] || row['PHOTOS'] || row['IMAGE'] || row['PICTURE'] || row['PHOTO_LINK'] || '');
                if (finalPhoto && !finalPhoto.startsWith('http') && row['PARENT_KEY']) {
                    finalPhoto = `/api/odk/image?form=${encodeURIComponent('NF- Activities')}&submissionId=${encodeURIComponent(row['PARENT_KEY'])}&filename=${encodeURIComponent(finalPhoto)}`;
                }

                current.push({
                    date: row['DATE_HARVEST'] || row['DATE'] || row['SUBMISSIONDATE'] || row['SUBMISSION DATE'] || '',
                    yieldQty: yieldStr,
                    photo: finalPhoto,
                    parentKey: row['PARENT_KEY'],
                    cropName: cropName,
                    yieldKgs: yieldKgs
                });
                harvestMap.set(normId, current);
            }
        });



            const cropsMap = new Map<string, CropRecord[]>();
            const cropsInfoMap = new Map<string, any>(); // To store name, gp, village for synthetic records
            
            parsedCropsRaw.forEach(row => {
                const hhId = row['HH_Id'] || row['HH ID'] || row['HHID'] || row['HH_ID'] || row['FARMER ID'] || row['FID'];
                if (hhId) {
                    const normId = normalizeId(hhId);
                    
                    // Store farmer info for synthetic records
                    if (!cropsInfoMap.has(normId)) {
                        cropsInfoMap.set(normId, {
                            name: row['FARMER NAME'] || row['NAME'] || 'Unknown Farmer',
                            gp: row['GP'] || '',
                            village: row['VILLAGE'] || '',
                            lat: parseFloat(row['PLOT_REG-PLOT_GPS-LATITUDE'] || '0') || 0,
                            lng: parseFloat(row['PLOT_REG-PLOT_GPS-LONGITUDE'] || '0') || 0
                        });
                    }

                    const current = cropsMap.get(normId) || [];
                    current.push({
                        hhId: hhId,
                        cropType: row['PLOT_REG-CROP_TYPE'] || '',
                        extent: parseFloat(row['EXTENT'] || '0') || 0,
                        sowingDate: row['PLOT_REG-SOWING_DATE'] || '',
                        soilType: row['PLOT_REG-SOIL_TYPE'] || '',
                        irrigationSource: row['PLOT_REG-IRRIGATION_SOURCE'] || '',
                        cropModel: row['PLOT_REG-CROP_MODEL'] || '',
                        mainCrop: row['PLOT_REG-MAIN_CROP'] || '',
                        interCrops: row['PLOT_REG-INTER_CROPS'] || '',
                        area: row['PLOT_REG-AREA'] || '',
                        season: row['PLOT_REG-SEASON'] || '',
                    });
                    cropsMap.set(normId, current);
                }
            });

            const contribMap = new Map<string, Record<string, number>>();
            parsedContribs.forEach(row => {
                const hhId = row['HH_Id'] || row['FARMERID'] || row['FID'] || row['ID'] || row['FARMER ID'] || row['HHID'] || row['HH ID'] || row['HH_ID'];
                if (hhId) {
                    const normId = normalizeId(hhId);
                    const current = contribMap.get(normId) || {};
                    const idHeaders = [
                        'HH_Id', 'FARMERID', 'FID', 'ID', 'FARMER ID', 'HHID', 'HH ID', 'HH_ID', 
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

            // Parse Assets for materialsReceived
            const assetMap = new Map<string, Record<string, number>>();
            parsedAssets.forEach(row => {
                const activityStr = String(row['ACTIVITY'] || '').toUpperCase();
                if (activityStr.includes('CROP')) {
                    const hhId = row['HH_Id'] || row['FARMER ID'] || row['BEN_ID'] || row['BENID'] || row['HH ID'] || row['HHID'] || row['HH_ID'];
                    if (hhId) {
                        const normId = normalizeId(hhId);
                        const current = assetMap.get(normId) || {};
                        const code = String(row['MATERIAL_ID'] || '').trim().toUpperCase();
                        let materialName = row['THIS_MATERIAL_LABEL']?.trim() || code;
                        
                        if (materialTargetsByCode.has(code)) {
                            materialName = materialTargetsByCode.get(code)!.name;
                        } else if (!materialName) {
                            materialName = 'Unknown Material';
                        }
                        
                        const count = parseFloat(row['MATERIALS_DETAILS-MATERIAL_COUNT'] || '0') || 0;
                        if (materialName && count > 0) {
                            current[materialName] = (current[materialName] || 0) + count;
                        }
                        assetMap.set(normId, current);
                    }
                }
            });

            const processedBens = parsedBens.map(b => {
                const normId = normalizeId(b.hhId);
                const userContribs = contribMap.get(normId) || {};
                const isCropsActivity = b.activity.toLowerCase() === 'crops';
                const cropDetails = isCropsActivity ? cropsMap.get(normId) : undefined;
                const userAssets = assetMap.get(normId) || {};
                const bioInputs = isCropsActivity ? bioMap.get(normId) : undefined;
                const harvests = isCropsActivity ? harvestMap.get(normId) : undefined;
                
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

                let materialTargets: Record<string, number> | undefined = undefined;
                if (isCropsActivity && cropDetails) {
                    const totalExtent = cropDetails.reduce((sum, c) => sum + (c.extent || 0), 0);
                    materialTargets = {};
                    materialTargetsByCode.forEach((meta, code) => {
                        const targetVal = (code === 'HDFC-A1.11-0044' || code === 'HDFC-A1.11-0051') 
                            ? meta.targetPerAcre 
                            : meta.targetPerAcre * totalExtent;
                        materialTargets![meta.name] = (materialTargets![meta.name] || 0) + targetVal;
                    });
                }

                return { ...b, contribution, cropDetails, normId, materialsReceived: userAssets, materialTargets, bioInputs, harvests };
            });

            // Augment with missing crops records
            const existingCropsIds = new Set(
                processedBens
                    .filter(b => b.activity.toLowerCase() === 'crops')
                    .map(b => b.normId)
            );

            const augmentedBens: BeneficiaryRecord[] = [...processedBens];
            cropsMap.forEach((plots, normId) => {
                if (!existingCropsIds.has(normId)) {
                    const info = cropsInfoMap.get(normId);
                    const villageNorm = (info?.village || '').toUpperCase();
                    const cluster = villageClusterMap.get(villageNorm) || 'Other';
                    
                    const materialTargets: Record<string, number> = {};
                    const totalExtent = plots.reduce((sum, c) => sum + (c.extent || 0), 0);
                    materialTargetsByCode.forEach((meta, code) => {
                        const targetVal = (code === 'HDFC-A1.11-0044' || code === 'HDFC-A1.11-0051') 
                            ? meta.targetPerAcre 
                            : meta.targetPerAcre * totalExtent;
                        materialTargets[meta.name] = (materialTargets[meta.name] || 0) + targetVal;
                    });
                    
                    augmentedBens.push({
                        hhId: plots[0].hhId,
                        name: info?.name || 'Unknown Farmer',
                        activity: 'crops',
                        gp: info?.gp || 'N/A',
                        village: info?.village || 'N/A',
                        age: '',
                        benId: '',
                        cluster: cluster,
                        lat: info?.lat || 0,
                        lng: info?.lng || 0,
                        photo: '',
                        contribution: 0,
                        cropDetails: plots,
                        materialsReceived: assetMap.get(normId) || {},
                        materialTargets: materialTargets,
                        bioInputs: bioMap.get(normId),
                        harvests: harvestMap.get(normId)
                    });
                }
            });

            setData(augmentedBens);
        } catch (err: any) {
            console.warn("Fetch error:", err.message);
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
        <div className="w-full mx-auto space-y-8 pb-20">
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
                                            {activity.toUpperCase().includes('CROP') ? (
                                                <span className="flex items-center gap-1 text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                                                    <TrendingUp className="w-3 h-3" />
                                                    {activityData.reduce((sum, d) => sum + (d.cropDetails?.reduce((s, c) => s + (c.extent || 0), 0) || 0), 0).toFixed(2)} Acres
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                                    <IndianRupee className="w-3 h-3" />
                                                    ₹{activityData.reduce((sum, d) => sum + (d.contribution || 0), 0).toLocaleString()}
                                                </span>
                                            )}
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
