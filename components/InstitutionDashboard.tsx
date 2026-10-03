
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Users, Search, RefreshCw, AlertCircle, LayoutGrid, List,
    Landmark, Building2, MapPin, Calendar, User, UserPlus,
    BarChart3, PieChart as PieChartIcon, ChevronDown, ChevronUp,
    Filter, X, UserCheck, Activity as ActivityIcon
} from 'lucide-react';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
    Line, ComposedChart
} from 'recharts';
import { useAuth } from '../hooks/useAuth';

interface GroupMember {
  id: string;
  name: string;
  age?: number;
  gender?: string;
  phone?: string;
  beneficiaryId?: string;
  hhId?: string;
}

interface GroupFormation {
  submissionId: string;
  cluster: string;
  gp: string;
  village: string;
  groupName: string;
  activity?: string;
  formationDate: string;
  members: GroupMember[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700/50 rounded-2xl ${className}`} />
);

const InstitutionDashboard: React.FC = () => {
    const { user } = useAuth();
    const [data, setData] = useState<GroupFormation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
    
    // Filters
    const [filterCluster, setFilterCluster] = useState('All');
    const [filterGP, setFilterGP] = useState('All');
    const [filterVillage, setFilterVillage] = useState('All');
    const [filterGender, setFilterGender] = useState('All');
    const [filterAgeGroup, setFilterAgeGroup] = useState('All');

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/odk/group-formation');
            const text = await res.text();
            
            let result;
            try {
                result = JSON.parse(text);
            } catch (e) {
                throw new Error(`Invalid server response (not JSON): ${text.substring(0, 100)}`);
            }

            if (!res.ok) {
                throw new Error(result.message || result.error || `Server error ${res.status}`);
            }
            
            setData(result);
        } catch (err: any) {
            console.error('Group Formation Error:', err);
            setError(err.message || 'An unknown error occurred while fetching data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Unique options for filters
    const filterOptions = useMemo(() => {
        const clusters = new Set<string>();
        const gps = new Set<string>();
        const villages = new Set<string>();
        
        data.forEach(g => {
            if (g.cluster) clusters.add(g.cluster);
            if (g.gp) gps.add(g.gp);
            if (g.village) villages.add(g.village);
        });

        return {
            clusters: ['All', ...Array.from(clusters).sort()],
            gps: ['All', ...Array.from(gps).sort()],
            villages: ['All', ...Array.from(villages).sort()]
        };
    }, [data]);

    // Apply filters
    const filteredData = useMemo(() => {
        return data.filter(group => {
            const matchCluster = filterCluster === 'All' || group.cluster === filterCluster;
            const matchGP = filterGP === 'All' || group.gp === filterGP;
            const matchVillage = filterVillage === 'All' || group.village === filterVillage;
            
            // For member-level filters (Gender/Age), we check if at least one member matches
            // OR if it's 'All', we keep the group. 
            // However, the KPI cards need to filter the members WITHIN the group.
            
            const matchSearch = !searchQuery || 
                group.groupName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                group.village.toLowerCase().includes(searchQuery.toLowerCase()) ||
                group.members.some(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));

            return matchCluster && matchGP && matchVillage && matchSearch;
        }).map(group => {
            // Also filter members within the group based on gender/age filters
            const filteredMembers = group.members.filter(member => {
                const matchGender = filterGender === 'All' || (member.gender?.toLowerCase() === filterGender.toLowerCase());
                
                let matchAge = true;
                if (filterAgeGroup !== 'All' && member.age) {
                    const age = member.age;
                    if (filterAgeGroup === '18-25') matchAge = age >= 18 && age <= 25;
                    else if (filterAgeGroup === '26-35') matchAge = age >= 26 && age <= 35;
                    else if (filterAgeGroup === '36-45') matchAge = age >= 36 && age <= 45;
                    else if (filterAgeGroup === '46-55') matchAge = age >= 46 && age <= 55;
                    else if (filterAgeGroup === '56+') matchAge = age >= 56;
                } else if (filterAgeGroup !== 'All' && !member.age) {
                    matchAge = false;
                }

                return matchGender && matchAge;
            });

            return { ...group, members: filteredMembers };
        }).filter(g => g.members.length > 0 || (filterGender === 'All' && filterAgeGroup === 'All'));
    }, [data, filterCluster, filterGP, filterVillage, filterGender, filterAgeGroup, searchQuery]);

    // Aggregate stats
    const stats = useMemo(() => {
        const totalGroups = filteredData.length;
        const allMembers = filteredData.flatMap(g => g.members);
        const totalMembers = allMembers.length;
        const maleMembers = allMembers.filter(m => m.gender?.toLowerCase() === 'male').length;
        const femaleMembers = allMembers.filter(m => m.gender?.toLowerCase() === 'female').length;
        const avgMembers = totalGroups > 0 ? (totalMembers / totalGroups).toFixed(1) : '0';
        const uniqueVillages = new Set(filteredData.map(g => g.village)).size;
        const uniqueGPs = new Set(filteredData.map(g => g.gp)).size;

        // Gender Chart Data
        const genderData = [
            { name: 'Male', value: maleMembers },
            { name: 'Female', value: femaleMembers },
            { name: 'Other/Unknown', value: totalMembers - maleMembers - femaleMembers }
        ].filter(d => d.value > 0);

        // Age Chart Data
        const ageMap = { '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56+': 0, 'Unknown': 0 };
        allMembers.forEach(m => {
            if (!m.age) ageMap['Unknown']++;
            else if (m.age <= 25) ageMap['18-25']++;
            else if (m.age <= 35) ageMap['26-35']++;
            else if (m.age <= 45) ageMap['36-45']++;
            else if (m.age <= 55) ageMap['46-55']++;
            else ageMap['56+']++;
        });
        const ageData = Object.entries(ageMap).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);

        // Cluster/GP/Village Member Data
        const clusterMemberMap: Record<string, number> = {};
        const clusterGroupMap: Record<string, number> = {};
        const activityClusterMap: Record<string, any> = {};
        const gpMap: Record<string, number> = {};
        const villageMap: Record<string, number> = {};
        const allClusters = new Set<string>();
        
        filteredData.forEach(g => {
            const cluster = g.cluster || 'Unknown';
            allClusters.add(cluster);
            clusterMemberMap[cluster] = (clusterMemberMap[cluster] || 0) + g.members.length;
            clusterGroupMap[cluster] = (clusterGroupMap[cluster] || 0) + 1;
            
            const activity = g.activity || 'General';
            if (!activityClusterMap[activity]) {
                activityClusterMap[activity] = { name: activity, total: 0 };
            }
            activityClusterMap[activity].total = (activityClusterMap[activity].total || 0) + 1;
            activityClusterMap[activity][cluster] = (activityClusterMap[activity][cluster] || 0) + 1;

            gpMap[g.gp] = (gpMap[g.gp] || 0) + g.members.length;
            villageMap[g.village] = (villageMap[g.village] || 0) + g.members.length;
        });

        const sortedClusters = Array.from(allClusters).sort();
        const clusterMemberData = Object.entries(clusterMemberMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
        const clusterGroupData = Object.entries(clusterGroupMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
        
        // Ensure every activity point has a value for every cluster to prevent line breaks
        const activityGroupData = Object.values(activityClusterMap)
            .sort((a: any, b: any) => b.total - a.total)
            .slice(0, 10)
            .map((item: any) => {
                const normalizedItem = { ...item };
                sortedClusters.forEach(cluster => {
                    if (normalizedItem[cluster] === undefined) normalizedItem[cluster] = 0;
                });
                return normalizedItem;
            });

        const gpData = Object.entries(gpMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
        const villageData = Object.entries(villageMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);

        // Group Size Distribution
        const sizeMap = { '1-5': 0, '6-10': 0, '11-15': 0, '16+': 0 };
        filteredData.forEach(g => {
            const count = g.members.length;
            if (count <= 5) sizeMap['1-5']++;
            else if (count <= 10) sizeMap['6-10']++;
            else if (count <= 15) sizeMap['11-15']++;
            else sizeMap['16+']++;
        });
        const sizeData = Object.entries(sizeMap).map(([name, value]) => ({ name, value }));

        return { 
            totalGroups, totalMembers, maleMembers, femaleMembers, 
            avgMembers, uniqueVillages, uniqueGPs,
            genderData, ageData, clusterMemberData, clusterGroupData, activityGroupData, gpData, villageData, sizeData,
            sortedClusters
        };
    }, [filteredData]);

    if (loading && data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-fade-in">
                <div className="relative w-24 h-24">
                    <div className="absolute inset-0 border-8 border-indigo-100 rounded-full"></div>
                    <div className="absolute inset-0 border-8 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-4 bg-indigo-50 rounded-full flex items-center justify-center">
                        <Landmark className="w-8 h-8 text-indigo-600" />
                    </div>
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest">Syncing Data</h2>
                    <p className="text-gray-400 font-bold text-[10px] uppercase tracking-[0.3em]">Connecting to ODK Central...</p>
                </div>
                <div className="grid grid-cols-3 gap-3 w-64">
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-2 w-full" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-7xl mx-auto p-8 text-center bg-rose-50 dark:bg-rose-900/10 rounded-[3rem] border border-rose-100 dark:border-rose-900/50">
                <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-6" />
                <h2 className="text-2xl font-black text-rose-900 dark:text-rose-400 uppercase mb-2">Sync Error</h2>
                <p className="text-rose-600 mb-8">{error}</p>
                <button onClick={fetchData} className="px-8 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg">Retry Sync</button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-100 dark:border-indigo-800">
                        <Landmark className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Institution Analytics</span>
                    </div>
                    <h1 className="text-5xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">
                        Group <span className="text-indigo-600">Formation</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 font-bold max-w-xl">
                        Comprehensive monitoring of community groups, SHGs, and membership demographics captured via ODK Central.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button 
                        onClick={fetchData} 
                        className="p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-gray-400 hover:text-indigo-600 transition-all shadow-sm group"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { label: 'Total Groups', value: stats.totalGroups, icon: Landmark, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Total Members', value: stats.totalMembers, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Male Members', value: stats.maleMembers, icon: User, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Female Members', value: stats.femaleMembers, icon: UserCheck, color: 'text-pink-600', bg: 'bg-pink-50' },
                    { label: 'Villages', value: stats.uniqueVillages, icon: MapPin, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Avg / Group', value: stats.avgMembers, icon: UserPlus, color: 'text-purple-600', bg: 'bg-purple-50' }
                ].map((kpi, i) => (
                    <div key={i} className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                        <div className={`w-10 h-10 ${kpi.bg} dark:bg-opacity-10 ${kpi.color} rounded-xl flex items-center justify-center mb-4`}>
                            <kpi.icon className="w-5 h-5" />
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{loading ? '...' : kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters & Search */}
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
                <div className="flex items-center gap-2 mb-2">
                    <Filter className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-800 dark:text-white">Smart Filters</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Cluster</label>
                        <select 
                            value={filterCluster} 
                            onChange={e => setFilterCluster(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                        >
                            {filterOptions.clusters.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">GP</label>
                        <select 
                            value={filterGP} 
                            onChange={e => setFilterGP(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                        >
                            {filterOptions.gps.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Village</label>
                        <select 
                            value={filterVillage} 
                            onChange={e => setFilterVillage(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                        >
                            {filterOptions.villages.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Gender</label>
                        <select 
                            value={filterGender} 
                            onChange={e => setFilterGender(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="All">All Genders</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Age Group</label>
                        <select 
                            value={filterAgeGroup} 
                            onChange={e => setFilterAgeGroup(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="All">All Ages</option>
                            <option value="18-25">18-25</option>
                            <option value="26-35">26-35</option>
                            <option value="36-45">36-45</option>
                            <option value="46-55">46-55</option>
                            <option value="56+">56+</option>
                        </select>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="text"
                        placeholder="Search groups or members..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Gender Distribution */}
                <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl">
                            <PieChartIcon size={20} />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-800 dark:text-white">Gender Split</h3>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.genderData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.genderData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Age Distribution */}
                <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl">
                            <BarChart3 size={20} />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-800 dark:text-white">Age Demographics</h3>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.ageData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={40}>
                                    {stats.ageData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Cluster Member Distribution */}
                <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-2xl">
                            <Users size={20} />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-800 dark:text-white">Cluster-wise Members</h3>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.clusterMemberData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} width={80} />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={20}>
                                    {stats.clusterMemberData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Cluster Groups Distribution */}
                <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-2xl">
                            <MapPin size={20} />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-800 dark:text-white">Cluster-wise Groups</h3>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.clusterGroupData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} width={80} />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={20}>
                                    {stats.clusterGroupData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Activity Groups Distribution */}
                <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm lg:col-span-2">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl">
                            <ActivityIcon size={20} />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-800 dark:text-white">Activity Distribution by Cluster</h3>
                    </div>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={stats.activityGroupData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend verticalAlign="top" height={36}/>
                                <Bar dataKey="total" name="Total Groups" fill="#10b981" opacity={0.2} radius={[10, 10, 0, 0]} barSize={40} />
                                {stats.sortedClusters.map((cluster, idx) => (
                                    <Line 
                                        key={cluster}
                                        type="monotone" 
                                        dataKey={cluster} 
                                        name={cluster}
                                        stroke={['#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981'][idx % 5]} 
                                        strokeWidth={3}
                                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                        connectNulls={true}
                                    />
                                ))}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Group Size Distribution */}
                <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 rounded-2xl">
                            <Users size={20} />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-800 dark:text-white">Group Size Distribution</h3>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.sizeData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={40}>
                                    {stats.sizeData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Member Table Section */}
            <div className="bg-white dark:bg-gray-900 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-gray-50 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none">
                            <List size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Member Directory</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Detailed listing of all registered members</p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">S.No</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Group / Village</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cluster / GP</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Members</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {loading ? (
                                [1, 2, 3, 4, 5].map(i => (
                                    <tr key={i}>
                                        <td colSpan={5} className="px-8 py-4"><Skeleton className="h-12 w-full" /></td>
                                    </tr>
                                ))
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center text-gray-400 font-bold">No records matching your filters</td>
                                </tr>
                            ) : filteredData.map((group, idx) => (
                                <React.Fragment key={group.submissionId}>
                                    <tr className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors ${expandedGroup === group.submissionId ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}>
                                        <td className="px-8 py-6 text-xs font-black text-gray-400 tabular-nums">{idx + 1}</td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="font-black text-gray-900 dark:text-white uppercase tracking-tight">{group.groupName}</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded uppercase tracking-tighter">{group.activity || 'General'}</span>
                                                    <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                                                        <MapPin size={10} className="text-gray-300" /> {group.village}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">{group.cluster}</span>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{group.gp}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-black tabular-nums">
                                                {group.members.length}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button 
                                                onClick={() => setExpandedGroup(expandedGroup === group.submissionId ? null : group.submissionId)}
                                                className={`p-3 rounded-xl transition-all ${expandedGroup === group.submissionId ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600'}`}
                                            >
                                                {expandedGroup === group.submissionId ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedGroup === group.submissionId && (
                                        <tr>
                                            <td colSpan={5} className="bg-indigo-50/20 dark:bg-indigo-950/10 px-8 py-8 animate-in slide-in-from-top-4 duration-300">
                                                <div className="bg-white dark:bg-gray-900 rounded-3xl border border-indigo-100 dark:border-indigo-900/50 shadow-xl p-8">
                                                    <div className="flex items-center justify-between mb-8">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
                                                                <Users size={20} />
                                                            </div>
                                                            <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">Members of {group.groupName}</h4>
                                                        </div>
                                                        <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
                                                            Registered on {new Date(group.formationDate).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                        {group.members.map((member, mIdx) => (
                                                            <div key={member.id} className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-indigo-200 transition-all group">
                                                                <div className="flex items-start justify-between mb-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 bg-white dark:bg-gray-700 text-gray-400 rounded-lg flex items-center justify-center text-xs font-black">
                                                                            {mIdx + 1}
                                                                        </div>
                                                                        <span className="font-black text-gray-900 dark:text-white uppercase text-xs truncate max-w-[120px]">{member.name}</span>
                                                                    </div>
                                                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter ${member.gender?.toLowerCase() === 'male' ? 'bg-blue-100 text-blue-600' : member.gender?.toLowerCase() === 'female' ? 'bg-pink-100 text-pink-600' : 'bg-gray-100 text-gray-500'}`}>
                                                                        {member.gender || 'N/A'}
                                                                    </span>
                                                                </div>
                                                                <div className="space-y-3 pt-4 border-t border-white dark:border-gray-700">
                                                                    <div className="flex justify-between">
                                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Age</span>
                                                                        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{member.age || 'N/A'}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Beneficiary ID</span>
                                                                        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 font-mono">{member.beneficiaryId || 'N/A'}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">HH ID</span>
                                                                        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 font-mono">{member.hhId || 'N/A'}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Phone</span>
                                                                        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{member.phone || 'N/A'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                {!loading && filteredData.length > 0 && (
                    <div className="p-8 bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-50 dark:border-gray-800 flex justify-between items-center">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Showing {filteredData.length} groups with {stats.totalMembers} active members
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InstitutionDashboard;
