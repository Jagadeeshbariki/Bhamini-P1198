
import React, { useState, useEffect, useMemo } from 'react';
import { 
    BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, 
    XAxis, YAxis, Tooltip 
} from 'recharts';
import { 
    Users, MapPin, Filter, Search, 
    Download, X, ArrowUpDown,
    Activity as ActivityIcon, UserCheck,
    ChevronDown, ChevronUp, ArrowLeft
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BENEFICIARY_DATA_URL, ASSET_DISTRIBUTION_URL } from '../config';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Asset {
    code: string;
    label: string;
    count: number;
    unit: string;
    date: string;
    distributor: string;
    photo?: string;
    parentKey?: string;
}

interface Beneficiary {
    hhId: string;
    hhHeadName: string;
    activity: string;
    beneficiaryName: string;
    beneficiaryId: string;
    age: number;
    gender: string;
    phoneNumber: string;
    cluster: string;
    gp: string;
    village: string;
    assets: Asset[];
}

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#f43f5e'];

const formatDriveUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
        const idMatch = url.match(/[-\w]{25,}/);
        if (idMatch) {
            return `https://docs.google.com/uc?export=view&id=${idMatch[0]}`;
        }
    }
    return url;
};

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700">
                <p className="text-[10px] font-black uppercase text-gray-400 mb-1">{data.name}</p>
                <div className="flex items-baseline gap-2">
                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                        {data.value.toLocaleString()}
                    </p>
                    {data.percentage !== undefined && (
                        <p className="text-[10px] font-black text-gray-400">({data.percentage.toFixed(1)}%)</p>
                    )}
                </div>
                <p className="text-[8px] font-black uppercase text-gray-400 mt-1 italic">Click to filter</p>
            </div>
        );
    }
    return null;
};

interface BeneficiaryExplorerProps {
    onBack?: () => void;
}

