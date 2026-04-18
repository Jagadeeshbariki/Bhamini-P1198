
import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { ASSETS_DATA_URL, ASSET_DISTRIBUTION_URL } from '../config';

interface DistributionRecord {
    materialId: string;
    farmerName: string;
    hhId: string;
    benId: string;
    qty: number;
    date: string;
    village: string;
    gp: string;
    cluster: string;
}

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
    distCluster1: number;
    qtyCluster2: number;
    distCluster2: number;
    qtyCluster3: number;
    distCluster3: number;
    distributions: DistributionRecord[];
    actualDistributed: number;
}

interface AssetTrackingDashboardProps {
    onBack?: () => void;
}

const AssetTrackingDashboard: React.FC<AssetTrackingDashboardProps> = ({ onBack }) => {
    const [data, setData] = useState<AssetRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterBudgetHead, setFilterBudgetHead] = useState('All');
    const [filterCluster, setFilterCluster] = useState('All');
    const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
    const [expandedActivity, setExpandedActivity] = useState<string | null>(null);

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
        const cleanHeaders = headers.map(h => h.toUpperCase().replace(/[^A-Z0-9]/g, ''));

        const getVal = (row: string[], search: string) => {
            const searchClean = search.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const idx = cleanHeaders.findIndex(h => h.includes(searchClean));
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
                distributions: [],
                actualDistributed: 0
            };
        }).filter((a): a is AssetRecord => !!a && !!a.assetName);
    };

    const parseDistCSV = (csv: string): DistributionRecord[] => {
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
        const cleanHeaders = headers.map(h => h.toUpperCase().replace(/[^A-Z0-9]/g, ''));

        const getVal = (row: string[], search: string) => {
            const searchClean = search.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const idx = cleanHeaders.findIndex(h => h.includes(searchClean));
            return idx !== -1 ? row[idx] : '';
        };

        return lines.slice(1).map(line => {
            const row = parseLine(line);
            if (row.length < 5) return null;

            return {
                materialId: getVal(row, 'MATERIAL_ID'),
                farmerName: getVal(row, 'BENEFICIARYNAME'),
                hhId: getVal(row, 'FARMERID'),
                benId: getVal(row, 'BEN_ID'),
                qty: parseFloat(getVal(row, 'MATERIAL_COUNT')) || 0,
                date: getVal(row, 'DISTRIBUTED_DATE'),
                village: getVal(row, 'VILLAGE'),
                gp: getVal(row, 'GP'),
                cluster: getVal(row, 'CLUSTER'),
            };
        }).filter((d): d is DistributionRecord => !!d && !!d.materialId);
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [assetRes, distRes] = await Promise.all([
                    fetch(`${ASSETS_DATA_URL}&t=${Date.now()}`),
                    fetch(`${ASSET_DISTRIBUTION_URL}&t=${Date.now()}`)
                ]);
                const assetText = await assetRes.text();
                const distText = await distRes.text();
                
                const rawAssets = parseCSV(assetText);
                const distributions = parseDistCSV(distText);
                
                // Aggregate assets by assetCode
                const assetMap = new Map<string, typeof rawAssets[0]>();
                for (const asset of rawAssets) {
                    const code = asset.assetCode.trim().toUpperCase();
                    if (!code) continue;
                    
                    if (assetMap.has(code)) {
                        const existing = assetMap.get(code)!;
                        existing.qtyPurchased += asset.qtyPurchased;
                        existing.qtyReceived += asset.qtyReceived;
                        existing.pending += asset.pending;
                        existing.totalPrice += asset.totalPrice;
                        existing.qtyCluster1 += asset.qtyCluster1;
                        existing.qtyCluster2 += asset.qtyCluster2;
                        existing.qtyCluster3 += asset.qtyCluster3;
                    } else {
                        assetMap.set(code, { ...asset });
                    }
                }
                const aggregatedAssets = Array.from(assetMap.values());
                
                const merged = aggregatedAssets.map(asset => {
                    const matchedDists = distributions.filter(d => 
                        d.materialId.trim().toUpperCase() === asset.assetCode.trim().toUpperCase()
                    );
                    
                    const actualDist = matchedDists.reduce((sum, d) => sum + d.qty, 0);
                    
                    const distByCluster = (clusterName: string) => 
                        matchedDists.filter(d => d.cluster?.toUpperCase().includes(clusterName.toUpperCase()))
                                   .reduce((sum, d) => sum + d.qty, 0);

                    return {
                        ...asset,
                        distributions: matchedDists,
                        actualDistributed: actualDist,
                        distCluster1: distByCluster('Cluster 1') || asset.distCluster1,
                        distCluster2: distByCluster('Cluster 2') || asset.distCluster2,
                        distCluster3: distByCluster('Cluster 3') || asset.distCluster3,
                    };
                });
                
                setData(merged);
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

    const downloadCSV = () => {
        const headers = [
            'SNO', 'Project Code', 'Budget Head', 'Activity Code', 'Asset Code', 'Asset Name', 
            'Date of Purchase', 'Date of Receipt', 'Cost Per Unit', 'HDFC Contribution', 
            'Community Contribution', 'Qty Purchased', 'Qty Received', 'Pending', 'Total Price', 
            'Payment Status', 'Asset Status', 'Qty C1', 'Dist C1', 'Qty C2', 'Dist C2', 'Qty C3', 'Dist C3'
        ];
        const csvContent = [
            headers.join(','),
            ...filteredLedgerData.map(d => [
                `"${d.id}"`, `"${d.projectCode}"`, `"${d.budgetHead}"`, `"${d.activityCode}"`, 
                `"${d.assetCode}"`, `"${d.assetName}"`, `"${d.dateOfPurchase}"`, `"${d.dateOfReceipt}"`,
                d.costPerUnit, d.hdfcContribution, d.communityContribution, d.qtyPurchased, 
                d.qtyReceived, d.pending, d.totalPrice, `"${d.paymentStatus}"`, `"${d.assetStatus}"`,
                d.qtyCluster1, d.distCluster1, d.qtyCluster2, d.distCluster2, d.qtyCluster3, d.distCluster3
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `asset_tracking_report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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
        
        const clusterStatus = [
            { label: 'Cluster 1', purchased: c1Rec, distributed: c1Dist },
            { label: 'Cluster 2', purchased: c2Rec, distributed: c2Dist },
            { label: 'Cluster 3', purchased: c3Rec, distributed: c3Dist },
        ];
        const maxClusterValue = Math.max(...clusterStatus.flatMap(c => [c.purchased, c.distributed]), 1);

        return { 
            ordered: Math.round(ordered), 
            receivedCentral: Math.round(receivedCentral), 
            fieldReached: Math.round(fieldReached), 
            fieldDistributed: Math.round(fieldDistributed),
            investment, 
            totalStock: Math.round(totalStock),
            activityExpenseData, maxActivityExpense, statusData, distributionEfficiency,
            clusterStatus, maxClusterValue
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
            {onBack && (
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 transition-colors mb-4 group w-fit"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Dashboards
                </button>
            )}
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
                <button 
                    onClick={downloadCSV}
                    className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                >
                    <Download className="w-4 h-4" />
                    Export
                </button>
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

            {/* 3. ANALYTICS & INSIGHTS - Adjusted to 4 equal columns on xl desktops */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col min-h-[350px]">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-6 px-2">Cluster Distribution Efficiency (%)</h3>
                    <div className="flex-grow flex items-end justify-around gap-4 px-2">
                        {stats.distributionEfficiency.map((c, i) => (
                            <EfficiencyBar key={i} label={c.label} percent={c.value} />
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col min-h-[350px]">
                    <div className="flex items-center justify-between mb-6 px-2">
                        <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Cluster Distribution Status</h3>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-sm bg-blue-500"></span><span className="text-[8px] font-black text-gray-400 uppercase">Purchased</span>
                            <span className="w-2 h-2 rounded-sm bg-emerald-500 ml-1"></span><span className="text-[8px] font-black text-gray-400 uppercase">Distributed</span>
                        </div>
                    </div>
                    <div className="flex-grow flex items-end justify-around gap-2 px-2 pb-6">
                        {stats.clusterStatus.map((c, i) => (
                            <GroupedBar key={i} label={c.label} val1={c.purchased} val2={c.distributed} max={stats.maxClusterValue} />
                        ))}
                    </div>
                </div>

                {/* Activity Wise Expenses */}
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

            {/* 4. BUDGET HEAD & ACTIVITY-WISE DISTRIBUTION TRACKER */}
            <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-4">
                    <div className="flex flex-col">
                        <h2 className="text-lg sm:text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight leading-none">Categorized Asset Tracking</h2>
                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Grouped by Budget Head & Activity pipeline</span>
                    </div>
                    <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-4 py-1.5 rounded-full uppercase tracking-tighter">{filteredLedgerData.length} Registry Items</span>
                </div>
                
                {Object.entries(
                    filteredLedgerData.reduce((acc, asset) => {
                        const budget = asset.budgetHead || 'Uncategorized Budget Head';
                        if (!acc[budget]) acc[budget] = {};
                        
                        const act = asset.activityCode || 'Uncategorized Activity';
                        if (!acc[budget][act]) acc[budget][act] = [];
                        
                        acc[budget][act].push(asset);
                        return acc;
                    }, {} as Record<string, Record<string, typeof filteredLedgerData>>)
                ).map(([budgetHead, activities]) => (
                    <div key={budgetHead} className="flex flex-col gap-3 relative">
                        {/* Budget Head Section Header */}
                        <div className="flex items-center gap-3 pl-2 pb-1 border-b-2 border-gray-100 dark:border-gray-800">
                            <div className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></div>
                            <h3 className="text-xs sm:text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-widest">{budgetHead}</h3>
                            <span className="text-[9px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">{Object.keys(activities).length} Activities</span>
                        </div>
                        
                        <div className="flex flex-col gap-3 pl-1 sm:pl-3">
                            {Object.entries(activities).map(([activity, assets]) => {
                                const isExpanded = expandedActivity === activity;
                                const totalPurchased = assets.reduce((sum, a) => sum + a.qtyPurchased, 0);
                                const totalDistributed = assets.reduce((sum, a) => sum + a.actualDistributed, 0);
                                
                                return (
                                    <div key={activity} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-300 shadow-sm flex flex-col">
                                        <button 
                                            onClick={() => setExpandedActivity(isExpanded ? null : activity)}
                                            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                                        >
                                            <div className="flex items-center gap-3 sm:gap-4">
                                                <div className={`p-2 rounded-xl transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-indigo-100 text-indigo-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"/></svg>
                                                </div>
                                                <div className="flex flex-col">
                                                    <h4 className="text-sm sm:text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">{activity}</h4>
                                                    <p className="text-[10px] sm:text-xs font-bold text-gray-400 mt-0.5 uppercase tracking-widest">{assets.length} Item{assets.length !== 1 ? 's' : ''} in Pipeline</p>
                                                </div>
                                            </div>
                                            <div className="hidden sm:flex items-center gap-6 text-right">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">Purchased</p>
                                                    <p className="text-sm font-black text-blue-600 dark:text-blue-400">{Math.round(totalPurchased)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">Distributed</p>
                                                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{Math.round(totalDistributed)}</p>
                                                </div>
                                            </div>
                                        </button>
                                        
                                        {isExpanded && (
                                <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left min-w-[700px]">
                                            <thead>
                                                <tr>
                                                    <th className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700 shadow-sm w-1/3">Asset Code & Name</th>
                                                    <th className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase text-gray-500 text-center border-b border-gray-200 dark:border-gray-700 shadow-sm">Cluster 1 (Dist/Rec)</th>
                                                    <th className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase text-gray-500 text-center border-b border-gray-200 dark:border-gray-700 shadow-sm">Cluster 2 (Dist/Rec)</th>
                                                    <th className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase text-gray-500 text-center border-b border-gray-200 dark:border-gray-700 shadow-sm">Cluster 3 (Dist/Rec)</th>
                                                    <th className="px-4 sm:px-6 py-4 text-[9px] sm:text-[10px] font-black uppercase text-gray-500 text-right border-b border-gray-200 dark:border-gray-700 shadow-sm">Overall (Dist / Purchased)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-800">
                                                {assets.map((asset, i) => (
                                                    <React.Fragment key={i}>
                                                        <tr 
                                                            className={`group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${expandedAssetId === asset.assetCode ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
                                                            onClick={() => setExpandedAssetId(expandedAssetId === asset.assetCode ? null : asset.assetCode)}
                                                        >
                                                            <td className="px-4 sm:px-6 py-4 relative">
                                                                <div className={`absolute left-0 top-0 bottom-0 w-1 transition-opacity ${expandedAssetId === asset.assetCode ? 'bg-indigo-500 opacity-100' : 'bg-indigo-400 opacity-0 group-hover:opacity-100'}`}></div>
                                                                <div className="font-black text-gray-900 dark:text-white text-[10px] sm:text-[12px] leading-tight uppercase mb-1">{asset.assetName}</div>
                                                                <div className="text-[8px] sm:text-[9px] font-bold text-indigo-500 uppercase tracking-tighter truncate max-w-[120px] sm:max-w-none">{asset.assetCode}</div>
                                                            </td>
                                                            <td className="px-4 sm:px-6 py-4 text-center">
                                                                <div className="inline-flex items-center gap-1 bg-gray-50 dark:bg-gray-900/50 px-2 sm:px-3 py-1 rounded-lg border border-gray-100 dark:border-gray-700">
                                                                    <span className="text-[10px] sm:text-[12px] font-black text-indigo-600 dark:text-indigo-400">{Math.round(asset.distCluster1)}</span>
                                                                    <span className="text-[8px] font-bold text-gray-400">/ {Math.round(asset.qtyCluster1)}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 sm:px-6 py-4 text-center">
                                                                <div className="inline-flex items-center gap-1 bg-gray-50 dark:bg-gray-900/50 px-2 sm:px-3 py-1 rounded-lg border border-gray-100 dark:border-gray-700">
                                                                    <span className="text-[10px] sm:text-[12px] font-black text-indigo-600 dark:text-indigo-400">{Math.round(asset.distCluster2)}</span>
                                                                    <span className="text-[8px] font-bold text-gray-400">/ {Math.round(asset.qtyCluster2)}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 sm:px-6 py-4 text-center">
                                                                <div className="inline-flex items-center gap-1 bg-gray-50 dark:bg-gray-900/50 px-2 sm:px-3 py-1 rounded-lg border border-gray-100 dark:border-gray-700">
                                                                    <span className="text-[10px] sm:text-[12px] font-black text-indigo-600 dark:text-indigo-400">{Math.round(asset.distCluster3)}</span>
                                                                    <span className="text-[8px] font-bold text-gray-400">/ {Math.round(asset.qtyCluster3)}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 sm:px-6 py-4 text-right">
                                                                <div className="inline-flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 px-2 py-1 rounded-lg mb-1">
                                                                    <span className="text-[11px] sm:text-[13px] font-black text-emerald-600 dark:text-emerald-400">{Math.round(asset.actualDistributed)}</span>
                                                                    <span className="text-[10px] font-black text-gray-400">/</span>
                                                                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">{Math.round(asset.qtyPurchased)}</span>
                                                                </div>
                                                                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden ml-auto max-w-[80px]">
                                                                    <div 
                                                                        className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                                                                        style={{ width: `${Math.min(100, asset.qtyPurchased > 0 ? (asset.actualDistributed / asset.qtyPurchased) * 100 : 0)}%` }}
                                                                    ></div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {expandedAssetId === asset.assetCode && (
                                                            <tr>
                                                                <td colSpan={5} className="px-4 sm:px-6 py-4 bg-gray-50/80 dark:bg-gray-900/30 animate-in fade-in slide-in-from-top-2 duration-300 shadow-inner">
                                                                    <div className="space-y-4">
                                                                        <div className="flex items-center justify-between">
                                                                            <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest flex items-center gap-2">
                                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                                                                                Beneficiary Distribution Log
                                                                            </h4>
                                                                            <span className="text-[9px] font-black bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-widest">{asset.distributions.length} Beneficiaries Reached</span>
                                                                        </div>
                                                                        {asset.distributions.length > 0 ? (
                                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                                {asset.distributions.map((dist, idx) => (
                                                                                    <div key={idx} className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-1.5 transition-transform hover:-translate-y-0.5">
                                                                                        <div className="flex justify-between items-start">
                                                                                            <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase leading-tight">{dist.farmerName}</span>
                                                                                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-lg border border-emerald-100 dark:border-emerald-800">Qty: {dist.qty}</span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                                                                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter truncate">{dist.village} • {dist.gp}</span>
                                                                                        </div>
                                                                                        <div className="flex justify-between items-center mt-1 pt-2 border-t border-gray-50 dark:border-gray-700">
                                                                                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">{dist.hhId}</span>
                                                                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{dist.date}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl bg-white/50 dark:bg-gray-800/50">
                                                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No distribution entries mapped</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                        </div>
                    </div>
                ))}
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
    const radius = 40;
    const circ = 2 * Math.PI * radius;

    return (
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            {data.map((item, idx) => {
                const dash = (item.percent / 100) * circ;
                const offset = circ - dash;
                const stroke = COLORS[idx % COLORS.length];
                
                // Calculate cumulative rotation based on previous items
                const rotation = (data.slice(0, idx).reduce((acc, curr) => acc + curr.percent, 0) / 100) * 360;
                
                return (
                    <circle 
                        key={idx}
                        cx="50" cy="50" r={radius} 
                        fill="transparent" 
                        stroke={stroke} 
                        strokeWidth="14" 
                        strokeDasharray={circ}
                        strokeDashoffset={offset}
                        style={{ transformOrigin: 'center', transform: `rotate(${rotation}deg)`, transition: 'all 1s ease' }}
                    />
                );
            })}
            <text x="50" y="50" className="text-[9px] font-black fill-gray-400 transform rotate-90" textAnchor="middle" dominantBaseline="middle">
                STATUS
            </text>
        </svg>
    );
};

const GroupedBar: React.FC<{ label: string; val1: number; val2: number; max: number }> = ({ label, val1, val2, max }) => (
    <div className="flex-1 flex flex-col items-center h-full justify-end group mt-4 relative max-w-[80px]">
        {/* Tooltip */}
        <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-all duration-300 z-50 pointer-events-none whitespace-nowrap bg-gray-900 text-white p-2.5 rounded-xl shadow-xl text-[10px] font-black flex flex-col gap-1">
            <span className="text-blue-400">Purchased: {Math.round(val1)}</span>
            <span className="text-emerald-400">Distributed: {Math.round(val2)}</span>
        </div>
        
        <div className="w-full flex items-end justify-center gap-1 h-full mb-2">
            {/* Bar 1 (Purchased) */}
            <div 
                className="w-1/2 min-w-[12px] max-w-[24px] bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all duration-700 shadow-md relative group-hover:scale-y-105 origin-bottom border-t border-white/20"
                style={{ height: `${max > 0 ? (val1/max)*100 : 0}%`, minHeight: '4px' }}
            ></div>
            {/* Bar 2 (Distributed) */}
            <div 
                className="w-1/2 min-w-[12px] max-w-[24px] bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg transition-all duration-700 shadow-md relative group-hover:scale-y-105 origin-bottom border-t border-white/20"
                style={{ height: `${max > 0 ? (val2/max)*100 : 0}%`, minHeight: '4px' }}
            ></div>
        </div>
        
        <div className="absolute -bottom-6 w-full flex justify-center items-center">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter w-full text-center">{label}</span>
        </div>
    </div>
);

export default AssetTrackingDashboard;
