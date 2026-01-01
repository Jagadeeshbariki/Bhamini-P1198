
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

    const today = useMemo(() => {
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

    const fetchMarkedDates = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&_=${new Date().getTime()}`);
            if (!response.ok) throw new Error('Failed to fetch attendance data.');
            const csvText = await response.text();
            const parsedData = parseCSV(csvText);

            const recordMap = new Map<string, AttendanceRecord>();
            
            // 1. Load remote data
            parsedData.forEach(row => {
                if (row['SELECT YOUR NAME'] && row['SELECT YOUR NAME'].trim() === user.username) {
                    const dateStr = row['CHOOSE DATE'] || '';
                    const parts = dateStr.trim().split('/');
                    if (parts.length === 3) {
                         const y = parts[2];
                         const m = String(parts[1]).padStart(2, '0');
                         const d = String(parts[0]).padStart(2, '0');
                         const key = `${y}-${m}-${d}`;
                         
                         const record: AttendanceRecord = {
                            timestamp: row['Timestamp'] || '',
                            name: row['SELECT YOUR NAME'] || '',
                            date: dateStr,
                            workingStatus: row['WORKING/LEAVE/HOLIDAY'] || '',
                            reasonNotWorking: row['WRITE THE REASON FOR NOT WORKING'] || '',
                            placeOfVisit: row['PLACE OF VISIT'] || '',
                            purposeOfVisit: row['PURPOSE OF VISIT'] || '',
                            workingHours: row['WORKING HOURS'] || '',
                            outcomes: row['OUTCOME'] || '',
                         };
                         recordMap.set(key, record);
                    }
                }
            });

            // 2. Overlay local pending submissions for instant feedback
            const localKey = `bhamini_local_${user.username}`;
            const localSubmissions = JSON.parse(localStorage.getItem(localKey) || '{}');
            Object.keys(localSubmissions).forEach(dateStr => {
                const parts = dateStr.split('/');
                const key = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                recordMap.set(key, localSubmissions[dateStr]);
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
        if (day > today) return;

        const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
        const isMarked = markedRecords.has(dayKey);

        // User wants to block edit in calendar.
        // If already marked, do nothing. Direct user to Report page via UI hint.
        if (isMarked) return;

        setSelectedDate(day);
        setIsModalOpen(true);
    };
    
    const handleFormSuccess = () => {
        fetchMarkedDates();
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Attendance Tracker</h1>
                <div className="text-xs bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 p-2 rounded-lg border border-orange-100 dark:border-orange-800 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span>Already Saved? Go to <b>Reports</b> to edit entries.</span>
                </div>
            </div>
            
            <div className="flex items-center justify-between mb-4 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl">
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-600 transition shadow-sm">
                    &lt;
                </button>
                <h2 className="text-xl font-bold">{monthName} {year}</h2>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-600 transition shadow-sm">
                    &gt;
                </button>
            </div>
            
            {loading && (
                <div className="flex justify-center items-center py-4 text-blue-600 gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-bold animate-pulse">Syncing...</span>
                </div>
            )}
            {error && <div className="text-center text-red-500 bg-red-50 p-2 rounded mb-4 font-bold text-xs">{error}</div>}

            <div className="grid grid-cols-7 gap-2 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="font-black text-[10px] uppercase tracking-widest text-gray-400 py-2">{day}</div>
                ))}
                {calendarDays.map((day, index) => {
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                    const isMarked = markedRecords.has(dayKey);
                    const isFutureDate = day > today;

                    return (
                        <button
                            key={index}
                            onClick={() => handleDayClick(day)}
                            disabled={isFutureDate}
                            className={`p-2 h-16 w-full rounded-xl transition-all flex flex-col justify-center items-center border-2
                                ${!isCurrentMonth ? 'opacity-20' : ''}
                                ${isMarked 
                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-500/30 text-green-700 dark:text-green-300 cursor-default opacity-80' 
                                    : isFutureDate 
                                        ? 'border-transparent text-gray-300 dark:text-gray-700 cursor-not-allowed' 
                                        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-blue-500 hover:shadow-lg active:scale-95'
                                }
                            `}
                        >
                            <span className="font-bold text-lg">{day.getDate()}</span>
                            {isMarked && <span className="text-[10px] font-black uppercase tracking-tighter">Saved</span>}
                        </button>
                    );
                })}
            </div>
            
            {isModalOpen && selectedDate && user && (
                <AttendanceFormModal 
                    user={user} 
                    date={selectedDate} 
                    onClose={() => setIsModalOpen(false)}
                    onSubmitSuccess={handleFormSuccess}
                />
            )}
        </div>
    );
};

export default MarkAttendancePage;
