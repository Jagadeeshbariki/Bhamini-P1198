import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GOOGLE_SHEET_CSV_URL } from '../config';
import { noto_sans_telugu_regular_base64 } from '../assets/noto-sans-telugu-font';

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

    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toLocaleString('default', { month: 'short' }));
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

    const years = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
    }, []);

    const months = useMemo(() => {
        return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    }, []);

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
                const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&_=${new Date().getTime()}`); // Prevent caching
                if (!response.ok) {
                    throw new Error(`Network response was not ok. Status: ${response.status}. Ensure the Google Sheet is published correctly.`);
                }
                const csvText = await response.text();
                const parsedData = parseCSV(csvText);
                
                const requiredColumns = ['Timestamp', 'SELECT YOUR NAME', 'CHOOSE DATE', 'WORKING/LEAVE/HOLIDAY', 'WRITE THE REASON FOR NOT WORKING', 'PLACE OF VISIT', 'PURPOSE OF VISIT', 'WORKING HOURS', 'OUTCOME'];
                const headers = parsedData.length > 0 ? Object.keys(parsedData[0]) : [];
                const missingColumns = requiredColumns.filter(col => !headers.includes(col));

                if (missingColumns.length > 0) {
                     throw new Error(`The published Google Sheet is missing required columns: ${missingColumns.join(', ')}. Please check your sheet's headers.`);
                }

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
                console.error("Failed to fetch or parse attendance data:", err);
                setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching data.');
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

            if (monthIndex !== -1) {
                const filtered = userRecords.filter(record => {
                    const parts = record.date.split('/');
                    if (parts.length === 3) {
                       const recordMonth = parseInt(parts[0], 10) - 1; // Month is 0-indexed
                       const recordYear = parseInt(parts[2], 10);
                       return recordMonth === monthIndex && recordYear.toString() === selectedYear;
                    }
                    return false;
                }).sort((a, b) => {
                    // M/D/YYYY format needs careful parsing
                    const datePartsA = a.date.split('/');
                    const datePartsB = b.date.split('/');
                    const dateA = new Date(+datePartsA[2], +datePartsA[0] - 1, +datePartsA[1]).getTime();
                    const dateB = new Date(+datePartsB[2], +datePartsB[0] - 1, +datePartsB[1]).getTime();
                    return dateA - dateB;
                });
                setFilteredData(filtered);
            } else {
                setFilteredData([]);
            }
        }
    }, [user, attendanceData, selectedMonth, selectedYear, months]);
    
    const downloadPDF = async () => {
        if (!user) return;
        setIsGenerating(true);
        setError(null);

        try {
            const doc = new jsPDF({ orientation: 'landscape' });

            // Add Telugu font support
            const fontFileName = 'NotoSansTelugu-Regular.ttf';
            doc.addFileToVFS(fontFileName, noto_sans_telugu_regular_base64);
            doc.addFont(fontFileName, 'NotoSansTelugu', 'normal');
            doc.setFont('NotoSansTelugu'); // Set as default

            const pageWidth = doc.internal.pageSize.getWidth();
            doc.setFontSize(12);
            doc.text('LEAD TECHNICAL AGENCY – WASSAN', pageWidth / 2, 15, { align: 'center' });
            doc.text('Project Name: HDFC Parivarthan', pageWidth / 2, 22, { align: 'center' });
            doc.setFontSize(14);
            doc.text('WORK DONE REPORT', pageWidth / 2, 29, { align: 'center' });

            doc.setFontSize(10);
            doc.text(`Month : ${selectedMonth}-${selectedYear}`, 14, 40);
            doc.text(`Budget Head: HDFC Parivarthan`, pageWidth - 14, 40, { align: 'right' });
            doc.text(`Name of the Person : ${user.username.toUpperCase()}`, 14, 47);
            doc.text(`Working GP :`, 14, 54);

            const tableColumn = ["Date", "Place Of Visit", "Purpose Of Visit", "Working Hours", "Outcomes"];
            const tableRows = filteredData.map(item => [
                item.date,
                item.placeOfVisit,
                item.purposeOfVisit,
                item.workingHours,
                item.outcomes
            ]);

            autoTable(doc, {
                startY: 60,
                head: [tableColumn],
                body: tableRows,
                theme: 'grid',
                styles: {
                    font: 'NotoSansTelugu', // Ensure table uses the Telugu font
                },
                headStyles: {
                    fillColor: [22, 160, 133],
                    textColor: 255,
                    font: 'NotoSansTelugu',
                },
            });

            doc.save(`Work_Done_Report_${user.username}_${selectedMonth}_${selectedYear}.pdf`);
        } catch (e) {
            console.error("PDF generation failed:", e);
            setError("PDF generation failed. An unexpected error occurred.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (loading) {
        return <div className="text-center p-8">Loading attendance data...</div>;
    }

    if (error && !isGenerating) { // Don't show data fetch error if a PDF error occurs
        return <div className="text-center p-8 text-red-500 bg-red-100 dark:bg-red-900 border border-red-500 rounded-lg">{error}</div>;
    }

    if (!user) {
        return <div className="text-center p-8">Please log in to view attendance.</div>;
    }
    
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Attendance Report</h1>
            
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                    <label htmlFor="month-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Month</label>
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
                    <label htmlFor="year-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year</label>
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

            <button
                onClick={downloadPDF}
                disabled={filteredData.length === 0 || isGenerating}
                className="w-full md:w-auto bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors mb-6 flex items-center justify-center"
            >
                 {isGenerating ? 'Generating...' : 'Download Report as PDF'}
            </button>
            {error && isGenerating && <div className="text-center my-2 p-2 text-red-500 bg-red-100 dark:bg-red-900 border border-red-500 rounded-lg">{error}</div>}


            <div className="overflow-x-auto">
                {filteredData.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Place Of Visit</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Purpose Of Visit</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Working Hours</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Outcomes</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredData.map((record, index) => (
                                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{record.date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{record.placeOfVisit}</td>
                                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-500 dark:text-gray-400">{record.purposeOfVisit}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{record.workingHours}</td>
                                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-500 dark:text-gray-400">{record.outcomes}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No records found for {user.username} for {selectedMonth} {selectedYear}.
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportPage;