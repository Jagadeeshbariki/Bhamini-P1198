const fs = require('fs');

const code = `
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ASSETS_DATA_URL, ASSET_DISTRIBUTION_URL, getProxyUrl } from '../config';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    LineChart, Line, AreaChart, Area, Cell
} from 'recharts';
import { 
    Target, CheckCircle, Clock, Percent, Activity, Box, Map, Calendar,
    Filter, Download, Search, ChevronRight, AlertTriangle, ArrowUp, ArrowDown,
    Menu, X, Maximize2, Sparkles, XCircle, Info
} from 'lucide-react';

// Custom CSS for scrollbar and animations
const customStyles = \`
  .pbi-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .pbi-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .pbi-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
  .pbi-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
\`;

// ---- Parsers & Types ----
interface TargetRecord {
    Transaction_ID: string;
    Asset_Name: string;
    Asset_Code: string;
    Activity: string;
    Activity_Code: string;
    Financial_Year: string;
    Target_Units: string;
    Target_Qty: number;
    Cluster: string;
}

interface DistRecord {
    Asset_Code: string;
    Asset_Name: string;
    Activity: string;
    Activity_Code: string;
    Cluster: string;
    Distributed_Qty: number;
    Date: string;
    Beneficiary_Name: string;
    Beneficiary_ID: string;
    Submitter: string;
    Photo: string;
}

// Simple CSV parser
const parseCSV = (csv) => {
    const lines = csv.trim().split(/\\r?\\n/).filter(l => l.trim());
    if (lines.length < 1) return [];
    const parseLine = (line) => {
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
    const headers = parseLine(lines[0]).map(h => h.trim().toUpperCase());
    return lines.slice(1).map(line => {
        const values = parseLine(line);
        const obj = {};
        headers.forEach((h, i) => obj[h] = values[i] || '');
        return obj;
    });
};

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#6366f1'];
const bgColors = ['bg-sky-50', 'bg-emerald-50', 'bg-amber-50', 'bg-violet-50', 'bg-pink-50', 'bg-rose-50', 'bg-teal-50', 'bg-indigo-50'];
const textColors = ['text-sky-600', 'text-emerald-600', 'text-amber-600', 'text-violet-600', 'text-pink-600', 'text-rose-600', 'text-teal-600', 'text-indigo-600'];

const ODKAssetDistribution = ({ onBack }) => {
    const [targets, setTargets] = useState([]);
    const [distributions, setDistributions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [filterFY, setFilterFY] = useState('All');
    const [filterCluster, setFilterCluster] = useState('All');
    const [filterActivity, setFilterActivity] = useState('All');
    const [filterMaterial, setFilterMaterial] = useState('All');
    
    // Pagination for table
    const [page, setPage] = useState(1);
    const [searchTable, setSearchTable] = useState('');
    const rowsPerPage = 10;

    // Mobile sidebar state
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const fetchSafe = (url) => fetch(getProxyUrl(\`\${url}&t=\${Date.now()}\`)).catch(() => null);
                
                const [targetRes, distRes] = await Promise.all([
                    fetchSafe(ASSETS_DATA_URL),
                    fetchSafe(ASSET_DISTRIBUTION_URL)
                ]);

                if (!targetRes?.ok || !distRes?.ok) {
                    throw new Error('Failed to fetch data. Check your network or data sources.');
                }

                const targetText = await targetRes.text();
                const distText = await distRes.text();

                const parsedTargets = parseCSV(targetText);
                const parsedDist = parseCSV(distText);

                // Process Targets
                // ASSETS_DATA_URL columns:
                // S.No, Project Code, Transaction_id, Budget Head, activity_code, Asset Name, Asset_code, units, FY, Number Of Asset Purchased
                // Cluster 1 Qty received at stock, Cluster 2 Qty received at stock, Cluster 3 Qty received at stock
                const processedTargets = [];
                parsedTargets.forEach(row => {
                    const tId = row['TRANSACTION_ID'] || '';
                    const aName = row['ASSET NAME'] || '';
                    const aCode = row['ASSET_CODE'] || '';
                    const act = row['BUDGET HEAD'] || '';
                    const actCode = row['ACTIVITY_CODE'] || '';
                    const fy = row['FY'] || '';
                    const units = row['UNITS'] || '';
                    const globalQty = parseFloat(row['NUMBER OF ASSET PURCHASED']) || 0;
                    
                    // check if we have cluster specific targets
                    const c1 = parseFloat(row['CLUSTER 1 QTY RECEIVED AT STOCK']) || 0;
                    const c2 = parseFloat(row['CLUSTER 2 QTY RECEIVED AT STOCK']) || 0;
                    const c3 = parseFloat(row['CLUSTER 3 QTY RECEIVED AT STOCK']) || 0;

                    if (c1 > 0) processedTargets.push({ Transaction_ID: tId, Asset_Name: aName, Asset_Code: aCode, Activity: act, Activity_Code: actCode, Financial_Year: fy, Target_Units: units, Target_Qty: c1, Cluster: 'Cluster 1' });
                    if (c2 > 0) processedTargets.push({ Transaction_ID: tId, Asset_Name: aName, Asset_Code: aCode, Activity: act, Activity_Code: actCode, Financial_Year: fy, Target_Units: units, Target_Qty: c2, Cluster: 'Cluster 2' });
                    if (c3 > 0) processedTargets.push({ Transaction_ID: tId, Asset_Name: aName, Asset_Code: aCode, Activity: act, Activity_Code: actCode, Financial_Year: fy, Target_Units: units, Target_Qty: c3, Cluster: 'Cluster 3' });
                    
                    if (c1 === 0 && c2 === 0 && c3 === 0 && globalQty > 0) {
                         processedTargets.push({ Transaction_ID: tId, Asset_Name: aName, Asset_Code: aCode, Activity: act, Activity_Code: actCode, Financial_Year: fy, Target_Units: units, Target_Qty: globalQty, Cluster: 'Global' });
                    }
                });

                // Process Distributions
                // ASSET_DISTRIBUTION_URL columns:
                // this_material_code, this_material_label, materials_details-material_count, materials_details-material_unit, Material_ID, materials_details-distributed_date, Farmer ID, Beneficiary name, Activity, Cluster, Activity_id
                const processedDist = [];
                parsedDist.forEach(row => {
                    const aCode = row['MATERIAL_ID'] || row['THIS_MATERIAL_CODE'] || '';
                    const aName = row['THIS_MATERIAL_LABEL'] || '';
                    const act = row['ACTIVITY'] || '';
                    const actCode = row['ACTIVITY_ID'] || '';
                    let cluster = row['CLUSTER'] || 'Global';
                    // normalize cluster name if needed
                    if(cluster.toLowerCase() === 'cluster_1') cluster = 'Cluster 1';
                    if(cluster.toLowerCase() === 'cluster_2') cluster = 'Cluster 2';
                    if(cluster.toLowerCase() === 'cluster_3') cluster = 'Cluster 3';

                    const qty = parseFloat(row['MATERIALS_DETAILS-MATERIAL_COUNT']) || 0;
                    let dateStr = row['DATE OF SUBMISSION'] || row['MATERIALS_DETAILS-DISTRIBUTED_DATE'] || '';
                    if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
                    else if (dateStr) {
                         // assume it might be DD-MMM-YYYY
                         const d = new Date(dateStr);
                         if(!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
                    }

                    const benName = row['BENEFICIARY NAME'] || '';
                    const benId = row['BEN_ID'] || row['FARMER ID'] || '';
                    const submitter = row['SUBMITTER'] || '';
                    const photo = row['PHOTO'] || '';

                    if(qty > 0) {
                        processedDist.push({
                            Asset_Code: aCode, Asset_Name: aName, Activity: act, Activity_Code: actCode, 
                            Cluster: cluster, Distributed_Qty: qty, Date: dateStr, Beneficiary_Name: benName,
                            Beneficiary_ID: benId, Submitter: submitter, Photo: photo
                        });
                    }
                });

                setTargets(processedTargets);
                setDistributions(processedDist);
                setLoading(false);

            } catch (err) {
                console.error(err);
                setError(err.message || 'Unknown error');
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Derived Filters
    const fyOptions = useMemo(() => ['All', ...Array.from(new Set(targets.map(t => t.Financial_Year).filter(Boolean))).sort()], [targets]);
    const clusterOptions = useMemo(() => ['All', ...Array.from(new Set([...targets.map(t => t.Cluster), ...distributions.map(d => d.Cluster)].filter(Boolean))).sort()], [targets, distributions]);
    const actOptions = useMemo(() => ['All', ...Array.from(new Set([...targets.map(t => t.Activity), ...distributions.map(d => d.Activity)].filter(Boolean))).sort()], [targets, distributions]);
    const matOptions = useMemo(() => ['All', ...Array.from(new Set([...targets.map(t => t.Asset_Name), ...distributions.map(d => d.Asset_Name)].filter(Boolean))).sort()], [targets, distributions]);

    // Apply Filters to get working set
    const fTargets = useMemo(() => {
        return targets.filter(t => {
            if (filterFY !== 'All' && t.Financial_Year !== filterFY) return false;
            if (filterCluster !== 'All' && t.Cluster !== filterCluster) return false;
            if (filterActivity !== 'All' && t.Activity !== filterActivity) return false;
            if (filterMaterial !== 'All' && t.Asset_Name !== filterMaterial) return false;
            return true;
        });
    }, [targets, filterFY, filterCluster, filterActivity, filterMaterial]);

    const fDist = useMemo(() => {
        return distributions.filter(d => {
            // Dist doesn't have FY explicitly, so we just filter by cluster/act/mat
            if (filterCluster !== 'All' && d.Cluster !== filterCluster) return false;
            if (filterActivity !== 'All' && d.Activity !== filterActivity) return false;
            if (filterMaterial !== 'All' && d.Asset_Name !== filterMaterial) return false;
            return true;
        });
    }, [distributions, filterCluster, filterActivity, filterMaterial]);

    // ---- Aggregations ----
    const totalTarget = fTargets.reduce((s, t) => s + (t.Target_Qty || 0), 0);
    const totalDist = fDist.reduce((s, d) => s + (d.Distributed_Qty || 0), 0);
    const pending = Math.max(0, totalTarget - totalDist);
    const achvPct = totalTarget > 0 ? (totalDist / totalTarget) * 100 : 0;
    
    const uActivities = new Set([...fTargets.map(t=>t.Activity), ...fDist.map(d=>d.Activity)]).size;
    const uMaterials = new Set([...fTargets.map(t=>t.Asset_Name), ...fDist.map(d=>d.Asset_Name)]).size;
    const uClusters = new Set([...fTargets.map(t=>t.Cluster), ...fDist.map(d=>d.Cluster)]).size;
    
    const today = new Date().toISOString().split('T')[0];
    const distToday = fDist.filter(d => d.Date === today).reduce((s, d) => s + d.Distributed_Qty, 0);

    // Grouping by Cluster
    const clusterStats = useMemo(() => {
        const map = {};
        fTargets.forEach(t => {
            if(!map[t.Cluster]) map[t.Cluster] = { name: t.Cluster, target: 0, dist: 0 };
            map[t.Cluster].target += t.Target_Qty;
        });
        fDist.forEach(d => {
            if(!map[d.Cluster]) map[d.Cluster] = { name: d.Cluster, target: 0, dist: 0 };
            map[d.Cluster].dist += d.Distributed_Qty;
        });
        return Object.values(map).map((c: any) => ({
            ...c,
            pending: Math.max(0, c.target - c.dist),
            achv: c.target > 0 ? (c.dist / c.target) * 100 : 0
        })).sort((a,b) => b.achv - a.achv);
    }, [fTargets, fDist]);

    // Grouping by Activity
    const actStats = useMemo(() => {
        const map = {};
        fTargets.forEach(t => {
            const k = t.Activity || 'Unknown';
            if(!map[k]) map[k] = { name: k, target: 0, dist: 0 };
            map[k].target += t.Target_Qty;
        });
        fDist.forEach(d => {
            const k = d.Activity || 'Unknown';
            if(!map[k]) map[k] = { name: k, target: 0, dist: 0 };
            map[k].dist += d.Distributed_Qty;
        });
        return Object.values(map).map((a: any) => ({
            ...a, 
            achv: a.target > 0 ? (a.dist / a.target) * 100 : 0,
            pending: Math.max(0, a.target - a.dist)
        })).sort((a,b) => b.target - a.target);
    }, [fTargets, fDist]);

    // Grouping by Material
    const matStats = useMemo(() => {
        const map = {};
        fTargets.forEach(t => {
            const k = t.Asset_Name || 'Unknown';
            if(!map[k]) map[k] = { name: k, target: 0, dist: 0 };
            map[k].target += t.Target_Qty;
        });
        fDist.forEach(d => {
            const k = d.Asset_Name || 'Unknown';
            if(!map[k]) map[k] = { name: k, target: 0, dist: 0 };
            map[k].dist += d.Distributed_Qty;
        });
        return Object.values(map).map((m: any) => ({
            ...m, 
            achv: m.target > 0 ? (m.dist / m.target) * 100 : 0,
            pending: Math.max(0, m.target - m.dist)
        })).sort((a,b) => b.target - a.target);
    }, [fTargets, fDist]);

    // Trend Data
    const trendData = useMemo(() => {
        const map = {};
        fDist.forEach(d => {
            const date = d.Date || 'Unknown';
            if(date === 'Unknown') return;
            map[date] = (map[date] || 0) + d.Distributed_Qty;
        });
        return Object.keys(map).sort().map(k => ({ date: k, qty: map[k] }));
    }, [fDist]);

    // Matrix (Activities vs Clusters)
    const matrixData = useMemo(() => {
        const map = {};
        // populate all cells
        clusterStats.forEach(c => {
            actStats.forEach(a => {
                map[\`\${a.name}_\${c.name}\`] = { act: a.name, cluster: c.name, target: 0, dist: 0 };
            });
        });
        fTargets.forEach(t => {
            const k = \`\${t.Activity || 'Unknown'}_\${t.Cluster}\`;
            if(map[k]) map[k].target += t.Target_Qty;
        });
        fDist.forEach(d => {
            const k = \`\${d.Activity || 'Unknown'}_\${d.Cluster}\`;
            if(map[k]) map[k].dist += d.Distributed_Qty;
        });
        
        const rows = actStats.map(a => a.name);
        const cols = clusterStats.map(c => c.name);
        const grid = rows.map(r => {
            const rowObj = { activity: r };
            cols.forEach(c => {
                const cell = map[\`\${r}_\${c}\`];
                rowObj[c] = cell && cell.target > 0 ? (cell.dist / cell.target) * 100 : (cell && cell.dist > 0 ? 100 : 0);
            });
            return rowObj;
        });
        return { rows, cols, grid };
    }, [fTargets, fDist, clusterStats, actStats]);

    // Unified Table Data
    const tableData = useMemo(() => {
        const map = {};
        fTargets.forEach(t => {
            const k = \`\${t.Cluster}|\${t.Activity}|\${t.Asset_Name}|\${t.Asset_Code}\`;
            if(!map[k]) map[k] = { cluster: t.Cluster, activity: t.Activity, material: t.Asset_Name, code: t.Asset_Code, target: 0, dist: 0, lastDate: null };
            map[k].target += t.Target_Qty;
        });
        fDist.forEach(d => {
            const k = \`\${d.Cluster}|\${d.Activity}|\${d.Asset_Name}|\${d.Asset_Code}\`;
            if(!map[k]) map[k] = { cluster: d.Cluster, activity: d.Activity, material: d.Asset_Name, code: d.Asset_Code, target: 0, dist: 0, lastDate: null };
            map[k].dist += d.Distributed_Qty;
            if(!map[k].lastDate || d.Date > map[k].lastDate) map[k].lastDate = d.Date;
        });
        return Object.values(map).map((r: any) => ({
            ...r,
            pending: Math.max(0, r.target - r.dist),
            achv: r.target > 0 ? (r.dist / r.target) * 100 : 0
        })).filter(r => {
            if(!searchTable) return true;
            const s = searchTable.toLowerCase();
            return (r.material||'').toLowerCase().includes(s) || (r.cluster||'').toLowerCase().includes(s) || (r.activity||'').toLowerCase().includes(s);
        }).sort((a,b) => b.achv - a.achv);
    }, [fTargets, fDist, searchTable]);

    const paginatedTable = tableData.slice((page - 1) * rowsPerPage, page * rowsPerPage);
    const totalPages = Math.ceil(tableData.length / rowsPerPage);

    // Helpers
    const getAchvColor = (pct) => {
        if(pct >= 90) return 'bg-emerald-500';
        if(pct >= 60) return 'bg-amber-400';
        return 'bg-rose-500';
    };
    const getAchvTextColor = (pct) => {
        if(pct >= 90) return 'text-emerald-600';
        if(pct >= 60) return 'text-amber-600';
        return 'text-rose-600';
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-500 font-medium animate-pulse">Loading Material Distribution Dashboard...</p>
            </div>
        );
    }
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6 text-center">
                <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-900">Data Source Error</h3>
                <p className="text-gray-500 mt-2 max-w-md">{error}</p>
                <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Retry</button>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#f3f4f6] font-sans overflow-hidden">
            <style dangerouslySetInnerHTML={{ __html: customStyles }} />
            
            {/* Sidebar Filters (Desktop) & Overlay (Mobile) */}
            <div className={\`fixed inset-0 z-40 lg:static lg:block \${sidebarOpen ? 'block' : 'hidden'}\`}>
                <div className="absolute inset-0 bg-gray-900/50 lg:hidden" onClick={() => setSidebarOpen(false)}></div>
                <div className="relative flex flex-col w-64 h-full bg-white border-r border-gray-200 shadow-xl lg:shadow-none animate-in slide-in-from-left-4 lg:animate-none">
                    <div className="flex items-center justify-between p-4 border-b border-gray-100">
                        <div className="flex items-center gap-2 text-indigo-600">
                            <Filter className="w-5 h-5" />
                            <span className="font-bold text-sm tracking-wide uppercase">Filters</span>
                        </div>
                        <button className="lg:hidden p-1 text-gray-400 hover:text-gray-600" onClick={() => setSidebarOpen(false)}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto pbi-scrollbar p-4 space-y-6">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Financial Year</label>
                            <select className="w-full bg-gray-50 border border-gray-200 text-gray-700 rounded-md p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none" value={filterFY} onChange={e => setFilterFY(e.target.value)}>
                                {fyOptions.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Cluster</label>
                            <select className="w-full bg-gray-50 border border-gray-200 text-gray-700 rounded-md p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none" value={filterCluster} onChange={e => setFilterCluster(e.target.value)}>
                                {clusterOptions.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Activity</label>
                            <select className="w-full bg-gray-50 border border-gray-200 text-gray-700 rounded-md p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none" value={filterActivity} onChange={e => setFilterActivity(e.target.value)}>
                                {actOptions.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Material Name</label>
                            <select className="w-full bg-gray-50 border border-gray-200 text-gray-700 rounded-md p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none" value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)}>
                                {matOptions.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        
                        <div className="pt-4 border-t border-gray-100">
                            <button 
                                onClick={() => { setFilterFY('All'); setFilterCluster('All'); setFilterActivity('All'); setFilterMaterial('All'); }}
                                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md text-sm font-semibold transition-colors"
                            >
                                Reset All Filters
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        {onBack && (
                            <button onClick={onBack} className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <button className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-900" onClick={() => setSidebarOpen(true)}>
                            <Menu className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                                <Box className="w-6 h-6 text-indigo-600" />
                                MATERIAL DISTRIBUTION
                            </h1>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Executive Dashboard</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs font-medium text-gray-600">
                            <Calendar className="w-4 h-4" /> Last Sync: {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                </header>

                {/* Dashboard Canvas */}
                <div className="flex-1 overflow-y-auto pbi-scrollbar p-6">
                    <div className="max-w-[1600px] mx-auto space-y-6">
                        
                        {/* KPI Cards Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-[0_2px_4px_rgb(0,0,0,0.02)] border border-gray-100 flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Target</span>
                                    <Target className="w-4 h-4 text-sky-500" />
                                </div>
                                <span className="text-xl font-black text-gray-800">{totalTarget.toLocaleString()}</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-[0_2px_4px_rgb(0,0,0,0.02)] border border-gray-100 flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Distributed</span>
                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                </div>
                                <span className="text-xl font-black text-gray-800">{totalDist.toLocaleString()}</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-[0_2px_4px_rgb(0,0,0,0.02)] border border-gray-100 flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Pending</span>
                                    <Clock className="w-4 h-4 text-amber-500" />
                                </div>
                                <span className="text-xl font-black text-gray-800">{pending.toLocaleString()}</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-[0_2px_4px_rgb(0,0,0,0.02)] border border-gray-100 flex flex-col justify-between relative overflow-hidden">
                                <div className="absolute inset-0 bg-indigo-50/50"></div>
                                <div className="relative flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-indigo-500 uppercase">Achiev %</span>
                                    <Percent className="w-4 h-4 text-indigo-600" />
                                </div>
                                <span className="relative text-2xl font-black text-indigo-700">{achvPct.toFixed(1)}%</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-[0_2px_4px_rgb(0,0,0,0.02)] border border-gray-100 flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Activities</span>
                                    <Activity className="w-4 h-4 text-violet-500" />
                                </div>
                                <span className="text-xl font-black text-gray-800">{uActivities}</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-[0_2px_4px_rgb(0,0,0,0.02)] border border-gray-100 flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Materials</span>
                                    <Box className="w-4 h-4 text-pink-500" />
                                </div>
                                <span className="text-xl font-black text-gray-800">{uMaterials}</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-[0_2px_4px_rgb(0,0,0,0.02)] border border-gray-100 flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Clusters</span>
                                    <Map className="w-4 h-4 text-rose-500" />
                                </div>
                                <span className="text-xl font-black text-gray-800">{uClusters}</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-[0_2px_4px_rgb(0,0,0,0.02)] border border-gray-100 flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Today</span>
                                    <Calendar className="w-4 h-4 text-teal-500" />
                                </div>
                                <span className="text-xl font-black text-gray-800">{distToday.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Top / Bottom Clusters & AI Insights */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Top Performing */}
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <ArrowUp className="w-4 h-4 text-emerald-500" /> Top Clusters
                                </h3>
                                <div className="space-y-3">
                                    {clusterStats.slice(0,3).map((c, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded bg-gray-50 flex items-center justify-center text-[10px] font-bold text-gray-500">{i+1}</div>
                                                <span className="text-sm font-semibold text-gray-700">{c.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className={\`text-sm font-bold \${getAchvTextColor(c.achv)}\`}>{c.achv.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Bottom Performing */}
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <ArrowDown className="w-4 h-4 text-rose-500" /> Needs Attention
                                </h3>
                                <div className="space-y-3">
                                    {[...clusterStats].reverse().slice(0,3).map((c, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded bg-rose-50 flex items-center justify-center text-[10px] font-bold text-rose-500">!</div>
                                                <span className="text-sm font-semibold text-gray-700">{c.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className={\`text-sm font-bold \${getAchvTextColor(c.achv)}\`}>{c.achv.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* AI Insights */}
                            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-5 rounded-xl shadow-sm border border-indigo-500 text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-20"><Sparkles className="w-24 h-24" /></div>
                                <h3 className="text-xs font-black uppercase tracking-wider mb-4 relative z-10">Smart Insights</h3>
                                <ul className="space-y-2 text-sm text-indigo-100 relative z-10 font-medium">
                                    <li className="flex items-start gap-2">
                                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></div>
                                        <span>Highest cluster is <strong>{clusterStats[0]?.name || 'N/A'}</strong> at {clusterStats[0]?.achv.toFixed(0)}%.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></div>
                                        <span>Lowest cluster is <strong>{clusterStats[clusterStats.length-1]?.name || 'N/A'}</strong>.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></div>
                                        <span><strong>{actStats[0]?.name || 'N/A'}</strong> is the highest volume activity.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0"></div>
                                        <span>Overall project stands at <strong>{achvPct.toFixed(1)}%</strong> completion.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Clusters Progress & Trend Line */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Cluster Progress Bars */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-6">Cluster Performance</h3>
                                <div className="space-y-5 max-h-[300px] overflow-y-auto pbi-scrollbar pr-2">
                                    {clusterStats.map(c => (
                                        <div key={c.name}>
                                            <div className="flex justify-between text-xs font-semibold mb-1">
                                                <span className="text-gray-700">{c.name}</span>
                                                <span className="text-gray-500">{c.dist.toLocaleString()} / {c.target.toLocaleString()} ({c.achv.toFixed(1)}%)</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2">
                                                <div className={\`h-2 rounded-full \${getAchvColor(c.achv)}\`} style={{ width: \`\${Math.min(100, c.achv)}%\` }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Trend */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-6">Distribution Trend (Qty)</h3>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorQty" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} minTickGap={30} />
                                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                            <RechartsTooltip 
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 600 }}
                                            />
                                            <Area type="monotone" dataKey="qty" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorQty)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Activity Performance & Material Distribution */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {/* Activity Performance */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-6">Activity Performance (Target vs Dist)</h3>
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={actStats} margin={{ top: 10, right: 10, left: -20, bottom: 60 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                            <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 600 }} />
                                            <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600, marginTop: '20px' }} />
                                            <Bar dataKey="target" name="Target Qty" fill="#cbd5e1" radius={[2, 2, 0, 0]} barSize={20} />
                                            <Bar dataKey="dist" name="Distributed Qty" fill="#4f46e5" radius={[2, 2, 0, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            
                            {/* Cluster vs Activity Heatmap */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-6">Activity vs Cluster Heatmap (%)</h3>
                                <div className="min-w-[500px]">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="text-left text-[10px] font-bold text-gray-400 uppercase py-2 px-3 border-b border-gray-100">Activity</th>
                                                {matrixData.cols.map(c => (
                                                    <th key={c} className="text-center text-[10px] font-bold text-gray-400 uppercase py-2 px-3 border-b border-gray-100">{c}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matrixData.grid.map((row, i) => (
                                                <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                                    <td className="py-2 px-3 text-xs font-semibold text-gray-700 truncate max-w-[150px]" title={row.activity}>{row.activity}</td>
                                                    {matrixData.cols.map(c => {
                                                        const val = row[c];
                                                        // Light to dark green based on %
                                                        let bg = 'bg-gray-50';
                                                        let txt = 'text-gray-400';
                                                        if(val > 0) {
                                                            if(val >= 90) { bg = 'bg-emerald-500'; txt = 'text-white'; }
                                                            else if(val >= 60) { bg = 'bg-emerald-300'; txt = 'text-emerald-900'; }
                                                            else { bg = 'bg-emerald-100'; txt = 'text-emerald-800'; }
                                                        }
                                                        return (
                                                            <td key={c} className="py-1 px-1">
                                                                <div className={\`\${bg} \${txt} text-[10px] font-bold py-1.5 px-1 text-center rounded\`}>
                                                                    {val.toFixed(0)}%
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
                            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Detailed Distribution Table</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Material level execution status</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input 
                                            type="text" 
                                            placeholder="Search material, cluster..." 
                                            className="pl-9 pr-4 py-2 border border-gray-200 rounded-md text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none w-full sm:w-64"
                                            value={searchTable}
                                            onChange={e => { setSearchTable(e.target.value); setPage(1); }}
                                        />
                                    </div>
                                    <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors shrink-0">
                                        <Download className="w-4 h-4" /> Export
                                    </button>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50">
                                            <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Cluster</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Activity</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Material Name</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Target</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Distributed</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Pending</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-center">Achv %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {paginatedTable.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-12 text-center text-gray-400 text-sm font-medium">
                                                    No materials found matching criteria.
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedTable.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-3 text-xs font-semibold text-gray-700 whitespace-nowrap">{row.cluster}</td>
                                                    <td className="px-6 py-3 text-xs font-medium text-gray-500 max-w-[200px] truncate">{row.activity}</td>
                                                    <td className="px-6 py-3 text-xs font-bold text-gray-900 max-w-[250px] truncate">
                                                        {row.material}
                                                        <div className="text-[10px] text-gray-400 font-normal mt-0.5">{row.code}</div>
                                                    </td>
                                                    <td className="px-6 py-3 text-xs font-medium text-gray-600 text-right">{row.target.toLocaleString()}</td>
                                                    <td className="px-6 py-3 text-xs font-bold text-gray-900 text-right">{row.dist.toLocaleString()}</td>
                                                    <td className="px-6 py-3 text-xs font-medium text-rose-500 text-right">{row.pending.toLocaleString()}</td>
                                                    <td className="px-6 py-3 text-center">
                                                        <span className={\`inline-flex items-center justify-center px-2 py-1 rounded text-[10px] font-bold \${getAchvColor(row.achv)} text-white min-w-[3rem]\`}>
                                                            {row.achv.toFixed(0)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-500">
                                        Showing {((page - 1) * rowsPerPage) + 1} to {Math.min(page * rowsPerPage, tableData.length)} of {tableData.length}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            disabled={page === 1}
                                            onClick={() => setPage(p => p - 1)}
                                            className="px-3 py-1 rounded border border-gray-200 text-xs font-bold text-gray-600 disabled:opacity-50"
                                        >
                                            Prev
                                        </button>
                                        <span className="px-3 py-1 text-xs font-bold text-gray-900">
                                            {page} / {totalPages}
                                        </span>
                                        <button 
                                            disabled={page === totalPages}
                                            onClick={() => setPage(p => p + 1)}
                                            className="px-3 py-1 rounded border border-gray-200 text-xs font-bold text-gray-600 disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default ODKAssetDistribution;
`;

fs.writeFileSync('components/ODKAssetDistribution.tsx', code);
