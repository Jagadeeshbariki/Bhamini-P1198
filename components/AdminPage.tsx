
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
    const { user, getAllUsers } = useAuth();
    const [allAttendanceData, setAllAttendanceData] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedUsername, setSelectedUsername] = useState<string>('');
    const [usersList, setUsersList] = useState<{username: string}[]>([]);

    // Filtering states
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
        // If the previously selected user is no longer in the list, or if none is selected, pick the first one
        if (list.length > 0) {
            const stillExists = list.find(u => u.username === selectedUsername);
            if (!stillExists) {
                setSelectedUsername(list[0].username);
            }
        }
    }, [getAllUsers, selectedUsername]);

    const parseCSV = (csv: string): Record<string, string>[] => {
        const lines = csv.split(/\r\n|\n/);
        if (lines.length < 1) return [];
        const parseLine = (line: string): string[] => {
            const values = [];
            let inQuote = false;
            let value = '';
            for (let j = 0; j < line.length; j++) {
                if (line[j] === '"') inQuote = !inQuote;
                else if (line[j] === ',' && !inQuote) { values.push(value.trim()); value = ''; }
                else value += line[j];
            }
            values.push(value.trim());
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
            setError('Failed to sync data from Google Sheets.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        loadUsers();
    }, [fetchData, loadUsers]);

    // Filtering logic based on 26th-25th period
    const filteredRecords = useMemo(() => {
        if (!selectedUsername) return [];
        
        const monthIndex = months.indexOf(selectedMonth);
        const year = parseInt(selectedYear);
        if (monthIndex === -1) return [];

        const startDate = new Date(year, monthIndex - 1, 26, 0, 0, 0).getTime();
        const endDate = new Date(year, monthIndex, 25, 23, 59, 59).getTime();

        return allAttendanceData.filter(record => {
            if (record.name !== selectedUsername) return false;
            
            const parts = record.date.split('/');
            if (parts.length === 3) {
                const d = parseInt(parts[0]);
                const m = parseInt(parts[1]) - 1;
                const y = parseInt(parts[2]);
                const recordDate = new Date(y, m, d).getTime();
                return recordDate >= startDate && recordDate <= endDate;
            }
            return false;
        }).sort((a, b) => {
            const partsA = a.date.split('/');
            const partsB = b.date.split('/');
            return new Date(+partsA[2], +partsA[1]-1, +partsA[0]).getTime() - new Date(+partsB[2], +partsB[1]-1, +partsB[0]).getTime();
        });
    }, [allAttendanceData, selectedUsername, selectedMonth, selectedYear, months]);

    const totalHours = useMemo(() => {
        return filteredRecords.reduce((sum, r) => {
            const hrs = parseFloat(r.workingHours) || 0;
            return sum + hrs;
        }, 0);
    }, [filteredRecords]);

    const markedDates = useMemo(() => new Set(filteredRecords.map(r => {
        const p = r.date.split('/');
        return p.length === 3 ? `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}` : '';
    })), [filteredRecords]);

    // Calendar logic
    const calendarDate = useMemo(() => {
        const monthIdx = months.indexOf(selectedMonth);
        return new Date(parseInt(selectedYear), monthIdx, 1);
    }, [selectedMonth, selectedYear, months]);

    const calendarDays = useMemo(() => generateCalendarDays(calendarDate), [calendarDate]);

    if (!user?.isAdmin) return <div className="p-8 text-center font-bold text-red-500">Unauthorized Access</div>;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header & Controls */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-gray-800 dark:text-white">Admin Dashboard</h1>
                        <p className="text-xs text-blue-600 font-bold uppercase tracking-widest mt-1">Field Monitoring & Reporting</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Live Sync Active</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Staff Member</label>
                        <select 
                            value={selectedUsername} 
                            onChange={e => setSelectedUsername(e.target.value)} 
                            className="w-full mt-1 px-4 py-2.5 rounded-xl border dark:bg-gray-700 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {usersList.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Reporting Month</label>
                        <select 
                            value={selectedMonth} 
                            onChange={e => setSelectedMonth(e.target.value)} 
                            className="w-full mt-1 px-4 py-2.5 rounded-xl border dark:bg-gray-700 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Reporting Year</label>
                        <select 
                            value={selectedYear} 
                            onChange={e => setSelectedYear(e.target.value)} 
                            className="w-full mt-1 px-4 py-2.5 rounded-xl border dark:bg-gray-700 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Statistics Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] uppercase font-bold text-gray-400">Total Days Logged</p>
                    <p className="text-3xl font-black text-blue-600 mt-1">{filteredRecords.length}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] uppercase font-bold text-gray-400">Total Hours Worked</p>
                    <p className="text-3xl font-black text-green-600 mt-1">{totalHours.toFixed(1)}</p>
                </div>
            </div>

            {/* Content Tabs / Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Calendar View */}
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        Attendance Calendar
                    </h3>
                    
                    {loading ? (
                         <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                         </div>
                    ) : (
                        <div className="grid grid-cols-7 gap-1 text-center">
                            {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-[10px] font-bold text-gray-400 py-2">{d}</div>)}
                            {calendarDays.map((day, i) => {
                                const key = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
                                const isM = markedDates.has(key);
                                const isCurrentMonth = day.getMonth() === calendarDate.getMonth();
                                return (
                                    <div key={i} className={`h-10 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${!isCurrentMonth ? 'opacity-20' : ''} ${isM ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-gray-50 dark:bg-gray-900/50 text-gray-400 dark:text-gray-600'}`}>
                                        {day.getDate()}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Report Table View */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        Detailed Work Report
                    </h3>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Place</th>
                                    <th className="px-4 py-3">Purpose / Reason</th>
                                    <th className="px-4 py-3 text-center">Hrs</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredRecords.length > 0 ? (
                                    filteredRecords.map((r, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                                            <td className="px-4 py-3 font-bold whitespace-nowrap">{r.date}</td>
                                            <td className="px-4 py-3">{r.workingStatus === 'Working' ? r.placeOfVisit : '-'}</td>
                                            <td className="px-4 py-3">
                                                {r.workingStatus === 'Working' ? (
                                                    <span className="text-gray-600 dark:text-gray-400 line-clamp-2" title={r.purposeOfVisit}>{r.purposeOfVisit}</span>
                                                ) : (
                                                    <span className="text-orange-600 font-bold">{r.workingStatus}: {r.reasonNotWorking}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center font-black text-blue-600">{r.workingStatus === 'Working' ? r.workingHours : '0'}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-12 text-center text-gray-400 font-medium italic">
                                            No data found for this period.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-800 text-sm font-bold text-center">
                    {error}
                </div>
            )}
        </div>
    );
};

export default AdminPage;
