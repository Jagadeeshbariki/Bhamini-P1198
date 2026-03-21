
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
    Search, Filter, Activity, Calendar, PieChart as PieChartIcon, 
    Target, TrendingUp, Clock, Users 
} from 'lucide-react';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, Cell, Legend 
} from 'recharts';

const BUDGET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgIQP5-BbSLrJRyN-E___LfrW-uQlNa3iZ4AbFfKM3Ne_FHlFeRXbHG2Xk5JYQhh9o_HLekVTmwsh6/pub?gid=1547578809&single=true&output=csv';

const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(val);
};

interface BudgetRow {
    year: string;
    quarter: string;
    months: string;
    headCode: string;
    budgetHead: string;
    targetAmount: number;
    unitsToCover: number;
    spentAmount: number;
    unitsCovered: number;
}

const BudgetTrackerPage: React.FC = () => {
    const [allData, setAllData] = useState<BudgetRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters & Search
    const [selectedYear, setSelectedYear] = useState<string>('All');
    const [selectedQuarter, setSelectedQuarter] = useState<string>('All');
    const [selectedMonth, setSelectedMonth] = useState<string>('All');
    const [selectedActivity, setSelectedActivity] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');

    const parseCSV = (csv: string): BudgetRow[] => {
        const lines = csv.trim().split(/\r\n|\n/);
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
        const headers = rawHeaders.map(h => h.toUpperCase().replace(/[\s_]+/g, ''));
        
        return lines.slice(1).map(line => {
            const vals = parseLine(line);
            const row: any = {};
            headers.forEach((h, i) => row[h] = vals[i] || '');
            
            return {
                year: row['YEAR'] || '',
                quarter: row['QUARTER'] || '',
                months: row['MONTHS'] || '',
                headCode: row['HEADCODE'] || row['HEAD_CODE'] || '',
                budgetHead: row['BUDGETHEAD'] || row['BUDGET_HEAD'] || '',
                targetAmount: parseFloat((row['TARGETAMOUNT'] || '0').replace(/[^0-9.]/g, '')) || 0,
                unitsToCover: parseFloat((row['UNITSTOCOVER'] || '0').replace(/[^0-9.]/g, '')) || 0,
                spentAmount: parseFloat((row['SPENTAMONT'] || row['SPENTAMOUNT'] || '0').replace(/[^0-9.]/g, '')) || 0,
                unitsCovered: parseFloat((row['UNITSCOVERED'] || '0').replace(/[^0-9.]/g, '')) || 0
            };
        });
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${BUDGET_CSV_URL}&t=${Date.now()}`);
                if (!response.ok) throw new Error("Could not load budget data");
                const text = await response.text();
                const parsed = parseCSV(text);
                setAllData(parsed);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filterOptions = useMemo(() => {
        const monthsSet = new Set<string>();
        allData.forEach(d => {
            if (d.months) {
                d.months.split(',').forEach(m => {
                    const trimmed = m.trim();
                    if (trimmed) monthsSet.add(trimmed);
                });
            }
        });

        const monthsOrder = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

        return {
            years: ['All', ...Array.from(new Set(allData.map(d => d.year).filter(Boolean))).sort()],
            quarters: ['All', ...Array.from(new Set(allData.map(d => d.quarter).filter(Boolean))).sort()],
            activities: ['All', ...Array.from(new Set(allData.map(d => d.headCode).filter(Boolean))).sort()],
            months: ['All', ...Array.from(monthsSet)].sort((a, b) => {
                if (a === 'All') return -1;
                if (b === 'All') return 1;
                return monthsOrder.indexOf(a) - monthsOrder.indexOf(b);
            })
        };
    }, [allData]);

    const filteredData = useMemo(() => {
        return allData.filter(d => {
            const matchesYear = selectedYear === 'All' || d.year === selectedYear;
            const matchesQuarter = selectedQuarter === 'All' || d.quarter === selectedQuarter;
            const matchesMonth = selectedMonth === 'All' || d.months.toLowerCase().includes(selectedMonth.toLowerCase());
            const matchesActivity = selectedActivity === 'All' || d.headCode === selectedActivity;
            const matchesSearch = d.budgetHead.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 d.headCode.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesYear && matchesQuarter && matchesMonth && matchesActivity && matchesSearch;
        });
    }, [allData, selectedYear, selectedQuarter, selectedMonth, selectedActivity, searchQuery]);

    const stats = useMemo(() => {
        const totalAmount = filteredData.reduce((acc, d) => acc + d.targetAmount, 0);
        const totalUnits = filteredData.reduce((acc, d) => acc + d.unitsToCover, 0);
        const totalSpent = filteredData.reduce((acc, d) => acc + d.spentAmount, 0);
        const totalPending = Math.max(0, totalAmount - totalSpent);
        
        const headCodeMap = new Map<string, { target: number, spent: number, pending: number, name: string, unitsTarget: number, unitsAchievement: number }>();
        filteredData.forEach(d => {
            const current = headCodeMap.get(d.headCode) || { target: 0, spent: 0, pending: 0, name: d.budgetHead, unitsTarget: 0, unitsAchievement: 0 };
            const newTarget = current.target + d.targetAmount;
            const newSpent = current.spent + d.spentAmount;
            const newUnitsTarget = current.unitsTarget + d.unitsToCover;
            const newUnitsAchievement = current.unitsAchievement + d.unitsCovered;
            
            headCodeMap.set(d.headCode, { 
                target: newTarget,
                spent: newSpent,
                pending: Math.max(0, newTarget - newSpent),
                name: d.budgetHead,
                unitsTarget: newUnitsTarget,
                unitsAchievement: newUnitsAchievement
            });
        });

        const budgetAnalysisData = Array.from(headCodeMap.entries())
            .map(([code, data]) => ({ 
                name: code,
                fullName: data.name,
                Target: data.target,
                Achievement: data.spent,
                Pending: data.pending,
                UnitsTarget: data.unitsTarget,
                UnitsAchievement: data.unitsAchievement
            }))
            .sort((a, b) => b.Target - a.Target)
            .slice(0, 15);

        const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
        const qData = quarters.map(q => {
            const qRows = filteredData.filter(d => d.quarter.includes(q));
            return {
                name: q,
                target: qRows.reduce((acc, d) => acc + d.targetAmount, 0),
                spent: qRows.reduce((acc, d) => acc + d.spentAmount, 0),
                unitsTarget: qRows.reduce((acc, d) => acc + d.unitsToCover, 0),
                unitsAchievement: qRows.reduce((acc, d) => acc + d.unitsCovered, 0)
            };
        });
        const maxQ = Math.max(...qData.map(q => Math.max(q.target, q.spent))) || 1;
        const maxQUnits = Math.max(...qData.map(q => Math.max(q.unitsTarget, q.unitsAchievement))) || 1;

        const activityQuarterlyData = Array.from(headCodeMap.entries())
            .map(([code, data]) => {
                const activityRows = filteredData.filter(d => d.headCode === code);
                const qBreakdown: any = { 
                    name: code, 
                    fullName: data.name,
                    totalTarget: data.unitsTarget,
                    totalAchievement: data.unitsAchievement
                };
                ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
                    const qRows = activityRows.filter(d => d.quarter.includes(q));
                    qBreakdown[`${q}_Target`] = qRows.reduce((acc, d) => acc + d.unitsToCover, 0);
                    qBreakdown[`${q}_Achievement`] = qRows.reduce((acc, d) => acc + d.unitsCovered, 0);
                });
                return qBreakdown;
            })
            .sort((a, b) => b.totalTarget - a.totalTarget)
            .slice(0, 6); // Top 6 for readability in clustered view

        return { totalAmount, totalUnits, totalSpent, totalPending, qData, maxQ, maxQUnits, budgetAnalysisData, activityQuarterlyData };
    }, [filteredData]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[70vh]">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-gray-500 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Syncing Field Targets...</p>
        </div>
    );

    if (error) return (
        <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-red-100 dark:border-red-900/30">
            <div className="text-red-500 mb-4 inline-block p-4 bg-red-50 dark:bg-red-900/10 rounded-full">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <p className="text-gray-800 dark:text-white font-black uppercase tracking-widest mb-2">Sync Error</p>
            <p className="text-gray-500 text-sm mb-6">{error}</p>
            <button onClick={() => window.location.reload()} className="px-8 py-3 bg-red-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-red-700 active:scale-95 transition-all">Retry Sync</button>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header & Filters */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Budget Analysis Dashboard</h1>
                            <p className="text-slate-500 text-sm">Monitor budget allocation and utilization across activities</p>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto">
                            <Search className="w-4 h-4 text-slate-400 ml-2" />
                            <input
                                type="text"
                                placeholder="Search activity..."
                                className="bg-transparent border-none focus:ring-0 text-sm text-slate-700 w-full md:w-64"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Financial Year</label>
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                >
                                    {filterOptions.years.map(y => <option key={y} value={y} className="bg-white dark:bg-gray-800 text-slate-900 dark:text-white">{y}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Activity (Head Code)</label>
                            <div className="relative">
                                <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                    value={selectedActivity}
                                    onChange={(e) => setSelectedActivity(e.target.value)}
                                >
                                    {filterOptions.activities.map(a => <option key={a} value={a} className="bg-white dark:bg-gray-800 text-slate-900 dark:text-white">{a}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Month</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                >
                                    {filterOptions.months.map(m => <option key={m} value={m} className="bg-white dark:bg-gray-800 text-slate-900 dark:text-white">{m}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Quarter</label>
                            <div className="relative">
                                <PieChartIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                    value={selectedQuarter}
                                    onChange={(e) => setSelectedQuarter(e.target.value)}
                                >
                                    {filterOptions.quarters.map(q => <option key={q} value={q} className="bg-white dark:bg-gray-800 text-slate-900 dark:text-white">{q}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-2 bg-indigo-50 rounded-lg">
                                <Target className="w-5 h-5 text-indigo-600" />
                            </div>
                            <span className="text-sm font-medium text-slate-500">Total Target</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalAmount)}</div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-2 bg-emerald-50 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-emerald-600" />
                            </div>
                            <span className="text-sm font-medium text-slate-500">Utilized Budget</span>
                        </div>
                        <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalSpent)}</div>
                        <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-emerald-500 rounded-full"
                                    style={{ width: `${Math.min(100, (stats.totalSpent / (stats.totalAmount || 1)) * 100)}%` }}
                                />
                            </div>
                            <span className="text-[10px] font-bold text-slate-400">
                                {((stats.totalSpent / (stats.totalAmount || 1)) * 100).toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-2 bg-amber-50 rounded-lg">
                                <Clock className="w-5 h-5 text-amber-600" />
                            </div>
                            <span className="text-sm font-medium text-slate-500">Pending Budget</span>
                        </div>
                        <div className="text-2xl font-bold text-amber-600">{formatCurrency(stats.totalPending)}</div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-2 bg-slate-50 rounded-lg">
                                <Users className="w-5 h-5 text-slate-600" />
                            </div>
                            <span className="text-sm font-medium text-slate-500">Target Units</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900">{stats.totalUnits.toLocaleString()}</div>
                    </div>
                </div>

                {/* Budget Analysis Chart (Amount) */}
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm mb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg">Budget Utilization by Activity (Amount)</h3>
                            <p className="text-slate-500 text-xs mt-1">Comparing Target, Achievement, and Pending amounts (by Head Code)</p>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Achievement</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pending</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.budgetAnalysisData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                    interval={0}
                                    angle={-45}
                                    textAnchor="end"
                                />
                                <YAxis 
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                                    tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`}
                                />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ 
                                        borderRadius: '16px', 
                                        border: 'none', 
                                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                        padding: '16px'
                                    }}
                                    formatter={(value: number) => [formatCurrency(value), '']}
                                />
                                <Bar dataKey="Target" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={16} />
                                <Bar dataKey="Achievement" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
                                <Bar dataKey="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={16} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Units Analysis Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    {/* Activity-wise Units Clustered Chart */}
                    <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                            <div>
                                <h3 className="font-bold text-slate-900 text-lg">Activity-wise Units Achievement (Quarterly)</h3>
                                <p className="text-slate-500 text-xs mt-1">Clustered comparison of Target vs Achievement by Quarter (Top Activities)</p>
                            </div>
                        </div>
                        
                        <div className="h-[450px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.activityQuarterlyData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                        interval={0}
                                        angle={-45}
                                        textAnchor="end"
                                    />
                                    <YAxis 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                                    />
                                    <Tooltip 
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ 
                                            borderRadius: '16px', 
                                            border: 'none', 
                                            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                            padding: '16px'
                                        }}
                                    />
                                    <Legend 
                                        verticalAlign="top" 
                                        height={36}
                                        iconType="circle"
                                        wrapperStyle={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                    />
                                    {/* Q1 */}
                                    <Bar dataKey="Q1_Target" name="Q1 Target" fill="#6366f1" radius={[2, 2, 0, 0]} barSize={8} />
                                    <Bar dataKey="Q1_Achievement" name="Q1 Achieved" fill="#818cf8" radius={[2, 2, 0, 0]} barSize={8} />
                                    {/* Q2 */}
                                    <Bar dataKey="Q2_Target" name="Q2 Target" fill="#10b981" radius={[2, 2, 0, 0]} barSize={8} />
                                    <Bar dataKey="Q2_Achievement" name="Q2 Achieved" fill="#34d399" radius={[2, 2, 0, 0]} barSize={8} />
                                    {/* Q3 */}
                                    <Bar dataKey="Q3_Target" name="Q3 Target" fill="#f59e0b" radius={[2, 2, 0, 0]} barSize={8} />
                                    <Bar dataKey="Q3_Achievement" name="Q3 Achieved" fill="#fbbf24" radius={[2, 2, 0, 0]} barSize={8} />
                                    {/* Q4 */}
                                    <Bar dataKey="Q4_Target" name="Q4 Target" fill="#ef4444" radius={[2, 2, 0, 0]} barSize={8} />
                                    <Bar dataKey="Q4_Achievement" name="Q4 Achieved" fill="#f87171" radius={[2, 2, 0, 0]} barSize={8} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Activity Legend */}
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <h3 className="font-bold text-slate-900 mb-6 uppercase tracking-wider text-xs border-b border-slate-100 pb-4">Activity Code Legend</h3>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                            {stats.budgetAnalysisData.map((item) => (
                                <div key={item.name} className="flex gap-3 group">
                                    <div className="flex-shrink-0 w-12 h-6 bg-slate-50 rounded flex items-center justify-center border border-slate-100 group-hover:bg-indigo-50 transition-colors">
                                        <span className="text-[10px] font-bold text-indigo-600 font-mono">{item.name}</span>
                                    </div>
                                    <span className="text-[11px] text-slate-600 leading-tight font-medium group-hover:text-slate-900 transition-colors">{item.fullName}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Quarter-wise Units Chart */}
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm mb-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-sm">Quarterly Units Target vs Achievement</h3>
                            <p className="text-slate-500 text-[10px] mt-1">Units progress across financial quarters</p>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Achievement</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.qData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                                />
                                <YAxis 
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                                />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ 
                                        borderRadius: '12px', 
                                        border: 'none', 
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                        padding: '12px'
                                    }}
                                />
                                <Bar dataKey="unitsTarget" name="Target Units" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} />
                                <Bar dataKey="unitsAchievement" name="Achieved Units" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BudgetTrackerPage;
