const fs = require('fs');
let path = 'components/ODKDashboardSection.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add states for selectedMonth and selectedYear
const stateStr = `    const [selectedForm, setSelectedForm] = useState<string>('All');
    const [selectedUser, setSelectedUser] = useState<string>('All');`;

const newStates = `    const [selectedForm, setSelectedForm] = useState<string>('All');
    const [selectedUser, setSelectedUser] = useState<string>('All');
    const [selectedMonth, setSelectedMonth] = useState<string>('All');
    const [selectedYear, setSelectedYear] = useState<string>('All');`;

content = content.replace(stateStr, newStates);

// 2. Add filtering logic in useMemo
const filterLogicStr = `        const filtered = rawSubmissions.filter((sub: any) => {
            const matchForm = selectedForm === 'All' || sub.formId === selectedForm;
            const matchUser = selectedUser === 'All' || String(sub.userId) === selectedUser;
            return matchForm && matchUser;
        });`;

const newFilterLogic = `        const filtered = rawSubmissions.filter((sub: any) => {
            const dateObj = new Date(sub.date);
            const subMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
            const subYear = String(dateObj.getFullYear());

            const matchForm = selectedForm === 'All' || sub.formId === selectedForm;
            const matchUser = selectedUser === 'All' || String(sub.userId) === selectedUser;
            const matchMonth = selectedMonth === 'All' || subMonth === selectedMonth;
            const matchYear = selectedYear === 'All' || subYear === selectedYear;
            
            return matchForm && matchUser && matchMonth && matchYear;
        });`;

content = content.replace(filterLogicStr, newFilterLogic);

// 3. Update useMemo dependency array
const useMemoDepsStr = `    }, [data, selectedForm, selectedUser]);`;
const newUseMemoDeps = `    }, [data, selectedForm, selectedUser, selectedMonth, selectedYear]);`;
content = content.replace(useMemoDepsStr, newUseMemoDeps);

// 4. Extract unique years and months to populate dropdowns (we can just generate them or extract from data)
const filterUIStr = `<div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">`;
const newFilterUI = `
    const availableYears = useMemo(() => {
        if (!data) return [];
        const years = new Set(data.rawSubmissions.map((s: any) => new Date(s.date).getFullYear().toString()));
        return Array.from(years).sort((a, b) => b.localeCompare(a)); // Descending
    }, [data]);

    const availableMonths = [
        { value: '01', label: 'January' }, { value: '02', label: 'February' }, { value: '03', label: 'March' },
        { value: '04', label: 'April' }, { value: '05', label: 'May' }, { value: '06', label: 'June' },
        { value: '07', label: 'July' }, { value: '08', label: 'August' }, { value: '09', label: 'September' },
        { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' }
    ];

    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row flex-wrap gap-4 items-center">`;

// 5. Actually, let's just do a clean replace using the node.js script string replace
content = content.replace(
    `<div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">`,
    `{/* Dynamically get years */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">`
);

content = content.replace(
    `<div className="w-full md:w-1/2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Filter by Form</label>`,
    `<div className="w-full">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Form</label>`
);

content = content.replace(
    `<div className="w-full md:w-1/2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Filter by User</label>`,
    `<div className="w-full">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">User</label>`
);

// Now we need to insert the Month and Year selects inside the filter div
const selectUserClosingTag = `</select>
                </div>`;

const newFilterSelects = `</select>
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
                </div>`;

content = content.replace(selectUserClosingTag, newFilterSelects);

fs.writeFileSync(path, content);
console.log("Filters added.");
