
import React, { useState, useEffect, useMemo } from 'react';
import { ASSET_DISTRIBUTION_URL, ASSETS_DATA_URL } from '../config';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { 
    Package, Activity, Database, TrendingUp,
    Info, AlertCircle, ChevronDown, ChevronUp, ArrowLeft,
    Download
} from 'lucide-react';

interface DistributionRecord {
    cluster: string;
    activity: string;
    material: string;
    materialId: string;
    count: number;
    date: string;
    beneficiary: string;
    gp: string;
    village: string;
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

interface ODKAssetDistributionProps {
    onBack?: () => void;
}

const ODKAssetDistribution: React.FC<ODKAssetDistributionProps> = ({ onBack }) => {
    const [data, setData] = useState<DistributionRecord[]>([]);
    const [assetMap, setAssetMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedActivity, setSelectedActivity] = useState('All');
    const [openAccordion, setOpenAccordion] = useState<string | null>(null);

    const parseCSV = (csv: string): DistributionRecord[] => {
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

        return lines.slice(1).map(line => {
            const row = parseLine(line);
            return {
                cluster: getVal(row, 'Cluster') || getVal(row, 'cluster') || getVal(row, 'location-block') || getVal(row, 'CLUSTER') || 'Unknown',
                activity: (getVal(row, 'activity_registration-activity') || getVal(row, 'Activity') || getVal(row, 'activity') || 'Uncategorized').trim().replace(/^(BYP-|BFE-|AFT-)/, ''),
                material: getVal(row, 'this_material_label') || 'Unknown Material',
                materialId: (getVal(row, 'Material_ID') || getVal(row, 'material_id') || getVal(row, 'MATERIAL_ID') || '').trim().toUpperCase(),
                count: parseFloat(getVal(row, 'materials_details-material_count')) || 0,
                date: getVal(row, 'materials_details-distributed_date') || '',
                beneficiary: getVal(row, 'Beneficiary name') || getVal(row, 'bnf_section_-bnf_name_') || getVal(row, 'bnf_section-bnf_name') || getVal(row, 'Beneficiary Name') || getVal(row, 'bnf_name') || 'Unknown',
                gp: getVal(row, 'GP') || getVal(row, 'location-gp') || 'Unknown',
                village: getVal(row, 'Village') || getVal(row, 'location-village') || 'Unknown',
            };
        });
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [distResponse, assetResponse] = await Promise.all([
                    fetch(`${ASSET_DISTRIBUTION_URL}&t=${Date.now()}`),
                    fetch(`${ASSETS_DATA_URL}&t=${Date.now()}`)
                ]);

                if (!distResponse.ok) throw new Error('Failed to fetch distribution data');
                if (!assetResponse.ok) throw new Error('Failed to fetch asset tracking data');

                const distCsvText = await distResponse.text();
                const assetCsvText = await assetResponse.text();

                // Parse assets for lookup
                const assetLines = assetCsvText.trim().split(/\r?\n/);
                const assetMapObj: Record<string, string> = {};
                if (assetLines.length > 1) {
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
                    const headers = parseLine(assetLines[0]);
                    const normalize = (h: string) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                    const normHeaders = headers.map(normalize);
                    
                    const idIdx = normHeaders.findIndex(h => h === 'assetid' || h === 'assetcode' || h === 'id');
                    const nameIdx = normHeaders.findIndex(h => h === 'assetname' || h === 'name' || h === 'itemname');

                    if (idIdx !== -1 && nameIdx !== -1) {
                        assetLines.slice(1).forEach(line => {
                            const row = parseLine(line);
                            const id = (row[idIdx] || '').trim().toUpperCase();
                            const name = (row[nameIdx] || '').trim();
                            if (id) assetMapObj[id] = name;
                        });
                    }
                }
                setAssetMap(assetMapObj);

                const parsed = parseCSV(distCsvText);
                setData(parsed);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const clusterStats = useMemo(() => {
        const stats: Record<string, number> = {};
        data.forEach(d => {
            stats[d.cluster] = (stats[d.cluster] || 0) + d.count;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [data]);

    const activityStats = useMemo(() => {
        const stats: Record<string, number> = {};
        data.forEach(d => {
            stats[d.activity] = (stats[d.activity] || 0) + d.count;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [data]);

    const materialStats = useMemo(() => {
        const stats: Record<string, number> = {};
        data.forEach(d => {
            if (selectedActivity !== 'All' && d.activity !== selectedActivity) return;
            // Use materialId for consistent tracking, but fall back to material label if ID is missing
            const key = d.materialId || d.material;
            stats[key] = (stats[key] || 0) + d.count;
        });
        return Object.entries(stats).map(([id, value]) => ({ 
            name: assetMap[id.toUpperCase()] || id, 
            value 
        })).sort((a, b) => b.value - a.value).slice(0, 15);
    }, [data, selectedActivity, assetMap]);

    const totalAssets = useMemo(() => data.reduce((acc, curr) => acc + curr.count, 0), [data]);
    const uniqueBeneficiaries = useMemo(() => new Set(data.map(d => d.beneficiary)).size, [data]);

    const lineChartData = useMemo(() => {
        const clustersList = Array.from(new Set(data.map(d => d.cluster))).filter(Boolean).sort();
        return clustersList.map(cluster => {
            const count = data.filter(d => d.cluster === cluster).reduce((acc, curr) => acc + curr.count, 0);
            return { name: cluster, value: count };
        });
    }, [data]);

    const pivotData = useMemo(() => {
        const clustersList = Array.from(new Set(data.map(d => d.cluster))).filter(Boolean).sort();
        const activitiesList = Array.from(new Set(data.map(d => d.activity))).filter(Boolean).sort();
        
        const summary: Record<string, { 
            materials: Record<string, Record<string, number>>, 
            clusterTotals: Record<string, number>,
            total: number,
            beneficiaryCount: number,
            clusterBeneficiaryCounts: Record<string, number>
        }> = {};

        const beneficiarySets: Record<string, Set<string>> = {};
        const clusterBeneficiarySets: Record<string, Record<string, Set<string>>> = {};

        activitiesList.forEach(activity => {
            summary[activity] = { materials: {}, clusterTotals: {}, total: 0, beneficiaryCount: 0, clusterBeneficiaryCounts: {} };
            beneficiarySets[activity] = new Set();
            clusterBeneficiarySets[activity] = {};
        });

        data.forEach(d => {
            if (!summary[d.activity]) return;
            
            beneficiarySets[d.activity].add(d.beneficiary);
            
            if (!clusterBeneficiarySets[d.activity][d.cluster]) {
                clusterBeneficiarySets[d.activity][d.cluster] = new Set();
            }
            clusterBeneficiarySets[d.activity][d.cluster].add(d.beneficiary);
            
            if (!summary[d.activity].materials[d.materialId]) {
                summary[d.activity].materials[d.materialId] = {};
            }
            
            summary[d.activity].materials[d.materialId][d.cluster] = (summary[d.activity].materials[d.materialId][d.cluster] || 0) + d.count;
            summary[d.activity].clusterTotals[d.cluster] = (summary[d.activity].clusterTotals[d.cluster] || 0) + d.count;
            summary[d.activity].total += d.count;
        });

        activitiesList.forEach(activity => {
            summary[activity].beneficiaryCount = beneficiarySets[activity].size;
            clustersList.forEach(cluster => {
                summary[activity].clusterBeneficiaryCounts[cluster] = clusterBeneficiarySets[activity][cluster]?.size || 0;
            });
        });

        const grandClusterTotals: Record<string, number> = {};
        clustersList.forEach(c => {
            grandClusterTotals[c] = data.reduce((acc, curr) => curr.cluster === c ? acc + curr.count : acc, 0);
        });

        return {
            clusters: clustersList,
            activities: activitiesList,
            summary,
            grandClusterTotals,
            grandTotal: data.reduce((acc, curr) => acc + curr.count, 0)
        };
    }, [data]);

    const downloadCSV = () => {
        const headers = ['Cluster', 'Activity', 'Material', 'Count', 'Date', 'Beneficiary', 'GP', 'Village'];
        const csvContent = [
            headers.join(','),
            ...data.map(d => [
                `"${d.cluster}"`, `"${d.activity}"`, `"${d.material}"`, d.count,
                `"${d.date}"`, `"${d.beneficiary}"`, `"${d.gp}"`, `"${d.village}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `asset_distribution_report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-black text-indigo-600 uppercase tracking-widest animate-pulse">Loading Distribution Data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/20 flex flex-col items-center gap-4 text-center">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <h3 className="text-xl font-black text-red-900 dark:text-red-400 uppercase">Data Fetch Error</h3>
                <p className="text-sm text-red-600 dark:text-red-300/70 max-w-md">{error}</p>
                <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-colors">Retry Fetch</button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-20">
            {onBack && (
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 transition-colors mb-4 group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Dashboards
                </button>
            )}
            {/* Header Section */}
            <div className="bg-white dark:bg-gray-900 p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 dark:shadow-none border border-gray-100 dark:border-gray-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                    <div className="flex items-center gap-4 md:gap-5">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-indigo-600 rounded-2xl md:rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-200 rotate-3">
                            <Package className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tighter leading-none uppercase">ODK Material distribution status</h1>
                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.3em] mt-1 md:mt-2">Material Distribution Insights</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <button 
                            onClick={downloadCSV}
                            className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                        >
                            <Download className="w-4 h-4" />
                            Export
                        </button>
                        <div className="px-4 py-2 md:px-6 md:py-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl md:rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                            <p className="text-[9px] md:text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5 md:mb-1">Total Assets</p>
                            <p className="text-lg md:text-2xl font-black text-indigo-600 dark:text-indigo-400 leading-none">{totalAssets.toLocaleString()}</p>
                        </div>
                        <div className="px-4 py-2 md:px-6 md:py-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl md:rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                            <p className="text-[9px] md:text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-0.5 md:mb-1">Beneficiaries</p>
                            <p className="text-lg md:text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none">{uniqueBeneficiaries.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Activity Wise Accordion Section */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl md:rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="p-4 md:p-6 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight uppercase">Activity Wise Distribution</h3>
                        <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Click on an activity to see material details</p>
                    </div>
                    <div className="p-2 md:p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl md:rounded-2xl text-indigo-600">
                        <Database className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                </div>
                <div className="p-2 md:p-4 space-y-2 md:space-y-3">
                    {pivotData.activities.map(activity => (
                        <div key={activity} className="border border-gray-100 dark:border-gray-800 rounded-xl md:rounded-2xl overflow-hidden">
                            <button 
                                onClick={() => {
                                    setOpenAccordion(openAccordion === activity ? null : activity);
                                    setSelectedActivity(openAccordion === activity ? 'All' : activity);
                                }}
                                className="w-full flex items-center justify-between p-3 md:p-4 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100/50 transition-colors"
                            >
                                <div className="flex items-center gap-2 md:gap-3">
                                    <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg md:rounded-xl flex items-center justify-center text-indigo-600">
                                        <Activity className="w-4 h-4 md:w-5 md:h-5" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs md:text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                            {activity}- {pivotData.summary[activity].beneficiaryCount}
                                        </p>
                                        <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">{pivotData.summary[activity].total.toLocaleString()} Units Distributed</p>
                                    </div>
                                </div>
                                {openAccordion === activity ? <ChevronUp className="w-4 h-4 md:w-5 md:h-5 text-gray-400" /> : <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />}
                            </button>
                            
                            {openAccordion === activity && (
                                <div className="p-3 md:p-4 overflow-x-auto animate-in slide-in-from-top-2 duration-300">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="border-b border-gray-100 dark:border-gray-800">
                                                <th className="pb-3 font-black text-gray-400 uppercase tracking-widest">Material Name</th>
                                                {pivotData.clusters.map(c => (
                                                    <th key={c} className="pb-3 font-black text-gray-400 uppercase tracking-widest text-center">
                                                        {c}
                                                        <div className="text-[8px] text-indigo-500 mt-1">
                                                            ({pivotData.summary[activity].clusterBeneficiaryCounts[c] || 0} Bens)
                                                        </div>
                                                    </th>
                                                ))}
                                                <th className="pb-3 font-black text-gray-400 uppercase tracking-widest text-center">Total</th>
                                            </tr>
                                            <tr className="border-b border-gray-50 dark:border-gray-900 bg-gray-50/30 dark:bg-gray-800/30">
                                                <th className="py-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest">Beneficiary Count</th>
                                                {pivotData.clusters.map(c => (
                                                    <th key={c} className="py-2 text-center text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                                        {pivotData.summary[activity].clusterBeneficiaryCounts[c] || 0}
                                                    </th>
                                                ))}
                                                <th className="py-2 text-center text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                                    {pivotData.summary[activity].beneficiaryCount}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                            {Object.entries(pivotData.summary[activity].materials).map(([materialId, clusters]) => (
                                                <tr key={materialId} className="hover:bg-gray-50/30 transition-colors">
                                                    <td className="py-3 font-bold text-gray-600 dark:text-gray-400">
                                                        <div className="flex flex-col">
                                                            <span className="text-gray-900 dark:text-white font-black">{assetMap[materialId.toUpperCase()] || materialId}</span>
                                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{materialId}</span>
                                                        </div>
                                                    </td>
                                                    {pivotData.clusters.map(c => (
                                                        <td key={c} className="py-3 text-center font-bold text-gray-900 dark:text-white">
                                                            {clusters[c]?.toLocaleString() || '-'}
                                                        </td>
                                                    ))}
                                                    <td className="py-3 text-center font-black text-indigo-600 dark:text-indigo-400">
                                                        {Object.values(clusters).reduce((a, b) => a + b, 0).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Overall Cluster Wise Distribution - Line Chart */}
                <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Overall Cluster Wise Distribution</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Trend of distribution across all clusters</p>
                        </div>
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-indigo-600">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={lineChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="name" 
                                    tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis 
                                    tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 800, fontSize: '12px' }}
                                />
                                <Legend 
                                    verticalAlign="top" 
                                    height={36}
                                    formatter={(value) => <span className="text-[10px] font-black uppercase text-gray-500">{value}</span>}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="value" 
                                    name="Total Units"
                                    stroke="#4f46e5" 
                                    strokeWidth={4} 
                                    dot={{ r: 6, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                                    activeDot={{ r: 8 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Activity Wise Distribution - Pie Chart */}
                <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Activity Wise Status</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Distribution by Project Category</p>
                        </div>
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-emerald-600">
                            <Activity className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={activityStats}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {activityStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 800, fontSize: '12px' }}
                                />
                                <Legend 
                                    verticalAlign="bottom" 
                                    height={36}
                                    formatter={(value) => <span className="text-[10px] font-black uppercase text-gray-500">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Material Wise Distribution - Conditional */}
            {selectedActivity !== 'All' && (
                <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Material Name Wise Status: {selectedActivity}</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Specific item distribution for selected activity</p>
                        </div>
                        <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-2xl text-rose-600">
                            <Package className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={materialStats} margin={{ left: 20, right: 20, top: 20, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="name" 
                                    angle={-45} 
                                    textAnchor="end" 
                                    interval={0} 
                                    height={80}
                                    tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }}
                                />
                                <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 800, fontSize: '12px' }}
                                />
                                <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={40}>
                                    {materialStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Insights Section */}
            <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48 blur-3xl"></div>
                <div className="relative flex flex-col lg:flex-row items-center gap-8">
                    <div className="lg:w-1/3">
                        <div className="flex items-center gap-3 mb-4">
                            <Info className="w-6 h-6" />
                            <h3 className="text-2xl font-black tracking-tight">DISTRIBUTION INSIGHTS</h3>
                        </div>
                        <p className="text-indigo-100 font-medium leading-relaxed">
                            Real-time analysis of material distribution across various clusters and activities. 
                            These insights help in identifying high-demand areas and optimizing supply chain logistics.
                        </p>
                    </div>
                    
                    <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                        <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-2">Top Cluster</p>
                            <p className="text-xl font-black">{clusterStats[0]?.name || 'N/A'}</p>
                            <p className="text-xs font-bold text-indigo-300 mt-1">Leading in material distribution volume</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-2">Primary Activity</p>
                            <p className="text-xl font-black">{activityStats[0]?.name || 'N/A'}</p>
                            <p className="text-xs font-bold text-indigo-300 mt-1">Highest resource allocation category</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-2">Most Distributed</p>
                            <p className="text-xl font-black truncate" title={materialStats[0]?.name || 'N/A'}>
                                {materialStats[0]?.name || 'N/A'}
                            </p>
                            <p className="text-xs font-bold text-indigo-300 mt-1">Highest frequency material item</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-2">Average per Ben</p>
                            <p className="text-xl font-black">{(totalAssets / (uniqueBeneficiaries || 1)).toFixed(1)} Units</p>
                            <p className="text-xs font-bold text-indigo-300 mt-1">Mean distribution per beneficiary</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ODKAssetDistribution;
