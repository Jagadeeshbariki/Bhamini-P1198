
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
    costPerUnit: number;
    hdfcContribution: number;
    communityContribution: number;
    qtyPurchased: number;
    qtyReceived: number;
    pending: number;
    totalPrice: number;
    paymentStatus: string;
    assetStatus: string;
    // Stock Received
    qtyCluster1: number;
    qtyCluster2: number;
    qtyCluster3: number;
    // Distributed (Issued)
    distCluster1: number;
    distCluster2: number;
    distCluster3: number;
    cluster1Name: string;
    cluster2Name: string;
    cluster3Name: string;
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
                costPerUnit: parseNum(getVal(row, 'COSTOFUNIT')),
                hdfcContribution: parseNum(getVal(row, 'HDFCCONTRIBUTION')),
                communityContribution: parseNum(getVal(row, 'COMMUNITYCONTRIBUTION')),
                qtyPurchased: parseNum(getVal(row, 'NUMBEROFASSETPURCHASED')),
                qtyReceived: parseNum(getVal(row, 'HOWMANYRECEIVED')),
                pending: parseNum(getVal(row, 'PENDING')),
                totalPrice: parseNum(getVal(row, 'TOTALPRICE')),
                paymentStatus: getVal(row, 'PAYMENTSTATUS'),
                assetStatus: getVal(row, 'STATUSOFTHEASSET'),
                
                // Cluster Mapping based on standard index provided in prompts
                // 19: Cluster 1 Name, 21: Received, 22: Issued (Distributed)
                cluster1Name: row[19] || 'Cluster 1',
                qtyCluster1: parseNum(row[21]),
                distCluster1: parseNum(row[22]),
                
                // 23: Cluster 2 Name, 25: Received, 26: Issued (Distributed)
                cluster2Name: row[23] || 'Cluster 2',
                qtyCluster2: parseNum(row[25]),
                distCluster2: parseNum(row[26]),
                
                // 27: Cluster 3 Name, 29: Received, 30: Issued (Distributed)
                cluster3Name: row[27] || 'Cluster 3',
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

    const budgetHeads = useMemo(() => ['All', ...Array.from(new Set(data.map(d => d.budgetHead)))], [data]);
    const clusterOptions = ['All', 'Cluster 1', 'Cluster 2', 'Cluster 3'];

    const filteredData = useMemo(() => {
        return data.filter(d => {
            const matchesSearch = d.assetName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 d.activityCode.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesBudget = filterBudgetHead === 'All' || d.budgetHead === filterBudgetHead;
            
            let matchesCluster = true;
            if (filterCluster === 'Cluster 1') matchesCluster = d.qtyCluster1 > 0 || d.distCluster1 > 0;
            else if (filterCluster === 'Cluster 2') matchesCluster = d.qtyCluster2 > 0 || d.distCluster2 > 0;
            else if (filterCluster === 'Cluster 3') matchesCluster = d.qtyCluster3 > 0 || d.distCluster3 > 0;

            return matchesSearch && matchesBudget && matchesCluster;
        });
    }, [data, searchQuery, filterBudgetHead, filterCluster]);

    const stats = useMemo(() => {
        const totalInvestment = filteredData.reduce((acc, d) => acc + d.totalPrice, 0);
        const hdfcTotal = filteredData.reduce((acc, d) => acc + d.hdfcContribution, 0);
        const commTotal = filteredData.reduce((acc, d) => acc + d.communityContribution, 0);
        const totalQty = filteredData.reduce((acc, d) => acc + d.qtyPurchased, 0);
        const receivedQty = filteredData.reduce((acc, d) => acc + d.qtyReceived, 0);
        const totalPending = filteredData.reduce((acc, d) => acc + d.pending, 0);
        
        // Distribution Stats
        const dist1 = filteredData.reduce((acc, d) => acc + d.distCluster1, 0);
        const dist2 = filteredData.reduce((acc, d) => acc + d.distCluster2, 0);
        const dist3 = filteredData.reduce((acc, d) => acc + d.distCluster3, 0);
        const totalDistributed = dist1 + dist2 + dist3;

        const paidItems = filteredData.filter(d => d.paymentStatus.toLowerCase().includes('paid'));
        const paidTotal = paidItems.reduce((acc, d) => acc + d.totalPrice, 0);
        const paymentProgress = totalInvestment > 0 ? (paidTotal / totalInvestment) * 100 : 0;

        const activityBreakdown = new Map<string, number>();
        filteredData.forEach(d => {
            activityBreakdown.set(d.activityCode, (activityBreakdown.get(d.activityCode) || 0) + d.totalPrice);
        });
        const topActivities = Array.from(activityBreakdown.entries())
            .map(([code, val]) => ({ code, val }))
            .sort((a, b) => b.val - a.val)
            .slice(0, 5);

        return { 
            totalInvestment, hdfcTotal, commTotal, totalQty, receivedQty, 
            totalPending, paymentProgress, topActivities, paidTotal,
            dist1, dist2, dist3, totalDistributed
        };
    }, [filteredData]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-[10px] font-black uppercase text-gray-400">Syncing Asset Data...</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Top Insight Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[180px]">
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase opacity-70 tracking-widest mb-1">Total Project Investment</p>
                        <h3 className="text-4xl font-black">₹{stats.totalInvestment.toLocaleString()}</h3>
                    </div>
                    <div className="relative z-10 flex gap-4 mt-6">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black opacity-60 uppercase">HDFC Contribution</span>
                            <span className="text-sm font-bold">₹{stats.hdfcTotal.toLocaleString()}</span>
                        </div>
                        <div className="w-px h-8 bg-white/20 self-center"></div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black opacity-60 uppercase">Community</span>
                            <span className="text-sm font-bold">₹{stats.commTotal.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="absolute -right-12 -bottom-12 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl flex flex-col justify-between min-h-[180px]">
                    <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Financial Reconciliation</p>
                        <h3 className="text-4xl font-black text-gray-900 dark:text-white">{stats.paymentProgress.toFixed(0)}% PAID</h3>
                    </div>
                    <div className="space-y-2">
                        <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${stats.paymentProgress}%` }}></div>
                        </div>
                        <p className="text-[10px] font-black text-gray-500 uppercase">Settled: ₹{stats.paidTotal.toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl flex flex-col justify-between min-h-[180px]">
                    <div>
                        <p className="text-[10px] font-black uppercase opacity-70 tracking-widest mb-1">Distribution Reach</p>
                        <h3 className="text-4xl font-black text-white">{stats.totalDistributed.toLocaleString()}</h3>
                    </div>
                    <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                            <span className="text-2xl font-black">{(stats.totalDistributed / (stats.totalQty || 1) * 100).toFixed(0)}%</span>
                            <span className="text-[9px] font-black uppercase opacity-60 tracking-widest">Distributed to Field</span>
                        </div>
                        <div className="bg-white/20 px-4 py-2 rounded-2xl">
                            <span className="text-[10px] font-black uppercase tracking-widest">{stats.receivedQty} IN STOCK</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 px-1 tracking-widest">Budget Head</label>
                        <select value={filterBudgetHead} onChange={e => setFilterBudgetHead(e.target.value)} className="w-full text-[11px] font-black uppercase bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border-none ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-2 focus:ring-emerald-600 transition-all">
                            {budgetHeads.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 px-1 tracking-widest">Stock Point Filter</label>
                        <select value={filterCluster} onChange={e => setFilterCluster(e.target.value)} className="w-full text-[11px] font-black uppercase bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border-none ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-2 focus:ring-emerald-600 transition-all">
                            {clusterOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-gray-400 px-1 tracking-widest">Search Inventory</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="ASSET NAME OR CODE..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-900 pl-12 pr-4 py-4 rounded-2xl text-[11px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-2 focus:ring-emerald-600 border-none shadow-inner"
                            />
                            <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle Insight Section - Two Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6">Activity Expenditure Analysis</h3>
                    <div className="space-y-5">
                        {stats.topActivities.map((act, i) => (
                            <div key={i} className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-tight">
                                    <span className="text-gray-700 dark:text-gray-300">{act.code}</span>
                                    <span className="text-emerald-600 font-bold">₹{act.val.toLocaleString()}</span>
                                </div>
                                <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(act.val / (stats.totalInvestment || 1)) * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6">Asset Distribution by Cluster</h3>
                    <div className="space-y-6">
                        {[
                            { name: 'Cluster 1', val: stats.dist1, color: 'bg-indigo-500' },
                            { name: 'Cluster 2', val: stats.dist2, color: 'bg-blue-500' },
                            { name: 'Cluster 3', val: stats.dist3, color: 'bg-indigo-400' }
                        ].map((cluster, idx) => (
                            <div key={idx} className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-tight">
                                    <span className="text-gray-700 dark:text-gray-300">{cluster.name}</span>
                                    <span className="text-indigo-600 font-bold">{cluster.val} Assets Distributed</span>
                                </div>
                                <div className="h-4 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                        className={`h-full ${cluster.color} rounded-full transition-all duration-1000`} 
                                        style={{ width: `${(cluster.val / (stats.totalDistributed || 1)) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                             <p className="text-[10px] font-bold text-gray-400 uppercase text-center tracking-widest">
                                Total Units Issued to Beneficiaries: {stats.totalDistributed}
                             </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Asset Ledger */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Inventory Ledger</h3>
                    <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full">{filteredData.length} ITEMS</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-100/50 dark:bg-gray-900/50">
                            <tr>
                                <th className="px-6 py-5 text-[9px] font-black uppercase text-gray-400">Asset & Date</th>
                                <th className="px-6 py-5 text-[9px] font-black uppercase text-gray-400 text-center">Procurement Status</th>
                                <th className="px-6 py-5 text-[9px] font-black uppercase text-gray-400 text-center">Distributed / In Stock</th>
                                <th className="px-6 py-5 text-[9px] font-black uppercase text-gray-400 text-right">Investment</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {filteredData.map((asset, i) => (
                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-6 py-5">
                                        <div className="font-black text-gray-900 dark:text-white text-sm leading-tight uppercase mb-1">{asset.assetName}</div>
                                        <div className="text-[9px] font-bold text-indigo-600 uppercase tracking-tight">{asset.activityCode} • {asset.dateOfPurchase}</div>
                                        <div className="text-[8px] font-black text-gray-400 uppercase mt-1">CODE: {asset.assetCode}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[11px] font-black text-gray-900 dark:text-white mb-1">{asset.qtyReceived} / {asset.qtyPurchased}</span>
                                            <div className="w-24 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(asset.qtyReceived / asset.qtyPurchased) * 100}%` }}></div>
                                            </div>
                                            <span className={`text-[8px] font-black mt-1 tracking-widest ${asset.pending > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                {asset.pending > 0 ? `${asset.pending} UNITS AWAITING` : 'FULLY PROCURED'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex justify-center gap-2">
                                            {[
                                                { label: 'C1', dist: asset.distCluster1, stock: asset.qtyCluster1 },
                                                { label: 'C2', dist: asset.distCluster2, stock: asset.qtyCluster2 },
                                                { label: 'C3', dist: asset.distCluster3, stock: asset.qtyCluster3 }
                                            ].map((c, idx) => (
                                                <div key={idx} className="flex flex-col items-center p-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700 min-w-[55px]">
                                                    <span className="text-[8px] font-black text-gray-400 uppercase mb-0.5">{c.label}</span>
                                                    <div className="flex flex-col items-center leading-none">
                                                        <span className="text-[11px] font-black text-indigo-600" title="Distributed">{c.dist}</span>
                                                        <div className="h-px w-4 bg-gray-200 my-1"></div>
                                                        <span className="text-[10px] font-bold text-gray-500" title="In Stock">{c.stock}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="text-sm font-black text-gray-900 dark:text-white leading-none">₹{asset.totalPrice.toLocaleString()}</div>
                                        <div className={`mt-2 inline-block px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                                            asset.paymentStatus.toLowerCase().includes('paid') 
                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                            : 'bg-amber-50 text-amber-600 border-amber-100'
                                        }`}>
                                            {asset.paymentStatus}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
};

export default AssetTrackingDashboard;
