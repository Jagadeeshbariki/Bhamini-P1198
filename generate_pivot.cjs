const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

// 1. Update Date select to input type="date"
const dateSelectOld = `<select
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 lg:p-1.5"
                        >
                            <option value="All">All Dates</option>
                            {Array.from(new Set(data.rawSubmissions.map((s: any) => s.date.split('T')[0]))).sort((a: any, b: any) => b.localeCompare(a)).map((d: any) => (
                                <option key={d} value={d}>{new Date(d).toLocaleDateString()}</option>
                            ))}
                        </select>`;

const dateSelectNew = `<input
                            type="date"
                            value={selectedDate === 'All' ? '' : selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value || 'All')}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 lg:p-[5px]"
                        />`;
content = content.replace(dateSelectOld, dateSelectNew);


// 2. Add Pivot Logic to useMemo
const pivotLogicOld = `        const aggregatedFormsArr = Array.from(formStats.values()).sort((a, b) => b.total - a.total);
        const topUsersArr = Array.from(userStats.values()).sort((a, b) => b.total - a.total);
        const timelineArr = Array.from(timelineStats.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));

        return {
            filteredForms: forms,
            filteredUsers: users,
            filteredTimeline: timelineArr,
            aggregatedForms: aggregatedFormsArr,
            topUsers: topUsersArr
        };
    }, [data, selectedForm, selectedUser, selectedMonth, selectedYear, selectedDate]);`;

const pivotLogicNew = `        const aggregatedFormsArr = Array.from(formStats.values()).sort((a, b) => b.total - a.total);
        const topUsersArr = Array.from(userStats.values()).sort((a, b) => b.total - a.total);
        const timelineArr = Array.from(timelineStats.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));

        // Pivot Generation
        const pivotMap = new Map(); // Form Name -> Map of FRP Name -> Count
        const frpNamesSet = new Set();
        
        filtered.forEach((sub: any) => {
            const formName = formsMap.get(sub.formId) || sub.formId;
            const frpName = usersMap.get(sub.userId) || \`User \${sub.userId}\`;
            
            frpNamesSet.add(frpName);
            
            if (!pivotMap.has(formName)) {
                pivotMap.set(formName, new Map());
            }
            const fMap = pivotMap.get(formName);
            fMap.set(frpName, (fMap.get(frpName) || 0) + 1);
        });

        const frpColumns = Array.from(frpNamesSet).sort((a: any, b: any) => a.localeCompare(b));
        
        const pivotData = Array.from(pivotMap.keys()).sort().map(formName => {
            const row: any = { formName };
            const fMap = pivotMap.get(formName);
            let total = 0;
            frpColumns.forEach((frp: any) => {
                const count = fMap.get(frp) || 0;
                row[frp] = count;
                total += count;
            });
            row.total = total;
            return row;
        }).sort((a, b) => b.total - a.total);

        return {
            filteredForms: forms,
            filteredUsers: users,
            filteredTimeline: timelineArr,
            aggregatedForms: aggregatedFormsArr,
            topUsers: topUsersArr,
            pivotData,
            frpColumns
        };
    }, [data, selectedForm, selectedUser, selectedMonth, selectedYear, selectedDate]);`;

content = content.replace(pivotLogicOld, pivotLogicNew);
content = content.replace(
    'const { filteredForms, filteredUsers, filteredTimeline, aggregatedForms, topUsers } = useMemo(() => {',
    'const { filteredForms, filteredUsers, filteredTimeline, aggregatedForms, topUsers, pivotData, frpColumns } = useMemo(() => {'
);
content = content.replace(
    'if (!data) return { filteredForms: [], filteredUsers: [], filteredTimeline: [], aggregatedForms: [], topUsers: [] };',
    'if (!data) return { filteredForms: [], filteredUsers: [], filteredTimeline: [], aggregatedForms: [], topUsers: [], pivotData: [], frpColumns: [] };'
);

// 3. Update the table to the Pivot Table
const frpTableOld = `<div className="flex-1 overflow-auto pr-2 custom-scrollbar lg:h-auto h-[250px]">
                            {topUsers.length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-white z-10 shadow-[0_2px_0_0_#f3f4f6]">
                                        <tr>
                                            <th className="pb-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">FRP Name</th>
                                            <th className="pb-2 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right w-20">Subs</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topUsers.map((user: any) => (
                                            <tr key={user.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                                <td className="py-2 pr-2">
                                                    <div className="font-bold text-gray-800 text-xs truncate max-w-[200px]" title={user.name}>{user.name}</div>
                                                </td>
                                                <td className="py-2 pl-2 text-right">
                                                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-md">
                                                        {user.total}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="py-8 text-center text-gray-400 text-sm">No users</div>
                            )}
                        </div>`;

const frpTableNew = `<div className="flex-1 overflow-auto custom-scrollbar lg:h-auto h-[250px] relative">
                            {pivotData.length > 0 ? (
                                <table className="w-full text-left border-collapse whitespace-nowrap">
                                    <thead className="sticky top-0 bg-white z-20 shadow-[0_2px_0_0_#f3f4f6]">
                                        <tr>
                                            <th className="py-2 px-3 text-[10px] font-black text-gray-400 uppercase tracking-wider bg-white sticky left-0 z-30 shadow-[2px_0_0_0_#f3f4f6] min-w-[150px]">Form Name</th>
                                            <th className="py-2 px-3 text-[10px] font-black text-gray-400 uppercase tracking-wider text-center border-l border-gray-100 bg-gray-50/50">Total</th>
                                            {frpColumns.map((frp: any) => (
                                                <th key={frp} className="py-2 px-3 text-[10px] font-black text-gray-400 uppercase tracking-wider text-center border-l border-gray-100 max-w-[120px] truncate" title={frp}>
                                                    {frp}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {pivotData.map((row: any, i: number) => (
                                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                <td className="py-2 px-3 font-bold text-gray-800 text-xs bg-white sticky left-0 z-10 shadow-[2px_0_0_0_#f3f4f6] truncate max-w-[150px]" title={row.formName}>
                                                    {row.formName}
                                                </td>
                                                <td className="py-2 px-3 text-center border-l border-gray-100 bg-gray-50/50">
                                                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded-md">
                                                        {row.total}
                                                    </span>
                                                </td>
                                                {frpColumns.map((frp: any) => (
                                                    <td key={frp} className="py-2 px-3 text-center border-l border-gray-100">
                                                        {row[frp] > 0 ? (
                                                            <span className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-md">
                                                                {row[frp]}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-300 text-xs">-</span>
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="py-8 text-center text-gray-400 text-sm">No submissions</div>
                            )}
                        </div>`;

content = content.replace(frpTableOld, frpTableNew);

fs.writeFileSync('components/ODKDashboardSection.tsx', content);
console.log('done');
