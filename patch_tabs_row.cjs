const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

const tabsRow = `            {/* Tabs Row */}
            <div className="flex flex-row gap-2 shrink-0">
                <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={\`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors \${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}\`}
                >
                    <LayoutDashboard className="w-4 h-4" />
                    Main Dashboard
                </button>
                <button 
                    onClick={() => setActiveTab('frp-report')}
                    className={\`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors \${activeTab === 'frp-report' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}\`}
                >
                    <Table className="w-4 h-4" />
                    FRP Report
                </button>
            </div>`;

const newTabsRow = `            {/* Tabs Row */}
            <div className="flex flex-row justify-between items-center shrink-0">
                <div className="flex flex-row gap-2">
                    <button 
                        onClick={() => setActiveTab('dashboard')}
                        className={\`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors \${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}\`}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        Main Dashboard
                    </button>
                    <button 
                        onClick={() => setActiveTab('frp-report')}
                        className={\`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors \${activeTab === 'frp-report' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}\`}
                    >
                        <Table className="w-4 h-4" />
                        FRP Report
                    </button>
                </div>
                <button 
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                >
                    <Download className="w-4 h-4" />
                    Export Filtered Data
                </button>
            </div>`;

content = content.replace(tabsRow, newTabsRow);
fs.writeFileSync('components/ODKDashboardSection.tsx', content);
