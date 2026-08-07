const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

// 1. Add selectedDate state
content = content.replace(
    "const [selectedYear, setSelectedYear] = useState<string>('All');",
    "const [selectedYear, setSelectedYear] = useState<string>('All');\n    const [selectedDate, setSelectedDate] = useState<string>('All');"
);

// 2. Add selectedDate dependency to useMemo
content = content.replace(
    "[data, selectedForm, selectedUser, selectedMonth, selectedYear]",
    "[data, selectedForm, selectedUser, selectedMonth, selectedYear, selectedDate]"
);

// 3. Update the filter logic
content = content.replace(
    "            const matchYear = selectedYear === 'All' || subYear === selectedYear;",
    "            const matchYear = selectedYear === 'All' || subYear === selectedYear;\n            const subDateString = sub.date.split('T')[0];\n            const matchDate = selectedDate === 'All' || subDateString === selectedDate;"
);

content = content.replace(
    "            return matchForm && matchUser && matchMonth && matchYear;",
    "            return matchForm && matchUser && matchMonth && matchYear && matchDate;"
);

// 4. Update the Grid layout and add Date select
// Find grid-cols-2 lg:grid-cols-4
content = content.replace(
    "grid-cols-2 lg:grid-cols-4",
    "grid-cols-2 lg:grid-cols-5"
);

// We need to inject the Date dropdown. Let's place it after Year.
const yearDropdownEnd = content.indexOf('</select>\n                    </div>', content.indexOf('<label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Year</label>')) + 35;

const dateDropdown = `
                    <div className="w-full">
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Date</label>
                        <select
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 lg:p-1.5"
                        >
                            <option value="All">All Dates</option>
                            {Array.from(new Set(data.rawSubmissions.map((s: any) => s.date.split('T')[0]))).sort((a: any, b: any) => b.localeCompare(a)).map((d: any) => (
                                <option key={d} value={d}>{new Date(d).toLocaleDateString()}</option>
                            ))}
                        </select>
                    </div>`;

content = content.slice(0, yearDropdownEnd) + dateDropdown + content.slice(yearDropdownEnd);

// 5. Fix Mobile Chart Sizes
// Replace "flex-1 w-full min-h-0" with "flex-1 w-full min-h-[250px] lg:min-h-0"
content = content.replace(/className="flex-1 w-full min-h-0"/g, 'className="flex-1 w-full min-h-[250px] lg:min-h-0"');


fs.writeFileSync('components/ODKDashboardSection.tsx', content);
console.log("updated");
