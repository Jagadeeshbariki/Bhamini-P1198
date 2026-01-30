
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
    const [calendarViewDate, setCalendarViewDate] = useState(new Date());

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

    const normalizeDateToKey = (dateStr: string) => {
        if (!dateStr) return '';
        const parts = dateStr.trim().split('/');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return '';
    };

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

    // Summary Table Filter (26th-25th)
    const filteredRecords = useMemo(() => {
        if (!selectedUsername) return [];
        const monthIdx = months.indexOf(selectedMonth);
        const year = parseInt(selectedYear);
        const start = new Date(year, monthIdx - 1, 26, 0, 0, 0).getTime();
        const end = new Date(year, monthIdx, 25, 23, 59, 59).getTime();

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

    // Calendar Marks (Full Month based on Calendar View)
    const markedDatesMap = useMemo(() => {
        const map = new Map<string, AttendanceRecord>();
        allAttendanceData.forEach(r => {
            if (r.name.toLowerCase() === selectedUsername.toLowerCase()) {
                const key = normalizeDateToKey(r.date);
                if (key) {
                    const existing = map.get(key);
                    const ts = (d: string) => d ? new Date(d).getTime() : 0;
                    if (!existing || ts(r.timestamp) >= ts(existing.timestamp)) {
                        map.set(key, r);
                    }
                }
            }
        });
        return map;
    }, [allAttendanceData, selectedUsername]);

    const calendarDays = useMemo(() => generateCalendarDays(calendarViewDate), [calendarViewDate]);

    if (!user?.isAdmin) return <div className="p-8 text-center font-bold text-red-500 uppercase tracking-widest">Unauthorized Access</div>;

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h1 className="text-2xl font-black text-gray-800 dark:text-white mb-6">Admin Monitoring</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <select value={selectedUsername} onChange={e => setSelectedUsername(e.target.value)} className="w-full px-4 py-3 rounded-xl border dark:bg-gray-700 font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                        {usersList.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                    </select>
                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full px-4 py-3 rounded-xl border dark:bg-gray-700 font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="w-full px-4 py-3 rounded-xl border dark:bg-gray-700 font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Interactive Admin Calendar */}
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg></button>
                        <div className="text-center">
                            <h3 className="text-lg font-black uppercase text-gray-800 dark:text-white">{calendarViewDate.toLocaleString('default', { month: 'long' })}</h3>
                            <p className="text-[10px] font-bold text-blue-600">{calendarViewDate.getFullYear()}</p>
                        </div>
                        <button onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1))} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg></button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center">
                        {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-[10px] font-black text-gray-400 py-2">{d}</div>)}
                        {calendarDays.map((day, i) => {
                            const key = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
                            const record = markedDatesMap.get(key);
                            const isCurrentMonth = day.getMonth() === calendarViewDate.getMonth();
                            const isSunday = day.getDay() === 0;
                            
                            let cellClass = 'h-10 flex flex-col items-center justify-center rounded-lg text-xs font-bold transition-all ';
                            if (!isCurrentMonth) cellClass += 'opacity-10 ';
                            else if (record) {
                                if (record.workingStatus === 'Working') cellClass += 'bg-green-600 text-white shadow-md ';
                                else cellClass += 'bg-red-600 text-white shadow-md ';
                            } else if (isSunday) {
                                cellClass += 'bg-red-600/80 text-white ';
                            } else {
                                cellClass += 'bg-gray-50 dark:bg-gray-900/50 text-gray-400 dark:text-gray-600 ';
                            }

                            return (
                                <div key={i} className={cellClass}>
                                    {day.getDate()}
                                    {isCurrentMonth && record && <div className="w-1 h-1 bg-white rounded-full mt-0.5"></div>}
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-6 space-y-2">
                         <div className="flex items-center gap-2 text-[10px] font-bold uppercase"><div className="w-3 h-3 bg-green-600 rounded"></div> Working Recorded</div>
                         <div className="flex items-center gap-2 text-[10px] font-bold uppercase"><div className="w-3 h-3 bg-red-600 rounded"></div> Holiday / Leave / Sunday</div>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="font-bold mb-4 text-gray-800 dark:text-white uppercase text-xs flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        Reporting Period: 26th - 25th
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700 text-gray-500 font-bold uppercase border-b border-gray-100 dark:border-gray-600">
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Place</th>
                                    <th className="px-4 py-3">Details</th>
                                    <th className="px-4 py-3 text-center">Hrs</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.map((r, idx) => (
                                    <tr key={idx} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-900/50">
                                        <td className="px-4 py-3 font-bold">{r.date}</td>
                                        <td className="px-4 py-3">{r.workingStatus === 'Working' ? r.placeOfVisit : r.workingStatus}</td>
                                        <td className="px-4 py-3 max-w-[200px] truncate">{r.workingStatus === 'Working' ? r.purposeOfVisit : r.reasonNotWorking}</td>
                                        <td className="px-4 py-3 text-center font-black text-blue-600">{r.workingStatus === 'Working' ? r.workingHours : '0'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminPage;
