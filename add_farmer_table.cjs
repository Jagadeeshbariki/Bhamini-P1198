const fs = require('fs');

let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

// Add `useState` if it doesn't have `currentPage`
if (!content.includes('const [currentPage, setCurrentPage] = useState(1);')) {
    content = content.replace(
        '  const [searchQuery, setSearchQuery] = useState("");',
        '  const [searchQuery, setSearchQuery] = useState("");\n  const [currentPage, setCurrentPage] = useState(1);'
    );
}

// Add the table code before the last closing `</div>` in the return statement
const tableCode = `
      {/* Filters & Farmer Details Table */}
      <div className="bg-[#1e2333] p-5 rounded-2xl shadow-lg border border-gray-800 flex flex-col gap-4 mt-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-300">Farmer Details</h3>
            
            <div className="flex flex-wrap items-center gap-3">
             <select
               className="bg-[#0f111a] text-white border border-gray-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
               value={selectedCluster}
               onChange={(e) => {
                 setSelectedCluster(e.target.value);
                 setSelectedGP("All");
                 setSelectedVillage("All");
                 setCurrentPage(1);
               }}
             >
               {clusters.map((c) => (
                 <option key={c} value={c}>
                   {c === "All" ? "All Clusters" : c}
                 </option>
               ))}
             </select>

             <select
               className="bg-[#0f111a] text-white border border-gray-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
               value={selectedGP}
               onChange={(e) => {
                 setSelectedGP(e.target.value);
                 setSelectedVillage("All");
                 setCurrentPage(1);
               }}
               disabled={selectedCluster === "All"}
             >
               {gps.map((g) => (
                 <option key={g} value={g}>
                   {g === "All" ? "All GPs" : g}
                 </option>
               ))}
             </select>

             <select
               className="bg-[#0f111a] text-white border border-gray-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
               value={selectedVillage}
               onChange={(e) => { setSelectedVillage(e.target.value); setCurrentPage(1); }}
               disabled={selectedGP === "All"}
             >
               {villages.map((v) => (
                 <option key={v} value={v}>
                   {v === "All" ? "All Villages" : v}
                 </option>
               ))}
             </select>
             
             <select
               className="bg-[#0f111a] text-white border border-gray-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
               value={selectedActivity}
               onChange={(e) => { setSelectedActivity(e.target.value); setCurrentPage(1); }}
             >
               {activityOptions.map((a) => (
                 <option key={a} value={a}>
                   {a === "All" ? "All Activities" : a}
                 </option>
               ))}
             </select>

             <input
               type="text"
               placeholder="Search farmers..."
               className="bg-[#0f111a] text-white border border-gray-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500 min-w-[150px]"
               value={searchQuery}
               onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
             />
            </div>
        </div>

        <div className="flex-1 overflow-x-auto mt-2">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="text-gray-400 border-b border-gray-800 bg-[#2a3042]/50">
              <tr>
                <th className="p-3 font-medium rounded-tl-lg">Farmer ID</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Cluster</th>
                <th className="p-3 font-medium">GP</th>
                <th className="p-3 font-medium">Village</th>
                <th className="p-3 font-medium">Activity</th>
                <th className="p-3 font-medium text-right">Target</th>
                <th className="p-3 font-medium text-right">Achievement</th>
                <th className="p-3 font-medium text-right rounded-tr-lg">% Achieved</th>
              </tr>
            </thead>
            <tbody className="text-gray-200">
              {(() => {
                const map = new Map();
                filteredData.forEach(d => {
                    const key = \`\${d.farmerId}-\${d.activity}\`;
                    if (!map.has(key)) {
                        map.set(key, {
                            farmerId: d.farmerId,
                            name: d.name,
                            cluster: d.cluster,
                            gp: d.gp,
                            village: d.village,
                            activity: d.activity,
                            amount: 0,
                            target: d.individualTarget || 0,
                        });
                    }
                    const entry = map.get(key);
                    entry.amount += d.amount;
                });
                
                const grouped = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
                const start = (currentPage - 1) * 10;
                const paginated = grouped.slice(start, start + 10);
                const totalPages = Math.ceil(grouped.length / 10);
                
                return (
                  <>
                    {paginated.map((r, i) => (
                      <tr key={i} className="border-b border-gray-800/50 last:border-0 hover:bg-white/5 transition-colors">
                        <td className="p-3 font-mono text-[10px] text-gray-400">{r.farmerId}</td>
                        <td className="p-3 font-medium">{r.name}</td>
                        <td className="p-3 text-gray-400">{r.cluster}</td>
                        <td className="p-3 text-gray-400">{r.gp}</td>
                        <td className="p-3 text-gray-400">{r.village}</td>
                        <td className="p-3">
                          <span className="bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded text-[10px] font-bold">
                            {r.activity}
                          </span>
                        </td>
                        <td className="p-3 text-right text-gray-400">₹{r.target.toLocaleString()}</td>
                        <td className="p-3 text-right font-bold text-[#10B981]">₹{r.amount.toLocaleString()}</td>
                        <td className="p-3 text-right">
                          {r.target > 0 ? (
                            <span className={r.amount >= r.target ? "text-[#10B981]" : "text-[#F59E0B]"}>
                              {((r.amount / r.target) * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-500">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {grouped.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-gray-500">
                          No records found matching the current filters.
                        </td>
                      </tr>
                    )}
                    {grouped.length > 0 && (
                      <tr className="bg-transparent">
                        <td colSpan={9} className="p-3 text-center">
                          <div className="flex justify-between items-center text-xs text-gray-400">
                            <span>Showing {start + 1} to {Math.min(start + 10, grouped.length)} of {grouped.length} entries</span>
                            <div className="flex gap-2">
                              <button 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="px-3 py-1 bg-[#2a3042] rounded disabled:opacity-50 hover:bg-[#374151] transition-colors"
                              >
                                Prev
                              </button>
                              <button 
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                className="px-3 py-1 bg-[#2a3042] rounded disabled:opacity-50 hover:bg-[#374151] transition-colors"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
`;

content = content.replace('{/* Existing List below the dashboard - maybe omit or keep hidden for now, or just leave it */}', tableCode);

// Fix FY filter style
const oldFYFilter = `        <select 
           className="bg-[#1e2333] text-white border border-gray-800 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
           value={selectedFinancialYear}
           onChange={(e) => setSelectedFinancialYear(e.target.value)}
         >
           {financialYears.map(year => (
             <option key={year} value={year}>{year === "All" ? "All Financial Years" : year}</option>
           ))}
         </select>`;

const newFYFilter = `        <div className="flex bg-[#1e2333] border border-gray-800 rounded-lg p-1">
           {financialYears.map(year => (
             <button
               key={year}
               onClick={() => setSelectedFinancialYear(year)}
               className={\`px-4 py-1.5 text-xs font-bold rounded-md transition-colors \${selectedFinancialYear === year ? 'bg-[#10B981] text-white shadow' : 'text-gray-400 hover:text-gray-200'}\`}
             >
               {year === "All" ? "All FY" : year}
             </button>
           ))}
        </div>`;

content = content.replace(oldFYFilter, newFYFilter);

fs.writeFileSync('components/ContributionPage.tsx', content);
console.log('Added table and updated FY filter');
