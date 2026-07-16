const fs = require('fs');
let code = fs.readFileSync('components/ExecutiveDashboard.tsx', 'utf8');

const aiPanel = `
            {/* 5. AI INSIGHTS PANEL */}
            <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl flex flex-col relative overflow-hidden mt-2">
                <Lightbulb className="absolute -right-8 -bottom-8 w-40 h-40 opacity-10" />
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-4 z-10 text-indigo-200">
                    <Star className="w-4 h-4 text-amber-400" />
                    AI Executive Insights
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 z-10">
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                            <TrendingUp className="w-4 h-4 text-emerald-300" />
                        </div>
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-100 mb-1">Top Performing GP</h4>
                            <p className="text-[11px] leading-relaxed opacity-90">
                                {dashboardData.gpData.length > 0 ? \`\${dashboardData.gpData[0].name} leads the registration count with \${dashboardData.gpData[0].count} beneficiaries, driving overall coverage efficiency.\` : 'Gathering sufficient data to identify top performing GPs...'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-amber-300" />
                        </div>
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-100 mb-1">Material Distribution</h4>
                            <p className="text-[11px] leading-relaxed opacity-90">
                                {dashboardData.materialAch < 50 ? \`Current distribution rate is at \${dashboardData.materialAch.toFixed(1)}%. Recommend expediting procurement and logistics for pending materials.\` : \`Strong material distribution at \${dashboardData.materialAch.toFixed(1)}%. Continue the current logistical pace to ensure full coverage.\`}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                            <Database className="w-4 h-4 text-pink-300" />
                        </div>
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-100 mb-1">Contribution Health</h4>
                            <p className="text-[11px] leading-relaxed opacity-90">
                                {stats.totalTargetContrib > 0 ? \`Collected ₹\${formatNumber(stats.totalCollectedContrib)} against a target of ₹\${formatNumber(stats.totalTargetContrib)}. \${((stats.totalCollectedContrib / stats.totalTargetContrib) * 100).toFixed(1)}% of financial goals met.\` : 'Analyzing contribution metrics for financial health.'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
`;

code = code.replace(/        <\/div>\n    \);\n};\n/, aiPanel + "    );\n};\n");

fs.writeFileSync('components/ExecutiveDashboard.tsx', code);
