const fs = require('fs');
let code = fs.readFileSync('components/ExecutiveDashboard.tsx', 'utf8');

const oldChart = `<ComposedChart data={stats.activityData} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} angle={-45} textAnchor="end" />
                            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Bar yAxisId="left" dataKey="targetCount" name="Target" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                            <Bar yAxisId="left" dataKey="value" name="Achievement" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </ComposedChart>`;

const newChart = `<ComposedChart data={stats.activityData.map(d => ({
                            ...d,
                            logTarget: Math.max(1, d.targetCount),
                            logValue: Math.max(1, d.value)
                        }))} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} angle={-45} textAnchor="end" />
                            <YAxis yAxisId="left" scale="log" domain={[1, 'auto']} allowDataOverflow axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(val) => val === 1 ? '0' : val.toLocaleString()} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                formatter={(value, name, props) => {
                                    if (name === 'Target') return [props.payload.targetCount.toLocaleString(), 'Target'];
                                    if (name === 'Achievement') return [props.payload.value.toLocaleString(), 'Achievement'];
                                    return [value, name];
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Bar yAxisId="left" dataKey="logTarget" name="Target" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                            <Bar yAxisId="left" dataKey="logValue" name="Achievement" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </ComposedChart>`;

code = code.replace(oldChart, newChart);
fs.writeFileSync('components/ExecutiveDashboard.tsx', code);
