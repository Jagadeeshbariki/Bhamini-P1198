const fs = require('fs');
let code = fs.readFileSync('components/ExecutiveDashboard.tsx', 'utf8');

const oldClusterChart = `<BarChart data={stats.clusterData} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} angle={-45} textAnchor="end" />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={formatNumber} tick={{ fontSize: 10, fill: '#6b7280' }} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Bar dataKey="target" name="Target" fill="#fef3c7" stroke="#f59e0b" strokeWidth={1} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="collected" name="Registered" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>`;

const newClusterChart = `<BarChart data={stats.clusterData.map(d => ({
                            ...d,
                            logTarget: Math.max(1, d.target),
                            logValue: Math.max(1, d.collected)
                        }))} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} angle={-45} textAnchor="end" />
                            <YAxis scale="log" domain={[1, 'auto']} allowDataOverflow axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(val) => val === 1 ? '0' : val.toLocaleString()} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                formatter={(value, name, props) => {
                                    if (name === 'Target') return [props.payload.target.toLocaleString(), 'Target'];
                                    if (name === 'Registered') return [props.payload.collected.toLocaleString(), 'Registered'];
                                    return [value, name];
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Bar dataKey="logTarget" name="Target" fill="#fef3c7" stroke="#f59e0b" strokeWidth={1} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="logValue" name="Registered" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>`;

code = code.replace(oldClusterChart, newClusterChart);
fs.writeFileSync('components/ExecutiveDashboard.tsx', code);
