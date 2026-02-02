
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
    onNavigate?: (page: any) => void;
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

    const normalizeDateToKey = (dateStr: string) => {
        if (!dateStr) return '';
        const parts = dateStr.trim().split('/');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return '';
    };

    const parseCSV = (csv: string): Record<string, string>[] => {
        const lines = csv.split(/\r\n|\n/).filter(l => l);
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
        return lines.slice(1).map(line => {
            const vals = parseLine(line);
            return headers.reduce((obj, h, i) => ({ ...obj, [h]: vals[i] || '' }), {});
        });
    };

    const fetchMarkedDates = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&cb=${Date.now()}`);
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
                        if (!existing || new Date(record.timestamp).getTime() >= new Date(existing.timestamp).getTime()) {
                            recordMap.set(key, record);
                        }
                    }
                }
            });
            setMarkedRecords(recordMap);
        } catch (err) {
            setError('Failed to load data.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchMarkedDates(); }, [fetchMarkedDates]);

    const navigateMonth = (direction: number) => {
        const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1);
        setCurrentDate(next);
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-4 md:p-8 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                <h1 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-3">
                    <span className="p-2 bg-blue-600 rounded-xl text-white">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    </span>
                    Attendance Calendar
                </h1>
                <button 
                    onClick={() => setCurrentDate(new Date())}
                    className="w-full md:w-auto px-8 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl font-black text-xs uppercase border border-blue-100 dark:border-blue-800 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                >
                    Back to Today
                </button>
            </div>
            
            <div className="flex items-center gap-4 mb-8">
                <button 
                    onClick={() => navigateMonth(-1)} 
                    className="flex-1 flex items-center justify-center gap-2 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-transparent hover:border-blue-500 transition-all active:scale-95 group"
                >
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
                    <span className="hidden sm:inline font-black uppercase text-xs text-gray-400 group-hover:text-blue-600">Previous</span>
                </button>
                
                <div className="flex-[2] text-center bg-white dark:bg-gray-800 p-2 rounded-2xl border-2 border-gray-100 dark:border-gray-700 shadow-inner">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">{monthName}</h2>
                    <p className="text-[10px] font-black text-blue-600 mt-1 uppercase tracking-widest">{year}</p>
                </div>

                <button 
                    onClick={() => navigateMonth(1)} 
                    className="flex-1 flex items-center justify-center gap-2 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-transparent hover:border-blue-500 transition-all active:scale-95 group"
                >
                    <span className="hidden sm:inline font-black uppercase text-xs text-gray-400 group-hover:text-blue-600">Next</span>
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                </button>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-4">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i} className={`text-center font-black text-xs py-2 uppercase ${i === 0 ? 'text-red-500' : 'text-gray-400'}`}>{d}</div>
                ))}
                {calendarDays.map((day, i) => {
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                    const record = markedRecords.get(dayKey);
                    const isSunday = day.getDay() === 0;
                    const isFuture = day > todayDate;

                    let btnClass = 'h-20 sm:h-24 w-full rounded-2xl flex flex-col items-center justify-center border-2 transition-all ';
                    let label = '';

                    if (!isCurrentMonth) {
                        btnClass += 'opacity-10 grayscale border-transparent pointer-events-none ';
                    } else if (record) {
                        if (record.workingStatus === 'Working') {
                            btnClass += 'bg-green-600 border-green-700 text-white shadow-lg ';
                            label = 'Working';
                        } else {
                            btnClass += 'bg-red-600 border-red-700 text-white shadow-lg ';
                            label = record.workingStatus;
                        }
                    } else if (isSunday) {
                        btnClass += 'bg-red-600 border-red-700 text-white ';
                        label = 'Sunday';
                    } else if (isFuture) {
                        btnClass += 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-300 ';
                    } else {
                        btnClass += 'bg-white dark:bg-gray-700 border-gray-100 dark:border-gray-600 text-gray-800 dark:text-gray-100 hover:border-blue-500 hover:scale-105 active:scale-95 ';
                    }

                    return (
                        <button
                            key={i}
                            disabled={!isCurrentMonth || isFuture || !!record}
                            onClick={() => { setSelectedDate(day); setIsModalOpen(true); }}
                            className={btnClass}
                        >
                            <span className="font-black text-xl sm:text-2xl">{day.getDate()}</span>
                            {label && <span className="text-[8px] font-black uppercase mt-1 truncate w-full px-1">{label}</span>}
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
