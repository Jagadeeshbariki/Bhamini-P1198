
import React, { useState, useEffect, useMemo } from 'react';

const BUDGET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgIQP5-BbSLrJRyN-E___LfrW-uQlNa3iZ4AbFfKM3Ne_FHlFeRXbHG2Xk5JYQhh9o_HLekVTmwsh6/pub?gid=1547578809&single=true&output=csv';

interface BudgetRow {
    year: string;
    quarter: string;
    months: string;
    headCode: string;
    budgetHead: string;
    targetAmount: number;
    unitsToCover: number;
}

const BudgetTrackerPage: React.FC = () => {
    const [allData, setAllData] = useState<BudgetRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters & Search
    const [selectedYear, setSelectedYear] = useState<string>('All');
    const [selectedQuarter, setSelectedQuarter] = useState<string>('All');
    const [selectedHead, setSelectedHead] = useState<string>('All');
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
                headCode: row['HEADCODE'] || '',
                budgetHead: row['BUDGETHEAD'] || '',
                targetAmount: parseFloat((row['TARGETAMOUNT'] || '0').replace(/[^0-9.]/g, '')) || 0,
                unitsToCover: parseFloat((row['UNITSTOCOVER'] || '0').replace(/[^0-9.]/g, '')) || 0
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

    const filterOptions = useMemo(() => ({
        years: ['All', ...Array.from(new Set(allData.map(d => d.year).filter(Boolean))).sort()],
        quarters: ['All', ...Array.from(new Set(allData.map(d => d.quarter).filter(Boolean))).sort()],
        budgetHeads: ['All', ...Array.from(new Set(allData.map(d => d.budgetHead).filter(Boolean))).sort()]
    }), [allData]);

    const filteredData = useMemo(() => {
        return allData.filter(d => {
            const matchesYear = selectedYear === 'All' || d.year === selectedYear;
            const matchesQuarter = selectedQuarter === 'All' || d.quarter === selectedQuarter;
            const matchesHead = selectedHead === 'All' || d.budgetHead === selectedHead;
            const matchesSearch = d.budgetHead.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 d.headCode.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesYear && matchesQuarter && matchesHead && matchesSearch;
        });
    }, [allData, selectedYear, selectedQuarter, selectedHead, searchQuery]);

    const stats = useMemo(() => {
        const totalAmount = filteredData.reduce((acc, d) => acc + d.targetAmount, 0);
        const totalUnits = filteredData.reduce((acc, d) => acc + d.unitsToCover, 0);
        const topActivities = [...filteredData].sort((a, b) => b.targetAmount - a.targetAmount).slice(0, 3);
        
        const headCodeMap = new Map<string, { units: number, name: string }>();
        filteredData.forEach(d => {
            const current = headCodeMap.get(d.headCode) || { units: 0, name: d.budgetHead };
            headCodeMap.set(d.headCode, { 
                units: current.units + d.unitsToCover, 
                name: d.budgetHead 
            });
        });

        const barChartData = Array.from(headCodeMap.entries())
            .map(([code, data]) => ({ code, ...data }))
            .sort((a, b) => b.units - a.units)
            .slice(0, 15);

        const maxUnits = Math.max(...barChartData.map(d => d.units)) || 1;

        const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
        const qData = quarters.map(q => ({
            name: q,
            amount: filteredData.filter(d => d.quarter.includes(q)).reduce((acc, d) => acc + d.targetAmount, 0)
        }));
        const maxQ = Math.max(...qData.map(q => q.amount)) || 1;

        return { totalAmount, totalUnits, topActivities, qData, maxQ, barChartData, maxUnits };
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
        <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-7xl mx-auto pb-12 px-2">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 sm:p-3 bg-blue-600 rounded-2xl text-white shadow-lg">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                        </div>
                        <h1 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">Activity Dashboard</h1>
                    </div>
                    <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-[0.2em] pl-1">Financial Year {selectedYear !== 'All' ? selectedYear : 'Consolidated'}</p>
                </div>
                
                <div className="w-full lg:w-96 relative group">
                    <input 
                        type="text" 
                        placeholder="Search activities..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 sm:py-4 bg-white dark:bg-gray-800 rounded-2xl border-none ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-2 focus:ring-blue-600 shadow-xl transition-all font-bold placeholder:text-gray-400 text-sm"
                    />
                    <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
                    <p className="text-blue-100 font-black uppercase tracking-[0.2em] text-[10px] mb-2 opacity-80">Total Target Amount</p>
                    <h3 className="text-3xl sm:text-4xl font-black">₹{stats.totalAmount.toLocaleString('en-IN')}</h3>
                    <div className="mt-6">
                        <span className="px-3 py-1 bg-white/20 rounded-full text-[9px] font-black uppercase tracking-wider">Financial Focus</span>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
                    <p className="text-emerald-50 font-black uppercase tracking-[0.2em] text-[10px] mb-2 bg-emerald-700/30 inline-block px-2 py-0.5 rounded">Total Units to Cover</p>
                    <h3 className="text-3xl sm:text-4xl font-black">{stats.totalUnits.toLocaleString('en-IN')}</h3>
                    <div className="mt-6">
                        <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest">Aggregate Impact</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl lg:col-span-1">
                    <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-[10px] mb-4">Quarterly Trajectory</p>
                    <div className="flex items-end justify-between h-20 gap-2">
                        {stats.qData.map(q => (
                            <div key={q.name} className="flex-1 flex flex-col items-center gap-2 group">
                                <div 
                                    className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-lg relative overflow-hidden transition-all duration-1000 origin-bottom hover:bg-blue-600"
                                    style={{ height: `${(q.amount / stats.maxQ) * 100}%`, minHeight: '4px' }}
                                >
                                    <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                </div>
                                <span className="text-[9px] font-black text-gray-500 group-hover:text-blue-600">{q.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Interactive Bar Chart - Mobile Optimized */}
            <div className="bg-white dark:bg-gray-800 p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-2xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 sm:mb-16">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 sm:h-8 bg-indigo-600 rounded-full"></div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Units by Head Code</h2>
                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-1">Scroll chart to see more</p>
                        </div>
                    </div>
                    
                    <div className="flex gap-2 w-full sm:w-auto">
                        <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="flex-1 sm:flex-none text-[9px] font-black uppercase bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-xl border-none ring-1 ring-gray-100 dark:ring-gray-600">
                            {filterOptions.years.map(y => <option key={y} value={y}>Year: {y}</option>)}
                        </select>
                        <select value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value)} className="flex-1 sm:flex-none text-[9px] font-black uppercase bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-xl border-none ring-1 ring-gray-100 dark:ring-gray-600">
                            {filterOptions.quarters.map(q => <option key={q} value={q}>Qtr: {q}</option>)}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto pb-8 custom-scrollbar">
                    <div className="relative h-[250px] sm:h-[300px] flex items-end justify-between gap-1.5 sm:gap-4 group/chart px-2 min-w-[600px] sm:min-w-0">
                        {/* Grid Lines */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
                            {[1, 0.75, 0.5, 0.25, 0].map(v => (
                                <div key={v} className="w-full border-t border-dashed border-gray-200 dark:border-gray-700 flex items-center">
                                    <span className="text-[7px] font-black text-gray-400 -mt-2.5">{(stats.maxUnits * v).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>

                        {/* Bars */}
                        {stats.barChartData.map((data, i) => (
                            <div key={data.code} className="relative flex-1 flex flex-col items-center group h-full justify-end">
                                {/* Floating Value Indicator */}
                                <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-30 pointer-events-none translate-y-2 group-hover:translate-y-0">
                                    <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-2 border border-indigo-400">
                                        <span className="text-[11px] font-black leading-none">{data.units.toLocaleString()}</span>
                                    </div>
                                    <div className="w-2 h-2 bg-indigo-600 rotate-45 mx-auto -mt-1"></div>
                                </div>

                                {/* Bar Visual */}
                                <div 
                                    className="w-full max-w-[44px] rounded-t-xl sm:rounded-t-2xl relative overflow-hidden transition-all duration-700 ease-out origin-bottom hover:scale-x-110 shadow-lg cursor-pointer border-t border-white/30"
                                    style={{ 
                                        height: `${(data.units / stats.maxUnits) * 100}%`,
                                        background: 'linear-gradient(to top, #4f46e5, #818cf8)',
                                        transitionDelay: `${i * 15}ms`
                                    }}
                                >
                                    <div className="absolute inset-0 bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    { (data.units / stats.maxUnits) > 0.2 && (
                                        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[9px] font-black text-white/80 rotate-90 origin-center whitespace-nowrap pointer-events-none">
                                            {data.units.toLocaleString()}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Axis Label */}
                                <div className="h-10 mt-3 flex items-start justify-center">
                                    <span className="text-[8px] sm:text-[9px] font-black text-gray-500 mt-1 uppercase rotate-45 origin-left truncate max-w-[45px]">
                                        {data.code}
                                    </span>
                                </div>
                            </div>
                        ))}
                        
                        {stats.barChartData.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-300 font-black uppercase tracking-[0.3em] text-[10px]">
                                No data available
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
                {/* Activity Detail Table */}
                <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                            <h2 className="text-lg sm:text-xl font-black text-gray-800 dark:text-white uppercase">Activity Detail</h2>
                        </div>
                        <span className="text-[9px] font-black text-gray-400 uppercase bg-gray-50 dark:bg-gray-700 px-3 py-1 rounded-full">
                            {filteredData.length} Records
                        </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl">
                        <table className="w-full text-left border-collapse min-w-[500px]">
                            <thead>
                                <tr className="border-b border-gray-50 dark:border-gray-700">
                                    <th className="px-2 py-4 text-[10px] font-black uppercase text-gray-400">Activity & Code</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase text-gray-400 text-right">Target</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase text-gray-400 text-right">Units</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                {filteredData.map((row, i) => (
                                    <tr key={i} className="group hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-colors">
                                        <td className="px-2 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-xs sm:text-sm font-bold text-gray-800 dark:text-white group-hover:text-blue-600 transition-colors">{row.budgetHead}</span>
                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter mt-1">{row.headCode}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-5 text-right font-black text-blue-600 text-xs sm:text-sm">₹{row.targetAmount.toLocaleString('en-IN')}</td>
                                        <td className="px-4 py-5 text-right font-black text-emerald-600 text-xs sm:text-sm">{row.unitsToCover.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Insights Sidebar */}
                <div className="space-y-6">
                    <div className="bg-gray-900 text-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                        <h3 className="text-base sm:text-lg font-black uppercase tracking-widest mb-6 relative z-10">High Impact Focus</h3>
                        <div className="space-y-6 relative z-10">
                            {stats.topActivities.map((act, idx) => (
                                <div key={idx} className="flex flex-col gap-1.5 border-l-2 border-indigo-500 pl-4">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter line-clamp-1">{act.budgetHead}</p>
                                    <p className="text-lg sm:text-xl font-black">₹{act.targetAmount.toLocaleString('en-IN')}</p>
                                    <p className="text-[9px] font-bold text-gray-500 uppercase">Units: {act.unitsToCover.toLocaleString()}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6">Top Distribution</h3>
                        <div className="space-y-4">
                            {stats.barChartData.slice(0, 5).map((data, i) => (
                                <div key={i} className="space-y-1.5">
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                        <span className="text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{data.code}</span>
                                        <span className="text-blue-600">{((data.units / stats.totalUnits) * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-gray-50 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${(data.units / stats.totalUnits) * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; }
            `}</style>
        </div>
    );
};

export default BudgetTrackerPage;
