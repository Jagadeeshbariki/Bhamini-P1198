
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { 
    GOOGLE_SHEET_CSV_URL, 
    GOOGLE_APPS_SCRIPT_URL, 
    GOOGLE_SHEET_PHOTOS_URL
} from '../config';
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
    activity: string;
    timestamp: string;
}

const AdminPage: React.FC = () => {
    const { user, getAllUsers } = useAuth();
    const [view, setView] = useState<'attendance' | 'media'>('attendance');
    const [allAttendanceData, setAllAttendanceData] = useState<AttendanceRecord[]>([]);
    const [mediaRegistry, setMediaRegistry] = useState<PhotoRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUsername, setSelectedUsername] = useState<string>('');
    const [usersList, setUsersList] = useState<{username: string, role: string}[]>([]);

    // Media Manager State
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [photoDescription, setPhotoDescription] = useState('');
    const [uploadType, setUploadType] = useState<'slider' | 'gallery'>('gallery');
    const [photoActivity, setPhotoActivity] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isDeletingMedia, setIsDeletingMedia] = useState<string | null>(null);
    const [uploadStatus, setUploadStatus] = useState<{success: boolean, message: string} | null>(null);

    const activityContextOptions = [
        'Irrigation', 'Mobile Irrigation', 'Eco-farm pond', 'BRC', 'CHC',
        'Enterprise & IB', 'Desi BYP', 'Goatery', 'Processing Hubs',
        'Fisheries', 'Crop Diversity', 'CB_Event', 'CB_Training', 'Admin'
    ];

    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toLocaleString('default', { month: 'short' }));
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const months = useMemo(() => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], []);
    const years = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
    }, []);
    const calendarDate = useMemo(() => new Date(parseInt(selectedYear), months.indexOf(selectedMonth), 1), [selectedMonth, selectedYear, months]);
    const calendarDays = useMemo(() => generateCalendarDays(calendarDate), [calendarDate]);

    const normalizeDate = (d: string) => {
        if (!d) return '';
        const parts = d.trim().split('/');
        if (parts.length !== 3) return d;
        return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
    };

    const getDirectDriveUrl = (url: string) => {
        if (!url) return '';
        const trimmed = url.trim();
        if (trimmed.includes('drive.google.com') || trimmed.includes('google.com/open')) {
            const idMatch = trimmed.match(/(?:id=|\/d\/|folders\/|file\/d\/|open\?id=)([-\w]{25,})/);
            const id = idMatch ? idMatch[1] : '';
            return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1600` : trimmed;
        }
        return trimmed;
    };

    const parseCSVToObjects = (csv: string): Record<string, string>[] => {
        if (!csv) return [];
        const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
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
        const headers = parseLine(lines[0]).map(h => h.toUpperCase().replace(/\s+/g, ''));
        return lines.slice(1).map(line => {
            const vals = parseLine(line);
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => { if (h) obj[h] = vals[i] || ''; });
            return obj;
        });
    };

    const getFuzzy = (row: Record<string, string>, keywords: string[]) => {
        const keys = Object.keys(row);
        for (const keyword of keywords) {
            const match = keys.find(k => k.includes(keyword.toUpperCase()));
            if (match && row[match]) return row[match];
        }
        return '';
    };

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [attRes, mediaRes, userRes] = await Promise.all([
                fetch(`${GOOGLE_SHEET_CSV_URL}&_=${Date.now()}`),
                fetch(`${GOOGLE_SHEET_PHOTOS_URL}&_=${Date.now()}`),
                getAllUsers()
            ]);

            const attCsv = await attRes.text();
            setAllAttendanceData(parseCSVToObjects(attCsv).map(row => ({
                timestamp: getFuzzy(row, ['TIMESTAMP']),
                name: (getFuzzy(row, ['NAME', 'PERSON', 'SELECTYOURNAME']) || '').trim(),
                date: normalizeDate(getFuzzy(row, ['DATE', 'CHOOSEDATE'])),
                workingStatus: getFuzzy(row, ['STATUS', 'WORKING', 'WORKING/LEAVE/HOLIDAY']),
                reasonNotWorking: getFuzzy(row, ['REASON', 'WRITETHEREASONFORNOTWORKING']),
                placeOfVisit: getFuzzy(row, ['PLACE', 'VILLAGE', 'PLACEOFVISIT']),
                purposeOfVisit: getFuzzy(row, ['PURPOSE', 'ACTIVITY', 'PURPOSEOFVISIT']),
                workingHours: getFuzzy(row, ['HOURS', 'WORKINGHOURS']),
                outcomes: getFuzzy(row, ['OUTCOME'])
            })));

            const mediaCsv = await mediaRes.text();
            setMediaRegistry(parseCSVToObjects(mediaCsv).map(row => {
                // The CSV headers are URL, CATEGORY, DESCRIPTION, TIMESTAMP, ACTIVITY, PHOTOUPLOADEDBY
                return {
                    url: getFuzzy(row, ['URL', 'LINK', 'IMAGE', 'PHOTO']),
                    type: (getFuzzy(row, ['CATEGORY', 'TYPE', 'CAT', 'PLACEMENT']) || 'gallery').toLowerCase(),
                    description: getFuzzy(row, ['DESCRIPTION', 'DESC', 'CAPTION']),
                    activity: (getFuzzy(row, ['ACTIVITY', 'ACT', 'WORK']) || 'Uncategorized').trim().replace(/^(BYP-|BFE-|AFT-)/, ''),
                    timestamp: getFuzzy(row, ['TIMESTAMP'])
                };
            }).filter(r => r.url).reverse());

            setUsersList(userRes);
            if (userRes.length > 0 && !selectedUsername) setSelectedUsername(userRes[0].username);
        } catch (err) {
            console.error('Admin sync error:', err);
        } finally {
            setLoading(false);
        }
    }, [getAllUsers, selectedUsername]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredWorkLog = useMemo(() => {
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

    const attendanceStats = useMemo(() => {
        return filteredWorkLog.reduce((acc, r) => {
            const status = (r.workingStatus || '').toLowerCase();
            if (status.includes('working')) acc.working++;
            else if (status.includes('leave')) acc.leave++;
            else if (status.includes('holiday')) acc.holiday++;
            acc.total++;
            return acc;
        }, { total: 0, working: 0, leave: 0, holiday: 0 });
    }, [filteredWorkLog]);

    const handleUploadMedia = async () => {
        if (selectedFiles.length === 0 || !photoActivity) {
            setUploadStatus({ success: false, message: 'Missing files or activity context' });
            return;
        }
        setIsUploading(true);
        setUploadStatus(null);
        
        let successCount = 0;
        let errorCount = 0;

        let lastErrorMessage = '';

        try {
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                const preview = previewUrls[i];
                const base64Data = preview.split(',')[1];
                
                const payload = {
                    action: "addPhoto",
                    fileName: file.name,
                    mimeType: file.type,
                    type: uploadType,
                    description: photoDescription || 'Field Entry',
                    activity: photoActivity,
                    data: base64Data
                };

                const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify(payload)
                });

                const raw = await response.text();
                try {
                    const data = JSON.parse(raw);
                    if (data.status === 'success') {
                        successCount++;
                    } else {
                        errorCount++;
                        lastErrorMessage = data.message || 'Unknown error from script';
                    }
                } catch {
                    errorCount++;
                    lastErrorMessage = 'Invalid JSON response from script. Check if the script is deployed as "Anyone".';
                }
            }

            if (successCount > 0) {
                setUploadStatus({ 
                    success: true, 
                    message: `Successfully uploaded ${successCount} image(s).${errorCount > 0 ? ` ${errorCount} failed.` : ''}` 
                });
                setSelectedFiles([]);
                setPreviewUrls([]);
                setPhotoDescription('');
                setPhotoActivity('');
                fetchData();
            } else {
                setUploadStatus({ success: false, message: `All uploads failed. Script Error: ${lastErrorMessage}` });
            }
        } catch (err) {
            setUploadStatus({ success: false, message: `Connection error: ${err instanceof Error ? err.message : 'Unknown error'}` });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteMedia = async (imageUrl: string) => {
        if (!window.confirm('Permanently remove this documentation from the registry?')) return;
        setIsDeletingMedia(imageUrl);
        try {
            const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'deletePhoto', url: imageUrl })
            });
            const raw = await response.text();
            let data;
            try {
                data = JSON.parse(raw);
            } catch {
                throw new Error('Invalid server response: ' + raw.substring(0, 100));
            }

            if (data.status === 'success') {
                setMediaRegistry(prev => prev.filter(item => item.url !== imageUrl));
            } else {
                alert('Deletion failed: ' + (data.message || 'Unknown error'));
            }
        } catch (err) {
            alert('Error while deleting: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setIsDeletingMedia(null);
        }
    };

    if (user?.role !== 'admin' && user?.role !== 'da' && user?.role !== 'field') return <div className="p-10 text-center font-black text-red-500 uppercase">Access Denied</div>;
    if (loading) return <div className="p-20 text-center font-black text-indigo-400 uppercase animate-pulse">Syncing...</div>;

    return (
        <div className="space-y-8 max-w-7xl mx-auto px-4 md:px-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase">Admin Console</h1>
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">Project Management Hub</p>
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl shadow-inner border border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar">
                    {['attendance', 'media'].filter(t => user?.role !== 'field' || t === 'attendance').map((t) => (
                        <button key={t} onClick={() => setView(t as any)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${view === t ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-400'}`}>
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {view === 'attendance' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex flex-wrap justify-between items-center gap-6 mb-8">
                            <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase">Personnel Attendance Sync</h2>
                            <div className="flex flex-wrap gap-4">
                                <select value={selectedUsername} onChange={e => setSelectedUsername(e.target.value)} className="bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-xl text-xs font-bold border-none ring-1 ring-gray-100">
                                    {usersList.map((u, idx) => <option key={`${u.username}-${idx}`} value={u.username}>{u.username} ({u.role})</option>)}
                                </select>
                                <div className="flex gap-2">
                                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-xl text-xs font-bold">
                                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-xl text-xs font-bold">
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 gap-2 mb-6">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="text-center text-[10px] font-black text-gray-400 uppercase py-2">{d}</div>)}
                            {calendarDays.map((day, i) => {
                                const dateKey = `${day.getDate().toString().padStart(2, '0')}/${(day.getMonth() + 1).toString().padStart(2, '0')}/${day.getFullYear()}`;
                                const records = allAttendanceData.filter(r => r.name.toLowerCase() === selectedUsername.toLowerCase() && r.date === dateKey);
                                const record = records.length > 0 ? records[records.length - 1] : null;
                                const isCurrentMonth = day.getMonth() === months.indexOf(selectedMonth);
                                const statusColor = record ? (record.workingStatus === 'Working' ? 'bg-emerald-500 border-emerald-600 text-white shadow-lg' : 'bg-red-500 border-red-600 text-white shadow-lg') : (day.getDay() === 0 && isCurrentMonth ? 'bg-red-50 dark:bg-red-900/10 border-red-100 text-red-300' : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-300');
                                return (
                                    <div key={`${dateKey}-${i}`} className={`h-24 p-2 rounded-3xl border-2 flex flex-col justify-between transition-all ${!isCurrentMonth ? 'opacity-20 pointer-events-none' : statusColor}`}>
                                        <span className="text-sm font-black">{day.getDate()}</span>
                                        {record && <span className="text-[8px] font-black uppercase truncate leading-none">{record.workingStatus === 'Working' ? record.placeOfVisit : record.workingStatus}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Attendance Summary Section */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Total Records</p>
                            <p className="text-2xl font-black text-gray-900 dark:text-white">{attendanceStats.total}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Working Days</p>
                            <p className="text-2xl font-black text-emerald-600">{attendanceStats.working}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Leave Days</p>
                            <p className="text-2xl font-black text-red-500">{attendanceStats.leave}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Holidays</p>
                            <p className="text-2xl font-black text-amber-500">{attendanceStats.holiday}</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase mb-8">Work Record Ledger</h2>
                        <div className="space-y-4">
                            {filteredWorkLog.map((r, idx) => (
                                <div key={`${r.date}-${idx}`} className="p-6 bg-gray-50 dark:bg-gray-900 rounded-3xl border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded-lg">{r.date}</span>
                                            <span className="text-xs font-black uppercase text-gray-800 dark:text-white">{r.workingStatus === 'Working' ? r.placeOfVisit : r.workingStatus}</span>
                                        </div>
                                        <p className="text-xs font-bold text-gray-500 italic mt-1">{r.workingStatus === 'Working' ? r.purposeOfVisit : r.reasonNotWorking}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right"><p className="text-[9px] font-black text-gray-400 uppercase">Hours</p><p className="text-sm font-black text-indigo-600">{r.workingHours || '0'}</p></div>
                                        <div className="h-8 w-px bg-gray-200"></div>
                                        <div className="max-w-[300px]"><p className="text-[9px] font-black text-gray-400 uppercase">Outcome</p><p className="text-[10px] text-gray-600 dark:text-gray-400 line-clamp-1 italic">{r.outcomes || '---'}</p></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {view === 'media' && user?.role !== 'field' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100">
                        <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase mb-8">Publish Documentation</h2>
                        <div className="space-y-6">
                            <select value={uploadType} onChange={e => setUploadType(e.target.value as any)} className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl font-black text-xs uppercase border-none ring-1 ring-gray-100">
                                <option value="gallery">Field Activity Gallery</option>
                                <option value="slider">Hero Highlights Slider</option>
                            </select>
                            <input 
                                type="file" 
                                accept="image/*" 
                                multiple 
                                onChange={e => {
                                    const files = Array.from(e.target.files || []).slice(0, 5);
                                    if (files.length > 0) {
                                        setSelectedFiles(files);
                                        const newPreviews: string[] = [];
                                        let loadedCount = 0;
                                        
                                        files.forEach((file, index) => {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                                newPreviews[index] = reader.result as string;
                                                loadedCount++;
                                                if (loadedCount === files.length) {
                                                    setPreviewUrls(newPreviews);
                                                }
                                            };
                                            reader.readAsDataURL(file);
                                        });
                                    }
                                }} 
                                className="text-xs w-full" 
                            />
                            {previewUrls.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {previewUrls.map((url, idx) => (
                                        <div key={idx} className="relative aspect-video rounded-2xl overflow-hidden border-2 border-white shadow-md">
                                            <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            <div className="absolute top-1 right-1 bg-black/50 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black">
                                                {idx + 1}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <select value={photoActivity} onChange={e => setPhotoActivity(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl font-bold text-sm">
                                <option value="">Select Activity...</option>
                                {activityContextOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            <textarea value={photoDescription} onChange={e => setPhotoDescription(e.target.value)} rows={3} placeholder="Description..." className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl font-bold text-sm" />
                            <button onClick={handleUploadMedia} disabled={isUploading || selectedFiles.length === 0 || !photoActivity} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl disabled:opacity-50">
                                {isUploading ? `Publishing (${selectedFiles.length})...` : "Commit to Registry"}
                            </button>
                            {uploadStatus && <p className={`text-center text-[10px] font-black uppercase mt-2 ${uploadStatus.success ? 'text-emerald-500' : 'text-red-500'}`}>{uploadStatus.message}</p>}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl overflow-hidden">
                        <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase mb-8">Media Log</h2>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            {mediaRegistry.map((item, idx) => (
                                <div key={`${item.url}-${idx}`} className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-3xl border border-transparent hover:border-indigo-100 transition-all relative group">
                                    <img src={getDirectDriveUrl(item.url)} className="w-20 h-20 rounded-2xl object-cover flex-shrink-0" referrerPolicy="no-referrer" />
                                    <div className="flex-grow min-w-0">
                                        <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase ${item.type === 'slider' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>{item.type}</span>
                                        <p className="text-[11px] font-black text-gray-800 dark:text-white truncate mt-1">{item.activity}</p>
                                        <p className="text-[10px] text-gray-400 line-clamp-2 italic leading-tight mt-1">{item.description}</p>
                                    </div>
                                    {user?.role === 'admin' && (
                                        <button 
                                            onClick={() => handleDeleteMedia(item.url)}
                                            disabled={isDeletingMedia === item.url}
                                            className="absolute top-4 right-4 p-2 bg-red-50 text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white disabled:opacity-50"
                                            title="Delete Image"
                                        >
                                            {isDeletingMedia === item.url ? (
                                                <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                            )}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default AdminPage;
