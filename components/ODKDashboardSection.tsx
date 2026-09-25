import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Bar, LabelList, LineChart, Line } from 'recharts';
import { toCanvas } from 'html-to-image';
import jsPDF from 'jspdf';
import { Download, Image as ImageIcon, LayoutDashboard, Table } from 'lucide-react';


const HDFC_MEMBERS = ['jadeskung', 'mani', 'sampanth', 'praveen', 'sugreevulu', 'lokesh', 'meenaka_ganapathi', 'meenak_ganapthi'];
const INTERNAL_MEMBERS = ['minna rao', 'govindu rao', 'vinodkumar', 'vinod kumar', 'sugreevulu', 'lokesh', 'meenaka_ganapathi', 'meenak_ganapthi', 'adinarayana', 'santhi'];

const getProjectsForUser = (userName: string) => {
    if (!userName) return ['HDFC', 'Internal'];
    const normalized = userName.toLowerCase().trim();
    const inHDFC = HDFC_MEMBERS.some(m => normalized.includes(m));
    const inInternal = INTERNAL_MEMBERS.some(m => normalized.includes(m));
    
    if (!inHDFC && !inInternal) return ['HDFC', 'Internal'];
    
    const projects: string[] = [];
    if (inHDFC) projects.push('HDFC');
    if (inInternal) projects.push('Internal');
    return projects;
};