const BeneficiaryExplorer: React.FC<BeneficiaryExplorerProps> = ({ onBack }) => {
    const [data, setData] = useState<Beneficiary[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [filterCluster, setFilterCluster] = useState('All');
    const [filterGP, setFilterGP] = useState('All');
    const [filterVillage, setFilterVillage] = useState('All');
    const [filterActivity, setFilterActivity] = useState('All');
    const [filterGender, setFilterGender] = useState('All');
    const [filterMaterialStatus, setFilterMaterialStatus] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Beneficiary; direction: 'asc' | 'desc' } | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const toggleRow = (index: number) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedRows(newExpanded);
    };

    const parseCSV = (csv: string, sourceName: string): Beneficiary[] => {
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentVal = '';
        let inQuotes = false;

        for (let i = 0; i < csv.length; i++) {
            const char = csv[i];
            const nextChar = csv[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentVal += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                currentRow.push(currentVal.trim());
                currentVal = '';
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
                if (currentVal || currentRow.length > 0) {
                    currentRow.push(currentVal.trim());
                    rows.push(currentRow);
                    currentVal = '';
                    currentRow = [];
                }
                if (char === '\r' && nextChar === '\n') i++;
            } else {
                currentVal += char;
            }
        }
        if (currentVal || currentRow.length > 0) {
            currentRow.push(currentVal.trim());
            rows.push(currentRow);
        }

        if (rows.length < 2) return [];

        const headers = rows[0];
        const normalize = (h: string) => (h || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        const normalizedHeaders = headers.map(normalize);

        const getVal = (row: string[], searchTerms: string[], allowFuzzy = false) => {
            // 1. Try exact matches first
            for (const term of searchTerms) {
                const searchNorm = normalize(term);
                const idx = normalizedHeaders.indexOf(searchNorm);
                if (idx !== -1) return (row[idx] || '').trim();
            }
            
            // 2. Try fuzzy matches only if explicitly allowed and no exact match found
            if (allowFuzzy) {
                for (const term of searchTerms) {
                    const searchNorm = normalize(term);
                    const idx = normalizedHeaders.findIndex(h => h.includes(searchNorm));
                    if (idx !== -1) return (row[idx] || '').trim();
                }
            }
            return '';
        };

        const beneficiaryMap = new Map<string, Beneficiary>();

        rows.slice(1).forEach(row => {
            if (row.length < 3) return;

            const bId = (getVal(row, ['Beneficiary ID', 'Ben_Id', 'bnf_section_-adhaar_number_', 'bnf_section-adhaar_number', 'adhaar'])).trim();
            const hhId = getVal(row, ['HH ID', 'Farmer ID', 'location-farmer_id', 'location-show_farmer_id', 'farmer_id']);
            
            if (!bId) return;

            const key = bId;
            
            const asset: Asset = {
                code: getVal(row, ['this_material_code'], true),
                label: getVal(row, ['this_material_label'], true),
                count: parseFloat(getVal(row, ['materials_details-material_count'], true)) || 0,
                unit: getVal(row, ['materials_details-material_unit'], true),
                date: getVal(row, ['materials_details-distributed_date'], true),
                distributor: getVal(row, ['materials_details-destributor_name'], true),
                photo: getVal(row, ['Photo', 'this_material_photo', 'photo', 'image'], true),
                parentKey: getVal(row, ['PARENT_KEY', 'instanceID', 'meta-instanceID', 'KEY'], true),
            };

            if (beneficiaryMap.has(key)) {
                const existing = beneficiaryMap.get(key)!;
                if (asset.label) {
                    existing.assets.push(asset);
                }
            } else {
                beneficiaryMap.set(key, {
                    hhId: hhId,
                    hhHeadName: getVal(row, ['location-farmer_name', 'location-show_farmer_name', 'HH Head Name', 'farmer_name']),
                    activity: getVal(row, ['activity', 'activity_registration-activity', 'Activity']).replace(/^(BYP-|BFE-|AFT-)/, ''),
                    beneficiaryName: getVal(row, ['Name', 'Beneficiary name', 'bnf_section_-bnf_name_', 'bnf_section-bnf_name', 'bnf_name']),
                    beneficiaryId: bId,
                    age: parseInt(getVal(row, ['age', 'Age', 'bnf_section_-age_', 'bnf_section-age'])) || 0,
                    gender: getVal(row, ['gender', 'Gender', 'bnf_section_-gender_', 'bnf_section-gender']),
                    phoneNumber: getVal(row, ['phone number', 'Ben_phone', 'bnf_section_-phone_number_', 'bnf_section-phone_number']),
                    cluster: getVal(row, ['cluster', 'location-block', 'Cluster', 'CLUSTER']),
                    gp: getVal(row, ['GP', 'location-gp', 'gp']),
                    village: getVal(row, ['Village', 'location-village', 'village']),
                    assets: asset.label ? [asset] : [],
                });
            }
        });

        console.log(`Parsed ${beneficiaryMap.size} unique beneficiaries from ${sourceName}`);
        return Array.from(beneficiaryMap.values());
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch Master List
                const masterRes = await fetch(`${BENEFICIARY_DATA_URL}&t=${Date.now()}`);
                const masterText = await masterRes.text();
                const masterData = parseCSV(masterText, 'Master List');

                // Fetch Distribution List
                const distRes = await fetch(`${ASSET_DISTRIBUTION_URL}&t=${Date.now()}`);
                const distText = await distRes.text();
                const distData = parseCSV(distText, 'Distribution List');

                // Merge Data
                const mergedMap = new Map<string, Beneficiary>();
                
                // Add all from master first
                masterData.forEach(b => {
                    const key = b.beneficiaryId;
                    if (key) mergedMap.set(key, b);
                });

                // Merge distribution data
                distData.forEach(b => {
                    const key = b.beneficiaryId;
                    if (key) {
                        if (mergedMap.has(key)) {
                            const existing = mergedMap.get(key)!;
                            // Add assets from distribution list
                            if (b.assets.length > 0) {
                                // Avoid duplicates if any
                                b.assets.forEach(newAsset => {
                                    const isDuplicate = existing.assets.some(a => 
                                        a.label === newAsset.label && a.date === newAsset.date
                                    );
                                    if (!isDuplicate) existing.assets.push(newAsset);
                                });
                            }
                        } else {
                            // If not in master, add as new (though usually they should be in master)
                            mergedMap.set(key, b);
                        }
                    }
                });

                setData(Array.from(mergedMap.values()));
            } catch (err) {
                console.error("Beneficiary fetch failed", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Filter Options
    const clusterOptions = useMemo(() => ['All', ...Array.from(new Set(data.map(d => (d.cluster || '').trim()))).filter(Boolean).sort()], [data]);
    const gpOptions = useMemo(() => ['All', ...Array.from(new Set(data.filter(d => filterCluster === 'All' || d.cluster === filterCluster).map(d => (d.gp || '').trim()))).filter(Boolean).sort()], [data, filterCluster]);
    const villageOptions = useMemo(() => ['All', ...Array.from(new Set(data.filter(d => (filterCluster === 'All' || d.cluster === filterCluster) && (filterGP === 'All' || d.gp === filterGP)).map(d => (d.village || '').trim()))).filter(Boolean).sort()], [data, filterCluster, filterGP]);
    const activityOptions = useMemo(() => ['All', ...Array.from(new Set(data.map(d => (d.activity || '').trim()))).filter(Boolean).sort()], [data]);

    const filteredData = useMemo(() => {
        return data.filter(d => {
            const matchesCluster = filterCluster === 'All' || d.cluster === filterCluster;
            const matchesGP = filterGP === 'All' || d.gp === filterGP;
            const matchesVillage = filterVillage === 'All' || d.village === filterVillage;
            const matchesActivity = filterActivity === 'All' || d.activity === filterActivity;
            const matchesGender = filterGender === 'All' || (() => {
                const g = d.gender?.trim().toLowerCase() || 'unknown';
                const label = g.startsWith('m') ? 'Male' : g.startsWith('f') ? 'Female' : 'Other';
                return label === filterGender;
            })();
            const matchesMaterial = filterMaterialStatus === 'All' || (
                filterMaterialStatus === 'Received' ? d.assets.length > 0 : d.assets.length === 0
            );
            const matchesSearch = d.beneficiaryName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 d.beneficiaryId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 d.hhHeadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 d.hhId.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCluster && matchesGP && matchesVillage && matchesActivity && matchesGender && matchesMaterial && matchesSearch;
        });
    }, [data, filterCluster, filterGP, filterVillage, filterActivity, filterGender, filterMaterialStatus, searchQuery]);

    const sortedData = useMemo(() => {
        const sortableItems = [...filteredData];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filteredData, sortConfig]);

    const requestSort = (key: keyof Beneficiary) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const stats = useMemo(() => {
        const total = filteredData.length;
        
        const activityCounts: Record<string, number> = {};
        const materialCounts = {
            'Received': 0,
            'Not Received': 0
        };

        filteredData.forEach(d => {
            const act = d.activity || 'Unassigned';
            activityCounts[act] = (activityCounts[act] || 0) + 1;
            
            if (d.assets && d.assets.length > 0) {
                materialCounts['Received']++;
            } else {
                materialCounts['Not Received']++;
            }
        });

        const activityData = Object.entries(activityCounts)
            .map(([name, value]) => ({ 
                name, 
                value,
                percentage: total > 0 ? (value / total) * 100 : 0
            }))
            .sort((a, b) => b.value - a.value);

        const materialData = [
            { name: 'Received', value: materialCounts['Received'], percentage: total > 0 ? (materialCounts['Received'] / total) * 100 : 0 },
            { name: 'Not Received', value: materialCounts['Not Received'], percentage: total > 0 ? (materialCounts['Not Received'] / total) * 100 : 0 }
        ];

        const genderCounts: Record<string, number> = {};
        filteredData.forEach(d => {
            const g = d.gender?.trim().toLowerCase() || 'unknown';
            const label = g.startsWith('m') ? 'Male' : g.startsWith('f') ? 'Female' : 'Other';
            genderCounts[label] = (genderCounts[label] || 0) + 1;
        });

        const genderData = Object.entries(genderCounts).map(([name, value]) => ({
            name,
            value,
            percentage: total > 0 ? (value / total) * 100 : 0
        }));

        const averageAge = total > 0 ? filteredData.reduce((acc, d) => acc + d.age, 0) / total : 0;
        const uniqueVillages = new Set(filteredData.map(d => d.village)).size;
        const uniqueGPs = new Set(filteredData.map(d => d.gp)).size;

        const clusterCounts: Record<string, number> = {};
        filteredData.forEach(d => {
            const c = d.cluster || 'Unknown';
            clusterCounts[c] = (clusterCounts[c] || 0) + 1;
        });

        const clusterData = Object.entries(clusterCounts).map(([name, value]) => ({
            name,
            value,
            percentage: total > 0 ? (value / total) * 100 : 0
        })).sort((a, b) => b.value - a.value);

        return { total, activityData, genderData, averageAge, uniqueVillages, uniqueGPs, clusterData, materialData };
    }, [filteredData]);

    const clearFilters = () => {
        setFilterCluster('All');
        setFilterGP('All');
        setFilterVillage('All');
        setFilterActivity('All');
        setFilterGender('All');
        setFilterMaterialStatus('All');
        setSearchQuery('');
    };

    const downloadCSV = () => {
        const headers = ['HH Id', 'HH Head', 'Activity', 'Beneficiary', 'ID', 'Age', 'Gender', 'Phone', 'Village', 'GP', 'Cluster'];
        const csvContent = [
            headers.join(','),
            ...filteredData.map(b => [
                `"${b.hhId}"`, `"${b.hhHeadName}"`, `"${b.activity}"`, `"${b.beneficiaryName}"`, 
                `"${b.beneficiaryId}"`, b.age, `"${b.gender}"`, `"${b.phoneNumber}"`, 
                `"${b.village}"`, `"${b.gp}"`, `"${b.cluster}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `beneficiary_report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-pulse">
            <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="mt-6 text-xs font-black uppercase text-gray-400 tracking-[0.3em]">Syncing MIS Core...</p>
        </div>
    );

    return (
        <div className="flex flex-col gap-3 animate-fade-in pb-20">
            {onBack && (
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 transition-colors mb-4 group w-fit"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Dashboards
                </button>
            )}
            {/* 1. HEADER & GLOBAL ACTIONS */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Beneficiary Explorer</h1>
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-1">Real-time Field Intelligence & Demographics</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={downloadCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export Data
                    </button>
                    {(filterCluster !== 'All' || filterGP !== 'All' || filterVillage !== 'All' || filterActivity !== 'All' || filterGender !== 'All' || filterMaterialStatus !== 'All' || searchQuery !== '') && (
                        <button 
                            onClick={clearFilters}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 hover:bg-red-100 transition-all"
                        >
                            <X className="w-3.5 h-3.5" />
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* 2. FILTERS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">
                        <MapPin className="w-3 h-3" /> Cluster
                    </label>
                    <select value={filterCluster} onChange={e => { setFilterCluster(e.target.value); setFilterGP('All'); setFilterVillage('All'); }} className="w-full bg-gray-50 dark:bg-gray-900 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer focus:ring-2 focus:ring-indigo-500 transition-all">
                        {clusterOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">
                        <Filter className="w-3 h-3" /> GP
                    </label>
                    <select value={filterGP} onChange={e => { setFilterGP(e.target.value); setFilterVillage('All'); }} className="w-full bg-gray-50 dark:bg-gray-900 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer focus:ring-2 focus:ring-indigo-500 transition-all">
                        {gpOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">
                        <MapPin className="w-3 h-3" /> Village
                    </label>
                    <select value={filterVillage} onChange={e => setFilterVillage(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer focus:ring-2 focus:ring-indigo-500 transition-all">
                        {villageOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">
                        <ActivityIcon className="w-3 h-3" /> Activity
                    </label>
                    <select value={filterActivity} onChange={e => setFilterActivity(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer focus:ring-2 focus:ring-indigo-500 transition-all">
                        {activityOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">
                        <ActivityIcon className="w-3 h-3" /> Material
                    </label>
                    <select value={filterMaterialStatus} onChange={e => setFilterMaterialStatus(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer focus:ring-2 focus:ring-indigo-500 transition-all">
                        <option value="All">All Status</option>
                        <option value="Received">Material Received Farmer</option>
                        <option value="Not Received">No Material Received Farmers</option>
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">
                        <Search className="w-3 h-3" /> Search
                    </label>
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="NAME / ID..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-900 pl-4 pr-10 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    </div>
                </div>
            </div>

            {/* 3. ANALYTICS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-1">
                {/* Key Metrics Bento */}
                <div className="lg:col-span-3 grid grid-cols-1 gap-1">
                    <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-xl shadow-indigo-100 dark:shadow-none flex flex-col justify-between relative overflow-hidden group min-h-[120px]">
                        <Users className="absolute -right-4 -bottom-4 w-16 h-16 opacity-10 group-hover:scale-110 transition-transform duration-700" />
                        <div>
                            <p className="text-[7px] font-black uppercase opacity-60 tracking-[0.2em] mb-1">Total Beneficiaries</p>
                            <p className="text-2xl font-black tracking-tighter">{stats.total.toLocaleString()}</p>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            <div className="h-1 w-6 bg-white/30 rounded-full"></div>
                            <span className="text-[6px] font-black uppercase opacity-60">Live Registry</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                        <div>
                            <p className="text-[7px] font-black uppercase text-gray-400 tracking-widest mb-1">Avg. Age</p>
                            <p className="text-lg font-black text-gray-900 dark:text-white">{stats.averageAge.toFixed(1)}</p>
                        </div>
                        <div className="mt-0.5 text-[7px] font-black uppercase text-indigo-500">Years Old</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                        <div>
                            <p className="text-[7px] font-black uppercase text-gray-400 tracking-widest mb-1">Coverage</p>
                            <p className="text-lg font-black text-gray-900 dark:text-white">{stats.uniqueVillages}</p>
                        </div>
                        <div className="mt-0.5 text-[7px] font-black uppercase text-emerald-500">{stats.uniqueGPs} GPs</div>
                    </div>
                </div>

                {/* Activity & Cluster Distribution Column */}
                <div className="lg:col-span-5 flex flex-col gap-1">
                    {/* Activity Distribution Chart (Vertical Bar) */}
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Activity Distribution</h3>
                            <ActivityIcon className="w-3 h-3 text-indigo-500" />
                        </div>
                        <div className="flex-grow pb-1">
                            <div className="h-[380px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.activityData} margin={{ top: 30, right: 10, left: 10, bottom: 20 }}>
                                        <XAxis 
                                            dataKey="name" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 9, fontWeight: 900, fill: '#9ca3af', dy: 10 }}
                                            interval={0}
                                            angle={-45}
                                            textAnchor="end"
                                            height={110}
                                        />
                                        <YAxis hide />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                                        <Bar 
                                            dataKey="value" 
                                            radius={[4, 4, 0, 0]}
                                            label={{ position: 'top', fill: '#6b7280', fontSize: 9, fontWeight: 900, offset: 5 }}
                                            onClick={(data) => setFilterActivity(data.name)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            {stats.activityData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Cluster Distribution Chart (Pie) */}
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-1">
                            <h3 className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Cluster Distribution</h3>
                            <MapPin className="w-3 h-3 text-emerald-500" />
                        </div>
                        <div className="flex-grow h-[220px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                                    <Pie
                                        data={stats.clusterData}
                                        innerRadius={0}
                                        outerRadius={70}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                                        onClick={(data) => setFilterCluster(data.name)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {stats.clusterData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Gender & Material Column */}
                <div className="lg:col-span-4 flex flex-col gap-1">
                    {/* Gender Split Chart */}
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-1">
                            <h3 className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Gender Split</h3>
                            <Users className="w-3 h-3 text-pink-500" />
                        </div>
                        <div className="flex-grow h-[280px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                                    <Pie
                                        data={stats.genderData}
                                        innerRadius={0}
                                        outerRadius={65}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                                        onClick={(data) => setFilterGender(data.name)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {stats.genderData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-1 flex flex-wrap justify-center gap-x-1.5 gap-y-0.5">
                            {stats.genderData.map((g, idx) => (
                                <button 
                                    key={idx} 
                                    onClick={() => setFilterGender(g.name)}
                                    className={cn(
                                        "flex items-center gap-1 px-1 py-0.5 rounded-lg transition-all",
                                        filterGender === g.name ? "bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-200" : "hover:bg-gray-50 dark:hover:bg-gray-700"
                                    )}
                                >
                                    <div className="w-1 h-1 rounded-full" style={{ background: COLORS[idx % COLORS.length] }}></div>
                                    <span className="text-[6px] font-black uppercase text-gray-500">{g.name} {g.percentage.toFixed(0)}%</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Material Distribution Chart */}
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-1">
                            <h3 className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Material Status</h3>
                            <Download className="w-3 h-3 text-amber-500" />
                        </div>
                        <div className="flex-grow h-[280px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                                    <Pie
                                        data={stats.materialData}
                                        innerRadius={0}
                                        outerRadius={65}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                                        onClick={(data) => setFilterMaterialStatus(data.name)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {stats.materialData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.name === 'Received' ? '#10b981' : '#f43f5e'} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-1 flex flex-wrap justify-center gap-x-1.5 gap-y-0.5">
                            {stats.materialData.map((m, idx) => (
                                <button 
                                    key={idx} 
                                    onClick={() => setFilterMaterialStatus(m.name)}
                                    className={cn(
                                        "flex items-center gap-1 px-1 py-0.5 rounded-lg transition-all",
                                        filterMaterialStatus === m.name ? "bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-200" : "hover:bg-gray-50 dark:hover:bg-gray-700"
                                    )}
                                >
                                    <div className="w-1 h-1 rounded-full" style={{ background: m.name === 'Received' ? '#10b981' : '#f43f5e' }}></div>
                                    <span className="text-[6px] font-black uppercase text-gray-500">{m.name}: {m.value}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. DETAILED TABLE */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-50 dark:border-gray-700 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gray-50/50 dark:bg-gray-900/20">
                    <div>
                        <h2 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">Beneficiary Registry</h2>
                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">Detailed Demographics & Activity Log</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
                        <div className="relative flex-1 sm:flex-none">
                            <input 
                                type="text" 
                                placeholder="QUICK SEARCH (NAME/ID/AADHAR)..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full sm:w-72 bg-white dark:bg-gray-800 pl-4 pr-10 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                            />
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                            <UserCheck className="w-3 h-3" />
                            {filteredData.length.toLocaleString()} Records
                        </div>
                    </div>
                </div>
                
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                                <th 
                                    className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('hhId')}
                                >
                                    <div className="flex items-center gap-2">
                                        HH ID & Head
                                        <ArrowUpDown className={cn("w-3 h-3 transition-opacity", sortConfig?.key === 'hhId' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover:opacity-50")} />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('beneficiaryId')}
                                >
                                    <div className="flex items-center gap-2">
                                        Beneficiary ID & Name
                                        <ArrowUpDown className={cn("w-3 h-3 transition-opacity", sortConfig?.key === 'beneficiaryId' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover:opacity-50")} />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('activity')}
                                >
                                    <div className="flex items-center gap-2">
                                        Activity
                                        <ArrowUpDown className={cn("w-3 h-3 transition-opacity", sortConfig?.key === 'activity' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover:opacity-50")} />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('cluster')}
                                >
                                    <div className="flex items-center gap-2">
                                        Location
                                        <ArrowUpDown className={cn("w-3 h-3 transition-opacity", sortConfig?.key === 'cluster' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover:opacity-50")} />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('age')}
                                >
                                    <div className="flex items-center gap-2">
                                        Age/Gender
                                        <ArrowUpDown className={cn("w-3 h-3 transition-opacity", sortConfig?.key === 'age' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover:opacity-50")} />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('phoneNumber')}
                                >
                                    <div className="flex items-center gap-2">
                                        Contact
                                        <ArrowUpDown className={cn("w-3 h-3 transition-opacity", sortConfig?.key === 'phoneNumber' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover:opacity-50")} />
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest">
                                    More
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {sortedData.length > 0 ? sortedData.map((b, i) => (
                                <React.Fragment key={i}>
                                    <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="text-[11px] font-black text-gray-900 dark:text-white uppercase group-hover:text-indigo-600 transition-colors">{b.hhId}</div>
                                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">{b.hhHeadName}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[11px] font-black text-gray-900 dark:text-white uppercase">{b.beneficiaryId}</div>
                                            <div className="text-[9px] font-bold text-indigo-500 uppercase tracking-tighter opacity-80">{b.beneficiaryName}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[8px] font-black uppercase tracking-widest border border-indigo-100/50 dark:border-indigo-900/50">
                                                {b.activity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[11px] font-black text-gray-900 dark:text-white uppercase">{b.cluster}</div>
                                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">{b.gp}, {b.village}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-black text-gray-700 dark:text-gray-300">{b.age} Yrs</span>
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest",
                                                    b.gender?.toLowerCase().startsWith('m') 
                                                        ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                                                        : 'bg-pink-50 text-pink-600 border border-pink-100'
                                                )}>
                                                    {b.gender}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[11px] font-black text-gray-600 dark:text-gray-400 font-mono tracking-tighter">{b.phoneNumber}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button 
                                                onClick={() => toggleRow(i)}
                                                className="flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-[9px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 hover:bg-indigo-600 hover:text-white transition-all"
                                            >
                                                {expandedRows.has(i) ? 'Less' : 'More'}
                                                {expandedRows.has(i) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedRows.has(i) && (
                                        <tr className="bg-gray-50/30 dark:bg-gray-900/20">
                                            <td colSpan={6} className="px-6 py-4">
                                                <div className="animate-fade-in">
                                                    <h4 className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-3">Distributed Assets</h4>
                                                    {b.assets.length > 0 ? (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                            {b.assets.map((asset, idx) => (
                                                                <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-2">
                                                                    <div className="flex justify-between items-start">
                                                                        <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase">{asset.label}</span>
                                                                        <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded text-[9px] font-black uppercase">
                                                                            {asset.count} {asset.unit}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-[8px] font-bold text-gray-400 uppercase">{asset.date}</span>
                                                                        <span className="text-[8px] font-bold text-indigo-400 uppercase">{asset.distributor}</span>
                                                                    </div>
                                                                    {asset.photo && (
                                                                        <div 
                                                                            className="mt-2 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 aspect-video relative group cursor-pointer"
                                                                            onClick={() => {
                                                                                if (asset.photo?.startsWith('http')) {
                                                                                    setPreviewImage(formatDriveUrl(asset.photo));
                                                                                } else if (asset.parentKey && asset.photo) {
                                                                                    setPreviewImage(`/api/odk/image?submissionId=${encodeURIComponent(asset.parentKey!)}&filename=${encodeURIComponent(asset.photo!)}`);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <img 
                                                                                src={asset.photo.startsWith('http') 
                                                                                    ? formatDriveUrl(asset.photo) 
                                                                                    : asset.parentKey 
                                                                                        ? `/api/odk/image?submissionId=${encodeURIComponent(asset.parentKey)}&filename=${encodeURIComponent(asset.photo)}`
                                                                                        : ''
                                                                                } 
                                                                                alt={asset.label}
                                                                                className="w-full h-full object-cover"
                                                                                referrerPolicy="no-referrer"
                                                                                onError={(e) => {
                                                                                    if (!asset.photo?.startsWith('http')) {
                                                                                        e.currentTarget.style.display = 'none';
                                                                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                                                    }
                                                                                }}
                                                                            />
                                                                            {!asset.photo.startsWith('http') && (
                                                                                <div className="hidden absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                                                                                    <span className="text-[10px] font-bold text-gray-500">Image Protected</span>
                                                                                    <span className="text-[8px] text-gray-400 mt-1">Requires ODK Central Login</span>
                                                                                </div>
                                                                            )}
                                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                                <span className="text-[10px] font-black text-white uppercase tracking-widest">Preview Photo</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase italic">No material distributed till now</p>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                            <Search className="w-12 h-12" />
                                            <p className="text-xs font-black uppercase tracking-[0.3em]">No matching records found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View (Cards) */}
                <div className="md:hidden">
                    {sortedData.length > 0 ? (
                        <div className="divide-y divide-gray-50 dark:divide-gray-800">
                            {sortedData.map((b, i) => (
                                <div key={i} className="p-4 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                    <div className="flex justify-between items-start gap-4" onClick={() => toggleRow(i)}>
                                        <div className="space-y-2 flex-1">
                                            {/* Beneficiary Name */}
                                            <div>
                                                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Beneficiary</p>
                                                <p className="text-sm font-black text-gray-900 dark:text-white uppercase">{b.beneficiaryName}</p>
                                            </div>
                                            
                                            {/* Activity */}
                                            <div>
                                                <span className="inline-flex items-center px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-md text-[8px] font-black uppercase tracking-widest border border-indigo-100/50 dark:border-indigo-900/50">
                                                    {b.activity}
                                                </span>
                                            </div>

                                            {/* HH Head Name */}
                                            <div>
                                                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">HH Head</p>
                                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">{b.hhHeadName}</p>
                                            </div>
                                        </div>
                                        
                                        <button 
                                            className="p-2 text-gray-400 hover:text-indigo-500 transition-colors"
                                        >
                                            {expandedRows.has(i) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedRows.has(i) && (
                                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-4 animate-fade-in">
                                            <div>
                                                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">HH ID</p>
                                                <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300 font-mono">{b.hhId}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Beneficiary ID</p>
                                                <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300 font-mono">{b.beneficiaryId}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Age / Gender</p>
                                                <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{b.age} Yrs / {b.gender}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Phone</p>
                                                <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300 font-mono">{b.phoneNumber}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Location</p>
                                                <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase">{b.village}, {b.gp}, {b.cluster}</p>
                                            </div>

                                            {/* Assets List */}
                                            <div className="col-span-2 mt-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                                                <p className="text-[8px] font-black uppercase text-indigo-500 tracking-widest mb-3">Distributed Assets</p>
                                                {b.assets.length > 0 ? (
                                                    <div className="space-y-3">
                                                        {b.assets.map((asset, idx) => (
                                                            <div key={idx} className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800 flex flex-col gap-2">
                                                                <div className="flex justify-between items-start">
                                                                    <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase">{asset.label}</span>
                                                                    <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded text-[8px] font-black uppercase">
                                                                        {asset.count} {asset.unit}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-[7px] font-bold text-gray-400 uppercase">{asset.date}</span>
                                                                    <span className="text-[7px] font-bold text-indigo-400 uppercase">{asset.distributor}</span>
                                                                </div>
                                                                {asset.photo && (
                                                                    <div 
                                                                        className="mt-2 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 aspect-video relative group cursor-pointer"
                                                                        onClick={() => {
                                                                            if (asset.photo?.startsWith('http')) {
                                                                                setPreviewImage(formatDriveUrl(asset.photo));
                                                                            } else if (asset.parentKey && asset.photo) {
                                                                                setPreviewImage(`/api/odk/image?submissionId=${encodeURIComponent(asset.parentKey!)}&filename=${encodeURIComponent(asset.photo!)}`);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <img 
                                                                            src={asset.photo.startsWith('http') 
                                                                                ? formatDriveUrl(asset.photo) 
                                                                                : asset.parentKey
                                                                                    ? `/api/odk/image?submissionId=${encodeURIComponent(asset.parentKey)}&filename=${encodeURIComponent(asset.photo)}`
                                                                                    : ''
                                                                            } 
                                                                            alt={asset.label}
                                                                            className="w-full h-full object-cover"
                                                                            referrerPolicy="no-referrer"
                                                                            onError={(e) => {
                                                                                if (!asset.photo?.startsWith('http')) {
                                                                                    e.currentTarget.style.display = 'none';
                                                                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                                                }
                                                                            }}
                                                                        />
                                                                        {!asset.photo.startsWith('http') && (
                                                                            <div className="hidden absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                                                                                <span className="text-[10px] font-bold text-gray-500">Image Protected</span>
                                                                                <span className="text-[8px] text-gray-400 mt-1">Requires ODK Central Login</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase italic">No material distributed till now</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center">
                            <div className="flex flex-col items-center gap-3 opacity-30">
                                <Search className="w-10 h-10" />
                                <p className="text-[10px] font-black uppercase tracking-[0.3em]">No records found</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; }
            `}</style>

            {previewImage && (
                <div 
                    className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300"
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
                            className="w-full h-auto max-h-[85vh] rounded-3xl shadow-2xl object-contain border border-white/10" 
                            referrerPolicy="no-referrer"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default BeneficiaryExplorer;
