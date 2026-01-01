
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { generateCalendarDays } from '../utils/calendar';
import AttendanceFormModal from './AttendanceFormModal';
import { GOOGLE_SHEET_CSV_URL } from '../config';

interface MarkAttendancePageProps {
    onNavigate?: (page: 'home' | 'activity' | 'login' | 'attendance-report' | 'mark-attendance' | 'admin') => void;
}

const MarkAttendancePage: React.FC<MarkAttendancePageProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());
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
                const char = line[j];
    
                if (char === '"') {
                    inQuote = !inQuote;
                } else if (char === ',' && !inQuote) {
                    values.push(value.trim());
                    value = '';
                } else {
                    value += char;
                }
            }
            values.push(value.trim());
            return values;
        };

        const headers = parseLine(lines[0]);
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

    const fetchMarkedDates = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&_=${new Date().getTime()}`);
            if (!response.ok) {
                throw new Error('Failed to fetch attendance data.');
            }
            const csvText = await response.text();
            const parsedData = parseCSV(csvText);

            const headers = parsedData.length > 0 ? Object.keys(parsedData[0]) : [];
            const requiredColumns = ['SELECT YOUR NAME', 'CHOOSE DATE'];
            const missingColumns = requiredColumns.filter(col => !headers.includes(col));

            if (missingColumns.length > 0) {
                throw new Error(`Required columns (${missingColumns.join(', ')}) not found in the sheet.`);
            }

            const dates = new Set<string>();
            parsedData.forEach(row => {
                if (row['SELECT YOUR NAME'] && row['SELECT YOUR NAME'].trim() === user.username) {
                    if (row['CHOOSE DATE']) {
                        const parts = row['CHOOSE DATE'].trim().split('/');
                        if (parts.length === 3) {
                             const year = parts[2];
                             const month = String(parts[1]).padStart(2, '0');
                             const day = String(parts[0]).padStart(2, '0');
                             const formattedDate = `${year}-${month}-${day}`;
                            dates.add(formattedDate);
                        }
                    }
                }
            });
            setMarkedDates(dates);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchMarkedDates();
    }, [fetchMarkedDates]);

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleDayClick = (day: Date) => {
        if (day > today) {
            return;
        }

        const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
        const isMarked = markedDates.has(dayKey);

        if (!isMarked) {
            setSelectedDate(day);
            setIsModalOpen(true);
        }
    };
    
    const handleFormSuccess = (submittedDate: Date) => {
        const dayKey = `${submittedDate.getFullYear()}-${String(submittedDate.getMonth() + 1).padStart(2, '0')}-${String(submittedDate.getDate()).padStart(2, '0')}`;
        
        setMarkedDates(prevDates => {
            const newDates = new Set(prevDates);
            newDates.add(dayKey);
            return newDates;
        });

        // After successful action, go to Hari (Activity Page) as requested
        if (onNavigate) {
            onNavigate('activity');
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Mark Attendance</h1>
            
            <div className="flex items-center justify-between mb-4">
                <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                    &lt;
                </button>
                <h2 className="text-xl font-semibold">{monthName} {year}</h2>
                <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                    &gt;
                </button>
            </div>
            
            {loading && <div className="text-center">Loading...</div>}
            {error && <div className="text-center text-red-500">{error}</div>}

            <div className="grid grid-cols-7 gap-1 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="font-bold text-gray-600 dark:text-gray-400 text-sm py-2">{day}</div>
                ))}
                {calendarDays.map((day, index) => {
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                    const isMarked = markedDates.has(dayKey);
                    const isFutureDate = day > today;

                    return (
                        <button
                            key={index}
                            onClick={() => handleDayClick(day)}
                            disabled={isMarked || isFutureDate}
                            className={`p-2 h-16 w-full rounded-lg transition text-sm flex flex-col justify-center items-center
                                ${!isCurrentMonth ? 'text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'}
                                ${isMarked 
                                    ? 'bg-green-200 dark:bg-green-800 cursor-not-allowed' 
                                    : isFutureDate 
                                        ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                                        : 'hover:bg-blue-100 dark:hover:bg-gray-700'
                                }
                            `}
                        >
                            <span className="font-medium">{day.getDate()}</span>
                            {isMarked && <span className="text-xs text-green-700 dark:text-green-300">Done</span>}
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
