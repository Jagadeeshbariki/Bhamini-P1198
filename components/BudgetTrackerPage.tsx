
import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
import { 
    Search, Activity, Calendar, PieChart as PieChartIcon, 
    Target, TrendingUp, Clock, Users,
    AlertCircle, CheckCircle2, X, Plus, Trash2
} from 'lucide-react';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, Cell, PieChart, Pie
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AuthContext } from '../contexts/AuthContext';
import { GOOGLE_APPS_SCRIPT_URL, BUDGET_CSV_URL } from '../config';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

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
            headCode: row['HEADCODE'] || row['HEAD_CODE'] || row['HEAD CODE'] || '',
            budgetHead: row['BUDGETHEAD'] || row['BUDGET_HEAD'] || row['BUDGET HEAD'] || '',
            targetAmount: parseFloat((row['TARGETAMOUNT'] || row['TARGET_AMOUNT'] || row['TARGET AMOUNT'] || '0').replace(/[^0-9.]/g, '')) || 0,
            unitsToCover: parseFloat((row['UNITSTOCOVER'] || row['UNITS_TO_COVER'] || row['UNITS TO COVER'] || '0').replace(/[^0-9.]/g, '')) || 0,
            spentAmount: parseFloat((row['SPENTAMOUNT'] || row['SPENT_AMOUNT'] || row['SPENT AMOUNT'] || row['SPENTAMONT'] || '0').replace(/[^0-9.]/g, '')) || 0,
            unitsCovered: parseFloat((row['UNITSCOVERED'] || row['UNITS_COVERED'] || row['UNITS COVERED'] || '0').replace(/[^0-9.]/g, '')) || 0
        };
    });
};

