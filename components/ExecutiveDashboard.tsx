import React, { useMemo } from 'react';
import { 
    BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, 
    XAxis, YAxis, Tooltip, LineChart, Line, AreaChart, Area, Legend, ComposedChart, CartesianGrid, Scatter, ScatterChart, ZAxis
} from 'recharts';
import { 
    Users, MapPin, Filter, Search, 
    Download, X, ArrowUpDown, ArrowUp,
    Activity as ActivityIcon, UserCheck,
    ChevronDown, ChevronUp, ArrowLeft,
    TrendingUp, TrendingDown, Target, Package, CheckCircle, AlertTriangle, Lightbulb, Calendar, Map as MapIcon, Heart, Star, LayoutDashboard, Database, TrendingRight
} from 'lucide-react';

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#f43f5e', '#14b8a6', '#f97316', '#06b6d4'];

const formatNumber = (num: number) => {
    if (num >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
    if (num >= 100000) return (num / 100000).toFixed(2) + ' L';
    if (num >= 1000) return (num / 1000).toFixed(1) + ' K';
    return num.toLocaleString();
};

export const ExecutiveDashboard = ({ filteredData, targets, stats, filterCluster, filterGP, filterVillage, filterActivity, filterFinancialYear }: any) => {
    
    const dashboardData = useMemo(() => {
        const total = stats.total;
        const totalTarget = stats.totalTarget;
        const beneficiaryAch = totalTarget > 0 ? (total / totalTarget) * 100 : 0;
        
        const totalMaterialTarget = targets.reduce((sum: number, t: any) => sum + (t.materialTarget || 0), 0);
        let totalMaterialDistributed = 0;
        filteredData.forEach((d: any) => {
            if (d.assets && d.assets.length > 0) totalMaterialDistributed++;
        });

        const materialAch = totalMaterialTarget > 0 ? (totalMaterialDistributed / totalMaterialTarget) * 100 : 0;

        const uniqueVillages = new Set(filteredData.map((d: any) => d.village)).size;
        const uniqueGPs = new Set(filteredData.map((d: any) => d.gp)).size;
        const uniqueClusters = new Set(filteredData.map((d: any) => d.cluster)).size;
        const uniqueHHs = new Set(filteredData.map((d: any) => d.hhId || d.beneficiaryId)).size;
        const baselineTotal = stats.baselineTotal || 0;
        const hhCoverageAch = baselineTotal > 0 ? (uniqueHHs / baselineTotal) * 100 : 0;
        
        // Time series for registration (if date available)
        const dateMap: Record<string, number> = {};
        filteredData.forEach((d: any) => {
            if (d.registrationDate) {
                try {
                    const dStr = d.registrationDate;
                    let monthYear = '';
                    if (dStr.includes('-')) {
                        const parts = dStr.split('-');
                        if (parts.length === 3) {
                            if (isNaN(parts[1])) {
                                monthYear = `${parts[1]} ${parts[2]}`;
                            } else {
                                // Try DD-MM-YYYY vs YYYY-MM-DD
                                if (parts[0].length === 4) {
                                    const date = new Date(dStr);
                                    if (!isNaN(date.getTime())) monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                                } else {
                                    // DD-MM-YYYY
                                    const date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                                    if (!isNaN(date.getTime())) monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                                }
                            }
                        }
                    } else if (dStr.includes('/')) {
                        const parts = dStr.split('/');
                        if (parts.length === 3) {
                            if (parts[2].length === 4) {
                                // DD/MM/YYYY
                                const date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                                if (!isNaN(date.getTime())) {
                                    monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                                } else {
                                    const date2 = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`); // MM/DD/YYYY
                                    if (!isNaN(date2.getTime())) monthYear = date2.toLocaleString('default', { month: 'short', year: 'numeric' });
                                }
                            }
                        }
                    } else {
                        const date = new Date(dStr);
                        if (!isNaN(date.getTime())) {
                            monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                        }
                    }
                    if (monthYear) {
                        dateMap[monthYear] = (dateMap[monthYear] || 0) + 1;
                    }
                } catch (e) { /* ignore */ }
            }
        });
        const sortedMonths = Object.keys(dateMap).sort((a, b) => {
            const dateA = new Date('01 ' + a);
            const dateB = new Date('01 ' + b);
            return dateA.getTime() - dateB.getTime();
        });
        const timeSeriesData = sortedMonths.map(k => ({ name: k, value: dateMap[k] }));

        // Village Performance
        const villageMap: Record<string, number> = {};
        filteredData.forEach((d: any) => {
            villageMap[d.village] = (villageMap[d.village] || 0) + 1;
        });
        const villageData = Object.entries(villageMap)
            .map(([name, count]) => ({ name: name || 'Unknown', count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // GP Performance
        const gpMap: Record<string, number> = {};
        filteredData.forEach((d: any) => {
            gpMap[d.gp] = (gpMap[d.gp] || 0) + 1;
        });
        const gpData = Object.entries(gpMap)
            .map(([name, count]) => ({ name: name || 'Unknown', count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            beneficiaryAch,
            totalMaterialTarget,
            totalMaterialDistributed,
            materialAch,
            uniqueVillages,
            uniqueGPs,
            uniqueClusters,
            uniqueHHs,
            baselineTotal,
            hhCoverageAch,
            timeSeriesData,
            villageData,
            gpData
        };
    }, [filteredData, targets, stats]);

    return (
        <div className="flex flex-col gap-6 w-full animate-fade-in pb-8">
            
            {/* 1. EXECUTIVE KPI CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <KPICard title="Total Beneficiaries" value={stats.total.toLocaleString()} subtitle={`Target: ${stats.totalTarget.toLocaleString()}`} icon={<Users />} color="indigo" progress={dashboardData.beneficiaryAch} />
                <KPICard title="Beneficiary Ach. %" value={`${dashboardData.beneficiaryAch.toFixed(1)}%`} subtitle="vs Overall Target" icon={<Target />} color="emerald" />
                <KPICard title="Total GPs Covered" value={dashboardData.uniqueGPs.toLocaleString()} subtitle="Across all selected" icon={<MapPin />} color="amber" />
                <KPICard title="Material Target" value={dashboardData.totalMaterialTarget.toLocaleString()} subtitle="Expected to distribute" icon={<Package />} color="blue" />
                <KPICard title="Material Dist." value={dashboardData.totalMaterialDistributed.toLocaleString()} subtitle={`${dashboardData.materialAch.toFixed(1)}% Achievement`} icon={<CheckCircle />} color="pink" progress={dashboardData.materialAch} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <KPICard title="Collected Contrib." value={`₹${formatNumber(stats.totalCollectedContrib)}`} subtitle={`Target: ₹${formatNumber(stats.totalTargetContrib)}`} icon={<Database />} color="violet" progress={stats.totalTargetContrib > 0 ? (stats.totalCollectedContrib/stats.totalTargetContrib)*100 : 0} />
                <KPICard title="Contrib Ach. %" value={`${stats.totalTargetContrib > 0 ? ((stats.totalCollectedContrib/stats.totalTargetContrib)*100).toFixed(1) : 0}%`} subtitle="Collection Rate" icon={<TrendingUp />} color="teal" />
                <KPICard title="Clusters Covered" value={dashboardData.uniqueClusters.toLocaleString()} subtitle="Operational Zones" icon={<LayoutDashboard />} color="rose" />
                <KPICard title="Villages Covered" value={dashboardData.uniqueVillages.toLocaleString()} subtitle="Operational Zones" icon={<MapIcon />} color="fuchsia" />
                <KPICard title="HH Covered" value={dashboardData.uniqueHHs.toLocaleString()} subtitle={dashboardData.baselineTotal > 0 ? `${dashboardData.hhCoverageAch.toFixed(1)}% of Baseline (${dashboardData.baselineTotal})` : "Total Unique HHs"} icon={<Users />} color="orange" progress={dashboardData.hhCoverageAch} />
            </div>

            {/* 2. ACTIVITY & CLUSTER PERFORMANCE DASHBOARD */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Activity Target vs Achievement" icon={<ActivityIcon />} height={350}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={stats.activityData.map(d => ({
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
                        </ComposedChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Cluster-wise Beneficiary Progress" icon={<MapPin />} height={350}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.clusterData.map(d => ({
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
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            
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

            {/* 3.6 DEMOGRAPHICS & MATERIAL DIST */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ChartCard title="Gender Distribution" icon={<Users />} height={250}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={stats.genderData}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {stats.genderData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Material Status" icon={<Package />} height={250}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={stats.materialData}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {stats.materialData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.name === 'Received' ? '#10b981' : '#f43f5e'} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
                
                <ChartCard title="Top GPs by Registration" icon={<Star />} height={250}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={dashboardData.gpData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                                {dashboardData.gpData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* 4. FINANCIAL / CONTRIBUTION DASHBOARD */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Cluster-wise Financial Contribution" icon={<Database />} height={300}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={stats.clusterData.map(d => ({
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
                                    if (name === 'Target Amount (₹)') return [`₹${formatNumber(props.payload.target)}`, 'Target'];
                                    if (name === 'Collected Amount (₹)') return [`₹${formatNumber(props.payload.collected)}`, 'Collected'];
                                    return [value, name];
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Area type="monotone" dataKey="logTargetMoney" name="Target Amount (₹)" fill="#e0e7ff" stroke="#6366f1" />
                            <Bar dataKey="logCollectedMoney" name="Collected Amount (₹)" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </ChartCard>
                
                <ChartCard title="Activity-wise Financial Contribution" icon={<TrendingUp />} height={300}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.activityData.map(d => ({
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
                                    if (name === 'Target Amount (₹)') return [`₹${formatNumber(props.payload.target)}`, 'Target'];
                                    if (name === 'Collected Amount (₹)') return [`₹${formatNumber(props.payload.collected)}`, 'Collected'];
                                    return [value, name];
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Bar dataKey="logTargetMoney" name="Target Amount (₹)" fill="#f1f5f9" stroke="#94a3b8" strokeWidth={1} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="logCollectedMoney" name="Collected Amount (₹)" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>


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
                                {dashboardData.gpData.length > 0 ? `${dashboardData.gpData[0].name} leads the registration count with ${dashboardData.gpData[0].count} beneficiaries, driving overall coverage efficiency.` : 'Gathering sufficient data to identify top performing GPs...'}
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
                                {dashboardData.materialAch < 50 ? `Current distribution rate is at ${dashboardData.materialAch.toFixed(1)}%. Recommend expediting procurement and logistics for pending materials.` : `Strong material distribution at ${dashboardData.materialAch.toFixed(1)}%. Continue the current logistical pace to ensure full coverage.`}
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
                                {stats.totalTargetContrib > 0 ? `Collected ₹${formatNumber(stats.totalCollectedContrib)} against a target of ₹${formatNumber(stats.totalTargetContrib)}. ${((stats.totalCollectedContrib / stats.totalTargetContrib) * 100).toFixed(1)}% of financial goals met.` : 'Analyzing contribution metrics for financial health.'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const KPICard = ({ title, value, subtitle, icon, color, progress }: any) => {
    const colorClasses: Record<string, string> = {
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600',
        blue: 'bg-blue-50 text-blue-600',
        pink: 'bg-pink-50 text-pink-600',
        violet: 'bg-violet-50 text-violet-600',
        teal: 'bg-teal-50 text-teal-600',
        rose: 'bg-rose-50 text-rose-600',
        fuchsia: 'bg-fuchsia-50 text-fuchsia-600',
        orange: 'bg-orange-50 text-orange-600',
    };

    const barColors: Record<string, string> = {
        indigo: 'bg-indigo-500',
        emerald: 'bg-emerald-500',
        amber: 'bg-amber-500',
        blue: 'bg-blue-500',
        pink: 'bg-pink-500',
        violet: 'bg-violet-500',
        teal: 'bg-teal-500',
        rose: 'bg-rose-500',
        fuchsia: 'bg-fuchsia-500',
        orange: 'bg-orange-500',
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-500 ${barColors[color]}`}></div>
            <div className="flex justify-between items-start mb-2 relative z-10">
                <div className="flex flex-col">
                    <p className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-widest">{title}</p>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1 tracking-tight">{value}</h3>
                </div>
                <div className={`p-2 rounded-xl ${colorClasses[color]}`}>
                    {React.cloneElement(icon, { className: 'w-4 h-4' })}
                </div>
            </div>
            <div className="relative z-10 mt-2">
                {progress !== undefined ? (
                    <div className="flex flex-col gap-1">
                        <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColors[color]}`} style={{ width: `${Math.min(progress, 100)}%` }}></div>
                        </div>
                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{subtitle}</p>
                    </div>
                ) : (
                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mt-1">{subtitle}</p>
                )}
            </div>
        </div>
    );
};

const ChartCard = ({ title, icon, height, children }: any) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 tracking-widest flex items-center gap-2">
                {icon && React.cloneElement(icon, { className: 'w-4 h-4 text-gray-400' })}
                {title}
            </h3>
        </div>
        <div style={{ height: `${height}px` }} className="w-full">
            {children}
        </div>
    </div>
);
