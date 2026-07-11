const fs = require('fs');
let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

// 1. Add trendYear state
content = content.replace(
  'const [selectedActivity, setSelectedActivity] = useState("All");',
  'const [selectedActivity, setSelectedActivity] = useState("All");\n  const [trendYear, setTrendYear] = useState("All");'
);

// 2. Change monthlyTrend to include year and filter
const oldMonthlyTrend = `    const monthlyTrend = Array.from(monthlyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(e => {
            cumulative += e[1].val;
            return {
                month: e[1].label,
                val: cumulative,
                target: totalTarget // use the computed totalTarget
            };
        });`;

const newMonthlyTrend = `    const monthlyTrend = Array.from(monthlyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(e => {
            return {
                month: e[1].label,
                val: e[1].val,
                year: e[1].year.toString(),
                target: totalTarget
            };
        });`;
content = content.replace(oldMonthlyTrend, newMonthlyTrend);

// 3. Filter clusters & activities
content = content.replace(
  '          percent: totalAmount > 0 ? (val / totalAmount) * 100 : 0,\n        };\n      })\n      .sort((a, b) => b.percent - a.percent);',
  '          percent: totalAmount > 0 ? (val / totalAmount) * 100 : 0,\n        };\n      })\n      .filter(c => c.target > 0 || c.val > 0)\n      .slice(0, 3)\n      .sort((a, b) => b.percent - a.percent);'
);

// 4. Activity chart
content = content.replace(
  '          percent: totalAmount > 0 ? (val / totalAmount) * 100 : 0,\n        };\n      })\n      .sort((a, b) => b.percent - a.percent);',
  '          percent: totalAmount > 0 ? (val / totalAmount) * 100 : 0,\n        };\n      })\n      .filter(a => a.target > 0 || a.val > 0)\n      .sort((a, b) => b.percent - a.percent);'
);

// 5. Update Trend UI
content = content.replace(
  '<h3 className="text-xs font-black uppercase tracking-widest text-gray-300">Contribution Trend (Monthly)</h3>',
  `<h3 className="text-xs font-black uppercase tracking-widest text-gray-300">Contribution Trend (Monthly)</h3>
            <select 
              className="bg-[#2a3042] text-white border border-gray-700 rounded px-2 py-1 text-[10px] outline-none"
              value={trendYear}
              onChange={(e) => setTrendYear(e.target.value)}
            >
              <option value="All">All Years</option>
              {Array.from(new Set(stats.monthlyTrend.map(t => t.year))).sort().map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>`
);

content = content.replace(
  '<LineChart data={stats.monthlyTrend}',
  '<LineChart data={trendYear === "All" ? stats.monthlyTrend : stats.monthlyTrend.filter(t => t.year === trendYear)}'
);

fs.writeFileSync('components/ContributionPage.tsx', content);
console.log('Done');
