const fs = require('fs');
let code = fs.readFileSync('components/ExecutiveDashboard.tsx', 'utf8');

const trendChart = `
            {/* 3.5 TREND ANALYSIS */}
            <div className="grid grid-cols-1 gap-4">
                <ChartCard title="Monthly Registration Trend" icon={<Calendar />} height={250}>
                    <ResponsiveContainer width="100%" height="100%">
                        {dashboardData.timeSeriesData.length > 0 ? (
                            <AreaChart data={dashboardData.timeSeriesData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                <Area type="monotone" dataKey="value" name="Registrations" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorValue)" />
                            </AreaChart>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                Insufficient Date Data
                            </div>
                        )}
                    </ResponsiveContainer>
                </ChartCard>
            </div>
`;

code = code.replace(
    /\{\/\* 3\. DEMOGRAPHICS & MATERIAL DIST \*\/\}/,
    trendChart + "\n            {/* 3.6 DEMOGRAPHICS & MATERIAL DIST */}"
);

fs.writeFileSync('components/ExecutiveDashboard.tsx', code);
