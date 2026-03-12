
import React, { useState, useEffect, useMemo } from 'react';
import { 
    BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, 
    XAxis, YAxis, Tooltip 
} from 'recharts';
import { 
    Users, MapPin, Filter, Search, 
    Download, X, ArrowUpDown,
    Activity as ActivityIcon, UserCheck,
    ChevronDown, ChevronUp
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

const BeneficiaryExplorer: React.FC = () => {
    const [data, setData] = useState<Beneficiary[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [filterCluster, setFilterCluster] = useState('All');
    const [filterGP, setFilterGP] = useState('All');
    const [filterVillage, setFilterVillage] = useState('All');
    const [filterActivity, setFilterActivity] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Beneficiary; direction: 'asc' | 'desc' } | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

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
        const lines = csv.trim().split(/\r?\n/);
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

        const headers = parseLine(lines[0]);
        const normalize = (h: string) => h.toLowerCase().trim().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
        const normalizedHeaders = headers.map(normalize);

        const getVal = (row: string[], search: string) => {
            const searchNorm = normalize(search);
            let idx = normalizedHeaders.findIndex(h => h === searchNorm);
            if (idx === -1) {
                idx = normalizedHeaders.findIndex(h => h.includes(searchNorm));
            }
            return idx !== -1 ? row[idx] : '';
        };

        const beneficiaryMap = new Map<string, Beneficiary>();

        lines.slice(1).forEach(line => {
            const row = parseLine(line);
            if (row.length < 3) return;

            const bId = getVal(row, 'Ben_Id') || getVal(row, 'bnf_section_-adhaar_number_') || getVal(row, 'bnf_section-adhaar_number') || getVal(row, 'Beneficiary ID') || getVal(row, 'adhaar');
            const hhId = getVal(row, 'Farmer ID') || getVal(row, 'location-farmer_id') || getVal(row, 'location-show_farmer_id') || getVal(row, 'HH Id') || getVal(row, 'farmer_id');
            
            if (!bId && !hhId) return;

            const key = (bId || hhId).trim();
            if (!key) return;
            
            const asset: Asset = {
                code: getVal(row, 'this_material_code'),
                label: getVal(row, 'this_material_label'),
                count: parseFloat(getVal(row, 'materials_details-material_count')) || 0,
                unit: getVal(row, 'materials_details-material_unit'),
                date: getVal(row, 'materials_details-distributed_date'),
                distributor: getVal(row, 'materials_details-destributor_name'),
            };

            if (beneficiaryMap.has(key)) {
                const existing = beneficiaryMap.get(key)!;
                if (asset.label) {
                    existing.assets.push(asset);
                }
            } else {
                beneficiaryMap.set(key, {
                    hhId: hhId,
                    hhHeadName: getVal(row, 'location-farmer_name') || getVal(row, 'location-show_farmer_name') || getVal(row, 'HH Head Name') || getVal(row, 'Beneficiary name') || getVal(row, 'farmer_name'),
                    activity: getVal(row, 'activity_registration-activity') || getVal(row, 'Activity') || getVal(row, 'activity'),
                    beneficiaryName: getVal(row, 'Beneficiary name') || getVal(row, 'bnf_section_-bnf_name_') || getVal(row, 'bnf_section-bnf_name') || getVal(row, 'Beneficiary Name') || getVal(row, 'bnf_name'),
                    beneficiaryId: bId,
                    age: parseInt(getVal(row, 'Age') || getVal(row, 'bnf_section_-age_') || getVal(row, 'bnf_section-age') || getVal(row, 'Age')) || 0,
                    gender: getVal(row, 'Gender') || getVal(row, 'bnf_section_-gender_') || getVal(row, 'bnf_section-gender') || getVal(row, 'Gender'),
                    phoneNumber: getVal(row, 'Ben_phone') || getVal(row, 'bnf_section_-phone_number_') || getVal(row, 'bnf_section-phone_number') || getVal(row, 'phone number'),
                    cluster: getVal(row, 'Cluster') || getVal(row, 'cluster') || getVal(row, 'location-block') || getVal(row, 'CLUSTER'),
                    gp: getVal(row, 'GP') || getVal(row, 'location-gp') || getVal(row, 'GP'),
                    village: getVal(row, 'Village') || getVal(row, 'location-village') || getVal(row, 'village'),
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
                    const key = b.beneficiaryId || b.hhId;
                    if (key) mergedMap.set(key, b);
                });

                // Merge distribution data
                distData.forEach(b => {
                    const key = b.beneficiaryId || b.hhId;
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
    const clusterOptions = useMemo(() => ['All', ...Array.from(new Set(data.map(d => d.cluster))).filter(Boolean).sort()], [data]);
    const gpOptions = useMemo(() => ['All', ...Array.from(new Set(data.filter(d => filterCluster === 'All' || d.cluster === filterCluster).map(d => d.gp))).filter(Boolean).sort()], [data, filterCluster]);
    const villageOptions = useMemo(() => ['All', ...Array.from(new Set(data.filter(d => (filterCluster === 'All' || d.cluster === filterCluster) && (filterGP === 'All' || d.gp === filterGP)).map(d => d.village))).filter(Boolean).sort()], [data, filterCluster, filterGP]);
    const activityOptions = useMemo(() => ['All', ...Array.from(new Set(data.map(d => d.activity))).filter(Boolean).sort()], [data]);

    const filteredData = useMemo(() => {
        return data.filter(d => {
            const matchesCluster = filterCluster === 'All' || d.cluster === filterCluster;
            const matchesGP = filterGP === 'All' || d.gp === filterGP;
            const matchesVillage = filterVillage === 'All' || d.village === filterVillage;
            const matchesActivity = filterActivity === 'All' || d.activity === filterActivity;
            const matchesSearch = d.beneficiaryName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 d.beneficiaryId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 d.hhHeadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 d.hhId.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCluster && matchesGP && matchesVillage && matchesActivity && matchesSearch;
        });
    }, [data, filterCluster, filterGP, filterVillage, filterActivity, searchQuery]);

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
        filteredData.forEach(d => {
            const act = d.activity || 'Unassigned';
            activityCounts[act] = (activityCounts[act] || 0) + 1;
        });

        const activityData = Object.entries(activityCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

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

        return { total, activityData, genderData, averageAge, uniqueVillages, uniqueGPs, clusterData };
    }, [filteredData]);

    const clearFilters = () => {
        setFilterCluster('All');
        setFilterGP('All');
        setFilterVillage('All');
        setFilterActivity('All');
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
        <div className="flex flex-col gap-6 animate-fade-in pb-20">
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
                    {(filterCluster !== 'All' || filterGP !== 'All' || filterVillage !== 'All' || filterActivity !== 'All' || searchQuery !== '') && (
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
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
                        <Search className="w-3 h-3" /> Search
                    </label>
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="NAME / ID / HHID..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-900 pl-4 pr-10 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    </div>
                </div>
            </div>

            {/* 3. ANALYTICS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Key Metrics Bento */}
                <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2 bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-100 dark:shadow-none flex flex-col justify-between relative overflow-hidden group">
                        <Users className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 group-hover:scale-110 transition-transform duration-700" />
                        <div>
                            <p className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em] mb-1">Total Beneficiaries</p>
                            <p className="text-5xl font-black tracking-tighter">{stats.total.toLocaleString()}</p>
                        </div>
                        <div className="mt-6 flex items-center gap-2">
                            <div className="h-1 w-12 bg-white/30 rounded-full"></div>
                            <span className="text-[8px] font-black uppercase opacity-60">Live Registry Count</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">Avg. Age</p>
                            <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.averageAge.toFixed(1)}</p>
                        </div>
                        <div className="mt-2 text-[8px] font-black uppercase text-indigo-500">Years Old</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">Villages</p>
                            <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.uniqueVillages}</p>
                        </div>
                        <div className="mt-2 text-[8px] font-black uppercase text-emerald-500">{stats.uniqueGPs} GPs Covered</div>
                    </div>
                </div>

                {/* Activity Distribution Chart */}
                <div className="lg:col-span-4 bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Activity Distribution</h3>
                        <ActivityIcon className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="flex-grow min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.activityData.slice(0, 6)} layout="vertical" margin={{ left: -20, right: 30 }}>
                                <XAxis type="number" hide />
                                <YAxis 
                                    dataKey="name" 
                                    type="category" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    width={100}
                                    tick={{ fontSize: 9, fontWeight: 900, fill: '#9ca3af' }}
                                />
                                <Tooltip 
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                                />
                                <Bar 
                                    dataKey="value" 
                                    radius={[0, 4, 4, 0]}
                                    label={{ position: 'right', fill: '#6b7280', fontSize: 9, fontWeight: 900 }}
                                >
                                    {stats.activityData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Cluster Distribution Chart */}
                <div className="lg:col-span-4 bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Cluster Distribution</h3>
                        <MapPin className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex-grow min-h-[160px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.clusterData}
                                    innerRadius={45}
                                    outerRadius={65}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                    labelLine={true}
                                >
                                    {stats.clusterData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-lg font-black text-gray-900 dark:text-white">{stats.uniqueGPs}</span>
                            <span className="text-[7px] font-black uppercase text-gray-400">GPs</span>
                        </div>
                    </div>
                </div>

                {/* Gender Split Chart */}
                <div className="lg:col-span-4 bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Gender Split</h3>
                        <Users className="w-4 h-4 text-pink-500" />
                    </div>
                    <div className="flex-grow min-h-[160px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.genderData}
                                    innerRadius={45}
                                    outerRadius={65}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                    labelLine={true}
                                >
                                    {stats.genderData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-lg font-black text-gray-900 dark:text-white">{stats.total}</span>
                            <span className="text-[7px] font-black uppercase text-gray-400">Total</span>
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
                        {stats.genderData.map((g, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ background: COLORS[idx % COLORS.length] }}></div>
                                <span className="text-[8px] font-black uppercase text-gray-500">{g.name} {g.percentage.toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. DETAILED TABLE */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50 dark:bg-gray-900/20">
                    <div>
                        <h2 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">Beneficiary Registry</h2>
                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">Detailed Demographics & Activity Log</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest">
                        <UserCheck className="w-3 h-3" />
                        {filteredData.length.toLocaleString()} Records
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
                                    onClick={() => requestSort('activity')}
                                >
                                    <div className="flex items-center gap-2">
                                        Activity
                                        <ArrowUpDown className={cn("w-3 h-3 transition-opacity", sortConfig?.key === 'activity' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover:opacity-50")} />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('beneficiaryName')}
                                >
                                    <div className="flex items-center gap-2">
                                        Beneficiary Details
                                        <ArrowUpDown className={cn("w-3 h-3 transition-opacity", sortConfig?.key === 'beneficiaryName' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover:opacity-50")} />
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
                                    onClick={() => requestSort('village')}
                                >
                                    <div className="flex items-center gap-2">
                                        Location & Contact
                                        <ArrowUpDown className={cn("w-3 h-3 transition-opacity", sortConfig?.key === 'village' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover:opacity-50")} />
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
                                            <span className="inline-flex items-center px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[8px] font-black uppercase tracking-widest border border-indigo-100/50 dark:border-indigo-900/50">
                                                {b.activity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[11px] font-black text-gray-900 dark:text-white uppercase">{b.beneficiaryName}</div>
                                            <div className="text-[9px] font-bold text-indigo-500 uppercase tracking-tighter opacity-80">{b.beneficiaryId}</div>
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
                                            <div className="text-[8px] font-bold text-gray-400 uppercase tracking-tight">{b.village}, {b.gp}</div>
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
                                                                <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                                    <div className="flex justify-between items-start mb-1">
                                                                        <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase">{asset.label}</span>
                                                                        <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded text-[9px] font-black uppercase">
                                                                            {asset.count} {asset.unit}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center mt-2">
                                                                        <span className="text-[8px] font-bold text-gray-400 uppercase">{asset.date}</span>
                                                                        <span className="text-[8px] font-bold text-indigo-400 uppercase">{asset.distributor}</span>
                                                                    </div>
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
                                            {/* HH Head Name */}
                                            <div>
                                                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">HH Head</p>
                                                <p className="text-sm font-black text-gray-900 dark:text-white uppercase">{b.hhHeadName}</p>
                                            </div>
                                            
                                            {/* Activity */}
                                            <div>
                                                <span className="inline-flex items-center px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-md text-[8px] font-black uppercase tracking-widest border border-indigo-100/50 dark:border-indigo-900/50">
                                                    {b.activity}
                                                </span>
                                            </div>

                                            {/* Beneficiary Name */}
                                            <div>
                                                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Beneficiary</p>
                                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">{b.beneficiaryName}</p>
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
                                                            <div key={idx} className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                                                <div className="flex justify-between items-start mb-1">
                                                                    <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase">{asset.label}</span>
                                                                    <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded text-[8px] font-black uppercase">
                                                                        {asset.count} {asset.unit}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between items-center mt-2">
                                                                    <span className="text-[7px] font-bold text-gray-400 uppercase">{asset.date}</span>
                                                                    <span className="text-[7px] font-bold text-indigo-400 uppercase">{asset.distributor}</span>
                                                                </div>
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
        </div>
    );
};

export default BeneficiaryExplorer;
