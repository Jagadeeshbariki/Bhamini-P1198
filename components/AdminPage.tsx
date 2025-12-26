
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { GOOGLE_SHEET_CSV_URL } from '../config';
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

const AdminPage: React.FC = () => {
    const { user, getAllUsers, addUser } = useAuth();
    const [allAttendanceData, setAllAttendanceData] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'calendar' | 'report'>('calendar');
    const [selectedUsername, setSelectedUsername] = useState<string>('');
    const [currentDate, setCurrentDate] = useState(new Date());

    // Add User State
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [addSuccess, setAddSuccess] = useState('');

    const usersList = useMemo(() => getAllUsers(), [getAllUsers]);

    const parseCSV = (csv: string): Record<string, string>[] => {
        const lines = csv.split(/\r\n|\n/);
        if (lines.length < 1) return [];
        const parseLine = (line: string): string[] => {
            const values = [];
            let inQuote = false;
            let value = '';
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                if (char === '"') inQuote = !inQuote;
                else if (char === ',' && !inQuote) {
                    values.push(value.trim());
                    value = '';
                } else value += char;
            }
            values.push(value.trim());
            return values;
        };
        const headers = parseLine(lines[0]).map(h => h.trim());
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i]) continue;
            const values = parseLine(lines[i]);
            if (values.length === headers.length) {
                const entry: Record<string, string> = {};
                headers.forEach((header, index) => {
                    entry[header] = values[index];
                });
                data.push(entry);
            }
        }
        return data;
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&_=${new Date().getTime()}`);
            if (!response.ok) throw new Error(`Fetch error: ${response.status}`);
            const csvText = await response.text();
            const parsed = parseCSV(csvText);
            const mapped: AttendanceRecord[] = parsed.map((row: any) => ({
                timestamp: row['Timestamp'] || '',
                name: (row['SELECT YOUR NAME'] || '').trim(),
                date: row['CHOOSE DATE'] || '',
                workingStatus: row['WORKING/LEAVE/HOLIDAY'] || '',
                reasonNotWorking: row['WRITE THE REASON FOR NOT WORKING'] || '',
                placeOfVisit: row['PLACE OF VISIT'] || '',
                purposeOfVisit: row['PURPOSE OF VISIT'] || '',
                workingHours: row['WORKING HOURS'] || '',
                outcomes: row['OUTCOME'] || '',
            }));
            setAllAttendanceData(mapped);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        if (usersList.length > 0) {
            setSelectedUsername(usersList[0].username);
        }
    }, [fetchData, usersList]);

    const filteredRecords = useMemo(() => {
        return allAttendanceData.filter(r => r.name === selectedUsername);
    }, [allAttendanceData, selectedUsername]);

    const markedDates = useMemo(() => {
        const dates = new Set<string>();
        filteredRecords.forEach(r => {
            const parts = r.date.split('/');
            if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2];
                dates.add(`${year}-${month}-${day}`);
            }
        });
        return dates;
    }, [filteredRecords]);

    const calendarDays = useMemo(() => generateCalendarDays(currentDate), [currentDate]);

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUsername || !newPassword) return;
        addUser(newUsername, newPassword);
        setNewUsername('');
        setNewPassword('');
        setAddSuccess('User added successfully!');
        setTimeout(() => setAddSuccess(''), 3000);
    };

    if (!user?.isAdmin) return <div className="p-8 text-center">Access Denied</div>;

    return (
        <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Admin Dashboard</h1>

                {/* User Addition */}
                <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    <h2 className="text-lg font-bold mb-4 text-blue-600 dark:text-blue-400 uppercase tracking-widest text-xs">Add New Staff Member</h2>
                    <form onSubmit={handleAddUser} className="flex flex-col md:flex-row gap-4">
                        <input
                            type="text"
                            placeholder="Username"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            className="px-4 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-600 w-full"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="px-4 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-600 w-full"
                        />
                        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-bold shrink-0">
                            Add User
                        </button>
                    </form>
                    {addSuccess && <p className="mt-2 text-green-500 text-sm font-bold">{addSuccess}</p>}
                </div>

                <div className="flex flex-col md:flex-row gap-6 mb-8">
                    <div className="flex-1">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Select Staff Member</label>
                        <select
                            value={selectedUsername}
                            onChange={(e) => setSelectedUsername(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                        >
                            {usersList.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">View Mode</label>
                        <div className="flex bg-gray-100 dark:bg-gray-900 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`flex-1 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'calendar' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}
                            >
                                Calendar
                            </button>
                            <button
                                onClick={() => setViewMode('report')}
                                className={`flex-1 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'report' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}
                            >
                                Report
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center py-12">
                        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-4 text-gray-500">Syncing data...</p>
                    </div>
                ) : error ? (
                    <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">{error}</div>
                ) : (
                    <div className="transition-all duration-300">
                        {viewMode === 'calendar' ? (
                            <div className="max-w-2xl mx-auto">
                                <div className="flex items-center justify-between mb-4">
                                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">&lt;</button>
                                    <h3 className="text-xl font-bold">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">&gt;</button>
                                </div>
                                <div className="grid grid-cols-7 gap-1 text-center">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="text-xs font-bold text-gray-400 uppercase py-2">{d}</div>)}
                                    {calendarDays.map((day, i) => {
                                        const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                                        const isMarked = markedDates.has(dayKey);
                                        const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                                        return (
                                            <div key={i} className={`h-14 flex flex-col items-center justify-center rounded-lg border ${!isCurrentMonth ? 'opacity-30' : ''} ${isMarked ? 'bg-green-100 border-green-200 dark:bg-green-900/40 dark:border-green-800' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                                                <span className="text-sm font-bold">{day.getDate()}</span>
                                                {isMarked && <span className="text-[10px] text-green-600 font-black">DONE</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto border dark:border-gray-700 rounded-xl">
                                <table className="w-full text-left text-sm border-collapse telugu-font">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th className="px-4 py-3 border-b dark:border-gray-600">Date</th>
                                            <th className="px-4 py-3 border-b dark:border-gray-600">Status</th>
                                            <th className="px-4 py-3 border-b dark:border-gray-600">Place</th>
                                            <th className="px-4 py-3 border-b dark:border-gray-600">Hours</th>
                                            <th className="px-4 py-3 border-b dark:border-gray-600">Outcome</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700">
                                        {filteredRecords.length > 0 ? (
                                            filteredRecords.map((r, i) => (
                                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                                                    <td className="px-4 py-3">{r.date}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${r.workingStatus === 'Working' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                            {r.workingStatus}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">{r.placeOfVisit || '-'}</td>
                                                    <td className="px-4 py-3">{r.workingHours || '0'}</td>
                                                    <td className="px-4 py-3 truncate max-w-xs" title={r.outcomes}>{r.outcomes || '-'}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No data found for this user.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPage;