const BudgetTrackerPage: React.FC = () => {
    const authContext = useContext(AuthContext);
    const user = authContext?.user;
    const isAuthorized = user?.role === 'admin' || user?.role === 'tl';

    const [allData, setAllData] = useState<BudgetRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters & Search
    const [selectedYear, setSelectedYear] = useState<string>('All');
    const [selectedQuarter, setSelectedQuarter] = useState<string>('All');
    const [selectedMonth, setSelectedMonth] = useState<string>('All');
    const [selectedActivity, setSelectedActivity] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');

    // Update Form State
    const [showUpdateForm, setShowUpdateForm] = useState(false);
    const [updateYear, setUpdateYear] = useState('');
    const [updateMonth, setUpdateMonth] = useState('');
    const [updateType, setUpdateType] = useState<'budget' | 'units'>('budget');
    const [updateActivities, setUpdateActivities] = useState<string[]>([]);
    const [updateValues, setUpdateValues] = useState<Record<string, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
            console.log("Fetching budget data from:", BUDGET_CSV_URL);
            const response = await fetch(`${BUDGET_CSV_URL}${BUDGET_CSV_URL.includes('?') ? '&' : '?'}t=${Date.now()}`, { 
                signal: controller.signal 
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            
            const text = await response.text();
            console.log("Raw CSV length:", text?.length || 0);
            
            if (!text || text.trim().length === 0) {
                throw new Error("Received empty data from spreadsheet");
            }
            
            const parsed = parseCSV(text);
            console.log("Parsed records:", parsed.length);
            setAllData(parsed);
        } catch (err: any) {
            console.error("Fetch error:", err);
            if (err.name === 'AbortError') {
                setError("Request timed out. The spreadsheet might be taking too long to respond. Please try again.");
            } else {
                setError(err.message || "An unexpected error occurred while loading data.");
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
        const totalBudget = filteredData.reduce((acc, d) => acc + d.targetAmount, 0);
        const totalSpent = filteredData.reduce((acc, d) => acc + d.spentAmount, 0);
        const totalUnitsTarget = filteredData.reduce((acc, d) => acc + d.unitsToCover, 0);
        const totalUnitsCovered = filteredData.reduce((acc, d) => acc + d.unitsCovered, 0);
        
        const headCodeMap = new Map<string, { target: number, spent: number, name: string, unitsTarget: number, unitsCovered: number }>();
        filteredData.forEach(d => {
            const current = headCodeMap.get(d.headCode) || { target: 0, spent: 0, name: d.budgetHead, unitsTarget: 0, unitsCovered: 0 };
            headCodeMap.set(d.headCode, { 
                target: current.target + d.targetAmount,
                spent: current.spent + d.spentAmount,
                name: d.budgetHead,
                unitsTarget: current.unitsTarget + d.unitsToCover,
                unitsCovered: current.unitsCovered + d.unitsCovered
            });
        });

        const activityData = Array.from(headCodeMap.entries()).map(([code, data]) => {
            const achievementRate = data.target > 0 ? (data.spent / data.target) * 100 : 0;
            const unitsRate = data.unitsTarget > 0 ? (data.unitsCovered / data.unitsTarget) * 100 : 0;
            return {
                code,
                name: data.name,
                target: data.target,
                spent: data.spent,
                unitsTarget: data.unitsTarget,
                unitsCovered: data.unitsCovered,
                achievementRate,
                unitsRate,
                isOverspent: data.spent > data.target
            };
        });

        const overspentActivities = activityData.filter(a => a.isOverspent);
        const below50Progress = activityData.filter(a => a.unitsRate < 50);
        const completedActivities = activityData.filter(a => a.unitsRate >= 100);
        
        const sortedByAchievement = [...activityData].filter(a => a.target > 0).sort((a, b) => b.unitsRate - a.unitsRate);
        const highestPerforming = sortedByAchievement[0] || null;
        const lowestPerforming = sortedByAchievement[sortedByAchievement.length - 1] || null;

        const pieData = activityData
            .sort((a, b) => b.target - a.target)
            .slice(0, 5)
            .map(a => ({ name: a.name.split(' ')[0], value: a.target, code: a.code }));

        return { 
            totalBudget, 
            totalSpent, 
            totalUnitsTarget, 
            totalUnitsCovered, 
            activityData, 
            overspentActivities,
            below50Progress,
            completedActivities,
            highestPerforming,
            lowestPerforming,
            pieData
        };
    }, [filteredData]);

    if (loading && allData.length === 0) return (
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
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 pb-20">
            <div className="max-w-7xl mx-auto">
                {/* Update Form Modal */}
                {showUpdateForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Update Performance Data</h2>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Submit spent amounts or units covered</p>
                                </div>
                                <button 
                                    onClick={() => setShowUpdateForm(false)}
                                    className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                                >
                                    <X className="w-6 h-6 text-slate-400" />
                                </button>
                            </div>

                            <div className="p-8 max-h-[70vh] overflow-y-auto">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Financial Year</label>
                                        <select
                                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase text-slate-900 focus:ring-2 focus:ring-indigo-500"
                                            value={updateYear}
                                            onChange={(e) => setUpdateYear(e.target.value)}
                                        >
                                            <option value="">Select Year</option>
                                            {filterOptions.years.filter(y => y !== 'All').map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Month</label>
                                        <select
                                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase text-slate-900 focus:ring-2 focus:ring-indigo-500"
                                            value={updateMonth}
                                            onChange={(e) => setUpdateMonth(e.target.value)}
                                        >
                                            <option value="">Select Month</option>
                                            {filterOptions.months.filter(m => m !== 'All').map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Update Type</label>
                                        <select
                                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase text-slate-900 focus:ring-2 focus:ring-indigo-500"
                                            value={updateType}
                                            onChange={(e) => setUpdateType(e.target.value as 'budget' | 'units')}
                                        >
                                            <option value="budget">Spent Amount (Budget)</option>
                                            <option value="units">Units Covered</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Select Activities</label>
                                        <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl min-h-[48px]">
                                            {filterOptions.activities.filter(a => a !== 'All').map(activity => (
                                                <button
                                                    key={activity}
                                                    onClick={() => {
                                                        if (updateActivities.includes(activity)) {
                                                            setUpdateActivities(updateActivities.filter(a => a !== activity));
                                                            const newValues = { ...updateValues };
                                                            delete newValues[activity];
                                                            setUpdateValues(newValues);
                                                        } else {
                                                            setUpdateActivities([...updateActivities, activity]);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                                        updateActivities.includes(activity) 
                                                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                                                            : "bg-white text-slate-400 border border-slate-200 hover:border-indigo-300"
                                                    )}
                                                >
                                                    {activity}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {updateActivities.length > 0 && (
                                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                                        <div className="flex items-center gap-4">
                                            <div className="h-px bg-slate-100 flex-1"></div>
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Activity Details</span>
                                            <div className="h-px bg-slate-100 flex-1"></div>
                                        </div>
                                        
                                        {updateActivities.map((code) => {
                                            const activity = stats.activityData.find(a => a.code === code);
                                            return (
                                                <div key={code} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:border-indigo-200 transition-all">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div>
                                                            <p className="text-[11px] font-black text-slate-900 uppercase">{activity?.name || code}</p>
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{code}</p>
                                                        </div>
                                                        <button 
                                                            onClick={() => setUpdateActivities(updateActivities.filter(a => a !== code))}
                                                            className="text-slate-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                                            {updateType === 'budget' ? 'Enter Spent Amount (₹)' : 'Enter Units Covered'}
                                                        </label>
                                                        <input
                                                            type="number"
                                                            placeholder={updateType === 'budget' ? "0.00" : "0"}
                                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-[11px] font-black text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                                            value={updateValues[code] || ''}
                                                            onChange={(e) => setUpdateValues({ ...updateValues, [code]: parseFloat(e.target.value) || 0 })}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                                <button 
                                    onClick={() => setShowUpdateForm(false)}
                                    className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    disabled={isSubmitting || !updateYear || !updateMonth || updateActivities.length === 0}
                                    onClick={async () => {
                                        setIsSubmitting(true);
                                        try {
                                            const payload = {
                                                action: 'updateBudgetPerformance',
                                                year: updateYear,
                                                month: updateMonth,
                                                type: updateType,
                                                updates: Object.entries(updateValues).map(([code, value]) => ({ code, value }))
                                            };

                                            // We use a timeout for the submission too
                                            const submitController = new AbortController();
                                            const submitTimeout = setTimeout(() => submitController.abort(), 60000); // 60s timeout

                                            await fetch(GOOGLE_APPS_SCRIPT_URL, {
                                                method: 'POST',
                                                mode: 'no-cors',
                                                body: JSON.stringify(payload),
                                                signal: submitController.signal
                                            });
                                            
                                            clearTimeout(submitTimeout);

                                            alert("Update submitted successfully! The dashboard will refresh with new data in a few seconds.");
                                            
                                            setShowUpdateForm(false);
                                            setUpdateActivities([]);
                                            setUpdateValues({});
                                            
                                            // Re-fetch data after a delay to allow Google Sheets to process the update
                                            setTimeout(() => {
                                                fetchData();
                                            }, 3000);
                                        } catch (err: any) {
                                            console.error("Submission error:", err);
                                            alert("Error submitting update: " + (err.name === 'AbortError' ? "Request timed out" : err.message));
                                        } finally {
                                            setIsSubmitting(false);
                                        }
                                    }}
                                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:shadow-none"
                                >
                                    {isSubmitting ? 'Submitting...' : 'Submit Updates'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header & Filters */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Budget & Activity Dashboard</h1>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Performance Monitoring & Utilization Tracking</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            {isAuthorized && (
                                <button 
                                    onClick={() => setShowUpdateForm(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                                >
                                    <Plus className="w-3 h-3" />
                                    Update Spents
                                </button>
                            )}
                            <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 flex-1 md:flex-none">
                                <Search className="w-4 h-4 text-slate-400 ml-2" />
                                <input
                                    type="text"
                                    placeholder="SEARCH BUDGET HEAD..."
                                    className="bg-transparent border-none focus:ring-0 text-[10px] font-bold uppercase text-slate-700 w-full md:w-64"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Year</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                >
                                    {filterOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Quarter</label>
                            <div className="relative">
                                <PieChartIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                                    value={selectedQuarter}
                                    onChange={(e) => setSelectedQuarter(e.target.value)}
                                >
                                    {filterOptions.quarters.map(q => <option key={q} value={q}>{q}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Month</label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                >
                                    {filterOptions.months.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Activity Code</label>
                            <div className="relative flex gap-2">
                                <div className="relative flex-1">
                                    <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <select
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                                        value={selectedActivity}
                                        onChange={(e) => setSelectedActivity(e.target.value)}
                                    >
                                        {filterOptions.activities.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                                <button 
                                    onClick={() => {
                                        setSelectedYear('All');
                                        setSelectedQuarter('All');
                                        setSelectedMonth('All');
                                        setSelectedActivity('All');
                                        setSearchQuery('');
                                    }}
                                    className="p-3 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-colors"
                                    title="Reset Filters"
                                >
                                    <Clock className="w-4 h-4 rotate-180" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 1. Top Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
                                <Target className="w-6 h-6" />
                            </div>
                            <span className="text-[8px] font-black uppercase text-indigo-500 tracking-widest bg-indigo-50 px-2 py-1 rounded-lg">Budget Target</span>
                        </div>
                        <div className="mt-4">
                            <p className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(stats.totalBudget)}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Total Allocated</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <span className="text-[8px] font-black uppercase text-emerald-500 tracking-widest bg-emerald-50 px-2 py-1 rounded-lg">Spent Amount</span>
                        </div>
                        <div className="mt-4">
                            <p className="text-2xl font-black text-emerald-600 tracking-tight">{formatCurrency(stats.totalSpent)}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{((stats.totalSpent / (stats.totalBudget || 1)) * 100).toFixed(1)}% Utilization</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 group-hover:scale-110 transition-transform">
                                <Users className="w-6 h-6" />
                            </div>
                            <span className="text-[8px] font-black uppercase text-amber-500 tracking-widest bg-amber-50 px-2 py-1 rounded-lg">Units Target</span>
                        </div>
                        <div className="mt-4">
                            <p className="text-2xl font-black text-slate-900 tracking-tight">{stats.totalUnitsTarget.toLocaleString()}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Total Beneficiaries</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-sky-50 rounded-2xl text-sky-600 group-hover:scale-110 transition-transform">
                                <Activity className="w-6 h-6" />
                            </div>
                            <span className="text-[8px] font-black uppercase text-sky-500 tracking-widest bg-sky-50 px-2 py-1 rounded-lg">Units Covered</span>
                        </div>
                        <div className="mt-4">
                            <p className="text-2xl font-black text-sky-600 tracking-tight">{stats.totalUnitsCovered.toLocaleString()}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{((stats.totalUnitsCovered / (stats.totalUnitsTarget || 1)) * 100).toFixed(1)}% Coverage</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
                    {/* 2. Bar Chart: Target vs Spent */}
                    <div className="lg:col-span-8 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Budget Utilization by Head</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Target vs Spent Amount (Top 10)</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                    <span className="text-[8px] font-black uppercase text-slate-400">Target</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <span className="text-[8px] font-black uppercase text-slate-400">Spent</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart 
                                    data={stats.activityData.slice(0, 10)} 
                                    margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                                    onClick={(data) => {
                                        if (data && data.activePayload && data.activePayload[0]) {
                                            setSelectedActivity(data.activePayload[0].payload.code);
                                        }
                                    }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="code" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }}
                                        tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`}
                                    />
                                    <Tooltip 
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                        formatter={(val: number) => [formatCurrency(val), '']}
                                    />
                                    <Bar dataKey="target" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Bar dataKey="spent" radius={[4, 4, 0, 0]} barSize={20}>
                                        {stats.activityData.slice(0, 10).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.spent > entry.target ? '#ef4444' : '#10b981'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 5. Pie Chart: Budget Distribution */}
                    <div className="lg:col-span-4 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Budget Split</h3>
                            <PieChartIcon className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div className="flex-grow min-h-[250px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.pieData}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        onClick={(data) => {
                                            if (data && data.code) {
                                                setSelectedActivity(data.code);
                                            }
                                        }}
                                    >
                                        {stats.pieData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#f43f5e', '#06b6d4'][index % 7]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-xl font-black text-slate-900">{stats.activityData.length}</span>
                                <span className="text-[7px] font-black uppercase text-slate-400">Heads</span>
                            </div>
                        </div>
                        <div className="mt-6 space-y-2">
                            {stats.pieData.slice(0, 4).map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ background: ['#6366f1', '#10b981', '#f59e0b', '#3b82f6'][idx % 4] }}></div>
                                        <span className="text-[9px] font-black uppercase text-slate-500">{item.name}</span>
                                    </div>
                                    <span className="text-[9px] font-black text-slate-900">{((item.value / stats.totalBudget) * 100).toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
                    {/* 3. Units Progress */}
                    <div className="lg:col-span-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Units Coverage Progress</h3>
                            <Activity className="w-4 h-4 text-sky-500" />
                        </div>
                        <div className="space-y-6">
                            {stats.activityData.slice(0, 5).map((activity, idx) => (
                                <div key={idx} className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <div className="max-w-[70%]">
                                            <p className="text-[10px] font-black text-slate-900 uppercase truncate">{activity.name}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">{activity.code}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-slate-900">{activity.unitsCovered} / {activity.unitsTarget}</p>
                                            <p className="text-[8px] font-bold text-sky-500 uppercase">{activity.unitsRate.toFixed(1)}%</p>
                                        </div>
                                    </div>
                                    <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                                        <div 
                                            className={cn(
                                                "h-full rounded-full transition-all duration-1000",
                                                activity.unitsRate >= 80 ? "bg-emerald-500" : activity.unitsRate >= 40 ? "bg-amber-500" : "bg-red-500"
                                            )}
                                            style={{ width: `${Math.min(100, activity.unitsRate)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 7. Insights Section */}
                    <div className="lg:col-span-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Dashboard Insights</h3>
                            <TrendingUp className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-5 bg-red-50 rounded-3xl border border-red-100 flex items-center gap-4">
                                <div className="p-3 bg-white rounded-2xl text-red-500 shadow-sm">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Overspent</p>
                                    <p className="text-xl font-black text-red-600">{stats.overspentActivities.length}</p>
                                </div>
                            </div>

                            <div className="p-5 bg-indigo-50 rounded-3xl border border-indigo-100 flex items-center gap-4">
                                <div className="p-3 bg-white rounded-2xl text-indigo-500 shadow-sm">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Completed</p>
                                    <p className="text-xl font-black text-indigo-600">{stats.completedActivities.length}</p>
                                </div>
                            </div>

                            <div className="p-5 bg-amber-50 rounded-3xl border border-amber-100 flex items-center gap-4">
                                <div className="p-3 bg-white rounded-2xl text-amber-500 shadow-sm">
                                    <Clock className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Below 50%</p>
                                    <p className="text-xl font-black text-amber-600">{stats.below50Progress.length}</p>
                                </div>
                            </div>
                            
                            {stats.highestPerforming && (
                                <div className="p-5 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-center gap-4 sm:col-span-2">
                                    <div className="p-3 bg-white rounded-2xl text-emerald-500 shadow-sm">
                                        <TrendingUp className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Highest Performance</p>
                                        <p className="text-sm font-black text-emerald-700 truncate">{stats.highestPerforming.name}</p>
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase">{stats.highestPerforming.unitsRate.toFixed(1)}% Coverage</p>
                                    </div>
                                </div>
                            )}

                            {stats.lowestPerforming && (
                                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-4 sm:col-span-2">
                                    <div className="p-3 bg-white rounded-2xl text-slate-500 shadow-sm">
                                        <Clock className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lowest Performance</p>
                                        <p className="text-sm font-black text-slate-700 truncate">{stats.lowestPerforming.name}</p>
                                        <p className="text-[10px] font-bold text-slate-600 uppercase">{stats.lowestPerforming.unitsRate.toFixed(1)}% Coverage</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 4. Overspending Table */}
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Overspending Analysis</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Activities exceeding allocated budget</p>
                        </div>
                        <div className="px-4 py-2 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                            {stats.overspentActivities.length} Alerts
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Budget Head</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Target</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Spent</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Variance</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {stats.overspentActivities.length > 0 ? stats.overspentActivities.map((activity, idx) => (
                                    <tr key={idx} className="bg-red-50/30 hover:bg-red-50/50 transition-colors">
                                        <td className="px-8 py-4">
                                            <p className="text-[11px] font-black text-slate-900 uppercase">{activity.name}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{activity.code}</p>
                                        </td>
                                        <td className="px-8 py-4 text-[11px] font-bold text-slate-600">{formatCurrency(activity.target)}</td>
                                        <td className="px-8 py-4 text-[11px] font-black text-red-600">{formatCurrency(activity.spent)}</td>
                                        <td className="px-8 py-4 text-[11px] font-black text-red-600">+{formatCurrency(activity.spent - activity.target)}</td>
                                        <td className="px-8 py-4">
                                            <span className="px-3 py-1 bg-red-100 text-red-600 rounded-lg text-[8px] font-black uppercase tracking-widest">Overspent</span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-12 text-center">
                                            <div className="flex flex-col items-center gap-2 opacity-30">
                                                <CheckCircle2 className="w-8 h-8" />
                                                <p className="text-[10px] font-black uppercase tracking-widest">All activities within budget</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BudgetTrackerPage;
