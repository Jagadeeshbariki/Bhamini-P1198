
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { GOOGLE_SHEET_CSV_URL, GOOGLE_APPS_SCRIPT_URL, GOOGLE_SHEET_PHOTOS_URL, MIS_TARGETS_URL } from '../config';
import { generateCalendarDays } from '../utils/calendar';

interface AttendanceRecord {
    timestamp: string;
    name: string;
    date: string;
    workingStatus: string;
    reasonNotWorking: string;
    placeOfVisit: string;
    purposeOfVisit: string;
    workingHours: string;
    outcomes: string;
}

interface PhotoRecord {
    url: string;
    type: string;
    description: string;
    timestamp: string;
}

interface MISTarget {
    id: string;
    name: string;
    uom: string;
}

const AdminPage: React.FC = () => {
    const { user, getAllUsers } = useAuth();
    const [view, setView] = useState<'attendance' | 'media' | 'mis'>('attendance');
    const [allAttendanceData, setAllAttendanceData] = useState<AttendanceRecord[]>([]);
    const [mediaRegistry, setMediaRegistry] = useState<PhotoRecord[]>([]);
    const [misTargets, setMisTargets] = useState<MISTarget[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUsername, setSelectedUsername] = useState<string>('');
    const [usersList, setUsersList] = useState<{username: string}[]>([]);

    // MIS Manager State
    const [selectedActivityId, setSelectedActivityId] = useState('');
    const [achievementValue, setAchievementValue] = useState('');
    const [achievementGP, setAchievementGP] = useState('');
    const [achievementRemarks, setAchievementRemarks] = useState('');
    const [isSubmittingMIS, setIsSubmittingMIS] = useState(false);
    const [misStatus, setMisStatus] = useState<{success: boolean, message: string} | null>(null);

    // Media Manager State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [photoDescription, setPhotoDescription] = useState('');
    const [uploadType, setUploadType] = useState<'slider' | 'gallery'>('gallery');
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [uploadStatus, setUploadStatus] = useState<{success: boolean, message: string} | null>(null);
    const [isZoomOpen, setIsZoomOpen] = useState(false);

    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toLocaleString('default', { month: 'short' }));
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

    const months = useMemo(() => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], []);
    const years = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
    }, []);

    const calendarDate = useMemo(() => {
        return new Date(parseInt(selectedYear), months.indexOf(selectedMonth), 1);
    }, [selectedMonth, selectedYear, months]);

    const calendarDays = useMemo(() => generateCalendarDays(calendarDate), [calendarDate]);

    const loadUsers = useCallback(async () => {
        const list = await getAllUsers();
        setUsersList(list);
        if (list.length > 0 && !selectedUsername) {
            setSelectedUsername(list[0].username);
        }
    }, [getAllUsers, selectedUsername]);

    const parseCSVToObjects = (csv: string): Record<string, string>[] => {
        const lines = csv.trim().split(/\r\n|\n/);
        if (lines.length < 1) return [];
        
        const parseLine = (line: string): string[] => {
            const values = [];
            let inQuote = false, val = '';
            for (let j = 0; j < line.length; j++) {
                if (line[j] === '"') inQuote = !inQuote;
                else if (line[j] === ',' && !inQuote) { values.push(val.trim()); val = ''; }
                else val += line[j];
            }
            values.push(val.trim().replace(/^"|"$/g, ''));
            return values;
        };

        const rawHeaders = parseLine(lines[0]);
        const cleanHeaders = rawHeaders.map(h => h.toUpperCase().replace(/\s+/g, ''));

        return lines.slice(1).filter(l => l.trim()).map(line => {
            const vals = parseLine(line);
            const obj: Record<string, string> = {};
            cleanHeaders.forEach((h, i) => {
                if (h) obj[h] = vals[i] || '';
            });
            return obj;
        });
    };

    const getFuzzy = (row: Record<string, string>, keywords: string[]) => {
        const keys = Object.keys(row);
        for (const keyword of keywords) {
            const match = keys.find(k => k.includes(keyword));
            if (match && row[match]) return row[match];
        }
        return '';
    };

    const fetchAttendanceData = useCallback(async () => {
        try {
            const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&_=${Date.now()}`);
            if (!response.ok) return;
            const csvText = await response.text();
            const parsed = parseCSVToObjects(csvText);
            
            const mapped: AttendanceRecord[] = parsed.map(row => ({
                timestamp: getFuzzy(row, ['TIMESTAMP']) || '',
                name: (getFuzzy(row, ['NAME', 'PERSON']) || '').trim(),
                date: getFuzzy(row, ['DATE']) || '',
                workingStatus: getFuzzy(row, ['STATUS', 'WORKING']) || '',
                reasonNotWorking: getFuzzy(row, ['REASON']) || '',
                placeOfVisit: getFuzzy(row, ['PLACE', 'VILLAGE']) || '',
                purposeOfVisit: getFuzzy(row, ['PURPOSE', 'ACTIVITY']) || '',
                workingHours: getFuzzy(row, ['HOURS']) || '0',
                outcomes: getFuzzy(row, ['OUTCOME']) || '',
            }));
            setAllAttendanceData(mapped);
        } catch (err) {
            console.error('Attendance sync error:', err);
        }
    }, []);

    const fetchMediaRegistry = useCallback(async () => {
        try {
            const response = await fetch(`${GOOGLE_SHEET_PHOTOS_URL}&_=${Date.now()}`);
            if (!response.ok) return;
            const csvText = await response.text();
            const parsed = parseCSVToObjects(csvText);
            
            const mapped: PhotoRecord[] = parsed.map(row => ({
                url: getFuzzy(row, ['URL', 'LINK', 'DRIVE', 'IMAGE', 'PHOTO']) || '',
                type: (getFuzzy(row, ['TYPE', 'CAT', 'SEC', 'PLACEMENT']) || 'gallery').toLowerCase(),
                description: getFuzzy(row, ['DESC', 'CAPTION', 'NOTE']) || '',
                timestamp: getFuzzy(row, ['TIMESTAMP']) || '',
            })).filter(r => r.url);
            
            setMediaRegistry(mapped.reverse());
        } catch (err) {
            console.error('Media sync error:', err);
        }
    }, []);

    const fetchMISTargets = useCallback(async () => {
        try {
            const response = await fetch(`${MIS_TARGETS_URL}&_=${Date.now()}`);
            if (!response.ok) return;
            const csvText = await response.text();
            const parsed = parseCSVToObjects(csvText);
            const mapped: MISTarget[] = parsed.map(row => ({
                id: row['ID'] || '',
                name: row['NAME'] || '',
                uom: row['UOM'] || ''
            })).filter(t => t.id);
            setMisTargets(mapped);
            if (mapped.length > 0) setSelectedActivityId(mapped[0].id);
        } catch (err) {
            console.error('MIS Targets sync error:', err);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        await Promise.all([fetchAttendanceData(), fetchMediaRegistry(), fetchMISTargets(), loadUsers()]);
        setLoading(false);
    }, [fetchAttendanceData, fetchMediaRegistry, fetchMISTargets, loadUsers]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert("File too large. Max 5MB.");
                return;
            }
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setPreviewUrl(reader.result as string);
            reader.readAsDataURL(file);
            setUploadStatus(null);
        }
    };

    const handleUploadMedia = async () => {
        if (!selectedFile || !previewUrl) return;
        setIsUploading(true);
        setUploadStatus(null);
        try {
            const base64Data = previewUrl.split(',')[1];
            const payload = {
                "action": "addPhoto",
                "fileName": selectedFile.name,
                "mimeType": selectedFile.type,
                "type": uploadType,
                "description": photoDescription,
                "data": base64Data
            };
            const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result?.status === 'success' || result?.result === 'success') {
                setUploadStatus({ success: true, message: 'Published successfully!' });
                setSelectedFile(null);
                setPreviewUrl(null);
                setPhotoDescription('');
                await fetchMediaRegistry();
            } else {
                throw new Error(result?.message || 'Upload failed');
            }
        } catch (err: any) {
            setUploadStatus({ success: false, message: err.message });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeletePhoto = async (url: string) => {
        if (!window.confirm("Remove this photo from the Registry and Google Drive permanently?")) return;
        setIsDeleting(url);
        try {
            const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'deletePhoto', url })
            });
            
            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                if (responseText.toLowerCase().includes("success")) {
                    result = { status: 'success' };
                } else {
                    throw new Error("Invalid server response");
                }
            }

            if (result.status === 'success' || result.result === 'success') {
                setMediaRegistry(prev => prev.filter(p => p.url !== url));
                await fetchMediaRegistry();
            } else {
                alert("Delete failed: " + (result.message || "Unknown error"));
            }
        } catch (err: any) {
            console.error('Delete error:', err);
            alert("Delete failed. Check your internet or Apps Script deployment.");
        } finally {
            setIsDeleting(null);
        }
    };

    const handleAchievementSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedActivityId || !achievementValue) return;
        
        setIsSubmittingMIS(true);
        setMisStatus(null);
        
        try {
            const payload = {
                action: "addAchievement",
                id: selectedActivityId,
                value: achievementValue,
                gp: achievementGP,
                remarks: achievementRemarks,
                timestamp: new Date().toISOString()
            };

            const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setMisStatus({ success: true, message: "Achievement logged successfully!" });
                setAchievementValue('');
                setAchievementGP('');
                setAchievementRemarks('');
            } else {
                throw new Error("Submission failed");
            }
        } catch (err: any) {
            setMisStatus({ success: false, message: err.message });
        } finally {
            setIsSubmittingMIS(false);
        }
    };

    const filteredRecords = useMemo(() => {
        if (!selectedUsername) return [];
        const monthIdx = months.indexOf(selectedMonth);
        const yearNum = parseInt(selectedYear);
        const start = new Date(yearNum, monthIdx - 1, 26, 0, 0, 0).getTime();
        const end = new Date(yearNum, monthIdx, 25, 23, 59, 59).getTime();

        return allAttendanceData.filter(r => {
            if (r.name.toLowerCase() !== selectedUsername.toLowerCase()) return false;
            const p = r.date.split('/');
            if (p.length !== 3) return false;
            const rd = new Date(+p[2], +p[1]-1, +p[0]).getTime();
            return rd >= start && rd <= end;
        }).sort((a, b) => {
            const pa = a.date.split('/'), pb = b.date.split('/');
            return new Date(+pa[2], +pa[1]-1, +pa[0]).getTime() - new Date(+pb[2], +pb[1]-1, +pb[0]).getTime();
        });
    }, [allAttendanceData, selectedUsername, selectedMonth, selectedYear, months]);

    const markedRecordsMap = useMemo(() => {
        const map = new Map<string, AttendanceRecord>();
        filteredRecords.forEach(r => {
            const p = r.date.split('/');
            if (p.length === 3) {
                const key = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                map.set(key, r);
            }
        });
        return map;
    }, [filteredRecords]);

    if (!user?.isAdmin) return <div className="p-8 text-center font-bold text-red-500 uppercase tracking-widest text-sm">Unauthorized Access</div>;

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Authorizing Console...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 dark:text-white">Admin Console</h1>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">Management & Oversight</p>
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shadow-inner border border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setView('attendance')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${view === 'attendance' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Attendance
                    </button>
                    <button 
                        onClick={() => setView('mis')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${view === 'mis' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        MIS Manager
                    </button>
                    <button 
                        onClick={() => setView('media')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${view === 'media' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Media Manager
                    </button>
                </div>
            </div>

            {view === 'attendance' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 px-1">Staff Member</label>
                            <select 
                                value={selectedUsername} 
                                onChange={e => setSelectedUsername(e.target.value)}
                                className="bg-white dark:bg-gray-800 p-3 rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 font-bold shadow-sm focus:ring-blue-500 transition-all"
                            >
                                {usersList.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 px-1">Month</label>
                            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-white dark:bg-gray-800 p-3 rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 font-bold shadow-sm">
                                {months.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 px-1">Year</label>
                            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-white dark:bg-gray-800 p-3 rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 font-bold shadow-sm">
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl">
                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                <div key={i} className={`text-center font-black text-[10px] py-1 uppercase ${i === 0 ? 'text-red-500' : 'text-gray-400'}`}>{d}</div>
                            ))}
                            {calendarDays.map((day, i) => {
                                const isCurrentMonth = day.getMonth() === calendarDate.getMonth();
                                const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                                const record = markedRecordsMap.get(dayKey);
                                const isSunday = day.getDay() === 0;

                                let bgColor = 'bg-gray-50 dark:bg-gray-900/40 text-gray-300';
                                let borderColor = 'border-transparent';
                                let textColor = 'text-gray-400';

                                if (isCurrentMonth) {
                                    if (record) {
                                        if (record.workingStatus === 'Working') {
                                            bgColor = 'bg-green-500';
                                            textColor = 'text-white';
                                        } else {
                                            bgColor = 'bg-red-500';
                                            textColor = 'text-white';
                                        }
                                    } else if (isSunday) {
                                        bgColor = 'bg-red-100 dark:bg-red-900/20';
                                        textColor = 'text-red-500';
                                    } else {
                                        bgColor = 'bg-white dark:bg-gray-800';
                                        borderColor = 'border-gray-100 dark:border-gray-700';
                                        textColor = 'text-gray-700 dark:text-gray-200';
                                    }
                                } else {
                                    textColor = 'text-gray-200 dark:text-gray-700';
                                }

                                return (
                                    <div
                                        key={i}
                                        className={`h-12 sm:h-14 rounded-xl border flex flex-col items-center justify-center transition-all ${bgColor} ${borderColor} ${textColor}`}
                                    >
                                        <span className={`text-sm font-black ${!isCurrentMonth ? 'opacity-20' : ''}`}>{day.getDate()}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase text-gray-400">Date</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase text-gray-400">Status</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase text-gray-400">Location</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase text-gray-400 text-right">Hrs</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                {filteredRecords.length > 0 ? filteredRecords.map((r, i) => (
                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                        <td className="px-4 py-4 text-sm font-bold">{r.date}</td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${r.workingStatus === 'Working' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {r.workingStatus}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-sm font-bold truncate max-w-[150px]">
                                            {r.placeOfVisit || '-'}
                                        </td>
                                        <td className="px-4 py-4 text-sm font-black text-right text-blue-600">{r.workingHours}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-10 text-center text-gray-400 italic text-sm">No records found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {view === 'mis' && (
                <div className="max-w-4xl mx-auto animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055zM20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/></svg>
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Achievement Logger</h2>
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Submit Field Performance Data</p>
                            </div>
                        </div>

                        <form onSubmit={handleAchievementSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 px-1">Activity Code (ID)</label>
                                    <select 
                                        value={selectedActivityId}
                                        onChange={e => setSelectedActivityId(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-bold focus:ring-2 focus:ring-indigo-600 transition-all text-sm"
                                        required
                                    >
                                        {misTargets.map(t => (
                                            <option key={t.id} value={t.id}>{t.id} - {t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 px-1">Value (Actual Achieved)</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={achievementValue}
                                            onChange={e => setAchievementValue(e.target.value)}
                                            placeholder="Enter numeric value"
                                            className="w-full bg-gray-50 dark:bg-gray-900 p-4 pr-12 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-bold focus:ring-2 focus:ring-indigo-600 transition-all text-sm"
                                            required
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-400 uppercase">
                                            {misTargets.find(t => t.id === selectedActivityId)?.uom || 'units'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 px-1">Village / GP Name</label>
                                <input 
                                    type="text" 
                                    value={achievementGP}
                                    onChange={e => setAchievementGP(e.target.value)}
                                    placeholder="Where was this achieved?"
                                    className="w-full bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-bold focus:ring-2 focus:ring-indigo-600 transition-all text-sm"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 px-1">Submission Remarks</label>
                                <textarea 
                                    value={achievementRemarks}
                                    onChange={e => setAchievementRemarks(e.target.value)}
                                    placeholder="Add context or notes for this update..."
                                    rows={3}
                                    className="w-full bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-bold focus:ring-2 focus:ring-indigo-600 transition-all text-sm resize-none"
                                />
                            </div>

                            <button 
                                type="submit"
                                disabled={isSubmittingMIS}
                                className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4"
                            >
                                {isSubmittingMIS ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Logging Progress...</span>
                                    </div>
                                ) : "Push Achievement to Master Sheet"}
                            </button>

                            {misStatus && (
                                <div className={`p-4 rounded-2xl text-center text-xs font-bold animate-pulse ${misStatus.success ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                    {misStatus.message}
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {view === 'media' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start animate-fade-in">
                    {/* Publication Form */}
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                            <h2 className="text-xl font-black text-gray-800 dark:text-white">New Publication</h2>
                        </div>
                        <div className="space-y-6">
                            <div className="group relative">
                                <label className="block text-xs font-black uppercase text-gray-400 mb-2">Select Image</label>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handleFileChange} 
                                    className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" 
                                />
                            </div>
                            
                            {previewUrl && (
                                <div className="relative animate-scale-up">
                                    <div className="relative aspect-video rounded-3xl overflow-hidden border-[6px] border-gray-100 dark:border-gray-700 shadow-2xl group/preview">
                                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover transition-transform duration-700 group-hover/preview:scale-105" />
                                        
                                        {/* Overlays */}
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                            <button 
                                                onClick={() => setIsZoomOpen(true)}
                                                className="p-4 bg-white/20 backdrop-blur-xl border border-white/30 text-white rounded-full hover:bg-white/40 transition-all transform hover:scale-110"
                                                title="Zoom Image"
                                            >
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg>
                                            </button>
                                            <button 
                                                onClick={() => { setPreviewUrl(null); setSelectedFile(null); }}
                                                className="p-4 bg-red-500/20 backdrop-blur-xl border border-red-500/30 text-red-100 rounded-full hover:bg-red-500/40 transition-all transform hover:scale-110"
                                                title="Remove Image"
                                            >
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="absolute -bottom-3 -right-3 bg-blue-600 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-lg">
                                        Ready for Publish
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4 pt-4">
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-400 mb-2">Placement</label>
                                    <select 
                                        value={uploadType} 
                                        onChange={e => setUploadType(e.target.value as 'slider' | 'gallery')} 
                                        className="w-full p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl font-bold border-none ring-1 ring-gray-200 dark:ring-gray-600 focus:ring-2 focus:ring-blue-500 transition-all"
                                    >
                                        <option value="gallery">Standard Gallery</option>
                                        <option value="slider">Premium Slider (Highlight)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-400 mb-2">Public Caption</label>
                                    <textarea 
                                        rows={3}
                                        value={photoDescription} 
                                        onChange={e => setPhotoDescription(e.target.value)} 
                                        placeholder="Enter a meaningful caption..." 
                                        className="w-full p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl font-bold border-none ring-1 ring-gray-200 dark:ring-gray-600 focus:ring-2 focus:ring-blue-500 resize-none transition-all" 
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={handleUploadMedia}
                                disabled={isUploading || !selectedFile}
                                className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4"
                            >
                                {isUploading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Syncing...</span>
                                    </div>
                                ) : "Publish to Registry"}
                            </button>
                            {uploadStatus && (
                                <p className={`text-center text-xs font-bold ${uploadStatus.success ? 'text-green-500' : 'text-red-500'} animate-pulse`}>
                                    {uploadStatus.message}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Media Registry List */}
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-6 bg-purple-600 rounded-full"></div>
                                <h2 className="text-xl font-black text-gray-800 dark:text-white">Live Registry</h2>
                            </div>
                            <button onClick={fetchMediaRegistry} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                            </button>
                        </div>

                        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
                            {mediaRegistry.length > 0 ? mediaRegistry.map((item, idx) => (
                                <div key={idx} className="flex gap-4 p-3 rounded-2xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 group hover:shadow-md transition-all">
                                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 border-white dark:border-gray-600 shadow-sm relative">
                                        <img src={item.url} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-grow min-w-0 flex flex-col justify-center">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase ${item.type === 'slider' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {item.type}
                                            </span>
                                        </div>
                                        <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 line-clamp-2 leading-tight">
                                            {item.description || "No caption."}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => handleDeletePhoto(item.url)}
                                        disabled={isDeleting === item.url}
                                        className="self-center p-3 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all disabled:opacity-30"
                                    >
                                        {isDeleting === item.url ? (
                                            <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                        )}
                                    </button>
                                </div>
                            )) : (
                                <div className="text-center py-10">
                                    <p className="text-gray-400 italic text-sm">No photos found in Registry.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox / Zoom Modal for Preview */}
            {isZoomOpen && previewUrl && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 sm:p-10 animate-fade-in" onClick={() => setIsZoomOpen(false)}>
                    <div className="relative max-w-6xl w-full h-full flex flex-col items-center justify-center gap-6" onClick={e => e.stopPropagation()}>
                        {/* Close Button - Positioned top-20 to clear site header */}
                        <button 
                            onClick={() => setIsZoomOpen(false)}
                            className="absolute top-20 right-0 p-4 bg-white/10 backdrop-blur-md text-white hover:text-gray-300 rounded-full border border-white/20 transition-all z-20"
                            title="Close Preview"
                        >
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                        
                        <div className="w-full h-full flex items-center justify-center">
                            <img 
                                src={previewUrl} 
                                alt="Zoomed Preview" 
                                className="max-w-full max-h-full object-contain rounded-xl shadow-[0_0_100px_rgba(37,99,235,0.2)] animate-scale-up-long" 
                            />
                        </div>
                        
                        <div className="bg-white/10 backdrop-blur-md px-8 py-4 rounded-3xl border border-white/20 text-center">
                            <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.3em]">Full Resolution Inspection</p>
                            <p className="text-white text-lg font-bold mt-1">{selectedFile?.name}</p>
                        </div>
                    </div>
                </div>
            )}
            
            <style>{`
                @keyframes scale-up {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes scale-up-long {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-scale-up {
                    animation: scale-up 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards;
                }
                .animate-scale-up-long {
                    animation: scale-up-long 0.7s cubic-bezier(0.19, 1, 0.22, 1) forwards;
                }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
};

export default AdminPage;
