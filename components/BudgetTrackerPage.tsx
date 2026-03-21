
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
    Search, Filter, Activity, Calendar, PieChart as PieChartIcon, 
    Target, TrendingUp, Clock, Users 
} from 'lucide-react';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, Cell 
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
        
        const headCodeMap = new Map<string, { target: number, spent: number, pending: number, name: string }>();
        filteredData.forEach(d => {
            const current = headCodeMap.get(d.headCode) || { target: 0, spent: 0, pending: 0, name: d.budgetHead };
            const newTarget = current.target + d.targetAmount;
            const newSpent = current.spent + d.spentAmount;
            headCodeMap.set(d.headCode, { 
                target: newTarget,
                spent: newSpent,
                pending: Math.max(0, newTarget - newSpent),
                name: d.budgetHead 
            });
        });

        const budgetAnalysisData = Array.from(headCodeMap.entries())
            .map(([code, data]) => ({ 
                name: code,
                Target: data.target,
                Utilized: data.spent,
                Pending: data.pending
            }))
            .sort((a, b) => b.Target - a.Target)
            .slice(0, 15);

        const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
        const qData = quarters.map(q => ({
            name: q,
            amount: filteredData.filter(d => d.quarter.includes(q)).reduce((acc, d) => acc + d.targetAmount, 0)
        }));
        const maxQ = Math.max(...qData.map(q => q.amount)) || 1;

        return { totalAmount, totalUnits, totalSpent, totalPending, qData, maxQ, budgetAnalysisData };
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
                            <p className="text-slate-50 text-sm">Monitor budget allocation and utilization across activities</p>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto">
                            <Search className="w-4 h-4 text-slate-400 ml-2" />
                            <input
                                type="text"
                                placeholder="Search activity..."
                                className="bg-transparent border-none focus:ring-0 text-sm w-full md:w-64"
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
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                >
                                    {filterOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Activity (Head Code)</label>
                            <div className="relative">
                                <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                    value={selectedActivity}
                                    onChange={(e) => setSelectedActivity(e.target.value)}
                                >
                                    {filterOptions.activities.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Month</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                >
                                    {filterOptions.months.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Quarter</label>
                            <div className="relative">
                                <PieChartIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                    value={selectedQuarter}
                                    onChange={(e) => setSelectedQuarter(e.target.value)}
                                >
                                    {filterOptions.quarters.map(q => <option key={q} value={q}>{q}</option>)}
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

                {/* Budget Analysis Chart */}
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm mb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg">Budget Utilization by Activity</h3>
                            <p className="text-slate-500 text-xs mt-1">Comparing Target, Utilized, and Pending amounts</p>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Utilized</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pending</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="h-[450px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.budgetAnalysisData} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
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
                                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                                        padding: '16px'
                                    }}
                                    formatter={(value: number) => [formatCurrency(value), '']}
                                />
                                <Bar dataKey="Target" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={16} />
                                <Bar dataKey="Utilized" fill="#10b981" radius={[6, 6, 0, 0]} barSize={16} />
                                <Bar dataKey="Pending" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={16} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Quarterly Breakdown */}
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-8 uppercase tracking-wider text-sm">Quarterly Allocation</h3>
                        <div className="space-y-8">
                            {stats.qData.map((q) => (
                                <div key={q.name} className="space-y-3">
                                    <div className="flex justify-between items-end">
                                        <span className="text-sm font-bold text-slate-700">{q.name}</span>
                                        <span className="text-xs font-bold text-indigo-600">{formatCurrency(q.amount)}</span>
                                    </div>
                                    <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                        <div 
                                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000"
                                            style={{ width: `${(q.amount / stats.maxQ) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Detailed Activity Table */}
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-sm">Activity Details</h3>
                            <span className="text-[10px] font-bold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200">
                                {filteredData.length} Activities
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Activity & Code</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Target</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Utilized</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Pending</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredData.slice(0, 15).map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{row.budgetHead}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 font-mono">{row.headCode}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <span className="text-sm font-bold text-slate-700">{formatCurrency(row.targetAmount)}</span>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <span className="text-sm font-bold text-emerald-600">{formatCurrency(row.spentAmount)}</span>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <span className="text-sm font-bold text-amber-600">{formatCurrency(row.targetAmount - row.spentAmount)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {filteredData.length > 15 && (
                            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Showing top 15 activities</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BudgetTrackerPage;
