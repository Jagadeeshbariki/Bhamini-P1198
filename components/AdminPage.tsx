
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { GOOGLE_SHEET_CSV_URL, GOOGLE_APPS_SCRIPT_URL, GOOGLE_SHEET_PHOTOS_URL, MIS_TARGETS_URL, MAINTENANCE_BILLS_URL } from '../config';
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

interface MaintenanceBill {
    id: string;
    date: string;
    category: string;
    description: string;
    amount: number;
    status: string;
    billUrl: string;
    timestamp: string;
}

const AdminPage: React.FC = () => {
    const { user, getAllUsers } = useAuth();
    const [view, setView] = useState<'attendance' | 'media' | 'mis' | 'maintenance'>('attendance');
    const [allAttendanceData, setAllAttendanceData] = useState<AttendanceRecord[]>([]);
    const [mediaRegistry, setMediaRegistry] = useState<PhotoRecord[]>([]);
    const [misTargets, setMisTargets] = useState<MISTarget[]>([]);
    const [maintenanceBills, setMaintenanceBills] = useState<MaintenanceBill[]>([]);
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

    // Maintenance Manager State
    const [isSubmittingBill, setIsSubmittingBill] = useState(false);
    const [billFile, setBillFile] = useState<File | null>(null);
    const [billPreview, setBillPreview] = useState<string | null>(null);
    const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
    const [billCategory, setBillCategory] = useState('Car Rental Bill');
    const [billDescription, setBillDescription] = useState('');
    const [billAmount, setBillAmount] = useState('');
    const [billStatus, setBillStatus] = useState('Pending with me');
    const [maintenanceStatus, setMaintenanceStatus] = useState<{success: boolean, message: string} | null>(null);
    const [selectedBillForView, setSelectedBillForView] = useState<MaintenanceBill | null>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

    const categories = ['Car Rental Bill', 'Office Maintenance Bill', 'Travel Bill', 'Event Bill'];
    const paymentStatuses = ['Pending with me', 'Pending with Patra', 'Pending with JP', 'Pending at Finance', 'Paid'];

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
        if (!csv) return [];
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

    const fetchMaintenanceBills = useCallback(async () => {
        try {
            const response = await fetch(`${MAINTENANCE_BILLS_URL}&_=${Date.now()}`);
            if (!response.ok) return;
            const csvText = await response.text();
            const parsed = parseCSVToObjects(csvText);
            
            const mapped: MaintenanceBill[] = parsed.map(row => ({
                id: getFuzzy(row, ['ID']) || '',
                date: getFuzzy(row, ['DATE']) || '',
                category: getFuzzy(row, ['CATEGORY']) || '',
                description: getFuzzy(row, ['DESCRIPTION']) || '',
                amount: parseFloat(getFuzzy(row, ['AMOUNT']) || '0'),
                status: getFuzzy(row, ['STATUS']) || 'Pending with me',
                billUrl: getFuzzy(row, ['BILLURL', 'URL', 'BILL']) || '',
                timestamp: getFuzzy(row, ['TIMESTAMP']) || '',
            })).filter(b => b.description || b.amount || b.id);
            
            setMaintenanceBills(mapped.reverse());
        } catch (err) {
            console.error('Maintenance bills sync error:', err);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        await Promise.all([
            fetchAttendanceData(), 
            fetchMediaRegistry(), 
            fetchMISTargets(), 
            fetchMaintenanceBills(),
            loadUsers()
        ]);
        setLoading(false);
    }, [fetchAttendanceData, fetchMediaRegistry, fetchMISTargets, fetchMaintenanceBills, loadUsers]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                alert("File too large. Max 10MB.");
                return;
            }
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setPreviewUrl(reader.result as string);
            reader.readAsDataURL(file);
            setUploadStatus(null);
        }
    };

    const handleBillFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                alert("File too large. Max 10MB.");
                return;
            }
            setBillFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setBillPreview(reader.result as string);
            reader.readAsDataURL(file);
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

    const handleSubmitMaintenanceBill = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!billAmount || !billDescription) return;
        setIsSubmittingBill(true);
        setMaintenanceStatus(null);

        try {
            let base64Bill = "";
            if (billPreview) {
                base64Bill = billPreview.split(',')[1];
            }

            const payload = {
                action: "addMaintenanceBill",
                date: billDate,
                category: billCategory,
                description: billDescription,
                amount: billAmount,
                status: billStatus,
                billData: base64Bill,
                fileName: billFile?.name || "bill.png",
                mimeType: billFile?.type || (billFile?.name.endsWith('.pdf') ? "application/pdf" : "image/png")
            };

            const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.status === 'success' || result.result === 'success') {
                setMaintenanceStatus({ success: true, message: "Entry logged successfully!" });
                
                // OPTIMISTIC UPDATE: Add the new bill to the state immediately
                const newBill: MaintenanceBill = {
                    id: result.billId || `TEMP-${Date.now()}`,
                    date: billDate,
                    category: billCategory,
                    description: billDescription,
                    amount: parseFloat(billAmount),
                    status: billStatus,
                    billUrl: result.billUrl || "",
                    timestamp: new Date().toISOString()
                };
                
                setMaintenanceBills(prev => [newBill, ...prev]);

                // Reset Form
                setBillAmount('');
                setBillDescription('');
                setBillFile(null);
                setBillPreview(null);
            } else {
                throw new Error(result.message || "Submission failed");
            }
        } catch (err: any) {
            setMaintenanceStatus({ success: false, message: err.message });
        } finally {
            setIsSubmittingBill(false);
        }
    };

    const handleUpdateBillStatus = async (billId: string, newStatus: string) => {
        if (!billId) {
            alert("This record is too new. Please refresh and try again once the ID is generated.");
            return;
        }
        setIsUpdatingStatus(billId);
        try {
            const payload = {
                action: "updateBillStatus",
                billId: billId,
                status: newStatus
            };
            const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.status === 'success') {
                setMaintenanceBills(prev => prev.map(b => b.id === billId ? { ...b, status: newStatus } : b));
            } else {
                throw new Error(result.message || "Update failed");
            }
        } catch (err: any) {
            alert("Error: " + err.message);
            await fetchMaintenanceBills();
        } finally {
            setIsUpdatingStatus(null);
        }
    };

    const handleDeletePhoto = async (url: string) => {
        if (!window.confirm("Remove this photo permanently?")) return;
        setIsDeleting(url);
        try {
            const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'deletePhoto', url })
            });
            
            const result = await response.json();
            if (result.status === 'success') {
                setMediaRegistry(prev => prev.filter(p => p.url !== url));
            } else {
                alert("Delete failed.");
            }
        } catch (err) {
            console.error(err);
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

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'Paid': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'Pending at Finance': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Pending with me': return 'bg-gray-100 text-gray-700 border-gray-200';
            case 'Pending with JP': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'Pending with Patra': return 'bg-purple-100 text-purple-700 border-purple-200';
            default: return 'bg-gray-50 text-gray-500 border-gray-200';
        }
    };

    if (!user?.isAdmin) return <div className="p-8 text-center font-bold text-red-500 uppercase tracking-widest text-sm">Unauthorized Access</div>;

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Authorizing Console...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 dark:text-white leading-tight">Admin Console</h1>
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mt-1">Project Oversight & Finance</p>
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shadow-inner border border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar">
                    <button onClick={() => setView('attendance')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${view === 'attendance' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700'}`}>Attendance</button>
                    <button onClick={() => setView('mis')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${view === 'mis' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700'}`}>MIS Manager</button>
                    <button onClick={() => setView('media')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${view === 'media' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700'}`}>Media Manager</button>
                    <button onClick={() => setView('maintenance')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${view === 'maintenance' ? 'bg-white dark:bg-gray-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-gray-500 hover:text-gray-700'}`}>Office Maintenance</button>
                </div>
            </div>

            {view === 'attendance' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 px-1">Staff Member</label>
                            <select value={selectedUsername} onChange={e => setSelectedUsername(e.target.value)} className="bg-white dark:bg-gray-800 p-3 rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 font-bold shadow-sm focus:ring-indigo-500 transition-all">
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
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (<div key={i} className={`text-center font-black text-[10px] py-1 uppercase ${i === 0 ? 'text-red-500' : 'text-gray-400'}`}>{d}</div>))}
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
                                        bgColor = record.workingStatus === 'Working' ? 'bg-green-500' : 'bg-red-500';
                                        textColor = 'text-white';
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
                                return (<div key={i} className={`h-12 sm:h-14 rounded-xl border flex flex-col items-center justify-center transition-all ${bgColor} ${borderColor} ${textColor}`}><span className={`text-sm font-black ${!isCurrentMonth ? 'opacity-20' : ''}`}>{day.getDate()}</span></div>);
                            })}
                        </div>
                    </div>
                </div>
            )}

            {view === 'maintenance' && (
                <div className="space-y-8 animate-fade-in pb-12">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-emerald-600 text-white p-6 rounded-3xl shadow-xl flex flex-col justify-between h-32">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Paid Total</p>
                            <h3 className="text-2xl font-black">₹{maintenanceBills.filter(b => b.status === 'Paid').reduce((acc, b) => acc + b.amount, 0).toLocaleString()}</h3>
                        </div>
                        <div className="bg-amber-500 text-white p-6 rounded-3xl shadow-xl flex flex-col justify-between h-32">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">At Approval</p>
                            <h3 className="text-2xl font-black">₹{maintenanceBills.filter(b => b.status.includes('JP') || b.status.includes('Patra')).reduce((acc, b) => acc + b.amount, 0).toLocaleString()}</h3>
                        </div>
                        <div className="bg-blue-600 text-white p-6 rounded-3xl shadow-xl flex flex-col justify-between h-32">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Pending Finance</p>
                            <h3 className="text-2xl font-black">₹{maintenanceBills.filter(b => b.status === 'Pending at Finance').reduce((acc, b) => acc + b.amount, 0).toLocaleString()}</h3>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 flex flex-col justify-between h-32">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Records</p>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white">{maintenanceBills.length} Entries</h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-2xl border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-2.5 bg-emerald-600 rounded-2xl text-white shadow-lg">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                </div>
                                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Lodge Entry</h2>
                            </div>
                            <form onSubmit={handleSubmitMaintenanceBill} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 px-1">Bill Date</label>
                                    <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 font-bold focus:ring-2 focus:ring-emerald-500 transition-all text-sm" required />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 px-1">Category</label>
                                    <select value={billCategory} onChange={e => setBillCategory(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 font-bold focus:ring-2 focus:ring-emerald-500 transition-all text-sm">
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 px-1">Initial Status</label>
                                    <select value={billStatus} onChange={e => setBillStatus(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 font-bold focus:ring-2 focus:ring-emerald-500 transition-all text-sm">
                                        {paymentStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 px-1">Amount (₹)</label>
                                    <input type="number" value={billAmount} onChange={e => setBillAmount(e.target.value)} placeholder="0.00" className="w-full bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 font-bold focus:ring-2 focus:ring-emerald-500 transition-all text-sm" required />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 px-1">Description</label>
                                    <textarea value={billDescription} onChange={e => setBillDescription(e.target.value)} rows={2} placeholder="Purpose..." className="w-full bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-700 font-bold focus:ring-2 focus:ring-emerald-500 transition-all text-sm resize-none" required />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-gray-400 px-1">Document (PDF/Image)</label>
                                    <input type="file" accept="image/*,application/pdf" onChange={handleBillFileChange} className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" />
                                </div>
                                <button type="submit" disabled={isSubmittingBill} className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-emerald-700 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2">
                                    {isSubmittingBill ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : "Log Expense"}
                                </button>
                                {maintenanceStatus && <p className={`text-center text-[10px] font-black uppercase mt-2 ${maintenanceStatus.success ? 'text-emerald-500' : 'text-red-500'}`}>{maintenanceStatus.message}</p>}
                            </form>
                        </div>

                        <div className="lg:col-span-2 space-y-4">
                            <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Expense Ledger</h3>
                                    <button onClick={fetchMaintenanceBills} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-100/50 dark:bg-gray-900/50">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">Info</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">Amount</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">Status</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 text-right">Doc</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                            {maintenanceBills.map((bill, i) => (
                                                <tr key={bill.id || i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-gray-900 dark:text-white text-sm">{bill.date}</div>
                                                        <div className="text-[10px] font-black uppercase text-emerald-600 truncate max-w-[150px]">{bill.category}</div>
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-gray-900 dark:text-white">₹{bill.amount.toLocaleString()}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="relative">
                                                            <select value={bill.status} onChange={(e) => handleUpdateBillStatus(bill.id, e.target.value)} disabled={isUpdatingStatus === bill.id || !bill.id} className={`w-full px-3 py-1.5 rounded-full text-[9px] font-black uppercase border appearance-none cursor-pointer ${getStatusColor(bill.status)} ${isUpdatingStatus === bill.id || !bill.id ? 'opacity-50' : ''}`}>
                                                                {paymentStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                                            </select>
                                                            {isUpdatingStatus === bill.id && <div className="absolute right-2 top-1/2 -translate-y-1/2"><div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button onClick={() => setSelectedBillForView(bill)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-gray-500 hover:text-emerald-600 transition-all active:scale-90">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {selectedBillForView && (
                        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedBillForView(null)}>
                            <div className="relative max-w-5xl w-full flex flex-col items-center gap-6" onClick={e => e.stopPropagation()}>
                                <button onClick={() => setSelectedBillForView(null)} className="absolute -top-12 right-0 p-4 bg-white/10 text-white rounded-full hover:bg-white/20 border border-white/10">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                                <div className="w-full h-[70vh] bg-gray-950 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl relative">
                                    {selectedBillForView.billUrl ? (
                                        <iframe src={selectedBillForView.billUrl} className="w-full h-full border-none" title="Bill Attachment" />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full p-12 text-gray-500 italic">No document attached.</div>
                                    )}
                                </div>
                                <div className="bg-white/5 backdrop-blur-2xl px-12 py-6 rounded-[3rem] border border-white/10 text-center text-white">
                                    <h4 className="text-xl font-black uppercase tracking-tight">{selectedBillForView.category}</h4>
                                    <p className="text-[10px] font-black uppercase text-emerald-400 mt-1">₹{selectedBillForView.amount.toLocaleString()} • {selectedBillForView.date}</p>
                                    <p className="mt-4 text-xs font-bold italic text-white/60 max-w-md mx-auto">{selectedBillForView.description}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {view === 'mis' && (
                <div className="max-w-4xl mx-auto animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055zM20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/></svg></div>
                            <div><h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Achievement Logger</h2></div>
                        </div>
                        <form onSubmit={handleAchievementSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 px-1">Activity Code</label>
                                    <select value={selectedActivityId} onChange={e => setSelectedActivityId(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-bold text-sm focus:ring-2 focus:ring-indigo-600" required>
                                        {misTargets.map(t => (<option key={t.id} value={t.id}>{t.id} - {t.name}</option>))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 px-1">Value</label>
                                    <div className="relative">
                                        <input type="number" step="0.01" value={achievementValue} onChange={e => setAchievementValue(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 p-4 pr-12 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-bold text-sm focus:ring-2 focus:ring-indigo-600" required />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-400 uppercase">{misTargets.find(t => t.id === selectedActivityId)?.uom || 'units'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 px-1">Village / GP</label>
                                <input type="text" value={achievementGP} onChange={e => setAchievementGP(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-bold text-sm focus:ring-2 focus:ring-indigo-600" required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 px-1">Remarks</label>
                                <textarea value={achievementRemarks} onChange={e => setAchievementRemarks(e.target.value)} rows={3} className="w-full bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-bold text-sm focus:ring-2 focus:ring-indigo-600 resize-none" />
                            </div>
                            <button type="submit" disabled={isSubmittingMIS} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 mt-4">
                                {isSubmittingMIS ? "Syncing..." : "Update Achievement"}
                            </button>
                            {misStatus && <div className={`p-4 rounded-2xl text-center text-xs font-bold ${misStatus.success ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{misStatus.message}</div>}
                        </form>
                    </div>
                </div>
            )}

            {view === 'media' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-8"><div className="w-2 h-8 bg-indigo-600 rounded-full" /><h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Post Content</h2></div>
                        <div className="space-y-6">
                            <div className="group relative"><label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Media</label><input type="file" accept="image/*" onChange={handleFileChange} className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-black file:bg-indigo-50 file:text-indigo-700" /></div>
                            {previewUrl && <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl group/preview"><img src={previewUrl} alt="Preview" className="w-full h-full object-cover group-hover/preview:scale-105 transition-transform duration-700" /><button onClick={() => { setPreviewUrl(null); setSelectedFile(null); }} className="absolute top-4 right-4 p-3 bg-red-500 text-white rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button></div>}
                            <div className="space-y-4">
                                <select value={uploadType} onChange={e => setUploadType(e.target.value as 'slider' | 'gallery')} className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl font-black text-xs uppercase border-none ring-1 ring-gray-200 dark:ring-gray-700"><option value="gallery">Gallery</option><option value="slider">Hero Slider</option></select>
                                <textarea rows={3} value={photoDescription} onChange={e => setPhotoDescription(e.target.value)} placeholder="Story..." className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-indigo-500 resize-none" />
                            </div>
                            <button onClick={handleUploadMedia} disabled={isUploading || !selectedFile} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3">{isUploading ? "Uploading..." : "Publish Feed"}</button>
                            {uploadStatus && <p className={`text-center text-xs font-bold ${uploadStatus.success ? 'text-emerald-500' : 'text-red-500'}`}>{uploadStatus.message}</p>}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-8"><h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Live Registry</h2><button onClick={fetchMediaRegistry} className="p-2 text-indigo-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></button></div>
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {mediaRegistry.map((item, idx) => (
                                <div key={idx} className="flex gap-4 p-3 rounded-2xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 group">
                                    <img src={item.url} alt="" className="w-16 h-16 rounded-xl object-cover shadow-sm flex-shrink-0" />
                                    <div className="flex-grow min-w-0 flex flex-col justify-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase w-fit mb-1 ${item.type === 'slider' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'}`}>{item.type}</span>
                                        <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 line-clamp-2 leading-tight">{item.description || "No caption."}</p>
                                    </div>
                                    <button onClick={() => handleDeletePhoto(item.url)} disabled={isDeleting === item.url} className="p-3 text-red-400 hover:text-red-600 rounded-xl transition-all">{isDeleting === item.url ? "..." : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>}</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default AdminPage;
