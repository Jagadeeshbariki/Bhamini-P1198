import React, { useState, useEffect, useMemo } from 'react';
import { 
    Users, Calendar, Camera, FileText, Upload, 
    Search, RefreshCw, AlertCircle, CheckCircle2,
    BarChart3, LayoutGrid, List, X, Image as ImageIcon,
    ExternalLink
} from 'lucide-react';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip 
} from 'recharts';
import { useAuth } from '../hooks/useAuth';
import PhotoGallery from './PhotoGallery';
import { GOOGLE_APPS_SCRIPT_URL } from '../config';

interface CapacityRecord {
    id: string;
    date: string;
    topic: string;
    participants: number;
    trainer: string;
    photo: string;
    raw: any;
    documents?: { id: string; name: string; url: string }[];
}

const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700/50 rounded-2xl ${className}`} />
);

const CapacityBuildingDashboard: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [data, setData] = useState<CapacityRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'table' | 'grid' | 'gallery'>('grid');
    const [selectedRecord, setSelectedRecord] = useState<CapacityRecord | null>(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadingToId, setUploadingToId] = useState<string | null>(null);
    const [linkedDocs, setLinkedDocs] = useState<{ id: string; name: string; url: string }[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [allForms, setAllForms] = useState<any[]>([]);
    const [formId, setFormId] = useState<string>('');
    const [debugMode, setDebugMode] = useState(false);
    const [rawSample, setRawSample] = useState<any>(null);

    const handleUpload = async (submissionId?: string) => {
        if (!selectedFile) {
            alert('Please select a file first');
            return;
        }
        setUploading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64 = (e.target?.result as string).split(',')[1];
                
                const payload = {
                    action: 'addTrainingDocument',
                    submissionId: submissionId || 'general',
                    fileName: selectedFile.name,
                    fileData: base64,
                    mimeType: selectedFile.type,
                    uploadedBy: user?.name || 'Unknown'
                };

                const res = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify(payload)
                });

                // With no-cors we can't see the result, but we can verify it by checking the list
                alert('Upload request sent! Please wait a moment for it to be processed and then refresh the list.');
                setShowUploadModal(false);
                setSelectedFile(null);
                setUploading(false);
                setUploadingToId(null);
                
                // Poll for the new document after a short delay
                setTimeout(() => fetchLinkedDocs(submissionId || 'general'), 3000);
            };
            reader.readAsDataURL(selectedFile);
        } catch (err: any) {
            console.error(err);
            alert('Upload failed: ' + err.message);
            setUploading(false);
        }
    };

    const fetchLinkedDocs = async (submissionId: string) => {
        setLoadingDocs(true);
        try {
            const res = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getTrainingDocuments&submissionId=${submissionId}`);
            if (!res.ok) throw new Error(`Script error: ${res.status}`);
            
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error('Script returned invalid data format. Please check script deployment.');
            }

            if (data.status === 'success' || data.success) {
                setLinkedDocs(data.files.map((f: any) => ({
                    id: f.id || Math.random().toString(),
                    name: f.name,
                    url: f.url
                })));
            }
        } catch (err: any) {
            console.error('Error fetching docs:', err);
        } finally {
            setLoadingDocs(false);
        }
    };

    useEffect(() => {
        if (selectedRecord) {
            setLinkedDocs([]);
            fetchLinkedDocs(selectedRecord.id);
        }
    }, [selectedRecord]);

    const fetchData = async (overrideFormId?: string) => {
        setLoading(true);
        setError(null);
        setRawSample(null);
        try {
            // 1. Resolve Form ID
            const dashRes = await fetch('/api/odk/dashboard');
            let availableForms: any[] = [];
            let targetId = overrideFormId || formId;
            
            if (dashRes.ok) {
                const dashText = await dashRes.text();
                try {
                    const dashData = JSON.parse(dashText);
                    availableForms = dashData.forms || [];
                } catch (e) {
                    throw new Error('Server returned invalid dashboard data. Please try again.');
                }
                
                if (!targetId) {
                    // Look for common patterns
                    const matchedForm = availableForms.find((f: any) => 
                        f.id.toLowerCase() === 'capacity_building' ||
                        f.id.toLowerCase().includes('capacity_building') ||
                        f.name.toLowerCase().includes('capacity building') || 
                        f.name.toLowerCase().includes('training report') ||
                        f.name.toLowerCase().includes('cb documentation') ||
                        f.name.toLowerCase().includes('training documentation')
                    );
                    targetId = matchedForm ? matchedForm.id : (availableForms.find(f => f.name.toLowerCase().includes('training'))?.id || availableForms[0]?.id || 'Capacity_building');
                }
            } else {
                throw new Error(`Failed to connect to ODK service (${dashRes.status})`);
            }

            setFormId(targetId);
            setAllForms(availableForms);

            // 2. Fetch OData Submissions
            const res = await fetch(`/api/odk/odata?formId=${encodeURIComponent(targetId)}`);
            if (!res.ok) throw new Error(`Failed to fetch data for ${targetId}. Status: ${res.status}`);
            
            const odataText = await res.text();
            let json;
            try {
                json = JSON.parse(odataText);
            } catch (e) {
                console.error('Non-JSON response from server:', odataText.substring(0, 500));
                if (odataText.includes('<!DOCTYPE html>') || odataText.includes('<html')) {
                    throw new Error(`The server returned a webpage instead of data. This usually means the API route was not found or redirected. (Form: ${targetId})`);
                }
                throw new Error(`Invalid response format from server. (Form: ${targetId})`);
            }

            if (json.error) {
                throw new Error(`${json.error}: ${json.details || 'No details provided'}`);
            }

            const rawSubmissions = json.value || [];
            
            if (rawSubmissions.length > 0) {
                setRawSample(rawSubmissions[0]);
            }

            // 3. Robust Path-Based Parsing Logic
            const getVal = (obj: any, paths: string[]): any => {
                for (const path of paths) {
                    if (obj[path] !== undefined && obj[path] !== null && obj[path] !== '') return obj[path];
                    const parts = path.split(/[\/\.]/);
                    let current = obj;
                    for (const part of parts) {
                        current = current?.[part];
                        if (current === undefined || current === null) break;
                    }
                    if (current !== undefined && current !== null && current !== '') return current;
                }
                return null;
            };

            const records: CapacityRecord[] = rawSubmissions.map((sub: any) => {
                // 1. Flatten the submission for easier searching
                const flatData: Record<string, any> = {};
                const flatten = (obj: any, prefix = '') => {
                    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                        Object.keys(obj).forEach(k => {
                            const newKey = prefix ? `${prefix}/${k}` : k;
                            flatData[newKey] = obj[k];
                            // Also store with dots and underscores for varied ODK formats
                            flatData[newKey.replace(/\//g, '.')] = obj[k];
                            flatData[newKey.replace(/\//g, '_')] = obj[k];
                            flatten(obj[k], newKey);
                        });
                    }
                };
                flatten(sub);

                // 2. Comprehensive pattern matching
                const findInFlat = (keywords: string[]) => {
                    // Try exact matches from flatData first
                    for (const kw of keywords) {
                        if (flatData[kw] !== undefined && flatData[kw] !== null && flatData[kw] !== '') return flatData[kw];
                    }
                    
                    // Try case-insensitive "ends with" match on all keys
                    const allKeys = Object.keys(flatData);
                    for (const kw of keywords) {
                        const match = allKeys.find(k => k.toLowerCase().endsWith(kw.toLowerCase()));
                        if (match && flatData[match] !== undefined && flatData[match] !== null && flatData[match] !== '') return flatData[match];
                    }

                    // Try "contains" match
                    for (const kw of keywords) {
                        const match = allKeys.find(k => k.toLowerCase().includes(kw.toLowerCase()));
                        if (match && flatData[match] !== undefined && flatData[match] !== null && flatData[match] !== '') return flatData[match];
                    }
                    return null;
                };

                const topicKeywords = ['Event_name', 'topic', 'training_topic', 'activity', 'training_name', 'Subject', 'Activity', 'Title', 'Training', 'Name'];
                const dateKeywords = ['from_date', 'date', 'today', 'reporting_date', 'training_date', 'Time'];
                const participantKeywords = ['total_members', 'participants', 'no_of_participants', 'attendees', 'attendance', 'total', 'count', 'Number', 'Impact'];
                const trainerKeywords = ['Data_sub_by', 'trainer', 'resource_person', 'facilitator', 'name_of_trainer', 'Resource'];
                const photoKeywords = ['photo', 'image', 'picture', 'pic', 'attachment', 'Documentation'];

                let topic = findInFlat(topicKeywords);
                if (!topic || typeof topic !== 'string') {
                    // Final fallback: find any string field > 5 chars that isn't ID or metadata
                    const candidateKey = Object.keys(flatData).find(k => 
                        typeof flatData[k] === 'string' && 
                        flatData[k].length > 5 && 
                        !k.includes('__') && !k.includes('meta') && !k.includes('id') && !k.includes('uuid')
                    );
                    topic = candidateKey ? flatData[candidateKey] : 'Untitled Training';
                }

                const date = findInFlat(dateKeywords) || sub.__system?.submissionDate || '';
                const participantsValue = findInFlat(participantKeywords);
                const participants = typeof participantsValue === 'number' ? participantsValue : Number(participantsValue || 0);
                const trainer = findInFlat(trainerKeywords) || 'N/A';
                
                const foundPhotoKey = Object.keys(flatData).find(k => 
                    photoKeywords.some(pk => k.toLowerCase().includes(pk)) && 
                    typeof flatData[k] === 'string' &&
                    flatData[k].length > 4 &&
                    flatData[k].includes('.') // Usually has an extension
                );

                let photo = '';
                if (foundPhotoKey) {
                    const filename = flatData[foundPhotoKey];
                    photo = `/api/odk/image?submissionId=${encodeURIComponent(sub.__id)}&filename=${encodeURIComponent(filename)}&form=${encodeURIComponent(targetId)}`;
                }

                return { id: sub.__id, date, topic: String(topic), participants, trainer: String(trainer), photo, raw: sub };
            });

            setData(records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredData = useMemo(() => {
        return data.filter(d => 
            d.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.trainer.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [data, searchQuery]);

    const stats = useMemo(() => {
        const totalTrainings = data.length;
        const totalParticipants = data.reduce((sum, d) => sum + d.participants, 0);
        const topicMap: Record<string, number> = {};
        data.forEach(d => { topicMap[d.topic] = (topicMap[d.topic] || 0) + 1; });
        const topicDist = Object.entries(topicMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
        return { totalTrainings, totalParticipants, topicDist };
    }, [data]);

    if (loading) {
        return (
            <div className="space-y-8 pb-10">
                {/* Header Skeleton */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-3 w-40" />
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-10 rounded-xl" />
                        <Skeleton className="h-10 w-10 rounded-xl" />
                    </div>
                </div>

                {/* KPI Skeletons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6">
                            <Skeleton className="w-14 h-14 rounded-2xl" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-8 w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filter Skeleton */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                    <Skeleton className="h-10 w-full md:w-96 rounded-xl" />
                    <Skeleton className="h-10 w-32 rounded-xl" />
                </div>

                {/* Content Skeletons (Grid) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                            <Skeleton className="h-56 w-full rounded-none" />
                            <div className="p-8 space-y-6">
                                <Skeleton className="h-7 w-3/4" />
                                <div className="space-y-4 pt-6 border-t border-gray-50 dark:border-gray-700/50">
                                    <div className="flex justify-between items-center">
                                        <Skeleton className="h-2 w-12" />
                                        <Skeleton className="h-4 w-24" />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <Skeleton className="h-2 w-12" />
                                        <Skeleton className="h-4 w-16" />
                                    </div>
                                </div>
                                <Skeleton className="h-14 w-full rounded-2xl mt-2" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-1 bg-indigo-600 rounded-full" />
                        <span className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.2em]">Institutional Progress</span>
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Capacity Building</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium max-w-xl">
                        Monitoring training impact and community empowerment through structured workshop data and photographic evidence.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => fetchData()}
                        className="p-3 rounded-xl bg-white dark:bg-gray-800 text-gray-400 hover:text-indigo-600 shadow-sm border border-gray-100 dark:border-gray-700 transition-all"
                        title="Force Refresh"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <button 
                        onClick={() => setDebugMode(!debugMode)}
                        className={`p-3 rounded-xl transition-all shadow-sm border ${debugMode ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-gray-700'}`}
                        title="Toggle Diagnostic Tools"
                    >
                        <AlertCircle size={18} />
                    </button>
                </div>
            </div>

            {/* Diagnostic Mode Tools */}
            {debugMode && (
                <div className="bg-indigo-900/10 dark:bg-indigo-950/30 p-6 rounded-3xl border border-indigo-200 dark:border-indigo-800 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                            <AlertCircle size={14} />
                            Diagnostic Console
                            {rawSample && (
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-[8px] ${(rawSample['training_details/topic'] || rawSample.training_details?.topic) ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                    {(rawSample['training_details/topic'] || rawSample.training_details?.topic) ? 'Structure Valid' : 'Mapping Warning'}
                                </span>
                            )}
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={() => fetchData()} className="text-[9px] font-black uppercase text-indigo-500 hover:underline">Reload Data</button>
                            <span className="text-indigo-300">·</span>
                            <button onClick={() => setDebugMode(false)} className="text-[9px] font-black uppercase text-rose-500 hover:underline">Close Console</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-gray-500">Active Form ID:</p>
                                <select 
                                    value={formId}
                                    onChange={(e) => fetchData(e.target.value)}
                                    className="w-full bg-white dark:bg-gray-800 border-none rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none shadow-sm"
                                >
                                    {allForms.map(f => (
                                        <option key={f.id} value={f.id}>{f.name} ({f.id})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Schema Verification</p>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-bold text-gray-500">training_details/topic</span>
                                        {rawSample && (rawSample['training_details/topic'] !== undefined || rawSample.training_details?.topic !== undefined) ? (
                                            <span className="text-[9px] font-black text-emerald-500 uppercase">Found ✅</span>
                                        ) : (
                                            <span className="text-[9px] font-black text-rose-500 uppercase">Missing ❌</span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-bold text-gray-500">Image Attachments</span>
                                        <span className="text-[9px] font-black text-indigo-500 tabular-nums">
                                            {rawSample ? Object.keys(rawSample).filter(k => k.toLowerCase().includes('photo') || k.toLowerCase().includes('image') || k.toLowerCase().includes('pic')).length : 0} Detected
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1 pt-2 border-t border-gray-50 dark:border-gray-800">
                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Image Indexing:</span>
                                        <div className="flex flex-wrap gap-1">
                                            {rawSample ? Object.keys(rawSample).filter(k => k.toLowerCase().includes('photo') || k.toLowerCase().includes('image') || k.toLowerCase().includes('pic')).map(k => (
                                                <span key={k} className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded text-[8px] font-mono border border-emerald-100 dark:border-emerald-800/50">
                                                    {k}
                                                </span>
                                            )) : <span className="text-[8px] text-gray-300 italic">No images detected</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-gray-500">Available Data Keys (Sample):</p>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm max-h-[12rem] overflow-y-auto">
                                <div className="flex flex-wrap gap-1">
                                    {rawSample ? Object.keys(rawSample).map(k => (
                                        <span key={k} className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${(k.includes('topic') || k.includes('photo')) ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                                            {k}
                                        </span>
                                    )) : <span className="text-[9px] text-gray-400 italic">No sample data loaded</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {rawSample && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-gray-500">Raw JSON Sample:</p>
                            <pre className="p-4 bg-gray-950 rounded-2xl text-[9px] text-emerald-500 overflow-x-auto font-mono">
                                {JSON.stringify(rawSample, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 p-6 rounded-3xl flex items-center gap-4 text-rose-600">
                    <AlertCircle size={24} />
                    <div className="flex-1">
                        <p className="text-xs font-black uppercase tracking-widest">Connection Error</p>
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                    <button onClick={() => fetchData()} className="px-4 py-2 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Retry</button>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6 group hover:border-indigo-200 transition-all">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Trainings</p>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">{stats.totalTrainings}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6 group hover:border-emerald-200 transition-all">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl text-emerald-600">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Participants</p>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">{stats.totalParticipants}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/40 rounded-2xl text-amber-600">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Project Reports</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">Documentation</p>
                        </div>
                    </div>
                    {isAdmin && (
                        <button 
                            onClick={() => setShowUploadModal(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl shadow-lg transition-all"
                        >
                            <Upload className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Filter & Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        type="text"
                        placeholder="Search trainings or trainers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <div className="flex items-center gap-1 p-1 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                    {(['grid', 'table', 'gallery'] as const).map((mode) => (
                        <button 
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`p-2 rounded-lg transition-all ${viewMode === mode ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                            title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} View`}
                        >
                            {mode === 'grid' && <LayoutGrid className="w-4 h-4" />}
                            {mode === 'table' && <List className="w-4 h-4" />}
                            {mode === 'gallery' && <ImageIcon className="w-4 h-4" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            {data.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 p-16 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 text-center space-y-6">
                    <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto text-gray-300">
                        <FileText className="w-10 h-10" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">No Training Data Found</h3>
                        <p className="text-sm font-medium text-gray-500 max-w-xs mx-auto">
                            Querying ODK Form: <span className="text-indigo-600 font-bold">{formId}</span>
                        </p>
                    </div>

                    {allForms.length > 0 && (
                        <div className="max-w-xs mx-auto space-y-3">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select another form:</p>
                            <select 
                                value={formId}
                                onChange={(e) => fetchData(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                {allForms.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                            <button 
                                onClick={() => fetchData()}
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all"
                            >
                                Retry Connection
                            </button>
                        </div>
                    )}
                </div>
            ) : viewMode === 'gallery' ? (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Photo Documentation</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Images from field training sessions</p>
                        </div>
                        <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-full">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                                {filteredData.filter(d => d.photo).length} photos found
                            </span>
                        </div>
                    </div>
                    <PhotoGallery 
                        images={filteredData
                            .filter(d => d.photo)
                            .map(d => ({
                                url: d.photo,
                                topic: d.topic,
                                participants: d.participants,
                                description: `${new Date(d.date).toLocaleDateString()} · ${d.trainer}`
                            }))
                        } 
                    />
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredData.map((record) => (
                        <div key={record.id} className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all group flex flex-col">
                            <div className="relative h-56 overflow-hidden bg-gray-50 dark:bg-gray-950">
                                {record.photo ? (
                                    <img src={record.photo} alt={record.topic} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                                        <Camera className="w-10 h-10 opacity-20" />
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">No Documentation</span>
                                    </div>
                                )}
                                <div className="absolute top-4 left-4">
                                    <div className="px-3 py-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-lg shadow-sm">
                                        <span className="text-[10px] font-black text-gray-900 dark:text-white tabular-nums">
                                            {record.date ? new Date(record.date).toLocaleDateString() : 'No Date'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-8 flex-grow flex flex-col">
                                <h4 className="text-xl font-black text-gray-900 dark:text-white leading-tight mb-6 group-hover:text-indigo-600 transition-colors line-clamp-2 uppercase tracking-tight">
                                    {record.topic}
                                </h4>
                                <div className="mt-auto space-y-4 pt-6 border-t border-gray-50 dark:border-gray-700/50">
                                    <div className="flex items-center justify-between">
                                        <span className="font-black uppercase text-gray-400 tracking-widest text-[9px]">Trainer</span>
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{record.trainer}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-black uppercase text-gray-400 tracking-widest text-[9px]">Impact</span>
                                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{record.participants} Attended</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedRecord(record)}
                                    className="mt-6 w-full py-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-indigo-600 hover:text-white text-gray-600 dark:text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95"
                                >
                                    Review Details
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b dark:border-gray-700">
                                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Topic</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Trainer</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Participants</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Docs</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {filteredData.map((record) => (
                                    <tr key={record.id} onClick={() => setSelectedRecord(record)} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors cursor-pointer group">
                                        <td className="px-8 py-6 text-xs font-bold text-gray-500 tabular-nums">{record.date ? new Date(record.date).toLocaleDateString() : '-'}</td>
                                        <td className="px-8 py-6 text-sm font-black text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{record.topic}</td>
                                        <td className="px-8 py-6 text-xs font-bold text-gray-500">{record.trainer}</td>
                                        <td className="px-8 py-6 text-right font-black text-indigo-600 tabular-nums">{record.participants}</td>
                                        <td className="px-8 py-6">
                                            <div className="flex justify-center">
                                                {record.photo ? (
                                                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                                                        <img src={record.photo} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <Camera className="w-4 h-4 text-gray-200" />
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {selectedRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300 flex flex-col md:flex-row max-h-[90vh]">
                        <div className="md:w-1/2 h-64 md:h-auto bg-gray-100 dark:bg-gray-950 relative">
                            {selectedRecord.photo ? (
                                <img src={selectedRecord.photo} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-4">
                                    <Camera className="w-16 h-16 opacity-20" />
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No Visual Record Available</p>
                                </div>
                            )}
                            <button onClick={() => setSelectedRecord(null)} className="md:hidden absolute top-4 right-4 p-2 bg-black/40 text-white rounded-full backdrop-blur-md">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="md:w-1/2 p-10 flex flex-col overflow-y-auto">
                            <div className="hidden md:flex justify-end mb-4">
                                <button onClick={() => setSelectedRecord(null)} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="space-y-8">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-4 h-4 rounded-full bg-indigo-600" />
                                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Training Session</span>
                                    </div>
                                    <h3 className="text-3xl font-black text-gray-900 dark:text-white leading-tight uppercase tracking-tight">{selectedRecord.topic}</h3>
                                    <p className="text-sm font-bold text-gray-400 mt-2 italic tabular-nums">Recorded on {new Date(selectedRecord.date).toLocaleDateString('en-IN', { dateStyle: 'full' })}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-8 border-t border-gray-100 dark:border-gray-800 pt-8">
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Lead Trainer</p>
                                        <p className="text-base font-bold text-gray-900 dark:text-white">{selectedRecord.trainer}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Impact Size</p>
                                        <p className="text-base font-black text-emerald-600 tabular-nums">{selectedRecord.participants} Participants</p>
                                    </div>
                                </div>
                                <div className="border-t border-gray-100 dark:border-gray-800 pt-8">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Linked Documents</p>
                                        <button 
                                            onClick={() => {
                                                setUploadingToId(selectedRecord.id);
                                                setShowUploadModal(true);
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
                                        >
                                            <Upload size={10} />
                                            Add Document
                                        </button>
                                    </div>
                                    
                                    {loadingDocs ? (
                                        <div className="flex items-center gap-2 py-4">
                                            <RefreshCw className="w-3 h-3 text-indigo-600 animate-spin" />
                                            <span className="text-[10px] font-bold text-gray-400">Searching Drive...</span>
                                        </div>
                                    ) : linkedDocs.length > 0 ? (
                                        <div className="space-y-2">
                                            {linkedDocs.map(doc => (
                                                <div key={doc.id} className="group relative">
                                                    <button 
                                                        onClick={() => setPreviewUrl(doc.url)}
                                                        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-indigo-200 transition-all text-left"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-white dark:bg-gray-900 rounded-lg shadow-sm">
                                                                <FileText size={14} className="text-gray-400 group-hover:text-indigo-600" />
                                                            </div>
                                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{doc.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[8px] font-black text-indigo-500 uppercase opacity-0 group-hover:opacity-100 transition-opacity">Preview</span>
                                                            <ExternalLink size={12} className="text-gray-300 group-hover:text-indigo-600" />
                                                        </div>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-8 text-center bg-gray-50/50 dark:bg-gray-950/50 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-800">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No Linked Documents</p>
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-gray-100 dark:border-gray-800 pt-8 mt-auto">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Verification</p>
                                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600">
                                        <CheckCircle2 size={12} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Verified ODK Submission</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-[2rem] p-8 shadow-2xl relative">
                        <button onClick={() => setShowUploadModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6"><Upload className="w-8 h-8" /></div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Upload Report</h3>
                            <p className="text-sm font-medium text-gray-500">
                                {uploadingToId ? 'Link a document specifically to this training session.' : 'Upload documents to the project Drive.'}
                            </p>
                            <div className="p-8 border-2 border-dashed border-gray-200 rounded-[2rem] hover:border-indigo-400 transition-colors cursor-pointer group relative">
                                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest group-hover:text-indigo-600">{selectedFile ? selectedFile.name : 'Click to Select'}</p>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => {
                                    setShowUploadModal(false);
                                    setUploadingToId(null);
                                }} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest">Cancel</button>
                                <button className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 disabled:opacity-50" onClick={() => handleUpload(uploadingToId || undefined)} disabled={uploading || !selectedFile}>
                                    {uploading ? 'Uploading...' : 'Upload & Link'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Preview Modal */}
            {previewUrl && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-5xl h-[85vh] rounded-[2.5rem] overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-300 flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
                            <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                <FileText className="text-indigo-600" size={16} />
                                Document Preview
                            </h3>
                            <div className="flex items-center gap-4">
                                <a 
                                    href={previewUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2"
                                >
                                    Open Original <ExternalLink size={12} />
                                </a>
                                <button onClick={() => setPreviewUrl(null)} className="p-2 text-gray-400 hover:text-rose-600 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-gray-50 dark:bg-gray-950 relative overflow-hidden">
                            {previewUrl.includes('drive.google.com') ? (
                                <iframe 
                                    src={previewUrl.replace('/view', '/preview')} 
                                    className="w-full h-full border-none"
                                    title="Document Preview"
                                />
                            ) : previewUrl.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                                <div className="w-full h-full p-8 flex items-center justify-center">
                                    <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-2xl shadow-xl" />
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center space-y-4">
                                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                                        <AlertCircle size={40} />
                                    </div>
                                    <h4 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Cannot Preview Directly</h4>
                                    <p className="text-xs font-medium max-w-xs">
                                        This file type doesn't support in-app previewing. Please use the button above to open it in a new tab.
                                    </p>
                                    <a 
                                        href={previewUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700"
                                    >
                                        Open in New Tab
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CapacityBuildingDashboard;
