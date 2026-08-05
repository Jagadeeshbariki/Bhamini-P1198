import React, { useState, useEffect, useMemo } from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Bar, LabelList, LineChart, Line } from 'recharts';

export const ODKDashboardSection: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedForm, setSelectedForm] = useState<string>('All');
    const [selectedUser, setSelectedUser] = useState<string>('All');
    const [selectedMonth, setSelectedMonth] = useState<string>('All');
    const [selectedYear, setSelectedYear] = useState<string>('All');

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

    const { filteredForms, filteredUsers, filteredTimeline, aggregatedForms, topUsers } = useMemo(() => {
        if (!data) return { filteredForms: [], filteredUsers: [], filteredTimeline: [], aggregatedForms: [], topUsers: [] };
        
        const { rawSubmissions, forms, users } = data;

        const usersMap = new Map(users.map((u: any) => [u.id, u.name]));
        const formsMap = new Map(forms.map((f: any) => [f.id, f.name]));

        // Apply filters
        const filtered = rawSubmissions.filter((sub: any) => {
            const dateObj = new Date(sub.date);
            const subMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
            const subYear = String(dateObj.getFullYear());

            const matchForm = selectedForm === 'All' || sub.formId === selectedForm;
            const matchUser = selectedUser === 'All' || String(sub.userId) === selectedUser;
            const matchMonth = selectedMonth === 'All' || subMonth === selectedMonth;
            const matchYear = selectedYear === 'All' || subYear === selectedYear;
            
            return matchForm && matchUser && matchMonth && matchYear;
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

        return {
            filteredForms: forms,
            filteredUsers: users,
            filteredTimeline: timelineArr,
            aggregatedForms: aggregatedFormsArr,
            topUsers: topUsersArr
        };
    }, [data, selectedForm, selectedUser, selectedMonth, selectedYear]);


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
                <p className="font-bold">Error loading ODK data</p>                <p className="text-sm">{error}</p>
            </div>
        );
    }

    const top10Users = topUsers.slice(0, 10);
    const totalSubmissions = aggregatedForms.reduce((acc, f) => acc + f.total, 0);

    return (
        <div className="space-y-6">
            {/* Filters */}
            {/* Dynamically get years */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div className="w-full">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Form</label>
                    <select
                        value={selectedForm}
                        onChange={(e) => setSelectedForm(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                    >
                        <option value="All">All Forms</option>
                        {data.forms.map((f: any) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                    </select>
                </div>
                
                <div className="w-full">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Month</label>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
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
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Year</label>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                    >
                        <option value="All">All Years</option>
                        {Array.from(new Set(data.rawSubmissions.map((s: any) => new Date(s.date).getFullYear().toString()))).sort((a: any, b: any) => b.localeCompare(a)).map((year: any) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
                <div className="w-full">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">User</label>
                    <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                    >
                        <option value="All">All Users</option>
                        {data.users.map((u: any) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Top Cards for Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Forms with Submissions</p>
                        <p className="text-2xl font-black text-gray-800">{aggregatedForms.length}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Total Submissions</p>
                        <p className="text-2xl font-black text-gray-800">{totalSubmissions}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Active Users</p>
                        <p className="text-2xl font-black text-gray-800">{topUsers.length}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Timeline Chart */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[350px]">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-800 mb-6">Submissions Timeline</h3>
                    <div className="flex-1 w-full h-[250px]">
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
                                        formatter={(value: any) => [`${value} Submissions`, 'Count']}
                                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                    />
                                    <Line type="monotone" dataKey="count" stroke="#6366F1" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">No data available</div>
                        )}
                    </div>
                </div>

                {/* Top Users Chart */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[350px]">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-800 mb-6">Top Submitters</h3>
                    <div className="flex-1 w-full h-[250px]">
                        {top10Users.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={top10Users} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#6B7280" }} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#374151", fontWeight: 'bold' }} width={80} />
                                    <RechartsTooltip 
                                        cursor={{ fill: "#F3F4F6" }} 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                    />
                                    <Bar dataKey="total" fill="#10B981" radius={[0, 4, 4, 0]} barSize={16}>
                                        <LabelList dataKey="total" position="right" fill="#6B7280" fontSize={10} fontWeight="bold" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">No data available</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Forms List */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-800 mb-6">ODK Forms & Submissions</h3>
                <div className="overflow-x-auto">
                    {aggregatedForms.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="pb-3 text-xs font-black text-gray-400 uppercase tracking-wider">Form Name</th>
                                    <th className="pb-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Submissions</th>
                                    <th className="pb-3 text-xs font-black text-gray-400 uppercase tracking-wider text-right">Latest Submission</th>
                                </tr>
                            </thead>
                            <tbody>
                                {aggregatedForms.map((form: any) => (
                                    <tr key={form.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                        <td className="py-3 pr-4">
                                            <div className="font-bold text-gray-800">{form.name}</div>
                                            <div className="text-xs text-gray-400 font-mono mt-0.5">{form.id}</div>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold bg-indigo-50 text-indigo-700 rounded-full">
                                                {form.total}
                                            </span>
                                        </td>
                                        <td className="py-3 pl-4 text-right">
                                            <span className="text-sm text-gray-600">
                                                {form.latest ? new Date(form.latest).toLocaleDateString() : 'Never'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="py-8 text-center text-gray-400">No forms found matching the filters.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ODKDashboardSection;
