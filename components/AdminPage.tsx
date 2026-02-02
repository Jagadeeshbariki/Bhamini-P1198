
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { GOOGLE_SHEET_CSV_URL, GOOGLE_APPS_SCRIPT_URL } from '../config';

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

const AdminPage: React.FC = () => {
    const { user, getAllUsers } = useAuth();
    const [view, setView] = useState<'attendance' | 'media'>('attendance');
    const [allAttendanceData, setAllAttendanceData] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedUsername, setSelectedUsername] = useState<string>('');
    const [usersList, setUsersList] = useState<{username: string}[]>([]);

    // Media Manager State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [photoDescription, setPhotoDescription] = useState('');
    const [uploadType, setUploadType] = useState<'slider' | 'gallery'>('gallery');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<{success: boolean, message: string} | null>(null);

    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toLocaleString('default', { month: 'short' }));
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

    const months = useMemo(() => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], []);
    const years = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
    }, []);

    const loadUsers = useCallback(async () => {
        const list = await getAllUsers();
        setUsersList(list);
        if (list.length > 0 && !selectedUsername) {
            setSelectedUsername(list[0].username);
        }
    }, [getAllUsers, selectedUsername]);

    const parseCSV = (csv: string): Record<string, string>[] => {
        const lines = csv.split(/\r\n|\n/);
        if (lines.length < 1) return [];
        const parseLine = (line: string): string[] => {
            const values = [];
            let inQuote = false, val = '';
            for (let j = 0; j < line.length; j++) {
                if (line[j] === '"') inQuote = !inQuote;
                else if (line[j] === ',' && !inQuote) { values.push(val.trim()); val = ''; }
                else val += line[j];
            }
            values.push(val.trim());
            return values;
        };
        const headers = parseLine(lines[0]);
        return lines.slice(1).filter(l => l).map(line => {
            const vals = parseLine(line);
            return headers.reduce((obj, h, i) => ({ ...obj, [h]: vals[i] || '' }), {});
        });
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&_=${new Date().getTime()}`);
            if (!response.ok) throw new Error('Network error syncing with Google Sheets');
            const csvText = await response.text();
            const parsed = parseCSV(csvText);
            const mapped: AttendanceRecord[] = parsed.map((row: any) => ({
                timestamp: row['Timestamp'] || '',
                name: (row['SELECT YOUR NAME'] || row['Name'] || '').trim(),
                date: row['CHOOSE DATE'] || row['Date'] || '',
                workingStatus: row['WORKING/LEAVE/HOLIDAY'] || '',
                reasonNotWorking: row['WRITE THE REASON FOR NOT WORKING'] || '',
                placeOfVisit: row['PLACE OF VISIT'] || '',
                purposeOfVisit: row['PURPOSE OF VISIT'] || '',
                workingHours: row['WORKING HOURS'] || '0',
                outcomes: row['OUTCOME'] || '',
            }));
            setAllAttendanceData(mapped);
        } catch (err) {
            setError('Failed to sync data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        loadUsers();
    }, [fetchData, loadUsers]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert("File too large. Please select an image under 5MB.");
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

            const uploadUrl = `${GOOGLE_APPS_SCRIPT_URL}?action=addPhoto`;

            const response = await fetch(uploadUrl, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload),
                redirect: 'follow'
            });

            const responseText = await response.text();
            console.log('Admin Console - Photo Upload Raw Response:', responseText);
            
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                throw new Error(`The server returned non-JSON data. Response: ${responseText.substring(0, 50)}...`);
            }

            const isAttendanceBranch = result?.action === 'appended';
            const isPhotoSuccess = (result?.status === 'success') || (result?.result === 'success' && !isAttendanceBranch) || !!result?.url;

            if (isPhotoSuccess && !isAttendanceBranch) {
                setUploadStatus({ success: true, message: 'Image successfully posted to the Field Registry!' });
                setSelectedFile(null);
                setPreviewUrl(null);
                setPhotoDescription('');
            } else if (isAttendanceBranch) {
                throw new Error("ROUTING ERROR: The backend script is executing the 'Attendance' code instead of the 'Photo' code. Ensure your script checks if (data.action === 'addPhoto') at the start of doPost.");
            } else {
                const serverMsg = result?.message || JSON.stringify(result);
                throw new Error(serverMsg || 'The server encountered an unknown error.');
            }
        } catch (err: any) {
            console.error('Upload Error Details:', err);
            setUploadStatus({ 
                success: false, 
                message: err.message 
            });
        } finally {
            setIsUploading(false);
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

    if (!user?.isAdmin) return <div className="p-8 text-center font-bold text-red-500 uppercase tracking-widest text-sm">Unauthorized Access</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 dark:text-white">Admin Console</h1>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">Management & Oversight</p>
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shadow-inner border border-gray-200 dark:border-gray-700">
                    <button 
                        onClick={() => setView('attendance')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${view === 'attendance' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Attendance
                    </button>
                    <button 
                        onClick={() => setView('media')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${view === 'media' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Media Manager
                    </button>
                </div>
            </div>

            {view === 'attendance' ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <select 
                            value={selectedUsername} 
                            onChange={e => setSelectedUsername(e.target.value)}
                            className="bg-gray-50 dark:bg-gray-700 p-3 rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-600 font-bold"
                        >
                            {usersList.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                        </select>
                        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-600 font-bold">
                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-xl border-none ring-1 ring-gray-200 dark:ring-gray-600 font-bold">
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase text-gray-400">Date</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase text-gray-400">Status</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase text-gray-400">Place/Purpose</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                {filteredRecords.map((r, i) => (
                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                        <td className="px-4 py-4 text-sm font-bold">{r.date}</td>
                                        <td className="px-4 py-4 text-sm font-medium">{r.workingStatus}</td>
                                        <td className="px-4 py-4 text-sm">
                                            <div className="font-bold">{r.placeOfVisit}</div>
                                            <div className="text-xs text-gray-500">{r.purposeOfVisit}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-black uppercase text-gray-400 mb-2">Select Image</label>
                            <input type="file" accept="image/*" onChange={handleFileChange} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                        </div>
                        
                        {previewUrl && (
                            <div className="relative aspect-video rounded-2xl overflow-hidden border-4 border-gray-100 dark:border-gray-700">
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-400 mb-2">Display Type</label>
                                <select value={uploadType} onChange={e => setUploadType(e.target.value as 'slider' | 'gallery')} className="w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-xl font-bold border-none ring-1 ring-gray-200 dark:ring-gray-600">
                                    <option value="gallery">Field Gallery</option>
                                    <option value="slider">Home Slider</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-400 mb-2">Description</label>
                                <input 
                                    type="text" 
                                    value={photoDescription} 
                                    onChange={e => setPhotoDescription(e.target.value)} 
                                    placeholder="Enter image description..." 
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-xl font-bold border-none ring-1 ring-gray-200 dark:ring-gray-600" 
                                />
                            </div>
                        </div>

                        {uploadStatus && (
                            <div className={`p-4 rounded-xl text-sm font-bold ${uploadStatus.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {uploadStatus.message}
                            </div>
                        )}

                        <button 
                            onClick={handleUploadMedia}
                            disabled={isUploading || !selectedFile}
                            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                        >
                            {isUploading ? 'Uploading...' : 'Publish to Field Registry'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPage;
