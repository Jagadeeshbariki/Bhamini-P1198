
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { generateCalendarDays } from '../utils/calendar';
import AttendanceFormModal from './AttendanceFormModal';
import { GOOGLE_SHEET_CSV_URL } from '../config';

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

interface MarkAttendancePageProps {
    onNavigate?: (page: 'home' | 'activity' | 'login' | 'attendance-report' | 'mark-attendance' | 'admin' | 'budget-tracker') => void;
}

const MarkAttendancePage: React.FC<MarkAttendancePageProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [markedRecords, setMarkedRecords] = useState<Map<string, AttendanceRecord>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const todayDate = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0); 
        return d;
    }, []);

    const calendarDays = useMemo(() => generateCalendarDays(currentDate), [currentDate]);
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();

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

    const getTimestampMs = (ts: string) => {
        if (!ts) return 0;
        const d = new Date(ts);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const normalizeDateToKey = (dateStr: string) => {
        if (!dateStr) return '';
        const parts = dateStr.trim().split('/');
        if (parts.length === 3) {
            const d = parts[0].padStart(2, '0');
            const m = parts[1].padStart(2, '0');
            const y = parts[2];
            return `${y}-${m}-${d}`;
        }
        return '';
    };

    const fetchMarkedDates = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&cache_bust=${Date.now()}`);
            if (!response.ok) throw new Error('Failed to fetch attendance data.');
            const csvText = await response.text();
            const parsedData = parseCSV(csvText);

            const recordMap = new Map<string, AttendanceRecord>();
            const currentUsernameLower = user.username.trim().toLowerCase();
            
            parsedData.forEach(row => {
                const rowName = (row['SELECT YOUR NAME'] || row['Name'] || '').trim().toLowerCase();
                if (rowName === currentUsernameLower) {
                    const dateStr = row['CHOOSE DATE'] || row['Date'] || '';
                    const key = normalizeDateToKey(dateStr);
                    
                    if (key) {
                        const record: AttendanceRecord = {
                            timestamp: row['Timestamp'] || '',
                            name: rowName,
                            date: dateStr,
                            workingStatus: row['WORKING/LEAVE/HOLIDAY'] || 'Working',
                            reasonNotWorking: row['WRITE THE REASON FOR NOT WORKING'] || '',
                            placeOfVisit: row['PLACE OF VISIT'] || '',
                            purposeOfVisit: row['PURPOSE OF VISIT'] || '',
                            workingHours: row['WORKING HOURS'] || '0',
                            outcomes: row['OUTCOME'] || '',
                        };
                         
                        const existing = recordMap.get(key);
                        if (!existing || getTimestampMs(record.timestamp) >= getTimestampMs(existing.timestamp)) {
                            recordMap.set(key, record);
                        }
                    }
                }
            });

            // Local storage overlay
            const localKey = `bhamini_local_${user.username}`;
            const localSubmissions = JSON.parse(localStorage.getItem(localKey) || '{}');
            Object.keys(localSubmissions).forEach(dateStr => {
                const key = normalizeDateToKey(dateStr);
                if (key) {
                    const localRec = localSubmissions[dateStr];
                    const existing = recordMap.get(key);
                    if (!existing || getTimestampMs(localRec.timestamp) >= getTimestampMs(existing.timestamp)) {
                        recordMap.set(key, localRec);
                    }
                }
            });

            setMarkedRecords(recordMap);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchMarkedDates();
    }, [fetchMarkedDates]);

    const handleDayClick = (day: Date) => {
        if (day > todayDate) return;
        const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
        if (markedRecords.has(key)) return;
        setSelectedDate(day);
        setIsModalOpen(true);
    };

    const navigateMonth = (direction: number) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 dark:text-gray-100 flex items-center gap-3">
                        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        Mark Attendance
                    </h1>
                </div>
                <button 
                    onClick={() => setCurrentDate(new Date())}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-all active:scale-95"
                >
                    Today
                </button>
            </div>
            
            <div className="flex items-center justify-between mb-6 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-2xl border border-gray-200 dark:border-gray-700">
                <button 
                    onClick={() => navigateMonth(-1)} 
                    className="p-4 rounded-xl hover:bg-white dark:hover:bg-gray-600 transition shadow-md text-gray-600 dark:text-gray-300 active:scale-90"
                >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <div className="text-center">
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{monthName}</h2>
                    <p className="text-xs font-black text-blue-600">{year}</p>
                </div>
                <button 
                    onClick={() => navigateMonth(1)} 
                    className="p-4 rounded-xl hover:bg-white dark:hover:bg-gray-600 transition shadow-md text-gray-600 dark:text-gray-300 active:scale-90"
                >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M9 5l7 7-7 7"/></svg>
                </button>
            </div>
            
            {loading && <div className="text-center py-4 text-blue-600 font-bold animate-pulse uppercase tracking-widest text-xs">Syncing...</div>}

            <div className="grid grid-cols-7 gap-2 text-center mb-4">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                    <div key={day} className={`font-black text-sm uppercase py-2 ${idx === 0 ? 'text-red-500' : 'text-gray-400'}`}>{day}</div>
                ))}
                {calendarDays.map((day, index) => {
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                    const record = markedRecords.get(dayKey);
                    const isMarked = !!record;
                    const isSunday = day.getDay() === 0;
                    const isFuture = day > todayDate;

                    let classes = 'h-24 w-full rounded-2xl flex flex-col justify-center items-center border-2 transition-all ';
                    let label = '';

                    if (!isCurrentMonth) {
                        classes += 'opacity-10 grayscale border-transparent pointer-events-none ';
                    } else if (isMarked) {
                        if (record.workingStatus === 'Working') {
                            classes += 'bg-green-600 border-green-700 text-white shadow-lg cursor-default ';
                            label = 'Working';
                        } else {
                            classes += 'bg-red-600 border-red-700 text-white shadow-lg cursor-default ';
                            label = record.workingStatus;
                        }
                    } else if (isSunday) {
                        classes += 'bg-red-600 border-red-700 text-white hover:scale-105 active:scale-95 ';
                        label = 'Sunday';
                    } else if (isFuture) {
                        classes += 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-300 cursor-not-allowed ';
                    } else {
                        classes += 'bg-white dark:bg-gray-700 border-gray-100 dark:border-gray-600 text-gray-800 dark:text-gray-100 hover:border-blue-500 hover:scale-105 active:scale-95 ';
                    }

                    return (
                        <button
                            key={index}
                            disabled={!isCurrentMonth || isFuture || isMarked}
                            onClick={() => handleDayClick(day)}
                            className={classes}
                        >
                            <span className="font-black text-2xl">{day.getDate()}</span>
                            {label && <span className="text-[10px] font-black uppercase mt-1">{label}</span>}
                        </button>
                    );
                })}
            </div>
            
            {isModalOpen && selectedDate && user && (
                <AttendanceFormModal 
                    user={user} 
                    date={selectedDate} 
                    onClose={() => setIsModalOpen(false)}
                    onSubmitSuccess={fetchMarkedDates}
                />
            )}
        </div>
    );
};

export default MarkAttendancePage;
