
import React, { useState, useEffect, useMemo } from 'react';
import { BASELINE_DATA_URL, CONTRIBUTION_DATA_URL } from '../config';

interface BaselineRecord {
    farmerId: string;
    hhHeadName: string;
    cluster: string;
    gp: string;
    village: string;
    category: string;
}

interface MergedContribution {
    id: string; // Unique transaction identifier
    farmerId: string;
    name: string;
    cluster: string;
    gp: string;
    village: string;
    amount: number;
    activity: string;
    date: string;
    category: string;
}

const ContributionPage: React.FC = () => {
    const [mergedData, setMergedData] = useState<MergedContribution[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [selectedCluster, setSelectedCluster] = useState('All');
    const [selectedGP, setSelectedGP] = useState('All');
    const [selectedVillage, setSelectedVillage] = useState('All');
    const [selectedActivity, setSelectedActivity] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    const parseCSV = (csv: string): Record<string, string>[] => {
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
        // Clean headers for keys
        const cleanHeaders = rawHeaders.map(h => h.trim().toUpperCase());

        return lines.slice(1).map(line => {
            const vals = parseLine(line);
            const obj: any = {};
            cleanHeaders.forEach((h, i) => { if (h) obj[h] = vals[i] || ''; });
            return obj;
        });
    };

    /**
     * Normalizes IDs to ensure "001" matches "1"
     */
    const normalizeId = (id: any): string => {
        if (!id) return '';
        const str = id.toString().trim();
        if (/^\d+$/.test(str)) {
            return parseInt(str, 10).toString();
        }
        return str;
    };

    // Helper to find a value by checking multiple key variants
    const getFuzzyValue = (row: any, keys: string[]) => {
        const rowKeys = Object.keys(row);
        for (const k of keys) {
            const match = rowKeys.find(rk => rk === k.toUpperCase() || rk.includes(k.toUpperCase()) || k.toUpperCase().includes(rk));
            if (match) return row[match];
        }
        return '';
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [baselineRes, contribRes] = await Promise.all([
                    fetch(`${BASELINE_DATA_URL}&cb=${Date.now()}`),
                    fetch(`${CONTRIBUTION_DATA_URL}&cb=${Date.now()}`)
                ]);

                if (!baselineRes.ok || !contribRes.ok) throw new Error("Synchronization failure with master spreadsheets.");

                const baselineText = await baselineRes.text();
                const contribText = await contribRes.text();

                const rawBaseline = parseCSV(baselineText);
                const rawContrib = parseCSV(contribText);

                // 1. Build Baseline Reference Map
                const baselineMap = new Map<string, BaselineRecord>();
                rawBaseline.forEach(row => {
                    const rawId = getFuzzyValue(row, ['FARMERID', 'FID', 'ID']);
                    const normId = normalizeId(rawId);
                    if (normId) {
                        baselineMap.set(normId, {
                            farmerId: rawId.toString(),
                            hhHeadName: getFuzzyValue(row, ['HHHEADNAME', 'FARMERNAME', 'NAME', 'BENEFICIARYNAME']),
                            cluster: getFuzzyValue(row, ['CLUSTER']),
                            gp: getFuzzyValue(row, ['GP', 'GRAMPANCHAYAT']),
                            village: getFuzzyValue(row, ['VILLAGE']),
                            category: getFuzzyValue(row, ['CATEGORY', 'CASTE'])
                        });
                    }
                });

                // 2. Identify Activity Columns in the contribution sheet
                const activityHeaders = [
                    'BYP-NS', 'MOBILE IRR', 'PROCESSING', 'ASC', 'CROP MOD', 
                    'BYP-BFE', 'FISHERIES', 'GOAT SHED', 'ECO-FARMPOND', 'FIXED IRRIG'
                ];

                const headersInSheet = Object.keys(rawContrib[0] || {});
                const foundActivityColumns = activityHeaders.filter(ah => 
                    headersInSheet.some(h => h.includes(ah.toUpperCase()))
                );

                // 3. Process every row and every activity column
                const merged: MergedContribution[] = [];
                rawContrib.forEach((row, rowIndex) => {
                    const rawId = getFuzzyValue(row, ['FARMERID', 'FID', 'ID']);
                    const normId = normalizeId(rawId);
                    const date = getFuzzyValue(row, ['DATE', 'TIMESTAMP', 'TIME', 'SUBMISSIONDATE']) || 'N/A';

                    if (normId) {
                        const baseline = baselineMap.get(normId);
                        if (baseline) {
                            foundActivityColumns.forEach((colName) => {
                                const valStr = row[colName] || row[headersInSheet.find(h => h.includes(colName)) || ''] || '0';
                                const amount = parseFloat(valStr.toString().replace(/[^0-9.]/g, '')) || 0;

                                if (amount > 0) {
                                    merged.push({
                                        id: `${normId}-${colName}-${rowIndex}`,
                                        farmerId: baseline.farmerId,
                                        name: baseline.hhHeadName,
                                        cluster: baseline.cluster,
                                        gp: baseline.gp,
                                        village: baseline.village,
                                        category: baseline.category,
                                        amount: amount,
                                        activity: colName,
                                        date: date
                                    });
                                }
                            });
                        }
                    }
                });

                setMergedData(merged.sort((a, b) => {
                    const dateA = new Date(a.date).getTime() || 0;
                    const dateB = new Date(b.date).getTime() || 0;
                    if (dateB !== dateA) return dateB - dateA;
                    return a.name.localeCompare(b.name);
                }));
            } catch (err: any) {
                console.error("Data processing error:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Filter Dynamic Calculations
    const clusters = useMemo(() => ['All', ...Array.from(new Set(mergedData.map(d => d.cluster).filter(Boolean))).sort()], [mergedData]);
    const gps = useMemo(() => {
        const filtered = selectedCluster === 'All' ? mergedData : mergedData.filter(d => d.cluster === selectedCluster);
        return ['All', ...Array.from(new Set(filtered.map(d => d.gp).filter(Boolean))).sort()];
    }, [mergedData, selectedCluster]);
    const villages = useMemo(() => {
        const filtered = selectedGP === 'All' 
            ? (selectedCluster === 'All' ? mergedData : mergedData.filter(d => d.cluster === selectedCluster))
            : mergedData.filter(d => d.gp === selectedGP);
        return ['All', ...Array.from(new Set(filtered.map(d => d.village).filter(Boolean))).sort()];
    }, [mergedData, selectedCluster, selectedGP]);
    
    // New: Activity Name options
    const activityOptions = useMemo(() => ['All', ...Array.from(new Set(mergedData.map(d => d.activity).filter(Boolean))).sort()], [mergedData]);

    const filteredData = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        return mergedData.filter(d => {
            const matchesCluster = selectedCluster === 'All' || d.cluster === selectedCluster;
            const matchesGP = selectedGP === 'All' || d.gp === selectedGP;
            const matchesVillage = selectedVillage === 'All' || d.village === selectedVillage;
            const matchesActivity = selectedActivity === 'All' || d.activity === selectedActivity;
            const matchesSearch = !query || 
                d.name.toLowerCase().includes(query) || 
                d.farmerId.toLowerCase().includes(query) ||
                d.activity.toLowerCase().includes(query);
            return matchesCluster && matchesGP && matchesVillage && matchesActivity && matchesSearch;
        });
    }, [mergedData, selectedCluster, selectedGP, selectedVillage, selectedActivity, searchQuery]);

    const totals = useMemo(() => {
        const amount = filteredData.reduce((acc, d) => acc + d.amount, 0);
        const uniqueFIDs = new Set(filteredData.map(d => d.farmerId)).size;
        return { amount, count: filteredData.length, uniqueFIDs };
    }, [filteredData]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 font-black uppercase tracking-widest text-[10px] animate-pulse">Mapping Activity Contributions...</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
            {/* KPI Summary Strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-600 p-6 rounded-[2.5rem] text-white shadow-xl flex flex-col justify-between h-36">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Total Collected</p>
                    <div>
                        <h2 className="text-3xl font-black">₹{totals.amount.toLocaleString()}</h2>
                        <p className="text-[9px] font-bold opacity-60 uppercase mt-1">{totals.count} Contribution Instances</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl flex flex-col justify-between h-36">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Contributor Base</p>
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white">{totals.uniqueFIDs}</h2>
                        <p className="text-[9px] font-black uppercase text-emerald-500 mt-1">Unique Beneficiaries</p>
                    </div>
                </div>
                <div className="bg-indigo-600 p-6 rounded-[2.5rem] text-white shadow-xl flex flex-col justify-center h-36 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Active Filters</p>
                    <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase border border-white/10 whitespace-nowrap">Cl: {selectedCluster}</span>
                        <span className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase border border-white/10 whitespace-nowrap">Act: {selectedActivity}</span>
                        <span className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase border border-white/10 whitespace-nowrap">Vi: {selectedVillage}</span>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="relative group col-span-1 md:col-span-1">
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-bold focus:ring-2 focus:ring-emerald-500 text-xs transition-all shadow-inner"
                        />
                        <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                    
                    <select value={selectedActivity} onChange={(e) => setSelectedActivity(e.target.value)} className="bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-black text-[10px] uppercase cursor-pointer text-indigo-600">
                        <option value="All">All Activities</option>
                        {activityOptions.filter(o => o !== 'All').map(o => <option key={o} value={o}>{o}</option>)}
                    </select>

                    <select value={selectedCluster} onChange={(e) => { setSelectedCluster(e.target.value); setSelectedGP('All'); setSelectedVillage('All'); }} className="bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-black text-[10px] uppercase cursor-pointer">
                        <option value="All">All Clusters</option>
                        {clusters.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    
                    <select value={selectedGP} onChange={(e) => { setSelectedGP(e.target.value); setSelectedVillage('All'); }} className="bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-black text-[10px] uppercase cursor-pointer">
                        <option value="All">All GPs</option>
                        {gps.filter(g => g !== 'All').map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    
                    <select value={selectedVillage} onChange={(e) => setSelectedVillage(e.target.value)} className="bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-black text-[10px] uppercase cursor-pointer">
                        <option value="All">All Villages</option>
                        {villages.filter(v => v !== 'All').map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>
            </div>

            {/* Detailed Transaction Table */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-gray-900/80 border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Beneficiary Details</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Activity Head</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Village Profile</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Fund Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {filteredData.map((row) => (
                                <tr key={row.id} className="hover:bg-emerald-50/20 dark:hover:bg-emerald-900/10 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="font-black text-gray-900 dark:text-white text-sm group-hover:text-emerald-600 transition-colors telugu-font leading-tight">{row.name}</div>
                                        <div className="flex flex-col mt-1">
                                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight">FID: {row.farmerId}</span>
                                            <span className="text-[9px] font-black text-gray-400 uppercase">{row.category}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 leading-snug max-w-xs uppercase">{row.activity}</div>
                                        <div className="text-[9px] font-black uppercase text-gray-400 mt-1">{row.date}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-xs font-bold text-gray-800 dark:text-gray-100">{row.village}</div>
                                        <div className="text-[9px] font-black uppercase text-gray-400 tracking-tighter">{row.gp} • {row.cluster}</div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="inline-block px-5 py-2 bg-emerald-600 text-white rounded-full font-black text-sm shadow-lg shadow-emerald-200 dark:shadow-none border border-white/10 group-hover:scale-105 transition-transform">
                                            ₹{row.amount.toLocaleString()}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredData.length === 0 && (
                    <div className="p-32 text-center text-gray-300 font-black uppercase tracking-[0.4em] text-[10px] italic">
                        No Matching Contribution Records Found
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
};

export default ContributionPage;
