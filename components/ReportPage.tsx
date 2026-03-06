
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { GOOGLE_SHEET_CSV_URL } from '../config';
import AttendanceFormModal from './AttendanceFormModal';
import { initializePdfMake } from '../utils/pdfMakeSetup';

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
    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const [editingRecord, setEditingRecord] = useState<{date: Date, data: AttendanceRecord} | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toLocaleString('default', { month: 'short' }));
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

    const years = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
    }, []);

    const months = useMemo(() => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], []);

    const normalizeDateStr = (dateStr: string) => {
        const p = dateStr.split('/');
        if (p.length !== 3) return dateStr;
        return `${p[0].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[2]}`;
    };

    const getTimestampMs = (ts: string) => {
        if (!ts) return 0;
        const d = new Date(ts);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&_=${new Date().getTime()}`);
            if (!response.ok) throw new Error(`Network error (${response.status})`);
            const csvText = await response.text();
            
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

            const lines = csvText.split(/\r\n|\n/).filter(l => l);
            if (lines.length < 1) return;
            const headers = parseLine(lines[0]);
            
            const remoteMapped: AttendanceRecord[] = lines.slice(1).map(line => {
                const vals = parseLine(line);
                const row: any = {};
                headers.forEach((h, i) => row[h] = vals[i]);
                return {
                    timestamp: row['Timestamp'] || '',
                    name: (row['SELECT YOUR NAME'] || '').trim(),
                    date: row['CHOOSE DATE'] || '',
                    workingStatus: row['WORKING/LEAVE/HOLIDAY'] || '',
                    reasonNotWorking: row['WRITE THE REASON FOR NOT WORKING'] || '',
                    placeOfVisit: row['PLACE OF VISIT'] || '',
                    purposeOfVisit: row['PURPOSE OF VISIT'] || '',
                    workingHours: row['WORKING HOURS'] || '',
                    outcomes: row['OUTCOME'] || '',
                };
            });

            if (user) {
                const localKey = `bhamini_local_${user.username}`;
                const localSubmissions = JSON.parse(localStorage.getItem(localKey) || '{}');
                const uniqueDatesMap = new Map<string, AttendanceRecord>();
                
                remoteMapped.forEach(r => {
                    if (r.name.toLowerCase() === user.username.toLowerCase()) {
                        const normalized = normalizeDateStr(r.date);
                        const existing = uniqueDatesMap.get(normalized);
                        if (!existing || getTimestampMs(r.timestamp) >= getTimestampMs(existing.timestamp)) {
                            uniqueDatesMap.set(normalized, r);
                        }
                    }
                });

                Object.keys(localSubmissions).forEach(d => {
                    const localRec = localSubmissions[d];
                    const normalized = normalizeDateStr(d);
                    const existing = uniqueDatesMap.get(normalized);
                    if (!existing || getTimestampMs(localRec.timestamp) >= getTimestampMs(existing.timestamp)) {
                        uniqueDatesMap.set(normalized, localRec);
                    }
                });

                setAttendanceData(Array.from(uniqueDatesMap.values()));
            } else {
                setAttendanceData(remoteMapped);
            }

        } catch (err) {
            console.error('Failed to sync data:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { if (user) fetchData(); }, [user, fetchData]);

    useEffect(() => {
        if (user && attendanceData.length > 0) {
            const userName = user.username.trim().toLowerCase();
            const monthIdx = months.indexOf(selectedMonth);
            const yearNum = parseInt(selectedYear);

            const start = new Date(yearNum, monthIdx - 1, 26, 0, 0, 0).getTime();
            const end = new Date(yearNum, monthIdx, 25, 23, 59, 59).getTime();

            const filtered = attendanceData.filter(r => {
                if (r.name.trim().toLowerCase() !== userName) return false;
                const p = r.date.split('/');
                if (p.length !== 3) return false;
                const rd = new Date(+p[2], +p[1]-1, +p[0]).getTime();
                return rd >= start && rd <= end;
            }).sort((a, b) => {
                const pa = a.date.split('/'), pb = b.date.split('/');
                return new Date(+pa[2], +pa[1]-1, +pa[0]).getTime() - new Date(+pb[2], +pb[1]-1, +pb[0]).getTime();
            });
            setFilteredData(filtered);
        } else if (attendanceData.length === 0) {
            setFilteredData([]);
        }
    }, [user, attendanceData, selectedMonth, selectedYear, months]);

    const handleEdit = (record: AttendanceRecord) => {
        const p = record.date.split('/');
        const d = new Date(+p[2], +p[1]-1, +p[0]);
        setEditingRecord({ date: d, data: record });
    };

    const downloadPDF = async () => {
        if (!user || filteredData.length === 0) return;
        setIsGenerating(true);
        setPdfError(null);

        try {
            // Get the configured pdfMake instance
            const pdfMakeInstance = await initializePdfMake();
            
            // Defensive check: Ensure fonts are actually in the VFS
            const vfs = (pdfMakeInstance as any).vfs || {};
            const availableKeys = Object.keys(vfs);
            console.log('📄 Generating PDF. VFS Keys available:', availableKeys);
            
            const requiredFonts = ['NotoSansTelugu-Regular.ttf', 'Roboto-Regular.ttf'];
            const fontStats = requiredFonts.map(f => `${f}: ${vfs[f]?.length || 0} chars`);
            console.log('📄 Font Stats:', fontStats);
            
            const missingFonts = requiredFonts.filter(f => !vfs[f] || vfs[f].length < 100);
            
            if (missingFonts.length > 0) {
                console.error('❌ VFS Missing Fonts. Missing:', missingFonts, 'Keys found:', availableKeys);
                const errorMsg = `Required fonts (${missingFonts.join(', ')}) could not be loaded correctly. This might be due to a slow internet connection. Please refresh the page and try again.`;
                setPdfError(errorMsg);
                throw new Error(errorMsg);
            }

            const docDefinition: any = {
                pageOrientation: 'landscape',
                pageSize: 'A4',
                pageMargins: [15, 25, 15, 25],
                // Use NotoSansTelugu as default as it's more likely to handle mixed content if it has Latin
                defaultStyle: {
                    font: 'NotoSansTelugu',
                    fontSize: 10,
                    lineHeight: 1.2
                },
                header: (currentPage: number) => {
                    if (currentPage === 1) return [];
                    return [
                        {
                            canvas: [{ type: 'rect', x: 15, y: 10, w: 812, h: 20, color: '#1e40af' }]
                        },
                        {
                            text: 'LEAD TECHNICAL AGENCY – WASSAN',
                            style: 'headerBox',
                            fontSize: 14,
                            margin: [0, -17, 0, 0]
                        }
                    ];
                },
                content: [
                    {
                        canvas: [{ type: 'rect', x: 0, y: 0, w: 812, h: 25, color: '#1e40af' }]
                    },
                    {
                        text: 'LEAD TECHNICAL AGENCY – WASSAN',
                        style: 'headerBox',
                        margin: [0, -22, 0, 10]
                    },
                    {
                        table: {
                            widths: ['*'],
                            body: [
                                [{ text: `HDFC PARIVARTAN PROJECT - Bhamini P1198`, style: 'subHeader' }],
                                [{ text: 'WORK DONE REPORT', style: 'title', fillColor: '#f3f4f6' }]
                            ]
                        },
                        layout: {
                            hLineWidth: () => 0.5,
                            vLineWidth: () => 0.5,
                            hLineColor: () => '#aaaaaa',
                            vLineColor: () => '#aaaaaa'
                        }
                    },
                    {
                        table: {
                            widths: [100, '*', 120, '*'],
                            body: [
                                [
                                    { text: 'Month:', bold: true, fillColor: '#f9fafb' }, 
                                    { text: `${selectedMonth} ${selectedYear}` },
                                    { text: 'Name of the Person:', bold: true, fillColor: '#f9fafb' }, 
                                    { text: user.username.toUpperCase() }
                                ],
                                [
                                    { text: 'Working GP:', bold: true, fillColor: '#f9fafb' }, 
                                    { text: filteredData[0]?.placeOfVisit || 'Field Operations', colSpan: 3 },
                                    {}, {}
                                ]
                            ]
                        },
                        layout: {
                            hLineWidth: () => 0.5,
                            vLineWidth: () => 0.5,
                            hLineColor: () => '#aaaaaa',
                            vLineColor: () => '#aaaaaa'
                        },
                        margin: [0, 5, 0, 10]
                    },
                    {
                        table: {
                            headerRows: 1,
                            widths: [25, 65, 110, '*', 40, 140],
                            dontBreakRows: true,
                            body: [
                                [
                                    { text: 'S.No', style: 'tableHeader' },
                                    { text: 'Date', style: 'tableHeader' },
                                    { text: 'Place of Visit', style: 'tableHeader' },
                                    { text: 'Purpose of visit/Work done', style: 'tableHeader' },
                                    { text: 'Hours', style: 'tableHeader' },
                                    { text: 'Outcome', style: 'tableHeader' }
                                ],
                                ...filteredData.map((r, i) => [
                                    { text: (i + 1).toString(), alignment: 'center', fontSize: 9 },
                                    { text: r.date, alignment: 'center', fontSize: 9 },
                                    { text: r.workingStatus === 'Working' ? r.placeOfVisit : r.workingStatus, fontSize: 9 },
                                    { text: r.workingStatus === 'Working' ? r.purposeOfVisit : `REASON: ${r.reasonNotWorking}`, fontSize: 9 },
                                    { text: r.workingStatus === 'Working' ? r.workingHours : '0', alignment: 'center', bold: true, fontSize: 9 },
                                    { text: r.outcomes, fontSize: 9 }
                                ]),
                                [
                                    { text: 'Total Monthly Hours:', colSpan: 4, alignment: 'right', bold: true, fillColor: '#f3f4f6', fontSize: 9 },
                                    {}, {}, {},
                                    { 
                                        text: filteredData.reduce((acc, curr) => acc + (parseFloat(curr.workingHours) || 0), 0).toFixed(1),
                                        alignment: 'center',
                                        bold: true,
                                        fillColor: '#f3f4f6',
                                        decoration: 'underline',
                                        fontSize: 9
                                    },
                                    { text: '', fillColor: '#f3f4f6' }
                                ]
                            ]
                        },
                        layout: {
                            hLineWidth: (i: number) => (i === 0) ? 1 : 0.5,
                            vLineWidth: (i: number) => (i === 0) ? 1 : 0.5,
                            hLineColor: () => '#444444',
                            vLineColor: () => '#444444',
                            paddingLeft: () => 4,
                            paddingRight: () => 4,
                            paddingTop: () => 4,
                            paddingBottom: () => 4
                        }
                    },
                    {
                        columns: [
                            {
                                stack: [
                                    { text: '', margin: [0, 25, 0, 0] },
                                    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 170, y2: 0, lineWidth: 0.5 }] },
                                    { text: 'SIGNATURE OF THE STAFF', bold: true, margin: [0, 5, 0, 0], fontSize: 9 },
                                    { text: `(${user.username})`, fontSize: 8 },
                                    { text: 'Date: _________________', fontSize: 8, margin: [0, 6, 0, 0] },
                                    { text: 'Place: _________________', fontSize: 8, margin: [0, 3, 0, 0] }
                                ],
                                alignment: 'center'
                            },
                            {
                                stack: [
                                    { text: '', margin: [0, 25, 0, 0] },
                                    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 170, y2: 0, lineWidth: 0.5 }] },
                                    { text: 'VERIFIED BY COORDINATOR', bold: true, margin: [0, 5, 0, 0], fontSize: 9 },
                                    { text: '(Name & Designation)', fontSize: 8 }
                                ],
                                alignment: 'center'
                            }
                        ],
                        margin: [0, 25, 0, 0],
                        unbreakable: true
                    },
                    {
                        text: `Bhamini P1198 Field System • Generated: ${new Date().toLocaleString()}`,
                        style: 'footer',
                        alignment: 'center',
                        margin: [0, 10, 0, 0]
                    }
                ],
                styles: {
                    headerBox: {
                        fontSize: 18,
                        bold: true,
                        color: 'white',
                        alignment: 'center'
                    },
                    subHeader: {
                        fontSize: 14,
                        bold: true,
                        alignment: 'center',
                        margin: [0, 3, 0, 3]
                    },
                    title: {
                        fontSize: 12,
                        bold: true,
                        alignment: 'center',
                        margin: [0, 2, 0, 2]
                    },
                    tableHeader: {
                        bold: true,
                        fontSize: 10,
                        color: 'black',
                        fillColor: '#f3f4f6',
                        alignment: 'center',
                        margin: [0, 3, 0, 3]
                    },
                    footer: {
                        fontSize: 8,
                        italics: true,
                        opacity: 0.7
                    }
                }
            };

            // Create PDF using the initialized instance
            const pdf = pdfMakeInstance.createPdf(
                docDefinition, 
                undefined, 
                (pdfMakeInstance as any).fonts, 
                (pdfMakeInstance as any).vfs
            );
            
            // Download the PDF
            pdf.download(`Work_Done_Report_${user.username}_${selectedMonth}_${selectedYear}.pdf`);
            
            // Also generate a preview URL if needed
            pdf.getDataUrl((dataUrl) => {
                setPdfPreviewUrl(dataUrl);
            });

        } catch (err: any) {
            console.error('PDF Generation Error:', err);
            setPdfError(err.message || "An unexpected error occurred while generating the PDF. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (loading) return <div className="text-center p-20 animate-pulse text-blue-600 font-bold">Checking local & remote records...</div>;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 dark:text-white">Reporting</h1>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">Monthly Work Statement</p>
                </div>
                <div className="flex gap-2">
                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-gray-50 dark:bg-gray-700 px-4 py-2 rounded-xl font-bold border-none ring-1 ring-gray-200 dark:ring-gray-600">
                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-gray-50 dark:bg-gray-700 px-4 py-2 rounded-xl font-bold border-none ring-1 ring-gray-200 dark:ring-gray-600">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-2">
                <button
                    onClick={downloadPDF}
                    disabled={filteredData.length === 0 || isGenerating}
                    className="flex-1 bg-blue-600 text-white font-black py-3 px-6 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>
                    {isGenerating ? 'Generating PDF...' : 'Export Official PDF'}
                </button>
            </div>

            {pdfError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4 rounded-xl mb-6 flex items-start gap-3 animate-shake">
                    <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <div>
                        <p className="text-sm font-bold text-red-800 dark:text-red-200">PDF Generation Failed</p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{pdfError}</p>
                    </div>
                </div>
            )}

            {pdfPreviewUrl && (
                <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-500">PDF Preview</h3>
                        <button 
                            onClick={() => setPdfPreviewUrl(null)}
                            className="text-xs font-bold text-gray-400 hover:text-red-500"
                        >
                            Close Preview
                        </button>
                    </div>
                    <iframe 
                        src={pdfPreviewUrl} 
                        className="w-full h-[500px] rounded-xl border border-gray-200 dark:border-gray-600 shadow-inner"
                        title="PDF Preview"
                    />
                </div>
            )}
            
            <div className="bg-blue-50 dark:bg-blue-900/10 p-2 rounded-lg mb-6 border border-blue-100 dark:border-blue-800">
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold text-center italic">
                    Deduplication Active: Only your latest entry for each date is displayed.
                </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700" ref={printRef}>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-4 py-4 text-[10px] font-black uppercase text-gray-400">Date</th>
                            <th className="px-4 py-4 text-[10px] font-black uppercase text-gray-400">Activity / Place</th>
                            <th className="px-4 py-4 text-[10px] font-black uppercase text-gray-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                        {filteredData.map((record, index) => (
                            <tr key={index} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors text-gray-800 dark:text-gray-200">
                                <td className="px-4 py-4 font-bold text-sm whitespace-nowrap">{record.date}</td>
                                <td className="px-4 py-4 text-sm">
                                    <div className="font-bold">{record.workingStatus === 'Working' ? record.placeOfVisit : record.workingStatus}</div>
                                    <div className="text-xs text-gray-500 line-clamp-1">{record.workingStatus === 'Working' ? record.purposeOfVisit : record.reasonNotWorking}</div>
                                </td>
                                <td className="px-4 py-4 text-right">
                                    <button 
                                        onClick={() => handleEdit(record)}
                                        className="text-gray-400 hover:text-blue-600 p-2 rounded-lg transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredData.length === 0 && <div className="p-20 text-center text-gray-400 italic">No records found for the selected 26th-25th period.</div>}
            </div>

            {editingRecord && user && (
                <AttendanceFormModal 
                    user={user} 
                    date={editingRecord.date} 
                    initialData={editingRecord.data}
                    onClose={() => setEditingRecord(null)}
                    onSubmitSuccess={() => { fetchData(); setEditingRecord(null); }}
                />
            )}
        </div>
    );
};

export default ReportPage;