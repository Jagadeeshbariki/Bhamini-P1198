import React, { useState, useEffect, useMemo } from 'react';
import { 
    Users, Search, 
    RefreshCw, AlertCircle, LayoutGrid, List,
    Landmark, Building2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface InstitutionRecord {
    id: string;
    date: string;
    name: string;
    type: string;
    village: string;
    members: number;
    photo: string;
    raw: any;
}

const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700/50 rounded-2xl ${className}`} />
);

const InstitutionDashboard: React.FC = () => {
    const [data, setData] = useState<InstitutionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
    const [formId, setFormId] = useState<string>('Group Formation');
    const [odkStatus, setOdkStatus] = useState<{status: string, project?: string, message?: string} | null>(null);

    const checkOdkStatus = async () => {
        try {
            const res = await fetch('/api/odk/status');
            if (res.ok) {
                const status = await res.json();
                setOdkStatus(status);
            }
        } catch (e) {
            console.error("Failed to check ODK status:", e);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        checkOdkStatus();
        
        try {
            // 1. Resolve the correct Form ID by searching for "Group Formation"
            let targetId = 'Group Formation';
            try {
                const dashRes = await fetch('/api/odk/dashboard');
                if (dashRes.ok) {
                    const dashData = await dashRes.json();
                    const forms = dashData.forms || [];
                    const matchedForm = forms.find((f: any) => 
                        f.id === 'Group Formation' ||
                        f.name.toLowerCase().includes('group formation') ||
                        f.name.toLowerCase().includes('institution')
                    );
                    if (matchedForm) {
                        targetId = matchedForm.id;
                        setFormId(targetId);
                    }
                }
            } catch (dashErr) {
                console.warn("[Dashboard] Could not fetch ODK dashboard for auto-discovery:", dashErr);
            }

            // 2. Fetch OData Submissions
            const res = await fetch(`/api/odk/data?formId=${encodeURIComponent(targetId)}`);
            
            const odataText = await res.text();
            let json;
            try {
                json = JSON.parse(odataText);
            } catch (e) {
                console.error('Non-JSON response from server:', odataText.substring(0, 500));
                if (odataText.includes('<!DOCTYPE') || odataText.includes('<html')) {
                    throw new Error(`The server returned a webpage instead of data. Status: ${res.status}`);
                }
                throw new Error(`Failed to parse ODK data. The server returned: ${odataText.substring(0, 100) || 'Empty response'} (Status: ${res.status})`);
            }

            if (!res.ok) {
                const details = json.details || json.error || 'No details provided';
                throw new Error(`ODK Central returned an error (${res.status}): ${details}`);
            }

            const rawSubmissions = json.value || (Array.isArray(json) ? json : []);

            // 3. Robust Path-Based Parsing Logic
            const records: InstitutionRecord[] = rawSubmissions.map((sub: any) => {
                const flatData: Record<string, any> = {};
                const flatten = (obj: any, prefix = '') => {
                    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                        Object.keys(obj).forEach(k => {
                            const newKey = prefix ? `${prefix}/${k}` : k;
                            flatData[newKey] = obj[k];
                            flatData[newKey.replace(/\//g, '.')] = obj[k];
                            flatData[newKey.replace(/\//g, '_')] = obj[k];
                            flatten(obj[k], newKey);
                        });
                    }
                };
                flatten(sub);

                const findInFlat = (keywords: string[]) => {
                    const allKeys = Object.keys(flatData);
                    for (const kw of keywords) {
                        if (flatData[kw] !== undefined && flatData[kw] !== null && flatData[kw] !== '') return flatData[kw];
                    }
                    for (const kw of keywords) {
                        const match = allKeys.find(k => k.toLowerCase().endsWith(kw.toLowerCase()));
                        if (match && flatData[match] !== undefined && flatData[match] !== null && flatData[match] !== '') return flatData[match];
                    }
                    for (const kw of keywords) {
                        const match = allKeys.find(k => k.toLowerCase().includes(kw.toLowerCase()));
                        if (match && flatData[match] !== undefined && flatData[match] !== null && flatData[match] !== '') return flatData[match];
                    }
                    return null;
                };

                const nameKeywords = ['group_name', 'name_of_group', 'name', 'GroupName', 'InstitutionName', 'institution_name', 'shg_name', 'fpo_name', 'entity_name', 'Organization', 'Title'];
                const typeKeywords = ['group_type', 'type_of_group', 'type', 'GroupType', 'InstitutionType', 'category', 'institution_type', 'Class', 'Type'];
                const villageKeywords = ['village', 'village_name', 'VillageName', 'location', 'habitation', 'Place', 'Area', 'Address'];
                const memberKeywords = ['members_count', 'no_of_members', 'members', 'total_members', 'count_members', 'Count', 'Strength', 'Enrollment'];
                const dateKeywords = ['formation_date', 'date_of_formation', 'date', 'FormationDate', 'CreatedDate', 'Today', 'Date'];
                const photoKeywords = ['photo', 'image', 'picture', 'pic', 'attachment', 'Logo', 'Photo', 'Group_Photo'];

                const nameValue = findInFlat(nameKeywords) || 'Unnamed Group';
                const typeValue = findInFlat(typeKeywords) || 'Group';
                const villageValue = findInFlat(villageKeywords) || 'Unknown';
                const membersValue = findInFlat(memberKeywords);
                const dateValue = findInFlat(dateKeywords) || sub.__system?.submissionDate || '';
                
                const foundPhotoKey = Object.keys(flatData).find(k => 
                    photoKeywords.some(pk => k.toLowerCase().includes(pk)) && 
                    typeof flatData[k] === 'string' &&
                    flatData[k].length > 4 &&
                    flatData[k].includes('.')
                );
                const photoValue = foundPhotoKey ? flatData[foundPhotoKey] : null;

                return {
                    id: sub.__id || sub.instanceID || sub.uuid || Math.random().toString(36).substr(2, 9),
                    date: dateValue,
                    name: String(nameValue),
                    type: String(typeValue),
                    village: String(villageValue),
                    members: typeof membersValue === 'number' ? membersValue : parseInt(String(membersValue || '0')),
                    photo: photoValue,
                    raw: sub
                };
            });

            setData(records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (err: any) {
            console.error('Institution Dashboard Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredData = useMemo(() => {
        return data.filter(r => 
            r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.village.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.type.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [data, searchQuery]);

    const stats = useMemo(() => {
        const total = data.length;
        const totalMembers = data.reduce((acc, curr) => acc + (curr.members || 0), 0);
        const types = Array.from(new Set(data.map(d => d.type)));
        return { total, totalMembers, typeCount: types.length };
    }, [data]);

    if (error) {
        return (
            <div className="max-w-7xl mx-auto space-y-6">
                {/* ODK Status Indicator */}
                {odkStatus && (
                    <div className={`shrink-0 px-4 py-2 rounded-xl border flex items-center justify-between transition-all duration-500 ${odkStatus.status === 'ok' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full animate-pulse ${odkStatus.status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                                ODK Central: {odkStatus.status === 'ok' ? `CONNECTED (${odkStatus.project})` : 'DISCONNECTED'}
                            </span>
                        </div>
                        {odkStatus.status !== 'ok' && (
                            <p className="text-[9px] font-bold opacity-80">{odkStatus.message}</p>
                        )}
                    </div>
                )}

                <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 p-8 rounded-[2.5rem] text-center">
                    <div className="w-16 h-16 bg-rose-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-rose-200 dark:shadow-none">
                        <AlertCircle size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-rose-900 dark:text-rose-400 uppercase tracking-tight mb-2">Data Sync Error</h2>
                    <p className="text-rose-600 dark:text-rose-300 font-bold mb-8 max-w-lg mx-auto">{error}</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button 
                            onClick={() => fetchData()}
                            className="px-10 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-rose-700 hover:scale-105 active:scale-95 transition-all shadow-lg"
                        >
                            Retry Sync
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* ODK Status Indicator */}
            {odkStatus && (
                <div className={`shrink-0 px-4 py-2 rounded-xl border flex items-center justify-between transition-all duration-500 ${odkStatus.status === 'ok' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${odkStatus.status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                            ODK Central: {odkStatus.status === 'ok' ? `CONNECTED (${odkStatus.project})` : 'DISCONNECTED'}
                        </span>
                    </div>
                    {odkStatus.status !== 'ok' && (
                        <p className="text-[9px] font-bold opacity-80">{odkStatus.message}</p>
                    )}
                    {odkStatus.status === 'ok' && odkStatus.email && (
                        <span className="text-[9px] font-bold opacity-60">Session: {odkStatus.email}</span>
                    )}
                </div>
            )}

            {/* Header & Stats */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-100 dark:border-indigo-800">
                        <Landmark className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Institution Monitoring</span>
                    </div>
                    <h1 className="text-5xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">
                        Groups & <span className="text-indigo-600">Institutions</span>
                    </h1>
                </div>

                <div className="grid grid-cols-3 gap-4 lg:w-96">
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.total}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Members</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalMembers}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Types</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.typeCount}</p>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="text"
                        placeholder="Search by name, village, or type..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                    />
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setViewMode('grid')}
                        className={`p-4 rounded-2xl border transition-all ${viewMode === 'grid' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-400'}`}
                    >
                        <LayoutGrid className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => setViewMode('table')}
                        className={`p-4 rounded-2xl border transition-all ${viewMode === 'table' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-400'}`}
                    >
                        <List className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={fetchData}
                        disabled={loading}
                        className="p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-gray-400 hover:text-indigo-600 transition-all"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Data View */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-64" />)}
                </div>
            ) : filteredData.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-[3rem] p-20 text-center border border-gray-100 dark:border-gray-800">
                    <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Search className="w-10 h-10 text-gray-300" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">No Groups Found</h3>
                    <p className="text-gray-500 font-bold">Try adjusting your search or sync again.</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredData.map((record) => (
                        <div 
                            key={record.id}
                            className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-6 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all group"
                        >
                            <div className="relative h-48 bg-gray-100 dark:bg-gray-800 rounded-[2rem] mb-6 overflow-hidden">
                                {record.photo ? (
                                    <img 
                                        src={`/api/odk/image?projectId=3&formId=${encodeURIComponent(formId)}&submissionId=${record.id}&imageName=${record.photo}`}
                                        alt={record.name}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=800';
                                        }}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                                        <Building2 className="w-16 h-16" />
                                    </div>
                                )}
                                <div className="absolute top-4 left-4">
                                    <span className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-600 shadow-sm">
                                        {record.type}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-tight mb-1 truncate">
                                        {record.name}
                                    </h3>
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <Users className="w-4 h-4" />
                                        <span className="text-xs font-bold">{record.members} Members</span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-50 dark:border-gray-800 grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Village</p>
                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{record.village}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Formation</p>
                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                            {record.date ? new Date(record.date).toLocaleDateString() : 'Unknown'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-50 dark:border-gray-800">
                                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Group Name</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Village</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Members</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Formation Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                {filteredData.map((record) => (
                                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                                    <Landmark className="w-5 h-5" />
                                                </div>
                                                <span className="font-black text-gray-900 dark:text-white uppercase tracking-tight text-sm">{record.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                {record.type}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-sm font-bold text-gray-500 dark:text-gray-400">{record.village}</td>
                                        <td className="px-8 py-6 text-center">
                                            <span className="font-black text-indigo-600">{record.members}</span>
                                        </td>
                                        <td className="px-8 py-6 text-sm font-bold text-gray-500 dark:text-gray-400">
                                            {record.date ? new Date(record.date).toLocaleDateString() : 'Unknown'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InstitutionDashboard;
