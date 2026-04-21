
import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Download, Filter, Search, ChevronDown, Package, Truck, Clock, CheckCircle, PieChart as PieIcon, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ASSETS_DATA_URL, ASSET_DISTRIBUTION_URL } from '../config';

interface DistributionRecord {
    materialId: string;
    activityName: string;
    farmerName: string;
    hhId: string;
    benId: string;
    phone: string;
    gender: string;
    age: string;
    qty: number;
    date: string;
    village: string;
    gp: string;
    cluster: string;
    submitter: string;
    photo: string;
}

interface AssetRecord {
    id: string; // S.No
    assetId: string; // HDFC-activityCode-s.No
    projectCode: string;
    budgetHead: string;
    activityCode: string;
    assetName: string;
    assetCode: string;
    units: string;
    dateOfPurchase: string;
    costPerUnit: number;
    hdfcContribution: number;
    communityContribution: number;
    qtyPurchased: number;
    deliveryPeriod: string;
    qtyReceived: number;
    pending: number;
    totalPrice: number;
    paymentStatus: string;
    dateOfAssetReceived: string;
    assetStatus: string;
}

interface AggregatedAsset {
    assetCode: string;
    assetName: string;
    activityName: string;
    activityCode: string;
    budgetHead: string;
    units: string;
    qtyPurchased: number;
    qtyReceived: number;
    pending: number;
    qtyDistributed: number;
    qtyMembers: number; // Unique Member count using Ben_Id
    totalValue: number;
    records: AssetRecord[];
}

interface AssetTrackingDashboardProps {
    onBack?: () => void;
}

const ACTIVITY_MAP: Record<string, string> = {
    'A1.1': 'Irrigation(Solar/Fixed)',
    'A1.2': 'Mobile irrigation systems',
    'A1.3': 'Eco-farm ponds with vegetables/fruits',
    'A1.4': 'Bio resource center to promote Natural Farming',
    'A1.5': 'Custom Hiring Centre',
    'A1.6': 'Strengthening institutional and enterprise capacity',
    'A1.7': 'Intensive poultry integrated farms and households',
    'A1.8': 'Goatery sheds',
    'A1.9': 'Processing hubs for local consumption and for value added markets',
    'A1.10': 'Fish production in rainfed water bodies',
    'A1.11': 'Crop improvement and diversification',
    'A1.12': 'Capacity building',
    'A1.13': 'Capacity Building of farmers on technical aspects on 8 themes',
    'A1.14': 'On Field Support',
    'A1.15': 'Video Documentation',
    'A2.8': 'NGO Management'
};

