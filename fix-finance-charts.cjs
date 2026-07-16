const fs = require('fs');
let code = fs.readFileSync('components/ExecutiveDashboard.tsx', 'utf8');

const clusterFinanceOld = `<ComposedChart data={stats.clusterData} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} angle={-45} textAnchor="end" />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={formatNumber} tick={{ fontSize: 10, fill: '#6b7280' }} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Area type="monotone" dataKey="target" name="Target Amount (₹)" fill="#e0e7ff" stroke="#6366f1" />
                            <Bar dataKey="collected" name="Collected Amount (₹)" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                        </ComposedChart>`;

const clusterFinanceNew = `<ComposedChart data={stats.clusterData.map(d => ({
                            ...d,
                            logTargetMoney: Math.max(1, d.target),
                            logCollectedMoney: Math.max(1, d.collected)
                        }))} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} angle={-45} textAnchor="end" />
                            <YAxis scale="log" domain={[1, 'auto']} allowDataOverflow axisLine={false} tickLine={false} tickFormatter={(val) => val === 1 ? '0' : formatNumber(val)} tick={{ fontSize: 10, fill: '#6b7280' }} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                formatter={(value, name, props) => {
                                    if (name === 'Target Amount (₹)') return [\`₹\${formatNumber(props.payload.target)}\`, 'Target'];
                                    if (name === 'Collected Amount (₹)') return [\`₹\${formatNumber(props.payload.collected)}\`, 'Collected'];
                                    return [value, name];
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Area type="monotone" dataKey="logTargetMoney" name="Target Amount (₹)" fill="#e0e7ff" stroke="#6366f1" />
                            <Bar dataKey="logCollectedMoney" name="Collected Amount (₹)" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                        </ComposedChart>`;

const activityFinanceOld = `<BarChart data={stats.activityData} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} angle={-45} textAnchor="end" />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={formatNumber} tick={{ fontSize: 10, fill: '#6b7280' }} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Bar dataKey="target" name="Target Amount (₹)" fill="#f1f5f9" stroke="#94a3b8" strokeWidth={1} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="collected" name="Collected Amount (₹)" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>`;

const activityFinanceNew = `<BarChart data={stats.activityData.map(d => ({
                            ...d,
                            logTargetMoney: Math.max(1, d.target),
                            logCollectedMoney: Math.max(1, d.collected)
                        }))} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} angle={-45} textAnchor="end" />
                            <YAxis scale="log" domain={[1, 'auto']} allowDataOverflow axisLine={false} tickLine={false} tickFormatter={(val) => val === 1 ? '0' : formatNumber(val)} tick={{ fontSize: 10, fill: '#6b7280' }} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                formatter={(value, name, props) => {
                                    if (name === 'Target Amount (₹)') return [\`₹\${formatNumber(props.payload.target)}\`, 'Target'];
                                    if (name === 'Collected Amount (₹)') return [\`₹\${formatNumber(props.payload.collected)}\`, 'Collected'];
                                    return [value, name];
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Bar dataKey="logTargetMoney" name="Target Amount (₹)" fill="#f1f5f9" stroke="#94a3b8" strokeWidth={1} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="logCollectedMoney" name="Collected Amount (₹)" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>`;

code = code.replace(clusterFinanceOld, clusterFinanceNew);
code = code.replace(activityFinanceOld, activityFinanceNew);

fs.writeFileSync('components/ExecutiveDashboard.tsx', code);
