const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

const oldTable = `                            <table className="w-full text-left border-collapse whitespace-nowrap bg-white border border-gray-300">
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
                                                        <span className="text-gray-400 font-bold text-[10px]">0</span>
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

const newTable = `                            <table className="w-full text-left border-collapse whitespace-nowrap bg-white border border-gray-300">
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
                            </table>`;

if (content.includes(oldTable)) {
    content = content.replace(oldTable, newTable);
    fs.writeFileSync('components/ODKDashboardSection.tsx', content);
    console.log("Replaced table successfully.");
} else {
    console.log("Could not find the exact old table block.");
}
