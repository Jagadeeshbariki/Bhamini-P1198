
import React, { useState, useEffect, useMemo } from 'react';
import { ASSETS_DATA_URL } from '../config';

interface AssetRecord {
    id: string;
    projectCode: string;
    budgetHead: string;
    activityCode: string;
    assetCode: string;
    assetName: string;
    dateOfPurchase: string;
    dateOfReceipt: string;
    costPerUnit: number;
    hdfcContribution: number;
    communityContribution: number;
    qtyPurchased: number;
    qtyReceived: number; // Central/Main Receipt
    pending: number;
    totalPrice: number;
    paymentStatus: string;
    assetStatus: string;
    qtyCluster1: number;
    distCluster1: number;
    qtyCluster2: number;
    distCluster2: number;
    qtyCluster3: number;
    distCluster3: number;
}

const AssetTrackingDashboard: React.FC = () => {
    const [data, setData] = useState<AssetRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterBudgetHead, setFilterBudgetHead] = useState('All');
    const [filterCluster, setFilterCluster] = useState('All');

    const parseCSV = (csv: string): AssetRecord[] => {
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
            const idx = cleanHeaders.findIndex(h => h.includes(search.toUpperCase().replace(/\s+/g, '')));
            return idx !== -1 ? row[idx] : '';
        };

        const parseNum = (val: any) => {
            if (val === undefined || val === null) return 0;
            const clean = val.toString().replace(/[^0-9.]/g, '');
            return parseFloat(clean) || 0;
        };

        return lines.slice(1).map(line => {
            const row = parseLine(line);
            if (row.length < 10) return null;

            return {
                id: getVal(row, 'SNO'),
                projectCode: getVal(row, 'PROJECTCODE'),
                budgetHead: getVal(row, 'BUDGETHEAD'),
                activityCode: getVal(row, 'ACTIVITYCODE'),
                assetCode: getVal(row, 'ASSETCODE'),
                assetName: getVal(row, 'ASSETNAME'),
                dateOfPurchase: getVal(row, 'DATEOFPURCHASE'),
                dateOfReceipt: row[10] || '',
                costPerUnit: parseNum(getVal(row, 'COSTOFUNIT')),
                hdfcContribution: parseNum(getVal(row, 'HDFCCONTRIBUTION')),
                communityContribution: parseNum(getVal(row, 'COMMUNITYCONTRIBUTION')),
                qtyPurchased: parseNum(getVal(row, 'NUMBEROFASSETPURCHASED')),
                qtyReceived: parseNum(getVal(row, 'HOWMANYRECEIVED')), 
                pending: parseNum(getVal(row, 'PENDING')),
                totalPrice: parseNum(getVal(row, 'TOTALPRICE')),
                paymentStatus: getVal(row, 'PAYMENTSTATUS'),
                assetStatus: getVal(row, 'STATUSOFTHEASSET'),
                
                qtyCluster1: parseNum(row[21]), 
                distCluster1: parseNum(row[22]),
                qtyCluster2: parseNum(row[25]), 
                distCluster2: parseNum(row[26]),
                qtyCluster3: parseNum(row[29]), 
                distCluster3: parseNum(row[30]),
            };
        }).filter((a): a is AssetRecord => !!a && !!a.assetName);
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${ASSETS_DATA_URL}&t=${Date.now()}`);
                const text = await response.text();
                setData(parseCSV(text));
            } catch (err) {
                console.error("Asset fetch failed", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const budgetHeadOptions = useMemo(() => ['All', ...Array.from(new Set(data.map(d => d.budgetHead))).sort()], [data]);
    const clusterOptions = ['All', 'Cluster 1', 'Cluster 2', 'Cluster 3'];

    const filteredLedgerData = useMemo(() => {
        return data.filter(d => {
            const matchesSearch = d.assetName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 d.assetCode.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesBudget = filterBudgetHead === 'All' || d.budgetHead === filterBudgetHead;
            let matchesCluster = true;
            if (filterCluster !== 'All') {
                if (filterCluster === 'Cluster 1') matchesCluster = d.qtyCluster1 > 0 || d.distCluster1 > 0;
                if (filterCluster === 'Cluster 2') matchesCluster = d.qtyCluster2 > 0 || d.distCluster2 > 0;
                if (filterCluster === 'Cluster 3') matchesCluster = d.qtyCluster3 > 0 || d.distCluster3 > 0;
            }
            return matchesSearch && matchesBudget && matchesCluster;
        });
    }, [data, searchQuery, filterBudgetHead, filterCluster]);

    const stats = useMemo(() => {
        const baseFiltered = data.filter(d => {
            const matchesSearch = d.assetName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 d.assetCode.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesBudget = filterBudgetHead === 'All' || d.budgetHead === filterBudgetHead;
            return matchesSearch && matchesBudget;
        });

        const ordered = baseFiltered.reduce((acc, d) => acc + d.qtyPurchased, 0);
        const receivedCentral = baseFiltered.reduce((acc, d) => acc + d.qtyReceived, 0); 
        const investment = baseFiltered.reduce((acc, d) => acc + d.totalPrice, 0);

        let fieldReached = 0;
        let fieldDistributed = 0;

        baseFiltered.forEach(d => {
            if (filterCluster === 'All' || filterCluster === 'Cluster 1') {
                fieldReached += d.qtyCluster1;
                fieldDistributed += d.distCluster1;
            }
            if (filterCluster === 'All' || filterCluster === 'Cluster 2') {
                fieldReached += d.qtyCluster2;
                fieldDistributed += d.distCluster2;
            }
            if (filterCluster === 'All' || filterCluster === 'Cluster 3') {
                fieldReached += d.qtyCluster3;
                fieldDistributed += d.distCluster3;
            }
        });

        const totalStock = fieldReached - fieldDistributed;

        const expenseMap: Record<string, number> = {};
        baseFiltered.forEach(d => {
            const activity = d.activityCode || 'N/A';
            expenseMap[activity] = (expenseMap[activity] || 0) + d.totalPrice;
        });
        const activityExpenseData = Object.entries(expenseMap).map(([label, total]) => ({ label, total })).sort((a,b) => b.total - a.total).slice(0, 10);
        const maxActivityExpense = Math.max(...activityExpenseData.map(d => d.total), 1);

        const statusMap: Record<string, number> = {};
        baseFiltered.forEach(d => {
            const status = d.assetStatus || 'Unknown';
            statusMap[status] = (statusMap[status] || 0) + 1;
        });
        const totalCount = baseFiltered.length || 1;
        const statusData = Object.entries(statusMap).map(([label, count]) => ({
            label,
            percent: (count / totalCount) * 100,
            count
        })).sort((a, b) => b.percent - a.percent);

        const c1Rec = baseFiltered.reduce((acc, d) => acc + d.qtyCluster1, 0);
        const c1Dist = baseFiltered.reduce((acc, d) => acc + d.distCluster1, 0);
        const c2Rec = baseFiltered.reduce((acc, d) => acc + d.qtyCluster2, 0);
        const c2Dist = baseFiltered.reduce((acc, d) => acc + d.distCluster2, 0);
        const c3Rec = baseFiltered.reduce((acc, d) => acc + d.qtyCluster3, 0);
        const c3Dist = baseFiltered.reduce((acc, d) => acc + d.distCluster3, 0);

        const getPct = (dist: number, rec: number) => rec > 0 ? (dist / rec) * 100 : 0;
        const distributionEfficiency = [
            { label: 'Cluster 1', value: getPct(c1Dist, c1Rec) },
            { label: 'Cluster 2', value: getPct(c2Dist, c2Rec) },
            { label: 'Cluster 3', value: getPct(c3Dist, c3Rec) },
        ];

        return { 
            ordered: Math.round(ordered), 
            receivedCentral: Math.round(receivedCentral), 
            fieldReached: Math.round(fieldReached), 
            fieldDistributed: Math.round(fieldDistributed),
            investment, 
            totalStock: Math.round(totalStock),
            activityExpenseData, maxActivityExpense, statusData, distributionEfficiency
        };
    }, [data, searchQuery, filterBudgetHead, filterCluster]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Asset Pipeline Syncing...</p>
        </div>
    );

    return (
        <div className="flex flex-col gap-8 animate-fade-in pb-20 overflow-visible">
            {/* 1. TOP FILTERS */}
            <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
                    </div>
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Filters:</span>
                </div>
                <input 
                    type="text" 
                    placeholder="Search Asset/Code..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none w-32 md:w-48 focus:ring-2 focus:ring-indigo-500 font-bold"
                />
                <select value={filterBudgetHead} onChange={e => setFilterBudgetHead(e.target.value)} className="bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer">
                    <option value="All">All Budget Heads</option>
                    {budgetHeadOptions.filter(o => o !== 'All').map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <select value={filterCluster} onChange={e => setFilterCluster(e.target.value)} className="bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer">
                    <option value="All">All Clusters (Summary)</option>
                    {clusterOptions.filter(o => o !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            {/* 2. KPI STRIP */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <KPICard label="Ordered Assets" value={stats.ordered} color="bg-blue-600" />
                <KPICard label="Central Received" value={stats.receivedCentral} color="bg-emerald-600" />
                <KPICard label="Field Reached" value={stats.fieldReached} color="bg-indigo-500" />
                <KPICard label="Field Distributed" value={stats.fieldDistributed} color="bg-indigo-700" />
                <KPICard label="Stock In Hand" value={stats.totalStock} color="bg-teal-600" />
                <KPICard label="Total Valuation" value={`₹${(stats.investment/100000).toFixed(1)}L`} color="bg-gray-900" />
            </div>

            {/* 3. ANALYTICS & INSIGHTS - Adjusted to 3 equal columns on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col min-h-[350px]">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-6 px-2">Cluster Distribution Efficiency (%)</h3>
                    <div className="flex-grow flex items-end justify-around gap-4 px-2">
                        {stats.distributionEfficiency.map((c, i) => (
                            <EfficiencyBar key={i} label={c.label} percent={c.value} />
                        ))}
                    </div>
                </div>

                {/* Activity Wise Expenses - Width Adjusted, No Horizontal Scroll */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col min-h-[350px]">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-6 px-2">Activity Wise Expenses</h3>
                    <div className="flex-grow flex items-end justify-between gap-1 px-4 h-full">
                        {stats.activityExpenseData.map((d, i) => (
                            <ActivityBar key={i} label={d.label} value={d.total} max={stats.maxActivityExpense} />
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center min-h-[350px]">
                    <h3 className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-4 px-2 text-center">Asset Physical Status</h3>
                    <div className="relative w-28 h-28 flex items-center justify-center">
                        <PieChart data={stats.statusData} />
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-1 w-full overflow-y-auto custom-scrollbar max-h-[140px]">
                        {stats.statusData.map((s, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-1.5 py-1">
                                <div className="flex items-center gap-1">
                                    <div className={`w-1.5 h-1.5 rounded-full`} style={{ background: COLORS[idx % COLORS.length] }}></div>
                                    <span className="text-[8px] font-black uppercase text-gray-500 truncate max-w-[100px]">{s.label}</span>
                                </div>
                                <span className="text-[8px] font-black text-gray-400">{s.percent.toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. REFINED ASSET LEDGER */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col overflow-visible">
                <div className="sticky top-20 z-[46] bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center rounded-t-[2.5rem] shadow-sm">
                    <div className="flex flex-col">
                        <h2 className="text-lg sm:text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight leading-none">Detailed Asset Ledger</h2>
                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Full Inventory Pipeline</span>
                    </div>
                    <span className="mt-2 sm:mt-0 text-[10px] font-black bg-indigo-100 text-indigo-600 px-4 py-1.5 rounded-full uppercase tracking-tighter">{filteredLedgerData.length} Registry Items</span>
                </div>
                
                <div className="overflow-x-auto sm:overflow-x-visible">
                    <table className="w-full text-left border-separate border-spacing-0 table-auto sm:table-fixed">
                        <thead>
                            <tr className="sticky top-[132px] sm:top-[154px] z-[45]">
                                <th className="px-3 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase text-gray-500 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">Asset & Activity</th>
                                <th className="px-3 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase text-gray-500 bg-gray-100 dark:bg-gray-800 text-center border-b border-gray-200 dark:border-gray-700 shadow-sm">Central Rec.</th>
                                <th className="px-3 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase text-gray-500 bg-gray-100 dark:bg-gray-800 text-center border-b border-gray-200 dark:border-gray-700 shadow-sm">Rec. at Stock</th>
                                <th className="px-3 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase text-gray-500 bg-gray-100 dark:bg-gray-800 text-center border-b border-gray-200 dark:border-gray-700 shadow-sm">Distributed</th>
                                <th className="px-3 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase text-gray-500 bg-gray-100 dark:bg-gray-800 text-right border-b border-gray-200 dark:border-gray-700 shadow-sm">Valuation</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {filteredLedgerData.map((asset, i) => (
                                <tr key={i} className="group hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-3 sm:px-6 py-4 border-b border-gray-50 dark:border-gray-800/50">
                                        <div className="font-black text-gray-900 dark:text-white text-[10px] sm:text-[12px] leading-tight uppercase mb-1">{asset.assetName}</div>
                                        <div className="text-[8px] sm:text-[9px] font-bold text-indigo-500 uppercase tracking-tighter truncate max-w-[120px] sm:max-w-none">{asset.assetCode} • {asset.activityCode}</div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-4 border-b border-gray-50 dark:border-gray-800/50 text-center font-black text-[11px] text-gray-900 dark:text-white uppercase">
                                        {Math.round(asset.qtyReceived)}
                                    </td>
                                    <td className="px-3 sm:px-6 py-4 border-b border-gray-50 dark:border-gray-800/50">
                                        <div className="flex justify-center gap-0.5 sm:gap-1">
                                            {[asset.qtyCluster1, asset.qtyCluster2, asset.qtyCluster3].map((v, idx) => (
                                                <div key={idx} className={`w-6 sm:w-10 py-1 rounded-lg text-center text-[8px] sm:text-[11px] font-black ${v > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 ring-1 ring-emerald-100' : 'bg-gray-50 dark:bg-gray-800 text-gray-300'}`}>{Math.round(v)}</div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-4 border-b border-gray-50 dark:border-gray-800/50">
                                        <div className="flex justify-center gap-0.5 sm:gap-1">
                                            {[asset.distCluster1, asset.distCluster2, asset.distCluster3].map((v, idx) => (
                                                <div key={idx} className={`w-6 sm:w-10 py-1 rounded-lg text-center text-[8px] sm:text-[11px] font-black ${v > 0 ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 ring-1 ring-indigo-100' : 'bg-gray-50 dark:bg-gray-800 text-gray-300'}`}>{Math.round(v)}</div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-4 border-b border-gray-50 dark:border-gray-800/50 text-right">
                                        <div className="text-[10px] sm:text-[12px] font-black text-gray-900 dark:text-white leading-none">₹{asset.totalPrice.toLocaleString()}</div>
                                        <div className={`text-[7px] sm:text-[8px] font-black uppercase tracking-widest mt-1 px-1.5 sm:px-2 py-0.5 rounded-full inline-block ${asset.paymentStatus.toLowerCase().includes('paid') ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{asset.paymentStatus}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
};

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

const KPICard: React.FC<{ label: string; value: any; color: string }> = ({ label, value, color }) => (
    <div className={`${color} p-5 rounded-[2.5rem] text-white shadow-xl shadow-black/5`}>
        <p className="text-[9px] font-black uppercase opacity-60 tracking-[0.2em] mb-1.5">{label}</p>
        <p className="text-2xl font-black tracking-tight">{value}</p>
    </div>
);

const EfficiencyBar: React.FC<{ label: string; percent: number }> = ({ label, percent }) => (
    <div className="flex-1 flex flex-col items-center h-full justify-end group relative max-w-[80px]">
        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all duration-300 z-50 pointer-events-none whitespace-nowrap bg-gray-900 text-white p-2 rounded-xl shadow-xl text-[10px] font-black">
            {percent.toFixed(1)}% Distributed
        </div>
        <div className="w-full flex flex-col items-center gap-2 h-full justify-end">
            <div className="w-8 sm:w-10 bg-indigo-50 dark:bg-gray-700/50 rounded-xl relative overflow-hidden h-full border border-gray-100 dark:border-gray-700">
                <div 
                    className="absolute bottom-0 left-0 right-0 bg-indigo-600 transition-all duration-1000 shadow-inner" 
                    style={{ height: `${percent}%` }}
                >
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[7px] font-black text-white/40 rotate-90">
                        {percent > 20 ? `${percent.toFixed(0)}%` : ''}
                    </div>
                </div>
            </div>
            <span className="text-[9px] font-black text-gray-500 uppercase truncate w-full text-center tracking-tighter leading-tight">{label}</span>
        </div>
    </div>
);

const ActivityBar: React.FC<{ label: string; value: number; max: number }> = ({ label, value, max }) => (
    <div className="flex-1 min-w-0 flex flex-col items-center h-full justify-end group relative">
        {/* Value Tooltip */}
        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all duration-300 z-50 pointer-events-none whitespace-nowrap bg-gray-900 text-white p-2 rounded-xl shadow-xl text-[10px] font-black">
            ₹{value.toLocaleString()}
        </div>
        
        {/* The Column Bar - Flexible Width */}
        <div 
            className="w-1/2 min-w-[12px] max-w-[40px] bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-xl transition-all duration-700 shadow-lg group-hover:scale-y-105 origin-bottom border-t border-white/20" 
            style={{ height: `${(value/max)*100}%`, minHeight: '8px' }}
        ></div>
        
        {/* RE-ALIGNED LABEL */}
        <div className="h-12 mt-4 relative w-full flex justify-center overflow-visible">
            <div className="absolute left-1/2 -translate-x-1/2 flex justify-center items-start">
                <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase rotate-45 origin-top-left whitespace-nowrap leading-none mt-2">
                    {label}
                </span>
            </div>
        </div>
    </div>
);

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
                        strokeWidth="14" 
                        strokeDasharray={circ}
                        strokeDashoffset={offset}
                        style={{ transformOrigin: 'center', transform: `rotate(${(currentOffset/100)*360}deg)`, transition: 'all 1s ease' }}
                    />
                );
                currentOffset += item.percent;
                return res;
            })}
            <text x="50" y="50" className="text-[9px] font-black fill-gray-400 transform rotate-90" textAnchor="middle" dominantBaseline="middle">
                STATUS
            </text>
        </svg>
    );
};

export default AssetTrackingDashboard;
