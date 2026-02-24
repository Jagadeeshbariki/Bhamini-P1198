
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { GOOGLE_SHEET_CSV_URL } from '../config';
import AttendanceFormModal from './AttendanceFormModal';

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
        if (!user || !printRef.current) return;
        
        const html2pdf = (window as any).html2pdf;
        if (!html2pdf) {
            alert("PDF library is not loaded. Please refresh and try again.");
            return;
        }

        setIsGenerating(true);
        
        // 1. Capture the content and the head elements
        const element = printRef.current;
        const head = document.head;
        const originalStyles = Array.from(head.querySelectorAll('style, link[rel="stylesheet"]'));
        
        try {
            // 2. Create a "Safe" style for the PDF
            const pdfStyle = document.createElement('style');
            pdfStyle.id = "pdf-safe-style";
            pdfStyle.innerHTML = `
                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;700&family=Inter:wght@400;700;900&display=swap');
                .pdf-print-container { 
                    background: white !important; 
                    color: black !important; 
                    font-family: 'Inter', sans-serif !important;
                    width: 1080px !important;
                    padding: 20px !important;
                    display: block !important;
                }
                .telugu-font { font-family: 'Noto Sans Telugu', 'Inter', sans-serif !important; }
                .pdf-header-box { 
                    border: 1px solid #000000 !important; 
                    text-align: center !important; 
                    padding: 8px 0 !important; 
                    font-weight: 900 !important; 
                    font-size: 24px !important; 
                    text-transform: uppercase !important; 
                }
                .pdf-bg-gray { background-color: #f3f4f6 !important; }
                table { width: 100% !important; border-collapse: collapse !important; margin-top: 0 !important; font-size: 12px !important; }
                th, td { border: 1px solid #000000 !important; color: #000000 !important; padding: 8px !important; }
            `;

            // 3. STRIP ALL STYLES to prevent oklch parsing error in html2canvas
            originalStyles.forEach(s => s.remove());
            head.appendChild(pdfStyle);

            const opt = {
                margin: [10, 5, 10, 5],
                filename: `Work_Done_Report_${user.username}_${selectedMonth}_${selectedYear}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 2, 
                    useCORS: true, 
                    logging: false,
                    letterRendering: true,
                    allowTaint: true
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };

            // 4. Generate PDF
            await html2pdf().set(opt).from(element).save();
            
        } catch (err) {
            console.error('PDF Generation Error:', err);
            alert("Failed to generate PDF. Please try again.");
        } finally {
            // 5. RESTORE ALL STYLES
            const safeStyle = document.getElementById('pdf-safe-style');
            if (safeStyle) safeStyle.remove();
            originalStyles.forEach(s => head.appendChild(s));
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
                    className="flex-1 bg-blue-600 text-white font-black py-3 px-6 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>
                    {isGenerating ? 'Generating...' : 'Export Official PDF'}
                </button>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/10 p-2 rounded-lg mb-6 border border-blue-100 dark:border-blue-800">
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold text-center italic">
                    Deduplication Active: Only your latest entry for each date is displayed.
                </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700">
                <table className="w-full text-left border-collapse telugu-font">
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

            {/* Hidden Official PDF Template Section */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <div ref={printRef} className="telugu-font pdf-print-container" style={{ width: '1080px', padding: '10px 20px', backgroundColor: '#ffffff', color: '#000000' }}>
                    
                    {/* Header Block Matching Image - LEAD TECHNICAL AGENCY */}
                    <div style={{ width: '100%', paddingTop: '4px', marginBottom: '0', borderTop: '4px solid #1e40af' }}>
                        <div className="pdf-header-box">
                            LEAD TECHNICAL AGENCY – WASSAN
                        </div>
                    </div>
                    
                    <div style={{ borderLeft: '1px solid #000000', borderRight: '1px solid #000000' }}>
                        <div style={{ borderBottom: '1px solid #000000', padding: '8px 16px', fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', fontSize: '18px' }}>
                            HDFC PARIVARTAN PROJECT - Bhamini P1198
                        </div>
                        <div className="pdf-bg-gray" style={{ borderBottom: '1px solid #000000', textAlign: 'center', padding: '4px 0', fontWeight: '900', textTransform: 'uppercase' }}>
                            WORK DONE REPORT
                        </div>
                        
                        <div style={{ borderBottom: '1px solid #000000', padding: '4px 16px', fontWeight: 'bold', display: 'flex', fontSize: '14px' }}>
                            <span style={{ width: '250px' }}>Month:</span>
                            <span style={{ flexGrow: 1 }}>{selectedMonth} {selectedYear}</span>
                        </div>
                        <div style={{ borderBottom: '1px solid #000000', padding: '4px 16px', fontWeight: 'bold', display: 'flex', fontSize: '14px' }}>
                            <span style={{ width: '250px' }}>Name of the Person:</span>
                            <span style={{ flexGrow: 1, textTransform: 'uppercase' }}>{user?.username}</span>
                        </div>
                        <div style={{ borderBottom: '1px solid #000000', padding: '4px 16px', fontWeight: 'bold', display: 'flex', fontSize: '14px' }}>
                            <span style={{ width: '250px' }}>Working GP:</span>
                            <span style={{ flexGrow: 1 }}>{filteredData[0]?.placeOfVisit || 'Field Operations'}</span>
                        </div>
                    </div>

                    {/* Table Block */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0', fontSize: '12px' }}>
                        <thead>
                            <tr className="pdf-bg-gray" style={{ fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' }}>
                                <th style={{ padding: '8px 4px', width: '40px' }}>S.No</th>
                                <th style={{ padding: '8px 8px', width: '110px' }}>Date</th>
                                <th style={{ padding: '8px 8px', width: '170px' }}>Place of Visit</th>
                                <th style={{ padding: '8px 8px' }}>Purpose of visit/Work done</th>
                                <th style={{ padding: '8px 4px', width: '80px' }}>Hours</th>
                                <th style={{ padding: '8px 8px', width: '170px' }}>Outcome</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.length > 0 ? filteredData.map((r, i) => (
                                <tr key={i} style={{ verticalAlign: 'top', pageBreakInside: 'avoid' }}>
                                    <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 'bold' }}>{i + 1}</td>
                                    <td style={{ padding: '8px 8px', textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 'bold' }}>{r.date}</td>
                                    <td style={{ padding: '8px 8px' }}>
                                        {r.workingStatus === 'Working' ? r.placeOfVisit : r.workingStatus}
                                    </td>
                                    <td style={{ padding: '8px 8px', lineHeight: '1.2', fontSize: '11px' }}>
                                        {r.workingStatus === 'Working' ? r.purposeOfVisit : `REASON: ${r.reasonNotWorking}`}
                                    </td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: '900' }}>
                                        {r.workingStatus === 'Working' ? r.workingHours : '0'}
                                    </td>
                                    <td style={{ padding: '8px 8px', fontSize: '10px', fontStyle: 'italic' }}>
                                        {r.outcomes}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontStyle: 'italic' }}>
                                        No data entries recorded.
                                    </td>
                                </tr>
                            )}
                            
                            {/* Summary Row */}
                            {filteredData.length > 0 && (
                                <tr className="pdf-bg-gray" style={{ fontWeight: '900', textTransform: 'uppercase', pageBreakInside: 'avoid' }}>
                                    <td colSpan={4} style={{ padding: '8px 16px', textAlign: 'right' }}>Total Monthly Hours:</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center', textDecoration: 'underline' }}>
                                        {filteredData.reduce((acc, curr) => acc + (parseFloat(curr.workingHours) || 0), 0).toFixed(1)}
                                    </td>
                                    <td style={{ padding: '8px 8px' }}></td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Footer / Signatures */}
                    <div style={{ marginTop: '48px', display: 'flex', justifyContent: 'space-around', padding: '0 40px', fontWeight: '900', fontSize: '12px', textTransform: 'uppercase', pageBreakInside: 'avoid' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ width: '256px', borderTop: '2px solid #000000', marginBottom: '8px' }}></div>
                            <span>SIGNATURE OF THE STAFF</span>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ width: '256px', borderTop: '2px solid #000000', marginBottom: '8px' }}></div>
                            <span>VERIFIED BY COORDINATOR</span>
                        </div>
                    </div>
                    
                    <div style={{ marginTop: '24px', fontSize: '9px', textAlign: 'center', fontStyle: 'italic', opacity: 0.7 }}>
                        Bhamini P1198 Field System • Generated: {new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportPage;
