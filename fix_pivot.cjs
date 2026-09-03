const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

const pivotDataLogicOld = `        const pivotData = Array.from(pivotMap.keys()).sort().map(formName => {
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
        };`;

const pivotDataLogicNew = `        const frpTotals: Record<string, number> = { total: 0 };
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
            filteredUsers: users,
            filteredTimeline: timelineArr,
            aggregatedForms: aggregatedFormsArr,
            topUsers: topUsersArr,
            pivotData,
            frpColumns,
            frpTotals
        };`;

content = content.replace(pivotDataLogicOld, pivotDataLogicNew);
content = content.replace(
    'const { filteredForms, filteredUsers, filteredTimeline, aggregatedForms, topUsers, pivotData, frpColumns } = useMemo(() => {',
    'const { filteredForms, filteredUsers, filteredTimeline, aggregatedForms, topUsers, pivotData, frpColumns, frpTotals } = useMemo(() => {'
);
content = content.replace(
    'if (!data) return { filteredForms: [], filteredUsers: [], filteredTimeline: [], aggregatedForms: [], topUsers: [], pivotData: [], frpColumns: [] };',
    'if (!data) return { filteredForms: [], filteredUsers: [], filteredTimeline: [], aggregatedForms: [], topUsers: [], pivotData: [], frpColumns: [], frpTotals: {} };'
);

const pivotTableOld = `                            <table className="w-full text-left border-collapse whitespace-nowrap bg-white">
                                <thead className="sticky top-0 z-20 shadow-[0_2px_0_0_#f3f4f6]">
                                    <tr>
                                        <th className="py-2 px-3 text-[10px] font-black text-gray-500 uppercase tracking-wider bg-gray-50 sticky left-0 z-30 shadow-[2px_0_0_0_#f3f4f6] min-w-[200px]">Form Name</th>
                                        <th className="py-2 px-3 text-[10px] font-black text-gray-500 uppercase tracking-wider text-center border-l border-gray-200 bg-gray-100 sticky left-[200px] z-30 shadow-[2px_0_0_0_#f3f4f6]">Total</th>
                                        {frpColumns.map((frp: any) => (
                                            <th key={frp} className="py-2 px-3 text-[10px] font-black text-gray-500 uppercase tracking-wider text-center border-l border-gray-200 bg-gray-50 max-w-[120px] truncate" title={frp}>
                                                {frp}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {pivotData.map((row: any, i: number) => (
                                        <tr key={i} className="hover:bg-gray-50 transition-colors bg-white">
                                            <td className="py-2 px-3 font-bold text-gray-800 text-xs bg-white sticky left-0 z-10 shadow-[2px_0_0_0_#f3f4f6] truncate max-w-[200px]" title={row.formName}>
                                                {row.formName}
                                            </td>
                                            <td className="py-2 px-3 text-center border-l border-gray-100 bg-gray-50/50 sticky left-[200px] z-10 shadow-[2px_0_0_0_#f3f4f6]">
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
                            </table>`;

const pivotTableNew = `                            <table className="w-full text-left border-collapse whitespace-nowrap bg-white border border-gray-300">
                                <thead className="sticky top-0 z-20 shadow-[0_2px_0_0_#d1d5db]">
                                    <tr>
                                        <th className="py-2 px-3 text-[10px] font-black text-gray-600 uppercase tracking-wider bg-gray-100 sticky left-0 z-30 border-r border-b border-gray-300 min-w-[200px]">Form Name</th>
                                        {frpColumns.map((frp: any) => (
                                            <th key={frp} className="py-2 px-3 text-[10px] font-black text-gray-600 uppercase tracking-wider text-center border-r border-b border-gray-300 bg-gray-100 max-w-[120px] truncate" title={frp}>
                                                {frp}
                                            </th>
                                        ))}
                                        <th className="py-2 px-3 text-[10px] font-black text-gray-700 uppercase tracking-wider text-center border-b border-gray-300 bg-gray-200 sticky right-0 z-20 shadow-[-2px_0_0_0_#d1d5db]">Grand Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pivotData.map((row: any, i: number) => (
                                        <tr key={i} className="hover:bg-gray-50 transition-colors bg-white">
                                            <td className="py-2 px-3 font-bold text-gray-800 text-xs bg-white sticky left-0 z-10 border-r border-b border-gray-300 truncate max-w-[200px]" title={row.formName}>
                                                {row.formName}
                                            </td>
                                            {frpColumns.map((frp: any) => (
                                                <td key={frp} className="py-2 px-3 text-center border-r border-b border-gray-300">
                                                    {row[frp] > 0 ? (
                                                        <span className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-md">
                                                            {row[frp]}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">-</span>
                                                    )}
                                                </td>
                                            ))}
                                            <td className="py-2 px-3 text-center border-b border-gray-300 bg-gray-50/80 sticky right-0 z-10 shadow-[-2px_0_0_0_#f3f4f6]">
                                                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded-md">
                                                    {row.total}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="sticky bottom-0 z-20 shadow-[0_-2px_0_0_#d1d5db]">
                                    <tr>
                                        <td className="py-2 px-3 font-black text-gray-900 text-xs bg-gray-100 sticky left-0 z-30 border-r border-t border-gray-300">
                                            Grand Total
                                        </td>
                                        {frpColumns.map((frp: any) => (
                                            <td key={frp} className="py-2 px-3 text-center font-bold text-gray-800 text-[10px] bg-gray-100 border-r border-t border-gray-300">
                                                {frpTotals[frp]}
                                            </td>
                                        ))}
                                        <td className="py-2 px-3 text-center font-black text-gray-900 text-[10px] bg-gray-200 border-t border-gray-300 sticky right-0 z-20 shadow-[-2px_0_0_0_#d1d5db]">
                                            {frpTotals.total}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>`;

content = content.replace(pivotTableOld, pivotTableNew);

fs.writeFileSync('components/ODKDashboardSection.tsx', content);
console.log('done');
