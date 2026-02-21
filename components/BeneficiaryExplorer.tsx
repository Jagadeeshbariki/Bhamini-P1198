
import React, { useState, useEffect, useMemo } from 'react';
import { BENEFICIARY_DATA_URL } from '../config';

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
}

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

    const parseCSV = (csv: string): Beneficiary[] => {
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
        const cleanHeaders = headers.map(h => h.toUpperCase().replace(/\s+/g, ''));

        const getVal = (row: string[], search: string) => {
            const searchClean = search.toUpperCase().replace(/\s+/g, '');
            // Try exact match first to avoid partial matches (e.g., 'Activity' matching 'Activity Registration Date')
            let idx = cleanHeaders.findIndex(h => h === searchClean);
            if (idx === -1) {
                // Fallback to includes only if exact match fails
                idx = cleanHeaders.findIndex(h => h.includes(searchClean));
            }
            return idx !== -1 ? row[idx] : '';
        };

        return lines.slice(1).map(line => {
            const row = parseLine(line);
            if (row.length < 5) return null;

            return {
                hhId: getVal(row, 'HH Id') || getVal(row, 'HHID') || getVal(row, 'House Hold ID'),
                hhHeadName: getVal(row, 'HH Head Name') || getVal(row, 'HHHEADNAME') || getVal(row, 'HH Head Name'),
                activity: getVal(row, 'Activity') || getVal(row, 'activity_registration-activity'),
                beneficiaryName: getVal(row, 'Beneficiary Name') || getVal(row, 'bnf_section-bnf_name') || getVal(row, 'bnf_section_-bnf_name_') || getVal(row, 'location-show_farmer_name'),
                beneficiaryId: getVal(row, 'Beneficiary ID') || getVal(row, 'bnf_section-adhaar_number') || getVal(row, 'bnf_section_-adhaar_number_') || getVal(row, 'location-show_farmer_id'),
                age: parseInt(getVal(row, 'Age') || getVal(row, 'bnf_section-age') || getVal(row, 'bnf_section_-age_')) || 0,
                gender: getVal(row, 'Gender') || getVal(row, 'bnf_section-gender') || getVal(row, 'bnf_section_-gender_'),
                phoneNumber: getVal(row, 'phone number') || getVal(row, 'bnf_section-phone_number') || getVal(row, 'bnf_section_-phone_number_'),
                cluster: getVal(row, 'cluster') || getVal(row, 'CLUSTER'),
                gp: getVal(row, 'GP'),
                village: getVal(row, 'village'),
            };
        }).filter((b): b is Beneficiary => !!b && !!b.beneficiaryName);
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${BENEFICIARY_DATA_URL}&t=${Date.now()}`);
                const text = await response.text();
                setData(parseCSV(text));
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
                                 d.hhHeadName.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCluster && matchesGP && matchesVillage && matchesActivity && matchesSearch;
        });
    }, [data, filterCluster, filterGP, filterVillage, filterActivity, searchQuery]);

    const sortedData = useMemo(() => {
        let sortableItems = [...filteredData];
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

    const SortIcon = ({ columnKey }: { columnKey: keyof Beneficiary }) => {
        if (!sortConfig || sortConfig.key !== columnKey) {
            return (
                <svg className="w-3 h-3 ml-1 opacity-20 group-hover:opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
            );
        }
        return sortConfig.direction === 'asc' ? (
            <svg className="w-3 h-3 ml-1 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" />
            </svg>
        ) : (
            <svg className="w-3 h-3 ml-1 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
            </svg>
        );
    };

    const stats = useMemo(() => {
        const total = filteredData.length;
        
        const activityCounts: Record<string, number> = {};
        filteredData.forEach(d => {
            const act = d.activity || 'Unassigned';
            activityCounts[act] = (activityCounts[act] || 0) + 1;
        });

        const genderCounts: Record<string, number> = {};
        filteredData.forEach(d => {
            const g = d.gender?.trim().toLowerCase() || 'unknown';
            const label = g.startsWith('m') ? 'Male' : g.startsWith('f') ? 'Female' : 'Other';
            genderCounts[label] = (genderCounts[label] || 0) + 1;
        });

        const genderData = Object.entries(genderCounts).map(([label, count]) => ({
            label,
            count,
            percent: total > 0 ? (count / total) * 100 : 0
        }));

        const averageAge = total > 0 ? filteredData.reduce((acc, d) => acc + d.age, 0) / total : 0;
        const uniqueVillages = new Set(filteredData.map(d => d.village)).size;

        return { total, activityCounts, genderData, averageAge, uniqueVillages };
    }, [filteredData]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Syncing Beneficiary Registry...</p>
        </div>
    );

    return (
        <div className="flex flex-col gap-8 animate-fade-in pb-20">
            {/* 1. FILTERS */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-2">Cluster</label>
                    <select value={filterCluster} onChange={e => { setFilterCluster(e.target.value); setFilterGP('All'); setFilterVillage('All'); }} className="bg-gray-50 dark:bg-gray-900 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer focus:ring-2 focus:ring-indigo-500">
                        {clusterOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-2">GP</label>
                    <select value={filterGP} onChange={e => { setFilterGP(e.target.value); setFilterVillage('All'); }} className="bg-gray-50 dark:bg-gray-900 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer focus:ring-2 focus:ring-indigo-500">
                        {gpOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-2">Village</label>
                    <select value={filterVillage} onChange={e => setFilterVillage(e.target.value)} className="bg-gray-50 dark:bg-gray-900 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer focus:ring-2 focus:ring-indigo-500">
                        {villageOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-2">Activity</label>
                    <select value={filterActivity} onChange={e => setFilterActivity(e.target.value)} className="bg-gray-50 dark:bg-gray-900 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer focus:ring-2 focus:ring-indigo-500">
                        {activityOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-2">Search</label>
                    <input 
                        type="text" 
                        placeholder="Name / ID..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="bg-gray-50 dark:bg-gray-900 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            {/* 2. SCORECARDS & CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Main Scorecards Column */}
                <div className="flex flex-col gap-4">
                    <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-200 dark:shadow-none">
                        <p className="text-[9px] font-black uppercase opacity-60 tracking-[0.2em] mb-1">Total Beneficiaries</p>
                        <p className="text-4xl font-black tracking-tighter">{stats.total}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                            <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest mb-1">Avg. Age</p>
                            <p className="text-xl font-black text-gray-800 dark:text-white">{stats.averageAge.toFixed(1)}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                            <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest mb-1">Villages</p>
                            <p className="text-xl font-black text-gray-800 dark:text-white">{stats.uniqueVillages}</p>
                        </div>
                    </div>
                </div>

                {/* Activity Wise Counts */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-4">Activity Distribution</h3>
                    <div className="flex-grow grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto pr-2 custom-scrollbar max-h-[180px]">
                        {Object.entries(stats.activityCounts).map(([activity, count]) => (
                            <div key={activity} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-col justify-center">
                                <p className="text-[8px] font-black uppercase text-gray-400 truncate mb-1">{activity}</p>
                                <p className="text-lg font-black text-gray-800 dark:text-white">{count}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Gender Pie Chart */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-4">Gender Split</h3>
                    <div className="relative w-28 h-28">
                        <PieChart data={stats.genderData} />
                    </div>
                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                        {stats.genderData.map((g, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ background: COLORS[idx % COLORS.length] }}></div>
                                <span className="text-[8px] font-black uppercase text-gray-500">{g.label} ({g.percent.toFixed(0)}%)</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3. DETAILED TABLE */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
                    <div>
                        <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Beneficiary Registry</h2>
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Detailed Demographics & Activity Log</p>
                    </div>
                    <div className="px-4 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase">
                        {filteredData.length} Records
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50">
                                <th 
                                    className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('hhId')}
                                >
                                    <div className="flex items-center">
                                        HH ID & Head
                                        <SortIcon columnKey="hhId" />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('activity')}
                                >
                                    <div className="flex items-center">
                                        Activity
                                        <SortIcon columnKey="activity" />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('beneficiaryName')}
                                >
                                    <div className="flex items-center">
                                        Beneficiary Details
                                        <SortIcon columnKey="beneficiaryName" />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('age')}
                                >
                                    <div className="flex items-center">
                                        Age/Gender
                                        <SortIcon columnKey="age" />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('village')}
                                >
                                    <div className="flex items-center">
                                        Contact
                                        <SortIcon columnKey="village" />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {sortedData.map((b, i) => (
                                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-[11px] font-black text-gray-900 dark:text-white uppercase">{b.hhId}</div>
                                        <div className="text-[9px] font-bold text-gray-400 uppercase">{b.hhHeadName}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[9px] font-black uppercase">
                                            {b.activity}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-[11px] font-black text-gray-900 dark:text-white uppercase">{b.beneficiaryName}</div>
                                        <div className="text-[9px] font-bold text-indigo-500 uppercase tracking-tighter">{b.beneficiaryId}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-black text-gray-700 dark:text-gray-300">{b.age} Yrs</span>
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${b.gender?.toLowerCase().startsWith('m') ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
                                                {b.gender}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-[11px] font-black text-gray-600 dark:text-gray-400 font-mono">{b.phoneNumber}</div>
                                        <div className="text-[8px] font-bold text-gray-400 uppercase">{b.village}, {b.gp}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; }
            `}</style>
        </div>
    );
};

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];

const PieChart: React.FC<{ data: { label: string; percent: number }[] }> = ({ data }) => {
    let currentOffset = 0;
    const radius = 40;
    const circ = 2 * Math.PI * radius;

    return (
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            {data.map((item, idx) => {
                const dash = (item.percent / 100) * circ;
                const offset = circ - dash;
                const stroke = COLORS[idx % COLORS.length];
                const res = (
                    <circle 
                        key={idx}
                        cx="50" cy="50" r={radius} 
                        fill="transparent" 
                        stroke={stroke} 
                        strokeWidth="12" 
                        strokeDasharray={circ}
                        strokeDashoffset={offset}
                        style={{ transformOrigin: 'center', transform: `rotate(${(currentOffset/100)*360}deg)`, transition: 'all 1s ease' }}
                    />
                );
                currentOffset += item.percent;
                return res;
            })}
            <circle cx="50" cy="50" r="30" className="fill-white dark:fill-gray-800" />
        </svg>
    );
};

export default BeneficiaryExplorer;
