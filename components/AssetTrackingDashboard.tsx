
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
    qtyReceived: number;
    pending: number;
    totalPrice: number;
    paymentStatus: string;
    assetStatus: string;
    qtyCluster1: number;
    qtyCluster2: number;
    qtyCluster3: number;
    distCluster1: number;
    distCluster2: number;
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
            const idx = cleanHeaders.findIndex(h => h.includes(search));
            return idx !== -1 ? row[idx] : '';
        };

        const parseNum = (val: any) => {
            if (val === undefined || val === null) return 0;
            return parseFloat(val.toString().replace(/[^0-9.]/g, '')) || 0;
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

    const filteredData = useMemo(() => {
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
        const ordered = filteredData.reduce((acc, d) => acc + d.qtyPurchased, 0);
        const received = filteredData.reduce((acc, d) => acc + d.qtyReceived, 0);
        const toReceive = filteredData.reduce((acc, d) => acc + d.pending, 0);
        const investment = filteredData.reduce((acc, d) => acc + d.totalPrice, 0);

        const c1Rec = filteredData.reduce((acc, d) => acc + d.qtyCluster1, 0);
        const c1Dist = filteredData.reduce((acc, d) => acc + d.distCluster1, 0);
        const c2Rec = filteredData.reduce((acc, d) => acc + d.qtyCluster2, 0);
        const c2Dist = filteredData.reduce((acc, d) => acc + d.distCluster2, 0);
        const c3Rec = filteredData.reduce((acc, d) => acc + d.qtyCluster3, 0);
        const c3Dist = filteredData.reduce((acc, d) => acc + d.distCluster3, 0);

        const totalDist = c1Dist + c2Dist + c3Dist;
        const totalStock = (c1Rec - c1Dist) + (c2Rec - c2Dist) + (c3Rec - c3Dist);

        const expenseMap: Record<string, number> = {};
        filteredData.forEach(d => {
            const activity = d.activityCode || 'N/A';
            expenseMap[activity] = (expenseMap[activity] || 0) + d.totalPrice;
        });
        const activityExpenseData = Object.entries(expenseMap).map(([label, total]) => ({ label, total })).sort((a,b) => b.total - a.total).slice(0, 10);
        const maxActivityExpense = Math.max(...activityExpenseData.map(d => d.total), 1);

        const statusMap: Record<string, number> = {};
        filteredData.forEach(d => {
            const status = d.assetStatus || 'Unknown';
            statusMap[status] = (statusMap[status] || 0) + 1;
        });
        const totalCount = filteredData.length || 1;
        const statusData = Object.entries(statusMap).map(([label, count]) => ({
            label,
            percent: (count / totalCount) * 100,
            count
        })).sort((a, b) => b.percent - a.percent);

        const maxChartVal = Math.max(ordered, received, toReceive, c1Rec, c2Rec, c3Rec) || 1;

        return { 
            ordered, received, toReceive, investment, totalDist, totalStock,
            c1Rec, c1Dist, c1Stock: c1Rec - c1Dist,
            c2Rec, c2Dist, c2Stock: c2Rec - c2Dist,
            c3Rec, c3Dist, c3Stock: c3Rec - c3Dist,
            maxChartVal, statusData, activityExpenseData, maxActivityExpense
        };
    }, [filteredData]);

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
                    className="bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none w-32 md:w-48 focus:ring-2 focus:ring-indigo-500"
                />
                <select value={filterBudgetHead} onChange={e => setFilterBudgetHead(e.target.value)} className="bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none">
                    <option value="All">All Budget Heads</option>
                    {budgetHeadOptions.filter(o => o !== 'All').map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <select value={filterCluster} onChange={e => setFilterCluster(e.target.value)} className="bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none">
                    {clusterOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            {/* 2. KPI STRIP */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <KPICard label="Ordered Assets" value={stats.ordered} color="bg-blue-600" />
                <KPICard label="Received Assets" value={stats.received} color="bg-emerald-600" />
                <KPICard label="Need to Receive" value={stats.toReceive} color="bg-amber-500" />
                <KPICard label="Field Distributed" value={stats.totalDist} color="bg-indigo-600" />
                <KPICard label="In Stock Assets" value={stats.totalStock} color="bg-teal-600" />
                <KPICard label="Total Valuation" value={`₹${(stats.investment/100000).toFixed(1)}L`} color="bg-gray-900" />
            </div>

            {/* 3. ANALYTICS & INSIGHTS */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1.5 bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col min-h-[300px]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Cluster Reach Summary</h3>
                        <div className="flex gap-2 text-[7px] font-black uppercase">
                            <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded bg-indigo-500"></div>R</div>
                            <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded bg-blue-400"></div>I</div>
                            <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded bg-teal-400"></div>S</div>
                        </div>
                    </div>
                    <div className="flex-grow flex items-end justify-around gap-4 px-2">
                        <ClusterGroup label="C1" rec={stats.c1Rec} dist={stats.c1Dist} stock={stats.c1Stock} max={stats.maxChartVal} />
                        <ClusterGroup label="C2" rec={stats.c2Rec} dist={stats.c2Dist} stock={stats.c2Stock} max={stats.maxChartVal} />
                        <ClusterGroup label="C3" rec={stats.c3Rec} dist={stats.c3Dist} stock={stats.c3Stock} max={stats.maxChartVal} />
                    </div>
                </div>

                <div className="lg:col-span-1.5 bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col min-h-[300px]">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-6">Activity Wise Expenses</h3>
                    <div className="flex-grow flex items-end justify-around gap-2 px-2 overflow-x-auto no-scrollbar">
                        {stats.activityExpenseData.map((d, i) => (
                            <ActivityBar key={i} label={d.label} value={d.total} max={stats.maxActivityExpense} />
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center min-h-[300px]">
                    <h3 className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-4">Asset Physical Status</h3>
                    <div className="relative w-28 h-28 flex items-center justify-center">
                        <PieChart data={stats.statusData} />
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-1 w-full overflow-y-auto custom-scrollbar max-h-[120px]">
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

            {/* 4. REFINED ASSET LEDGER (FIXED STICKY POSITIONING) */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col overflow-visible">
                {/* 
                    CONSOLIDATED STICKY HEADER
                    To avoid overlap issues, we put the Title and Headers in a single sticky block if they are close, 
                    OR we ensure the offsets are exactly calculated. 
                    Main Navigation = top-0, h-20 (80px).
                */}
                <div className="sticky top-20 z-[46] bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center rounded-t-[2.5rem] shadow-sm">
                    <div className="flex flex-col">
                        <h2 className="text-lg sm:text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight leading-none">Detailed Asset Ledger</h2>
                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Full Inventory Pipeline</span>
                    </div>
                    <span className="mt-2 sm:mt-0 text-[10px] font-black bg-indigo-100 text-indigo-600 px-4 py-1.5 rounded-full uppercase tracking-tighter">{filteredData.length} Registry Items</span>
                </div>
                
                <div className="overflow-x-auto sm:overflow-x-visible">
                    <table className="w-full text-left border-separate border-spacing-0 table-auto sm:table-fixed">
                        <thead>
                            {/* 
                                COLUMN HEADERS
                                Offset = 80px (Main Nav) + 74px (Approx Title Bar Height) = 154px.
                                We'll use 154px as a stable top value.
                            */}
                            <tr className="sticky top-[132px] sm:top-[154px] z-[45]">
                                <th className="px-3 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase text-gray-500 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">Asset & Activity</th>
                                <th className="px-3 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase text-gray-500 bg-gray-100 dark:bg-gray-800 text-center border-b border-gray-200 dark:border-gray-700 shadow-sm">Status</th>
                                <th className="px-3 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase text-gray-500 bg-gray-100 dark:bg-gray-800 text-center border-b border-gray-200 dark:border-gray-700 shadow-sm">Reach</th>
                                <th className="px-3 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase text-gray-500 bg-gray-100 dark:bg-gray-800 text-center border-b border-gray-200 dark:border-gray-700 shadow-sm">Distribution</th>
                                <th className="px-3 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase text-gray-500 bg-gray-100 dark:bg-gray-800 text-right border-b border-gray-200 dark:border-gray-700 shadow-sm">Valuation</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {filteredData.map((asset, i) => (
                                <tr key={i} className="group hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-3 sm:px-6 py-4 border-b border-gray-50 dark:border-gray-800/50">
                                        <div className="font-black text-gray-900 dark:text-white text-[10px] sm:text-[12px] leading-tight uppercase mb-1">{asset.assetName}</div>
                                        <div className="text-[8px] sm:text-[9px] font-bold text-indigo-500 uppercase tracking-tighter truncate max-w-[120px] sm:max-w-none">{asset.assetCode} • {asset.activityCode}</div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-4 border-b border-gray-50 dark:border-gray-800/50">
                                        <div className="flex flex-col items-center">
                                            <div className="flex items-center gap-1 mb-1">
                                                <span className="text-[10px] sm:text-[11px] font-black text-gray-900 dark:text-white">{asset.qtyReceived}</span>
                                                <span className="text-[8px] sm:text-[9px] font-bold text-gray-400">/{asset.qtyPurchased}</span>
                                            </div>
                                            <div className="w-12 sm:w-20 h-1 sm:h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                                                <div className="h-full bg-emerald-500" style={{ width: `${(asset.qtyReceived/asset.qtyPurchased)*100}%` }}></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-4 border-b border-gray-50 dark:border-gray-800/50">
                                        <div className="flex justify-center gap-0.5 sm:gap-1">
                                            {[asset.qtyCluster1, asset.qtyCluster2, asset.qtyCluster3].map((v, idx) => (
                                                <div key={idx} className={`w-6 sm:w-10 py-1 rounded-lg text-center text-[8px] sm:text-[11px] font-black ${v > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 ring-1 ring-emerald-100' : 'bg-gray-50 dark:bg-gray-800 text-gray-300'}`}>{v}</div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-4 border-b border-gray-50 dark:border-gray-800/50">
                                        <div className="flex justify-center gap-0.5 sm:gap-1">
                                            {[asset.distCluster1, asset.distCluster2, asset.distCluster3].map((v, idx) => (
                                                <div key={idx} className={`w-6 sm:w-10 py-1 rounded-lg text-center text-[8px] sm:text-[11px] font-black ${v > 0 ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 ring-1 ring-indigo-100' : 'bg-gray-50 dark:bg-gray-800 text-gray-300'}`}>{v}</div>
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

const ClusterGroup: React.FC<{ label: string; rec: number; dist: number; stock: number; max: number }> = ({ label, rec, dist, stock, max }) => (
    <div className="flex-1 flex flex-col items-center h-full justify-end group relative">
        <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-all duration-300 z-50 pointer-events-none whitespace-nowrap bg-gray-900 text-white p-2.5 rounded-2xl shadow-2xl flex flex-col gap-1.5 min-w-[90px]">
            <div className="flex justify-between gap-3 text-[9px] font-black border-b border-white/10 pb-1">
                <span className="text-indigo-400">RCV:</span>
                <span>{rec}</span>
            </div>
            <div className="flex justify-between gap-3 text-[9px] font-black border-b border-white/10 pb-1">
                <span className="text-blue-400">ISS:</span>
                <span>{dist}</span>
            </div>
            <div className="flex justify-between gap-3 text-[9px] font-black">
                <span className="text-teal-400">STK:</span>
                <span>{stock}</span>
            </div>
        </div>

        <div className="w-full flex items-end justify-center gap-1.5 h-full pb-3">
            <div className="w-3 bg-indigo-500 rounded-t-xl transition-all duration-700 shadow-md" style={{ height: `${(rec/max)*100}%`, minHeight: '4px' }}></div>
            <div className="w-3 bg-blue-400 rounded-t-xl transition-all duration-700 shadow-md" style={{ height: `${(dist/max)*100}%`, minHeight: '4px' }}></div>
            <div className="w-3 bg-teal-400 rounded-t-xl transition-all duration-700 shadow-md" style={{ height: `${(stock/max)*100}%`, minHeight: '4px' }}></div>
        </div>
        <span className="text-[9px] font-black text-gray-900 dark:text-white uppercase mt-1 tracking-tighter">{label}</span>
    </div>
);

const ActivityBar: React.FC<{ label: string; value: number; max: number }> = ({ label, value, max }) => (
    <div className="flex-1 flex flex-col items-center h-full justify-end group relative min-w-[40px]">
        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all duration-300 z-50 pointer-events-none whitespace-nowrap bg-gray-900 text-white p-2 rounded-xl shadow-xl text-[10px] font-black">
            ₹{value.toLocaleString()}
        </div>
        <div className="w-full max-w-[32px] bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all duration-700 shadow-lg group-hover:scale-y-105 origin-bottom" style={{ height: `${(value/max)*100}%`, minHeight: '4px' }}></div>
        <span className="text-[8px] font-black text-gray-500 dark:text-gray-400 uppercase mt-2 rotate-45 origin-left truncate w-16">{label}</span>
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
