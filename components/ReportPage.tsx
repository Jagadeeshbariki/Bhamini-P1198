
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
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

const ReportPage: React.FC = () => {
    const { user } = useAuth();
    const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
    const [filteredData, setFilteredData] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toLocaleString('default', { month: 'short' }));
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

    const years = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
    }, []);

    const months = useMemo(() => {
        return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    }, []);

    // Calculate the report period strings for display
    const reportPeriodLabel = useMemo(() => {
        const monthIndex = months.indexOf(selectedMonth);
        const year = parseInt(selectedYear);
        
        const startDate = new Date(year, monthIndex - 1, 26);
        const endDate = new Date(year, monthIndex, 25);
        
        const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
        return `${fmt(startDate)} to ${fmt(endDate)}`;
    }, [selectedMonth, selectedYear, months]);

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
    
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&_=${new Date().getTime()}`);
                if (!response.ok) {
                    throw new Error(`Network response was not ok. Status: ${response.status}.`);
                }
                const csvText = await response.text();
                const parsedData = parseCSV(csvText);
                
                const mappedData: AttendanceRecord[] = parsedData.map((row: any) => ({
                    timestamp: row['Timestamp'],
                    name: row['SELECT YOUR NAME'],
                    date: row['CHOOSE DATE'],
                    workingStatus: row['WORKING/LEAVE/HOLIDAY'],
                    reasonNotWorking: row['WRITE THE REASON FOR NOT WORKING'],
                    placeOfVisit: row['PLACE OF VISIT'],
                    purposeOfVisit: row['PURPOSE OF VISIT'],
                    workingHours: row['WORKING HOURS'],
                    outcomes: row['OUTCOME'],
                }));
                setAttendanceData(mappedData);
            } catch (err) {
                console.error("Failed to fetch attendance data:", err);
                setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user && attendanceData.length > 0) {
            const userRecords = attendanceData.filter(record => record.name === user.username);
            const monthIndex = months.indexOf(selectedMonth);
            const year = parseInt(selectedYear);

            if (monthIndex !== -1) {
                // New logic: 26th of prev month to 25th of current month
                const startDate = new Date(year, monthIndex - 1, 26, 0, 0, 0);
                const endDate = new Date(year, monthIndex, 25, 23, 59, 59);

                const filtered = userRecords.filter(record => {
                    const parts = record.date.split('/');
                    if (parts.length === 3) {
                       // Date format is D/M/YYYY
                       const day = parseInt(parts[0], 10);
                       const month = parseInt(parts[1], 10) - 1;
                       const recYear = parseInt(parts[2], 10);
                       const recordDate = new Date(recYear, month, day);
                       
                       return recordDate >= startDate && recordDate <= endDate;
                    }
                    return false;
                }).sort((a, b) => {
                    const datePartsA = a.date.split('/');
                    const datePartsB = b.date.split('/');
                    const dateA = new Date(+datePartsA[2], +datePartsA[1] - 1, +datePartsA[0]).getTime();
                    const dateB = new Date(+datePartsB[2], +datePartsB[1] - 1, +datePartsB[0]).getTime();
                    return dateA - dateB;
                });
                setFilteredData(filtered);
            } else {
                setFilteredData([]);
            }
        }
    }, [user, attendanceData, selectedMonth, selectedYear, months]);
    
    const downloadPDF = async () => {
        if (!user || !printRef.current) return;
        setIsGenerating(true);
        setError(null);

        try {
            // @ts-ignore - html2pdf is globally available via CDN
            const worker = window.html2pdf();
            
            const opt = {
                margin: [10, 10, 10, 10], // Increased side margins to prevent clipping
                filename: `Work_Done_Report_${user.username}_${selectedMonth}_${selectedYear}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 2, 
                    useCORS: true,
                    logging: false,
                    letterRendering: true,
                    scrollX: 0,
                    scrollY: 0,
                    windowWidth: 1200 // Ensure sufficient width for calculation
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
            };

            await worker.from(printRef.current).set(opt).save();
        } catch (e) {
            console.error("PDF generation failed:", e);
            setError("PDF generation failed. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (loading) {
        return <div className="text-center p-8">Loading attendance data...</div>;
    }

    if (error && !isGenerating) {
        return <div className="text-center p-8 text-red-500 bg-red-100 dark:bg-red-900 border border-red-500 rounded-lg">{error}</div>;
    }

    if (!user) {
        return <div className="text-center p-8">Please log in to view attendance.</div>;
    }
    
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h1 className="text-3xl font-bold mb-2 text-gray-800 dark:text-gray-200">Attendance Report</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                Showing data from 26th of previous month to 25th of selected month.
            </p>
            
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                    <label htmlFor="month-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Month</label>
                    <select
                        id="month-select"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        {months.map(month => <option key={month} value={month}>{month}</option>)}
                    </select>
                </div>
                <div className="flex-1">
                    <label htmlFor="year-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Year</label>
                    <select
                        id="year-select"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        {years.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                </div>
            </div>

            <div className="mb-4 text-blue-700 dark:text-blue-300 font-semibold bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                Period: {reportPeriodLabel}
            </div>

            <button
                onClick={downloadPDF}
                disabled={filteredData.length === 0 || isGenerating}
                className="w-full md:w-auto bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors mb-6 flex items-center justify-center"
            >
                 {isGenerating ? 'Generating PDF...' : 'Download Report as PDF'}
            </button>
            {error && isGenerating && <div className="text-center my-2 p-2 text-red-500 bg-red-100 dark:bg-red-900 border border-red-500 rounded-lg">{error}</div>}


            <div className="overflow-x-auto">
                {filteredData.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 telugu-font">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Place Of Visit</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Purpose Of Visit</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hours</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Outcomes</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredData.map((record, index) => {
                                const isWorking = record.workingStatus === 'Working';
                                return (
                                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{record.date}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {isWorking ? record.placeOfVisit : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-normal text-sm text-gray-500 dark:text-gray-400">
                                            {isWorking ? (
                                                record.purposeOfVisit
                                            ) : (
                                                <span className="font-semibold text-orange-600 dark:text-orange-400">
                                                    {record.workingStatus}: {record.reasonNotWorking}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {isWorking ? record.workingHours : '0'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-normal text-sm text-gray-500 dark:text-gray-400">
                                            {isWorking ? record.outcomes : '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No records found for {user.username} for the period ending {selectedMonth} {selectedYear}.
                    </div>
                )}
            </div>

            {/* HIDDEN PRINTABLE SECTION: Optimized for A4 Landscape */}
            <div style={{ position: 'fixed', left: '-9999px', top: '0', zIndex: -100 }}>
                {/* Fixed width for landscape container, adding box-sizing and padding to prevent border cut-off */}
                <div ref={printRef} className="p-10 bg-white telugu-font" style={{ width: '1080px', color: '#000000', boxSizing: 'border-box' }}>
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold uppercase mb-1" style={{ color: '#000000' }}>LEAD TECHNICAL AGENCY – WASSAN</h1>
                        <h2 className="text-xl font-semibold mb-1" style={{ color: '#000000' }}>Project Name: HDFC Parivarthan</h2>
                        <h3 className="text-3xl font-black border-b-4 border-black inline-block pb-1 px-8 mt-4" style={{ color: '#000000' }}>WORK DONE REPORT</h3>
                    </div>

                    <div className="flex justify-between mb-8 text-base font-bold" style={{ color: '#000000' }}>
                        <div>
                            <p>Month : {selectedMonth} - {selectedYear}</p>
                            <p className="mt-2 text-blue-800">Period: {reportPeriodLabel}</p>
                            <p className="mt-2">Name of the Person : {user.username.toUpperCase()}</p>
                            <p className="mt-2">Working GP : ___________________________</p>
                        </div>
                        <div className="text-right">
                            <p>Budget Head: HDFC Parivarthan</p>
                        </div>
                    </div>

                    {/* Using explicit width and table-fixed to help with border rendering. Ensure w-[calc(100%-2px)] to avoid overlap clipping. */}
                    <table className="w-full border-collapse border-2 border-black text-sm table-fixed" style={{ color: '#000000', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f3f4f6' }}>
                                <th className="border-2 border-black px-3 py-2 text-center w-28 font-bold">Date</th>
                                <th className="border-2 border-black px-3 py-2 text-center w-48 font-bold">Place Of Visit</th>
                                <th className="border-2 border-black px-3 py-2 text-center font-bold">Purpose Of Visit</th>
                                <th className="border-2 border-black px-3 py-2 text-center w-24 font-bold">Hours</th>
                                <th className="border-2 border-black px-3 py-2 text-center font-bold">Outcomes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((record, index) => {
                                const isWorking = record.workingStatus === 'Working';
                                return (
                                    <tr key={index}>
                                        <td className="border-2 border-black px-3 py-2 text-center" style={{ color: '#000000' }}>{record.date}</td>
                                        <td className="border-2 border-black px-3 py-2" style={{ color: '#000000' }}>
                                            {isWorking ? record.placeOfVisit : '-'}
                                        </td>
                                        <td className="border-2 border-black px-3 py-2" style={{ color: '#000000' }}>
                                            {isWorking ? (
                                                record.purposeOfVisit
                                            ) : (
                                                <strong>{record.workingStatus}: {record.reasonNotWorking}</strong>
                                            )}
                                        </td>
                                        <td className="border-2 border-black px-3 py-2 text-center" style={{ color: '#000000' }}>
                                            {isWorking ? record.workingHours : '0'}
                                        </td>
                                        <td className="border-2 border-black px-3 py-2" style={{ color: '#000000' }}>
                                            {isWorking ? record.outcomes : '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                            {/* Fill empty rows to maintain layout if few records */}
                            {filteredData.length < 5 && Array.from({ length: 10 - filteredData.length }).map((_, i) => (
                                <tr key={`empty-${i}`} style={{ height: '45px' }}>
                                    <td className="border-2 border-black px-3 py-2"></td>
                                    <td className="border-2 border-black px-3 py-2"></td>
                                    <td className="border-2 border-black px-3 py-2"></td>
                                    <td className="border-2 border-black px-3 py-2"></td>
                                    <td className="border-2 border-black px-3 py-2"></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="mt-24 flex justify-between px-12 italic font-bold" style={{ color: '#000000' }}>
                        <div className="text-center">
                            <div className="w-48 border-b-2 border-black mb-2"></div>
                            <p>Signature of the Staff</p>
                        </div>
                        <div className="text-center">
                            <div className="w-48 border-b-2 border-black mb-2"></div>
                            <p>Signature of the Coordinator</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportPage;