const AssetTrackingDashboard: React.FC<AssetTrackingDashboardProps> = ({ onBack }) => {
    const [assets, setAssets] = useState<AssetRecord[]>([]);
    const [distributions, setDistributions] = useState<DistributionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCluster, setFilterCluster] = useState('All');
    const [filterGP, setFilterGP] = useState('All');
    const [filterVillage, setFilterVillage] = useState('All');
    const [filterActivity, setFilterActivity] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    
    // UI State
    const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());

    const parseCSV = (csv: string): any[] => {
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

        return lines.slice(1).map(line => {
            const row = parseLine(line);
            const obj: any = {};
            headers.forEach((h, i) => {
                obj[cleanHeaders[i]] = row[i] || '';
            });
            return obj;
        });
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
                const rawDists = parseCSV(distText);

                const parsedAssets: AssetRecord[] = rawAssets.map(row => {
                    const sno = (row.SNO || row.S_NO || row.ID || '').trim();
                    const actCode = (row.ACTIVITYCODE || row.ACTIVITY_CODE || '').trim();
                    const csvAssetId = (row.ASSETID || row.ASSET_ID || '').trim().toUpperCase();
                    
                    // Construct assetId as per user format: HDFC-activityCode-SNO 
                    // This serves as a fallback if the sheet doesn't have an explicit ASSETID column
                    const generatedId = `HDFC-${actCode}-${sno}`.toUpperCase();
                    
                    return {
                        id: sno,
                        assetId: csvAssetId || generatedId, // Use sheet's ID if exists, else generate
                        projectCode: row.PROJECTCODE || '',
                        budgetHead: row.BUDGETHEAD || '',
                        activityCode: actCode,
                        assetName: row.ASSETNAME || '',
                        assetCode: (row.ASSETCODE || row.ASSET_CODE || '').trim(),
                        units: row.UNITS || '',
                        dateOfPurchase: row.DATEOFPURCHASE || '',
                        costPerUnit: parseFloat(row.COSTOFUNITASSET) || 0,
                        hdfcContribution: parseFloat(row.HDFCCONTRIBUTION) || 0,
                        communityContribution: parseFloat(row.COMMUNITYCONTRIBUTION) || 0,
                        qtyPurchased: parseFloat(row.NUMBEROFASSETPURCHASED) || 0,
                        deliveryPeriod: row.DELIVERYPERIOD || '',
                        qtyReceived: parseFloat(row.HOWMANYRECEIVED) || 0,
                        pending: parseFloat(row.PENDINGFROMVENDOR) || 0,
                        totalPrice: parseFloat(row.TOTALPRICEINCLUDINGGST) || 0,
                        paymentStatus: row.PAYMENTSTATUS || '',
                        dateOfAssetReceived: row.DATEOFASSETRECEIVED || '',
                        assetStatus: row.STATUSOFTHEASSET || ''
                    };
                }).filter(a => a.assetName);

                const parsedDists: DistributionRecord[] = rawDists.map(row => ({
                    materialId: (row.MATERIALID || row.MATERIAL_ID || row.THISMATERIALCODE || '').trim().toUpperCase(),
                    activityName: row.ACTIVITY || row.ACTIVITYNAME || '',
                    farmerName: row.BENEFICIARYNAME || row.FARMERNAME || '',
                    hhId: row.FARMERID || row.HHID || '',
                    benId: row.BENID || row.BEN_ID || '',
                    phone: row.BENPHONE || row.BEN_PHONE || '',
                    gender: row.GENDER || '',
                    age: row.AGE || '',
                    qty: parseFloat(row.MATERIALSDETAILSMATERIALCOUNT || row.MATERIALCOUNT || row.QTY || '1') || 0,
                    date: row.DATEOFSUBMISSION || row.DISTRIBUTEDDATE || '',
                    village: row.VILLAGE || '',
                    gp: row.GP || '',
                    cluster: row.CLUSTER || '',
                    submitter: row.SUBMITTER || '',
                    photo: row.PHOTO || ''
                })).filter(d => d.materialId);

                setAssets(parsedAssets);
                setDistributions(parsedDists);
            } catch (err) {
                console.error("Failed to fetch asset data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Filter Options
    const clusters = useMemo(() => ['All', ...Array.from(new Set(distributions.map(d => d.cluster))).filter(Boolean).sort()], [distributions]);
    const gps = useMemo(() => {
        const filtered = filterCluster === 'All' ? distributions : distributions.filter(d => d.cluster === filterCluster);
        return ['All', ...Array.from(new Set(filtered.map(d => d.gp))).filter(Boolean).sort()];
    }, [distributions, filterCluster]);
    
    const villages = useMemo(() => {
        let filtered = distributions;
        if (filterCluster !== 'All') filtered = filtered.filter(d => d.cluster === filterCluster);
        if (filterGP !== 'All') filtered = filtered.filter(d => d.gp === filterGP);
        return ['All', ...Array.from(new Set(filtered.map(d => d.village))).filter(Boolean).sort()];
    }, [distributions, filterCluster, filterGP]);

    // 2. Derive available activities for the filter dropdown
    const activities = useMemo(() => {
        return ['All', ...Array.from(new Set(assets.map(a => a.activityCode))).filter(Boolean).sort()];
    }, [assets]);

    // 3. Data Aggregation (Filtering and Grouping)
    const aggregatedData = useMemo(() => {
        // Filter distributions based on side filters
        const filteredDists = distributions.filter(d => {
            const matchesCluster = filterCluster === 'All' || d.cluster === filterCluster;
            const matchesGP = filterGP === 'All' || d.gp === filterGP;
            const matchesVillage = filterVillage === 'All' || d.village === filterVillage;
            return matchesCluster && matchesGP && matchesVillage;
        });

        // Filter assets based on activity filter, status filter, and search
        const filteredAssets = assets.filter(a => {
            const matchesActivity = filterActivity === 'All' || a.activityCode === filterActivity;
            const matchesStatus = filterStatus === 'All' || a.assetStatus === filterStatus;
            const matchesSearch = a.assetName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 a.assetCode.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesActivity && matchesStatus && matchesSearch;
        });

        // Group by Activity Name -> then by Asset Code
        const groups: Record<string, Record<string, AggregatedAsset>> = {};

        filteredAssets.forEach(asset => {
            const actCode = asset.activityCode || 'Unknown';
            const actName = ACTIVITY_MAP[actCode] || actCode;
            const code = asset.assetCode || 'Unknown Code';

            if (!groups[actName]) groups[actName] = {};
            if (!groups[actName][code]) {
                groups[actName][code] = {
                    assetCode: code,
                    assetName: asset.assetName,
                    activityName: actName,
                    activityCode: actCode,
                    budgetHead: asset.budgetHead,
                    units: asset.units,
                    qtyPurchased: 0,
                    qtyReceived: 0,
                    pending: 0,
                    qtyDistributed: 0,
                    totalValue: 0,
                    records: []
                };
            }

            const g = groups[actName][code];
            g.qtyPurchased += asset.qtyPurchased;
            g.qtyReceived += asset.qtyReceived;
            g.pending += asset.pending;
            g.totalValue += asset.totalPrice;
            g.records.push(asset);
        });

        // Attach distribution sums and member counts
        Object.keys(groups).forEach(act => {
            Object.keys(groups[act]).forEach(code => {
                const g = groups[act][code];
                const activeDists = filteredDists
                    .filter(d => {
                        const dId = d.materialId.trim().toUpperCase();
                        const aCode = code.trim().toUpperCase();
                        // Exact match: Asset_code from asset sheet with Material_ID from distribution
                        return dId === aCode;
                    });
                
                g.qtyDistributed = activeDists.reduce((sum, d) => sum + d.qty, 0);
                g.qtyMembers = new Set(activeDists.map(d => d.benId).filter(Boolean)).size;
            });
        });

        return groups;
    }, [assets, distributions, filterCluster, filterGP, filterVillage, filterActivity, searchQuery, filterStatus]);

    const stats = useMemo(() => {
        let totalPurchased = 0;
        let totalReceived = 0;
        let totalPending = 0;
        let totalDistributed = 0;

        // Status counts for the pie chart
        // We calculate this based on the side filters but BEFORE status filter to show available options
        const statusMap: Record<string, number> = {};
        
        assets.forEach(a => {
            // Apply other filters to the status calculation
            const matchesActivity = filterActivity === 'All' || a.activityCode === filterActivity;
            const matchesSearch = a.assetName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 a.assetCode.toLowerCase().includes(searchQuery.toLowerCase());
            
            if (matchesActivity && matchesSearch) {
                const s = a.assetStatus || 'Not Specified';
                statusMap[s] = (statusMap[s] || 0) + 1;
            }
        });

        const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

        Object.values(aggregatedData).forEach(actGroup => {
            Object.values(actGroup).forEach(asset => {
                totalPurchased += asset.qtyPurchased;
                totalReceived += asset.qtyReceived;
                totalPending += asset.pending;
                totalDistributed += asset.qtyDistributed;
            });
        });

        return { totalPurchased, totalReceived, totalPending, totalDistributed, statusData };
    }, [aggregatedData, assets, filterActivity, searchQuery]);

    const STATUS_COLORS: Record<string, string> = {
        'Received': '#10b981',    // Emerald 500
        'Ordered': '#3b82f6',     // Blue 500
        'In Transit': '#f59e0b',  // Amber 500
        'Pending': '#ef4444',     // Red 500
        'Distributed': '#8b5cf6', // Violet 500
        'Not Specified': '#94a3b8',// Slate 400
        'Cancelled': '#64748b',   // Gray 500
        'Returned': '#f43f5e',    // Rose 500
        'Shipped': '#06b6d4',     // Cyan 500
        'Processing': '#ec4899',  // Pink 500
        'Approved': '#22c55e',    // Green 500
        'Rejected': '#b91c1c',    // Red 700
    };

    const UI_PALETTE = [
        '#6366f1', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', 
        '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16',
        '#14b8a6', '#facc15', '#6366f1', '#a855f7', '#d946ef',
        '#fb7185', '#2dd4bf', '#22c55e', '#eab308', '#fb923c'
    ];

    const getStatusColor = (status: string, index: number) => {
        if (STATUS_COLORS[status]) return STATUS_COLORS[status];
        return UI_PALETTE[(index + 10) % UI_PALETTE.length]; // Offset to avoid collision with common mapped colors
    };

    const getActivityColor = (activityName: string, index: number) => {
        // Deterministic color based on name if possible, or just index
        return UI_PALETTE[index % UI_PALETTE.length];
    };

    const toggleActivity = (activity: string) => {
        const next = new Set(expandedActivities);
        if (next.has(activity)) next.delete(activity);
        else next.add(activity);
        setExpandedActivities(next);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">Syncing Asset Registry...</p>
        </div>
    );

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-20">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <button 
                        onClick={onBack}
                        className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 transition-colors mb-2"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Management Suite
                    </button>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Asset Tracking Dashboard</h1>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Real-time procurement & distribution audit</p>
                </div>
                
                <div className="flex items-center gap-2">
                    <button className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95">
                        <Download className="w-4 h-4" />
                        Export Audit
                    </button>
                </div>
            </div>

            {/* Stats & Pie Chart Container */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-2">
                {/* Distribution Summary */}
                <div className="lg:col-span-2 grid grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatCard label="Purchased" value={stats.totalPurchased} icon={<Package className="w-4 h-4" />} color="text-blue-600" bg="bg-blue-50" />
                    <StatCard label="Received" value={stats.totalReceived} icon={<Truck className="w-4 h-4" />} color="text-emerald-600" bg="bg-emerald-50" />
                    <StatCard label="Distributed" value={stats.totalDistributed} icon={<CheckCircle className="w-4 h-4" />} color="text-indigo-600" bg="bg-indigo-50" />
                    <StatCard label="Pending" value={stats.totalPending} icon={<Clock className="w-4 h-4" />} color="text-orange-600" bg="bg-orange-50" />
                </div>

                {/* Status Pie Chart */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-500">
                                <PieIcon size={16} />
                            </div>
                            <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Asset Status Distribution</span>
                        </div>
                        {filterStatus !== 'All' && (
                            <button 
                                onClick={() => setFilterStatus('All')}
                                className="flex items-center gap-1 text-[9px] font-black text-indigo-600 uppercase hover:text-indigo-800"
                            >
                                <X size={12} /> Clear Filter
                            </button>
                        )}
                    </div>

                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    onClick={(data) => {
                                        if (data && data.name) {
                                            setFilterStatus(data.name === filterStatus ? 'All' : data.name);
                                        }
                                    }}
                                    className="cursor-pointer"
                                    isAnimationActive={true}
                                >
                                    {stats.statusData.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={getStatusColor(entry.name, index)} 
                                            strokeWidth={filterStatus === entry.name ? 3 : 0}
                                            stroke="#fff"
                                            className={`transition-all duration-300 ${filterStatus !== 'All' && filterStatus !== entry.name ? 'opacity-30' : 'opacity-100'}`}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ 
                                        borderRadius: '1rem', 
                                        border: 'none', 
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                        fontSize: '10px',
                                        fontWeight: '900',
                                        textTransform: 'uppercase'
                                    }} 
                                />
                                <Legend 
                                    verticalAlign="bottom" 
                                    height={36} 
                                iconType="circle"
                                    formatter={(value) => <span className="text-[9px] font-black uppercase text-gray-500 ml-1">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Advanced Filters */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-50 dark:border-gray-700">
                    <Filter className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-widest">Audit Filters</h2>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input 
                            type="text"
                            placeholder="SEARCH ASSET..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-[10px] font-black uppercase border-none ring-1 ring-gray-100 dark:ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    
                    <FilterDropdown label="Cluster" value={filterCluster} options={clusters} onChange={setFilterCluster} />
                    <FilterDropdown label="GP" value={filterGP} options={gps} onChange={setFilterGP} />
                    <FilterDropdown label="Village" value={filterVillage} options={villages} onChange={setFilterVillage} />
                    <FilterDropdown label="Activity" value={filterActivity} options={activities} onChange={setFilterActivity} />
                </div>
            </div>

            {/* Main Content: Accordions */}
            <div className="flex flex-col gap-4">
                {Object.entries(aggregatedData).length > 0 ? (
                    Object.entries(aggregatedData).map(([activity, assetsMap], actIdx) => {
                        const themeColor = getActivityColor(activity, actIdx);
                        return (
                            <div key={activity} className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm transition-all">
                                <button 
                                    onClick={() => toggleActivity(activity)}
                                    className="w-full h-16 px-8 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div 
                                            className="p-2 rounded-xl text-white shadow-sm"
                                            style={{ backgroundColor: themeColor }}
                                        >
                                            <Package className="w-5 h-5" />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{activity}</h3>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{Object.keys(assetsMap).length} Distinct Asset Codes</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="hidden sm:flex items-center gap-8">
                                            <TinyStat label="Purchased" value={Object.values(assetsMap).reduce((s, a) => s + a.qtyPurchased, 0)} />
                                            <TinyStat label="Received" value={Object.values(assetsMap).reduce((s, a) => s + a.qtyReceived, 0)} />
                                        </div>
                                        <div className={`p-2 rounded-full transition-all duration-300 ${expandedActivities.has(activity) ? 'rotate-180 text-white shadow-lg shadow-indigo-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}
                                             style={expandedActivities.has(activity) ? { backgroundColor: themeColor } : {}}>
                                            <ChevronDown className="w-4 h-4" />
                                        </div>
                                    </div>
                                </button>

                            {expandedActivities.has(activity) && (
                                <div className="p-4 sm:p-8 pt-0 border-t border-gray-50 dark:border-gray-700 animate-in slide-in-from-top-2 duration-300">
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full text-left min-w-[900px]">
                                            <thead>
                                                <tr>
                                                    <th className="pb-4 pt-6 px-4 text-[9px] font-black uppercase text-gray-400 tracking-widest">Asset Details</th>
                                                    <th className="pb-4 pt-6 px-4 text-[9px] font-black uppercase text-gray-400 tracking-widest text-center">Purchased</th>
                                                    <th className="pb-4 pt-6 px-4 text-[9px] font-black uppercase text-gray-400 tracking-widest text-center">Received</th>
                                                    <th className="pb-4 pt-6 px-4 text-[9px] font-black uppercase text-gray-400 tracking-widest text-center">Pending</th>
                                                    <th className="pb-4 pt-6 px-4 text-[10px] font-black uppercase text-indigo-600 tracking-widest text-center bg-indigo-50/50 dark:bg-indigo-900/10 rounded-t-2xl">Distributed</th>
                                                    <th className="pb-4 pt-6 px-4 text-[10px] font-black uppercase text-emerald-600 tracking-widest text-center">Members</th>
                                                    <th className="pb-4 pt-6 px-4 text-[9px] font-black uppercase text-gray-400 tracking-widest text-right">Progress</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                                {Object.values(assetsMap).map((asset, idx) => (
                                                    <tr key={idx} className="group hover:bg-gray-50/50 dark:hover:bg-gray-900/20 transition-colors">
                                                        <td className="py-4 px-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-black text-gray-900 dark:text-white uppercase leading-tight">{asset.assetName}</span>
                                                                <div className="flex items-center flex-wrap gap-2 mt-1">
                                                                    <span className="text-[9px] font-black text-emerald-500 uppercase px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-md">
                                                                        {asset.assetCode}
                                                                    </span>
                                                                    <span className="text-[9px] font-bold text-gray-400 uppercase">/ {asset.units || 'Units'}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-4 text-center font-black text-gray-600 dark:text-gray-300 text-sm">{Math.round(asset.qtyPurchased)}</td>
                                                        <td className="py-4 px-4 text-center font-black text-emerald-600 text-sm">{Math.round(asset.qtyReceived)}</td>
                                                        <td className="py-4 px-4 text-center font-black text-orange-600 text-sm">{Math.round(asset.pending)}</td>
                                                        <td className="py-4 px-4 text-center font-black text-indigo-700 dark:text-indigo-400 text-sm bg-indigo-50/30 dark:bg-indigo-900/5">{Math.round(asset.qtyDistributed)}</td>
                                                        <td className="py-4 px-4 text-center font-black text-emerald-700 dark:text-emerald-400 text-sm">{asset.qtyMembers}</td>
                                                        <td className="py-4 px-4">
                                                            <div className="flex flex-col items-end gap-1.5">
                                                                <div className="w-16 sm:w-24 bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className="h-full bg-indigo-600 rounded-full transition-all duration-1000"
                                                                        style={{ width: `${Math.min(100, asset.qtyPurchased > 0 ? (asset.qtyDistributed / asset.qtyPurchased) * 100 : 0)}%` }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">
                                                                    {asset.qtyPurchased > 0 ? ((asset.qtyDistributed / asset.qtyPurchased) * 100).toFixed(0) : 0}% Complete
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })
            ) : (
                <div className="p-20 text-center bg-white dark:bg-gray-800 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col items-center gap-4 opacity-30">
                        <Package className="w-12 h-12" />
                        <p className="text-xs font-black uppercase tracking-widest text-gray-400">No Asset Records Found matching filters</p>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; color: string; bg: string }> = ({ label, value, icon, color, bg }) => (
    <div className={`${bg} p-5 rounded-[2rem] border border-transparent hover:border-black/5 transition-all shadow-sm`}>
        <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-xl bg-white shadow-sm ${color}`}>{icon}</div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${color} opacity-60`}>{label}</span>
        </div>
        <p className={`text-2xl font-black ${color}`}>{Math.round(value).toLocaleString()}</p>
    </div>
);

const FilterDropdown: React.FC<{ label: string; value: string; options: string[]; onChange: (v: string) => void }> = ({ label, value, options, onChange }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] px-3">{label}</label>
        <select 
            value={value} 
            onChange={e => onChange(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-[10px] font-black uppercase border-none ring-1 ring-gray-100 dark:ring-gray-700 cursor-pointer focus:ring-2 focus:ring-indigo-500"
        >
            {options.map(opt => (
                <option key={opt} value={opt}>
                    {label === 'Activity' && opt !== 'All' ? (ACTIVITY_MAP[opt] || opt) : opt}
                </option>
            ))}
        </select>
    </div>
);

const TinyStat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="flex flex-col items-end">
        <span className="text-[8px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">{label}</span>
        <span className="text-xs font-black text-gray-900 dark:text-white leading-none">{Math.round(value)}</span>
    </div>
);

export default AssetTrackingDashboard;
