const fs = require('fs');
let path = 'components/ODKDashboardSection.tsx';
let content = fs.readFileSync(path, 'utf8');

const returnStart = content.indexOf('return (');
const returnEnd = content.lastIndexOf(');') + 2;

const newJSX = `    return (
        <div className="h-[calc(100vh-160px)] flex flex-col gap-3 overflow-hidden">
            {/* Filters & Top Cards Row */}
            <div className="flex gap-3 shrink-0 h-16">
                <div className="flex-1 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 grid grid-cols-4 gap-3 items-center">
                    <div className="w-full">
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Form</label>
                        <select
                            value={selectedForm}
                            onChange={(e) => setSelectedForm(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-1.5"
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
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-1.5"
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
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-1.5"
                        >
                            <option value="All">All Years</option>
                            {Array.from(new Set(data.rawSubmissions.map((s: any) => new Date(s.date).getFullYear().toString()))).sort((a: any, b: any) => b.localeCompare(a)).map((year: any) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full">
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">User</label>
                        <select
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-1.5"
                        >
                            <option value="All">All Users</option>
                            {data.users.map((u: any) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 w-40">
                        <div className="w-8 h-8 shrink-0 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 truncate">Forms</p>
                            <p className="text-lg font-black text-gray-800 leading-none">{aggregatedForms.length}</p>
                        </div>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 w-40">
                        <div className="w-8 h-8 shrink-0 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 truncate">Total</p>
                            <p className="text-lg font-black text-gray-800 leading-none">{totalSubmissions}</p>
                        </div>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 w-40">
                        <div className="w-8 h-8 shrink-0 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 truncate">Users</p>
                            <p className="text-lg font-black text-gray-800 leading-none">{topUsers.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Area: Charts & Table */}
            <div className="flex-1 min-h-0 flex gap-3">
                {/* Left Column: Charts */}
                <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">
                    <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-0">
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-800 mb-2 shrink-0">Timeline</h3>
                        <div className="flex-1 w-full min-h-0">
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
                                                return \`\${d.getDate()} \${d.toLocaleString('default', { month: 'short' })}\`;
                                            }}
                                        />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#6B7280" }} />
                                        <RechartsTooltip 
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
                                            formatter={(value: any) => [\`\${value}\`, 'Submissions']}
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

                    <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-0">
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-800 mb-2 shrink-0">Top Users</h3>
                        <div className="flex-1 w-full min-h-0">
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

                {/* Right Column: Table */}
                <div className="w-1/3 min-w-[300px] bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-0">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-800 mb-3 shrink-0">Forms</h3>
                    <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
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
                                                <div className="font-bold text-gray-800 text-xs truncate max-w-[150px]" title={form.name}>{form.name}</div>
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
            
            <style dangerouslySetInnerHTML={{__html: \`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 4px; }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #D1D5DB; }
            \`}} />
        </div>
    );`;

content = content.slice(0, returnStart) + newJSX + '\n};\nexport default ODKDashboardSection;\n';

fs.writeFileSync(path, content);
console.log("Updated layout.");