export const ODKDashboardSection: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<'dashboard' | 'frp-report'>('dashboard');

    const [selectedForm, setSelectedForm] = useState<string>('All');
    const [selectedUser, setSelectedUser] = useState<string>('All');
    const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'));
    const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
    const [selectedDate, setSelectedDate] = useState<string>('All');
    const [selectedProject, setSelectedProject] = useState<string>('All');

    const pivotRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/odk/dashboard');
                if (!res.ok) {
                    throw new Error(`Failed to fetch data: ${res.status}`);
                }
                const result = await res.json();
                setData(result);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const { filteredSubmissions, filteredForms, filteredUsers, filteredTimeline, aggregatedForms, topUsers, pivotData, frpColumns, frpTotals } = useMemo(() => {
        if (!data) return { filteredSubmissions: [], filteredForms: [], filteredUsers: [], filteredTimeline: [], aggregatedForms: [], topUsers: [], pivotData: [], frpColumns: [], frpTotals: {} };
        
        const { rawSubmissions, forms, users } = data;

        const usersMap = new Map(users.map((u: any) => [u.id, u.name]));
        const formsMap = new Map(forms.map((f: any) => [f.id, f.name]));

        // Apply filters
        const filtered = rawSubmissions.filter((sub: any) => {
            const dateObj = new Date(sub.date);
            const subMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
            const subYear = String(dateObj.getFullYear());
            const subDateString = sub.date.split('T')[0];

            const matchForm = selectedForm === 'All' || sub.formId === selectedForm;
            const matchUser = selectedUser === 'All' || String(sub.userId) === selectedUser;
            
            const matchDate = selectedDate === 'All' || subDateString === selectedDate;
            const matchMonth = selectedDate !== 'All' ? true : (selectedMonth === 'All' || subMonth === selectedMonth);
            const matchYear = selectedDate !== 'All' ? true : (selectedYear === 'All' || subYear === selectedYear);
            
            let matchProject = true;
            if (selectedProject !== 'All') {
                const subUserName = usersMap.get(sub.userId) || '';
                const projects = getProjectsForUser(subUserName);
                if (!projects.includes(selectedProject)) matchProject = false;
            }

            return matchForm && matchUser && matchMonth && matchYear && matchDate && matchProject;
        });

        // Aggregation
        const formStats = new Map<string, { id: string, name: string, total: number, latest: string | null }>();
        const userStats = new Map<string, { id: string, name: string, total: number }>();
        const timelineStats = new Map<string, number>();

        filtered.forEach((sub: any) => {
            // Forms
            if (!formStats.has(sub.formId)) {
                formStats.set(sub.formId, { id: sub.formId, name: formsMap.get(sub.formId) || sub.formId, total: 0, latest: null });
            }
            const fStat = formStats.get(sub.formId)!;
            fStat.total += 1;
            if (!fStat.latest || new Date(sub.date) > new Date(fStat.latest)) {
                fStat.latest = sub.date;
            }

            // Users
            if (!userStats.has(String(sub.userId))) {
                userStats.set(String(sub.userId), { id: String(sub.userId), name: (usersMap.get(sub.userId) as string) || `User ${sub.userId}`, total: 0 });
            }
            const uStat = userStats.get(String(sub.userId))!;
            uStat.total += 1;

            // Timeline
            const dateStr = sub.date.split('T')[0];
            timelineStats.set(dateStr, (timelineStats.get(dateStr) || 0) + 1);
        });

        const aggregatedFormsArr = Array.from(formStats.values()).sort((a, b) => b.total - a.total);
        const topUsersArr = Array.from(userStats.values()).sort((a, b) => b.total - a.total);
        const timelineArr = Array.from(timelineStats.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));

        // Pivot Generation
        const pivotMap = new Map(); // Form Name -> Map of FRP Name -> Count
        const frpNamesSet = new Set();
        
        // Add ALL valid users to frpNamesSet based on current user/project filters
        users.forEach((u: any) => {
            const matchUser = selectedUser === 'All' || String(u.id) === selectedUser;
            let matchProject = true;
            if (selectedProject !== 'All') {
                const projects = getProjectsForUser(u.name);
                if (!projects.includes(selectedProject)) matchProject = false;
            }
            if (matchUser && matchProject) {
                frpNamesSet.add(u.name);
            }
        });

        filtered.forEach((sub: any) => {
            const formName = formsMap.get(sub.formId) || sub.formId;
            const frpName = usersMap.get(sub.userId) || `User ${sub.userId}`;
            
            // Just in case a submission has a user not in the users array
            frpNamesSet.add(frpName);
            
            if (!pivotMap.has(formName)) {
                pivotMap.set(formName, new Map());
            }
            const fMap = pivotMap.get(formName);
            fMap.set(frpName, (fMap.get(frpName) || 0) + 1);
        });

        const frpColumns = Array.from(frpNamesSet).sort((a: any, b: any) => a.localeCompare(b));
        
        const frpTotals: Record<string, number> = { total: 0 };
        frpColumns.forEach((frp: any) => {
            frpTotals[frp] = 0;
        });

        const pivotData = Array.from(pivotMap.keys()).sort().map(formName => {
            const row: any = { formName };
            const fMap = pivotMap.get(formName);
            let total = 0;
            frpColumns.forEach((frp: any) => {
                const count = fMap.get(frp) || 0;
                row[frp] = count;
                frpTotals[frp] += count;
                total += count;
            });
            row.total = total;
            frpTotals.total += total;
            return row;
        }).sort((a, b) => b.total - a.total);

        return {
            filteredForms: forms,
            filteredSubmissions: filtered,
            filteredUsers: users,
            filteredTimeline: timelineArr,
            aggregatedForms: aggregatedFormsArr,
            topUsers: topUsersArr,
            pivotData,
            frpColumns,
            frpTotals
        };
    }, [data, selectedForm, selectedUser, selectedMonth, selectedYear, selectedDate, selectedProject]);


    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[300px]">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs animate-pulse">Loading ODK Data...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-red-500">
                <p className="font-bold">Error loading ODK data</p>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    const top10Users = topUsers.slice(0, 10);
    const totalSubmissions = aggregatedForms.reduce((acc: any, f: any) => acc + f.total, 0);

        const exportToCSV = () => {
        const csvRows = [];
        let filename = '';

        if (activeTab === 'frp-report') {
            if (!pivotData || pivotData.length === 0) {
                alert('No data to export for the selected filters.');
                return;
            }
            
            // Header row
            const headers = ['Form Name', ...frpColumns, 'Grand Total'];
            csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));
            
            // Data rows
            pivotData.forEach((row: any) => {
                const csvRow = [
                    `"${String(row.formName).replace(/"/g, '""')}"`,
                    ...frpColumns.map((frp: any) => `"${row[frp] || 0}"`),
                    `"${row.total}"`
                ];
                csvRows.push(csvRow.join(','));
            });
            
            // Footer row
            const footerRow = [
                '"Grand Total"',
                ...frpColumns.map((frp: any) => `"${frpTotals[frp] || 0}"`),
                `"${frpTotals.total}"`
            ];
            csvRows.push(footerRow.join(','));
            filename = `ODK_FRP_Report_${new Date().toISOString().split('T')[0]}.csv`;
        } else {
            if (!filteredSubmissions || filteredSubmissions.length === 0) {
                alert('No data to export for the selected filters.');
                return;
            }

            // Get all unique keys from all submissions to use as headers
            const headersSet = new Set<string>();
            filteredSubmissions.forEach((sub: any) => {
                Object.keys(sub).forEach(key => headersSet.add(key));
            });
            const headers = Array.from(headersSet);

            // Build CSV content
            csvRows.push(headers.join(',')); // Header row

            filteredSubmissions.forEach((sub: any) => {
                const row = headers.map(header => {
                    let val = sub[header];
                    if (val === null || val === undefined) val = '';
                    // Escape quotes and wrap in quotes to handle commas in values
                    const strVal = String(val).replace(/"/g, '""');
                    return `"${strVal}"`;
                });
                csvRows.push(row.join(','));
            });
            filename = `ODK_Filtered_Data_${new Date().toISOString().split('T')[0]}.csv`;
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportAsImage = async () => {
        if (!pivotRef.current) return;
        try {
            setIsExporting(true);
            const canvas = await toCanvas(pivotRef.current, { backgroundColor: '#ffffff', pixelRatio: 2, skipFonts: false });
            canvas.toBlob((blob) => {
                if (blob) {
                    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                        .then(() => alert('Image copied to clipboard successfully!'))
                        .catch((err) => {
                            console.error('Failed to copy to clipboard:', err);
                            alert('Failed to copy image. Your browser might not support this feature or requires a secure context (HTTPS).');
                        });
                }
            });
        } catch (err) {
            console.error('Error exporting image:', err);
        } finally {
            setIsExporting(false);
        }
    };

    const exportAsPDF = async () => {
        if (!pivotRef.current) return;
        try {
            setIsExporting(true);
            const canvas = await toCanvas(pivotRef.current, { backgroundColor: '#ffffff', pixelRatio: 2, skipFonts: false });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF('l', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`FRP_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) {
            console.error('Error exporting PDF:', err);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="lg:h-[calc(100vh-160px)] flex flex-col gap-3 lg:overflow-hidden">
            {/* Tabs Row */}
            <div className="flex flex-row justify-between items-center shrink-0">
                <div className="flex flex-row gap-2">
                    <button 
                        onClick={() => setActiveTab('dashboard')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        Main Dashboard
                    </button>
                    <button 
                        onClick={() => setActiveTab('frp-report')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'frp-report' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}
                    >
                        <Table className="w-4 h-4" />
                        FRP Report
                    </button>
                </div>
                <button 
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                >
                    <Download className="w-4 h-4" />
                    Export Filtered Data
                </button>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col lg:flex-row gap-3 shrink-0 lg:h-16">
                <div className="flex-1 bg-white px-4 py-3 lg:py-2 rounded-xl shadow-sm border border-gray-100 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-center">
                    <div className="w-full">
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Form</label>
                        <select
                            value={selectedForm}
                            onChange={(e) => setSelectedForm(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 lg:p-1.5"
                        >
                            <option value="All">All Forms</option>
                            {data.forms.map((f: any) => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full">
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Month</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => { setSelectedMonth(e.target.value); setSelectedDate('All'); }}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 lg:p-1.5"
                        >
                            <option value="All">All Months</option>
                            <option value="01">January</option>
                            <option value="02">February</option>
                            <option value="03">March</option>
                            <option value="04">April</option>
                            <option value="05">May</option>
                            <option value="06">June</option>
                            <option value="07">July</option>
                            <option value="08">August</option>
                            <option value="09">September</option>
                            <option value="10">October</option>
                            <option value="11">November</option>
                            <option value="12">December</option>
                        </select>
                    </div>
                    <div className="w-full">
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Year</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => { setSelectedYear(e.target.value); setSelectedDate('All'); }}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 lg:p-1.5"
                        >
                            <option value="All">All Years</option>
                            {Array.from(new Set(data.rawSubmissions.map((s: any) => new Date(s.date).getFullYear().toString()))).sort((a: any, b: any) => b.localeCompare(a)).map((year: any) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full">
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Date</label>
                        <input
                            type="date"
                            value={selectedDate === 'All' ? '' : selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value || 'All')}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 lg:p-[5px]"
                        />
                    </div>
                    <div className="w-full">
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Project</label>
                        <select
                            value={selectedProject}
                            onChange={(e) => setSelectedProject(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 lg:p-1.5"
                        >
                            <option value="All">All Projects</option>
                            <option value="HDFC">HDFC</option>
                            <option value="Internal">Internal</option>
                        </select>
                    </div>
                    <div className="w-full">
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">User</label>
                        <select
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 lg:p-1.5"
                        >
                            <option value="All">All Users</option>
                            {data.users.map((u: any) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white p-3 lg:px-4 lg:py-2 rounded-xl shadow-sm border border-gray-100 flex flex-col lg:flex-row items-center lg:justify-start justify-center gap-2 lg:gap-3 lg:w-40">
                        <div className="w-8 h-8 shrink-0 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        </div>
                        <div className="min-w-0 text-center lg:text-left">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 truncate">Forms</p>
                            <p className="text-lg font-black text-gray-800 leading-none">{aggregatedForms.length}</p>
                        </div>
                    </div>
                    <div className="bg-white p-3 lg:px-4 lg:py-2 rounded-xl shadow-sm border border-gray-100 flex flex-col lg:flex-row items-center lg:justify-start justify-center gap-2 lg:gap-3 lg:w-40">
                        <div className="w-8 h-8 shrink-0 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        </div>
                        <div className="min-w-0 text-center lg:text-left">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 truncate">Total</p>
                            <p className="text-lg font-black text-gray-800 leading-none">{totalSubmissions}</p>
                        </div>
                    </div>
                    <div className="bg-white p-3 lg:px-4 lg:py-2 rounded-xl shadow-sm border border-gray-100 flex flex-col lg:flex-row items-center lg:justify-start justify-center gap-2 lg:gap-3 lg:w-40">
                        <div className="w-8 h-8 shrink-0 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                        </div>
                        <div className="min-w-0 text-center lg:text-left">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 truncate">Users</p>
                            <p className="text-lg font-black text-gray-800 leading-none">{topUsers.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'dashboard' ? (
                <div className="flex-1 lg:min-h-0 flex flex-col lg:flex-row gap-3 overflow-y-auto lg:overflow-hidden pb-16 lg:pb-0">
                    {/* Left Column: Charts */}
                    <div className="flex-1 flex flex-col gap-3 min-w-0 lg:min-h-0 h-auto">
                        <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[300px] lg:min-h-0">
                            <h3 className="text-xs font-black uppercase tracking-widest text-gray-800 mb-2 shrink-0">Timeline</h3>
                            <div className="w-full h-[250px] lg:flex-1 lg:h-auto lg:min-h-0">
                                {filteredTimeline.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={filteredTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                            <XAxis 
                                                dataKey="date" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fontSize: 10, fill: "#6B7280" }} 
                                                tickFormatter={(val) => {
                                                    const d = new Date(val);
                                                    return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
                                                }}
                                            />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#6B7280" }} />
                                            <RechartsTooltip 
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
                                                formatter={(value: any) => [`${value}`, 'Submissions']}
                                                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                            />
                                            <Line type="monotone" dataKey="count" stroke="#6366F1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No data</div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[300px] lg:min-h-0">
                            <h3 className="text-xs font-black uppercase tracking-widest text-gray-800 mb-2 shrink-0">Top Users</h3>
                            <div className="w-full h-[250px] lg:flex-1 lg:h-auto lg:min-h-0">
                                {top10Users.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={top10Users} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#6B7280" }} />
                                            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#374151", fontWeight: 'bold' }} width={80} />
                                            <RechartsTooltip 
                                                cursor={{ fill: "#F3F4F6" }} 
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                            />
                                            <Bar dataKey="total" fill="#10B981" radius={[0, 4, 4, 0]} barSize={12}>
                                                <LabelList dataKey="total" position="right" fill="#6B7280" fontSize={9} fontWeight="bold" />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No data</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Forms Table */}
                    <div className="lg:w-1/3 w-full flex flex-col min-h-[400px] lg:min-h-0">
                        <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                            <h3 className="text-xs font-black uppercase tracking-widest text-gray-800 mb-3 shrink-0">Form Wise Submission</h3>
                            <div className="flex-1 overflow-auto pr-2 custom-scrollbar lg:h-auto h-[400px]">
                                {aggregatedForms.length > 0 ? (
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-white z-10 shadow-[0_2px_0_0_#f3f4f6]">
                                            <tr>
                                                <th className="pb-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">Form</th>
                                                <th className="pb-2 text-[10px] font-black text-gray-400 uppercase tracking-wider text-center w-16">Subs</th>
                                                <th className="pb-2 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right w-20">Latest</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {aggregatedForms.map((form: any) => (
                                                <tr key={form.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                                    <td className="py-2 pr-2">
                                                        <div className="font-bold text-gray-800 text-xs truncate max-w-[200px]" title={form.name}>{form.name}</div>
                                                    </td>
                                                    <td className="py-2 px-2 text-center">
                                                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded-md">
                                                            {form.total}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 pl-2 text-right">
                                                        <span className="text-[10px] text-gray-500 font-mono">
                                                            {form.latest ? new Date(form.latest).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="py-8 text-center text-gray-400 text-sm">No forms</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* FRP Report Tab */
                <div className="flex-1 flex flex-col bg-white p-4 rounded-xl shadow-sm border border-gray-100 min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-4 shrink-0">
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-800">FRP Wise Report Pivot</h3>
                        <div className="flex gap-2">
                            <button 
                                onClick={exportAsImage}
                                disabled={isExporting}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                            >
                                <ImageIcon className="w-3.5 h-3.5" />
                                {isExporting ? 'Exporting...' : 'Copy Image'}
                            </button>
                            <button 
                                onClick={exportAsPDF}
                                disabled={isExporting}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                            >
                                <Download className="w-3.5 h-3.5" />
                                {isExporting ? 'Exporting...' : 'PDF'}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto custom-scrollbar relative" ref={pivotRef}>
                        {pivotData.length > 0 ? (
                            <table className="w-full text-left border-collapse whitespace-nowrap bg-white border border-gray-300">
                                <thead className="sticky top-0 z-20 shadow-[0_2px_0_0_#d1d5db]">
                                    <tr>
                                        <th className="py-2 px-3 text-[10px] font-black text-black uppercase tracking-wider bg-gray-100 sticky left-0 z-30 border-r border-b border-gray-300 min-w-[200px]">Form Name</th>
                                        {frpColumns.map((frp: any) => (
                                            <th key={frp} className="py-2 px-3 text-[10px] font-black text-black uppercase tracking-wider text-center border-r border-b border-gray-300 bg-gray-100 max-w-[120px] truncate" title={frp}>
                                                {frp}
                                            </th>
                                        ))}
                                        <th className="py-2 px-3 text-[10px] font-black text-black uppercase tracking-wider text-center border-b border-gray-300 bg-gray-200 sticky right-0 z-20 shadow-[-2px_0_0_0_#d1d5db]">Grand Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pivotData.map((row: any, i: number) => (
                                        <tr key={i} className="hover:bg-gray-50 transition-colors bg-white">
                                            <td className="py-2 px-3 font-bold text-black text-xs bg-white sticky left-0 z-10 border-r border-b border-gray-300 truncate max-w-[200px]" title={row.formName}>
                                                {row.formName}
                                            </td>
                                            {frpColumns.map((frp: any) => (
                                                <td key={frp} className="py-2 px-3 text-center border-r border-b border-gray-300">
                                                    {row[frp] > 0 ? (
                                                        <span className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 text-[10px] font-black bg-gray-100 text-black border border-gray-300 rounded-md">
                                                            {row[frp]}
                                                        </span>
                                                    ) : (
                                                        <span className="text-black font-black text-[10px]">0</span>
                                                    )}
                                                </td>
                                            ))}
                                            <td className="py-2 px-3 text-center border-b border-gray-300 bg-gray-50/80 sticky right-0 z-10 shadow-[-2px_0_0_0_#f3f4f6]">
                                                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-black bg-gray-200 text-black border border-gray-400 rounded-md">
                                                    {row.total}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="sticky bottom-0 z-20 shadow-[0_-2px_0_0_#d1d5db]">
                                    <tr>
                                        <td className="py-2 px-3 font-black text-black text-xs bg-gray-100 sticky left-0 z-30 border-r border-t border-gray-300">
                                            Grand Total
                                        </td>
                                        {frpColumns.map((frp: any) => (
                                            <td key={frp} className="py-2 px-3 text-center font-black text-black text-[10px] bg-gray-100 border-r border-t border-gray-300">
                                                {frpTotals[frp]}
                                            </td>
                                        ))}
                                        <td className="py-2 px-3 text-center font-black text-black text-[10px] bg-gray-200 border-t border-gray-300 sticky right-0 z-20 shadow-[-2px_0_0_0_#d1d5db]">
                                            {frpTotals.total}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        ) : (
                            <div className="py-16 text-center text-gray-400 text-sm">No submissions found for the selected filters.</div>
                        )}
                    </div>
                </div>
            )}
            
            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #94a3b8; }
            `}} />
        </div>
    );
};
export default ODKDashboardSection;
