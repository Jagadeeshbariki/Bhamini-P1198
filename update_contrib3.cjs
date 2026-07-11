const fs = require('fs');

let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

// 1. Add global filter at the top of the return block
content = content.replace(
  '{/* Top KPI Row */}      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">',
  `<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h2 className="text-xl font-bold">Contribution Dashboard</h2>
        <select 
           className="bg-[#1e2333] text-white border border-gray-800 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
           value={selectedFinancialYear}
           onChange={(e) => setSelectedFinancialYear(e.target.value)}
         >
           {financialYears.map(year => (
             <option key={year} value={year}>{year === "All" ? "All Financial Years" : year}</option>
           ))}
         </select>
      </div>
      {/* Top KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">`
);

// 2. Remove Target from Monthly Trend
content = content.replace(
  '<div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#F59E0B] rounded-sm"></div>Target</div>',
  ''
);

content = content.replace(
  '<Line type="monotone" dataKey="target" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4, fill: \'#1e2333\', stroke: \'#F59E0B\', strokeWidth: 2 }} activeDot={{ r: 6 }} />',
  ''
);

// 3. Update topContributors logic
const oldTopContrib = `    const topContributorsMap = new Map<string, { name: string, cluster: string, amount: number, count: number }>();
    filteredData.forEach(d => {
        if (!topContributorsMap.has(d.farmerId)) {
            topContributorsMap.set(d.farmerId, { name: d.name, cluster: d.cluster, amount: 0, count: 0 });
        }
        const entry = topContributorsMap.get(d.farmerId)!;
        entry.amount += d.amount;
        entry.count += 1;
    });
    const topContributors = Array.from(topContributorsMap.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);`;

const newTopContrib = `    const topContributorsMap = new Map<string, { name: string, cluster: string, amount: number, activities: Set<string> }>();
    filteredData.forEach(d => {
        if (!topContributorsMap.has(d.farmerId)) {
            topContributorsMap.set(d.farmerId, { name: d.name, cluster: d.cluster, amount: 0, activities: new Set() });
        }
        const entry = topContributorsMap.get(d.farmerId)!;
        entry.amount += d.amount;
        entry.activities.add(d.activity);
    });
    const topContributors = Array.from(topContributorsMap.values())
        .map(entry => ({ ...entry, activity: Array.from(entry.activities).join(", ") }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);`;

content = content.replace(oldTopContrib, newTopContrib);

// 4. Update topContributors table
content = content.replace(
  '<th className="pb-3 font-medium text-center">Collections</th>',
  '<th className="pb-3 font-medium text-center">Activity</th>'
);

content = content.replace(
  '<td className="py-3 text-center text-gray-400">{c.count}</td>',
  '<td className="py-3 text-center text-gray-400">{c.activity}</td>'
);

fs.writeFileSync('components/ContributionPage.tsx', content);
console.log('Update applied');
