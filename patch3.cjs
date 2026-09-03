const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

content = content.replace("}, [data, selectedForm, selectedUser, selectedMonth, selectedYear, selectedDate]);", "}, [data, selectedForm, selectedUser, selectedMonth, selectedYear, selectedDate, selectedProject]);");

content = content.replace('grid-cols-2 lg:grid-cols-5', 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6');

const userFilterBlock = `                    <div className="w-full">
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">User</label>
                        <select
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 lg:p-1.5"
                        >
                            <option value="All">All Users</option>
                            {data.users.map((u: any) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>`;

const newFilters = `                    <div className="w-full">
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Project</label>
                        <select
                            value={selectedProject}
                            onChange={(e) => setSelectedProject(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 lg:p-1.5"
                        >
                            <option value="All">All Projects</option>
                            <option value="HDFC">HDFC</option>
                            <option value="Internal">Internal</option>
                        </select>
                    </div>
` + userFilterBlock;

content = content.replace(userFilterBlock, newFilters);

fs.writeFileSync('components/ODKDashboardSection.tsx', content);
