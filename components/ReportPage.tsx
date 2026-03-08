import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { GOOGLE_SHEET_CSV_URL } from '../config';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const [language, setLanguage] = useState<'en' | 'te'>('en');
    const [isDownloading, setIsDownloading] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    // Robust date parser to handle DD/MM/YYYY, YYYY-MM-DD, and other formats
    const parseDate = (dateStr: string): Date | null => {
        if (!dateStr) return null;
        const cleanStr = dateStr.trim();
        
        // Try DD/MM/YYYY or D/M/YYYY
        if (cleanStr.includes('/')) {
            const parts = cleanStr.split('/');
            if (parts.length === 3) {
                let year = parseInt(parts[2]);
                if (year < 100) year += 2000; // Handle 2-digit year
                // Check if valid numbers
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                     return new Date(year, month - 1, day);
                }
            }
        }
        
        // Try YYYY-MM-DD
        if (cleanStr.includes('-')) {
            const parts = cleanStr.split('-');
            if (parts.length === 3) {
                 const year = parseInt(parts[0]);
                 const month = parseInt(parts[1]);
                 const day = parseInt(parts[2]);
                 if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                     return new Date(year, month - 1, day);
                 }
            }
            // Fallback to standard parser
            const d = new Date(cleanStr);
            if (!isNaN(d.getTime())) return d;
        }
        
        return null;
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

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&cb=${Date.now()}`);
            const csvText = await response.text();
            const parsedData = parseCSV(csvText);
            const currentUsernameLower = user.username.trim().toLowerCase();
            
            // Get local data for instant feedback
            const localKey = `bhamini_local_${user.username}`;
            const localData = JSON.parse(localStorage.getItem(localKey) || '{}');
            
            // Combine sheet data and local data
            const combinedData = [...parsedData];
            
            // Map sheet data
            const userRecords = combinedData
                .filter(row => (row['SELECT YOUR NAME'] || row['Name'] || '').trim().toLowerCase() === currentUsernameLower)
                .map(row => ({
                    timestamp: row['Timestamp'] || '',
                    name: currentUsernameLower,
                    date: row['CHOOSE DATE'] || row['Date'] || '',
                    workingStatus: row['WORKING/LEAVE/HOLIDAY'] || 'Working',
                    reasonNotWorking: row['WRITE THE REASON FOR NOT WORKING'] || '',
                    placeOfVisit: row['PLACE OF VISIT'] || '',
                    purposeOfVisit: row['PURPOSE OF VISIT'] || '',
                    workingHours: row['WORKING HOURS'] || '0',
                    outcomes: row['OUTCOME'] || '',
                }));

            // Add local records if not already present (based on date)
            Object.keys(localData).forEach(dateKey => {
                const exists = userRecords.some(r => r.date === dateKey);
                if (!exists) {
                    const localEntry = localData[dateKey];
                    userRecords.push({
                        timestamp: localEntry.timestamp,
                        name: currentUsernameLower,
                        date: dateKey,
                        workingStatus: localEntry.workingStatus,
                        reasonNotWorking: localEntry.reasonNotWorking,
                        placeOfVisit: localEntry.placeOfVisit,
                        purposeOfVisit: localEntry.purposeOfVisit,
                        workingHours: localEntry.workingHours,
                        outcomes: localEntry.outcomes || localEntry.outcome,
                    });
                }
            });

            const sortedRecords = userRecords.sort((a, b) => {
                const dateA = parseDate(a.date);
                const dateB = parseDate(b.date);
                if (dateA && dateB) {
                    return dateA.getTime() - dateB.getTime();
                }
                return 0;
            });
                
            setRecords(sortedRecords);
        } catch (err) {
            console.error('Failed to load report data:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const reportPeriod = useMemo(() => {
        // End date: 25th of selected month/year
        const endDate = new Date(filterYear, filterMonth, 25);
        // Start date: 26th of previous month
        const startDate = new Date(filterYear, filterMonth - 1, 26);
        
        const days: Date[] = [];
        const curr = new Date(startDate);
        while (curr <= endDate) {
            days.push(new Date(curr));
            curr.setDate(curr.getDate() + 1);
        }
        return { startDate, endDate, days };
    }, [filterMonth, filterYear]);

    const filteredRecords = useMemo(() => {
        const { startDate, endDate } = reportPeriod;
        return records.filter(r => {
            const d = parseDate(r.date);
            if (!d) return false;
            // Set hours to 0 for accurate date comparison
            d.setHours(0, 0, 0, 0);
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(0, 0, 0, 0);
            
            return d >= start && d <= end;
        });
    }, [records, reportPeriod]);

    const stats = useMemo(() => {
        const working = filteredRecords.filter(r => r.workingStatus === 'Working').length;
        const leave = filteredRecords.filter(r => r.workingStatus === 'Leave').length;
        const holiday = filteredRecords.filter(r => r.workingStatus === 'Holiday').length;
        const totalHours = filteredRecords.reduce((acc, r) => acc + (parseFloat(r.workingHours) || 0), 0);
        
        return { working, leave, holiday, totalHours };
    }, [filteredRecords]);

    const handleDownload = async () => {
        if (!reportRef.current) return;
        setIsDownloading(true);
        try {
            const canvas = await html2canvas(reportRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                    const styles = clonedDoc.getElementsByTagName('style');
                    const links = clonedDoc.getElementsByTagName('link');
                    for (let i = styles.length - 1; i >= 0; i--) styles[i].parentNode?.removeChild(styles[i]);
                    for (let i = links.length - 1; i >= 0; i--) links[i].parentNode?.removeChild(links[i]);

                    const style = clonedDoc.createElement('style');
                    style.innerHTML = `
                        @font-face { font-family: 'sans-serif'; src: local('Arial'), local('Helvetica'), local('sans-serif'); }
                        * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                        body { margin: 0; padding: 0; background: white; }
                    `;
                    clonedDoc.head.appendChild(style);
                }
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', 'a4');
            const pdfPageWidth = pdf.internal.pageSize.getWidth();
            const pdfPageHeight = pdf.internal.pageSize.getHeight();
            
            const imgWidth = pdfPageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            // Calculate ratio to convert DOM pixels to PDF mm
            const domWidth = reportRef.current.offsetWidth;
            const pxToMm = pdfPageWidth / domWidth;
            const containerRect = reportRef.current.getBoundingClientRect();
            const rows = reportRef.current.querySelectorAll('tr');

            const splitPoints: number[] = [0];
            let currentSplit = 0;

            // Calculate split points based on row positions
            while (currentSplit + pdfPageHeight < imgHeight) {
                const naiveCutMm = currentSplit + pdfPageHeight;
                let cutMm = naiveCutMm;
                
                // Find if any row is crossing the naive cut line
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    const rowRect = row.getBoundingClientRect();
                    const rowTopRel = rowRect.top - containerRect.top;
                    const rowBottomRel = rowRect.bottom - containerRect.top;
                    
                    const rowTopMm = rowTopRel * pxToMm;
                    const rowBottomMm = rowBottomRel * pxToMm;
                    
                    // If row starts before the cut and ends after the cut
                    if (rowTopMm < naiveCutMm && rowBottomMm > naiveCutMm) {
                        // Cut before this row starts
                        cutMm = rowTopMm;
                        break;
                    }
                }
                
                // Safety check: if cutMm didn't advance (row taller than page?), force advance
                if (cutMm <= currentSplit) {
                    cutMm = naiveCutMm;
                }
                
                splitPoints.push(cutMm);
                currentSplit = cutMm;
            }

            // Generate PDF pages
            splitPoints.forEach((splitY, index) => {
                if (index > 0) pdf.addPage();
                // We place the image shifted up by splitY (negative Y offset)
                pdf.addImage(imgData, 'PNG', 0, -splitY, imgWidth, imgHeight);
            });

            pdf.save(`Work_Report_${user?.username}_${filterMonth + 1}_${filterYear}.pdf`);
        } catch (err) {
            console.error('Download failed:', err);
            alert('Download failed. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    const t = {
        en: {
            title: 'Monthly Performance Report',
            sub: 'Attendance & Activity Summary',
            download: 'Download PDF',
            lang: 'Telugu',
            stats: {
                worked: 'Days Worked',
                leave: 'Leave Taken',
                holiday: 'Holidays',
                hours: 'Total Hours'
            },
            table: {
                date: 'Date',
                status: 'Status',
                place: 'Place',
                purpose: 'Purpose',
                hours: 'Hours'
            },
            report: {
                agency: 'LEAD TECHNICAL AGENCY – WASSAN',
                project: 'HDFC Parivarthan',
                type: 'WORK DONE REPORT',
                month: 'Month:',
                name: 'Name of the Person:',
                gp: 'Working GP:',
                sno: 'S. No',
                date: 'Date',
                place: 'Place of Visit',
                purpose: 'Purpose of visit/Work done',
                hours: 'No of Hours Working',
                outcome: 'Outcome from work',
                total_hours: 'TOTAL MONTHLY HOURS:',
                staff_sig: 'SIGNATURE OF THE STAFF',
                coord_sig: 'VERIFIED BY COORDINATOR',
                name_designation: '(NAME & DESIGNATION)',
                place_label: 'PLACE:',
                date_label: 'DATE:',
                signature_label: 'Signature of the Person'
            }
        },
        te: {
            title: 'నెలవారీ పనితీరు నివేదిక',
            sub: 'హాజరు మరియు కార్యకలాపాల సారాంశం',
            download: 'PDF డౌన్‌లోడ్ చేయండి',
            lang: 'English',
            stats: {
                worked: 'పని చేసిన రోజులు',
                leave: 'తీసుకున్న సెలవులు',
                holiday: 'సెలవు దినాలు',
                hours: 'మొత్తం గంటలు'
            },
            table: {
                date: 'తేదీ',
                status: 'స్థితి',
                place: 'ప్రదేశం',
                purpose: 'ఉద్దేశ్యం',
                hours: 'గంటలు'
            },
            report: {
                agency: 'లీడ్ టెక్నికల్ ఏజెన్సీ - వాసన్',
                project: 'హెచ్‌డిఎఫ్‌సి పరివర్తన్',
                type: 'పని నివేదిక (WORK DONE REPORT)',
                month: 'నెల (Month):',
                name: 'వ్యక్తి పేరు (Name):',
                gp: 'పని చేస్తున్న జిపి (Working GP):',
                sno: 'వరుస సంఖ్య',
                date: 'తేదీ',
                place: 'సందర్శించిన ప్రదేశం',
                purpose: 'సందర్శన ఉద్దేశ్యం/చేసిన పని',
                hours: 'పని గంటల సంఖ్య',
                outcome: 'పని ఫలితం',
                total_hours: 'మొత్తం నెలవారీ గంటలు (TOTAL MONTHLY HOURS):',
                staff_sig: 'సిబ్బంది సంతకం (SIGNATURE OF THE STAFF)',
                coord_sig: 'కోఆర్డినేటర్ ద్వారా ధృవీకరించబడింది (VERIFIED BY COORDINATOR)',
                name_designation: '(పేరు & హోదా)',
                place_label: 'ప్రదేశం (PLACE):',
                date_label: 'తేదీ (DATE):',
                signature_label: 'వ్యక్తి సంతకం (Signature of the Person)'
            }
        }
    };

    const currentT = t[language];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-xs font-black uppercase text-gray-400 tracking-widest">Generating Report...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 animate-fade-in pb-20">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{currentT.title}</h1>
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">{currentT.sub}</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                    <button 
                        onClick={() => setLanguage(language === 'en' ? 'te' : 'en')}
                        className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white transition-all"
                    >
                        {currentT.lang}
                    </button>
                    
                    <select 
                        value={filterMonth} 
                        onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                        className="bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer"
                    >
                        {Array.from({ length: 12 }).map((_, i) => (
                            <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                        ))}
                    </select>
                    
                    <select 
                        value={filterYear} 
                        onChange={(e) => setFilterYear(parseInt(e.target.value))}
                        className="bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer"
                    >
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>

                    <button 
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className={`flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all ${isDownloading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isDownloading ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                        )}
                        {currentT.download}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label={currentT.stats.worked} value={stats.working} color="bg-emerald-600" />
                <StatCard label={currentT.stats.leave} value={stats.leave} color="bg-red-600" />
                <StatCard label={currentT.stats.holiday} value={stats.holiday} color="bg-indigo-600" />
                <StatCard label={currentT.stats.hours} value={stats.totalHours.toFixed(1)} color="bg-gray-900" />
            </div>

            {/* Main Table View */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">{language === 'en' ? 'Detailed Activity Log' : 'వివరణాత్మక కార్యాచరణ లాగ్'}</h2>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50">
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">{currentT.table.date}</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">{currentT.table.status}</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">{currentT.table.place}</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">{currentT.table.purpose}</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">{currentT.table.hours}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {filteredRecords.length > 0 ? (
                                filteredRecords.map((r, i) => (
                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 text-[11px] font-bold text-gray-900 dark:text-white">{r.date}</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase ${
                                                r.workingStatus === 'Working' ? 'bg-emerald-100 text-emerald-600' : 
                                                r.workingStatus === 'Leave' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'
                                            }`}>
                                                {r.workingStatus}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-[11px] text-gray-500 dark:text-gray-400 uppercase font-bold">{r.placeOfVisit || '-'}</td>
                                        <td className="px-6 py-4 text-[11px] text-gray-500 dark:text-gray-400 font-medium">{r.purposeOfVisit || '-'}</td>
                                        <td className="px-6 py-4 text-[11px] font-black text-gray-900 dark:text-white">{r.workingHours}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                        {language === 'en' ? 'No records found for this period' : 'ఈ కాలానికి రికార్డులు ఏవీ లేవు'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Hidden Report Template for PDF Generation */}
            <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
                <div 
                    ref={reportRef} 
                    style={{ 
                        width: '297mm', 
                        minHeight: '210mm', 
                        padding: '10mm', 
                        backgroundColor: '#ffffff', 
                        color: '#000000', 
                        fontFamily: 'sans-serif' 
                    }}
                >
                    {/* Header Section */}
                    <div style={{ textAlign: 'center', borderBottom: '2px solid #000000', paddingBottom: '16px', marginBottom: '16px' }}>
                        <h1 style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', margin: '0 0 4px 0' }}>{currentT.report.agency}</h1>
                        <h2 style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', margin: '0 0 4px 0' }}>{currentT.report.project}</h2>
                        <h3 style={{ fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase', margin: '8px 0 0 0' }}>{currentT.report.type}</h3>
                    </div>

                    {/* Info Section */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '4px 0' }}>
                            <span style={{ width: '192px', fontWeight: 'bold' }}>{currentT.report.month}</span>
                            <span>{new Date(0, filterMonth).toLocaleString('default', { month: 'long' })} {filterYear}</span>
                        </div>
                        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '4px 0' }}>
                            <span style={{ width: '192px', fontWeight: 'bold' }}>{currentT.report.name}</span>
                            <span style={{ textTransform: 'uppercase' }}>{user?.username}</span>
                        </div>
                        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '4px 0' }}>
                            <span style={{ width: '192px', fontWeight: 'bold' }}>{currentT.report.gp}</span>
                            <span>{filteredRecords[0]?.placeOfVisit || 'N/A'}</span>
                        </div>
                    </div>

                    {/* Table Section */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000000' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f3f4f6' }}>
                                <th style={{ border: '2px solid #000000', padding: '8px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', width: '10mm' }}>{currentT.report.sno}</th>
                                <th style={{ border: '2px solid #000000', padding: '8px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', width: '25mm' }}>{currentT.report.date}</th>
                                <th style={{ border: '2px solid #000000', padding: '8px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', width: '35mm' }}>{currentT.report.place}</th>
                                <th style={{ border: '2px solid #000000', padding: '8px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center' }}>{currentT.report.purpose}</th>
                                <th style={{ border: '2px solid #000000', padding: '8px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', width: '25mm' }}>{currentT.report.hours}</th>
                                <th style={{ border: '2px solid #000000', padding: '8px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', width: '35mm' }}>{currentT.report.outcome}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportPeriod.days.map((day, i) => {
                                const dateStr = `${day.getDate().toString().padStart(2, '0')}/${(day.getMonth() + 1).toString().padStart(2, '0')}/${day.getFullYear()}`;
                                
                                // Find record using robust date comparison
                                const record = filteredRecords.find(r => {
                                    const rDate = parseDate(r.date);
                                    if (!rDate) return false;
                                    return rDate.getDate() === day.getDate() && 
                                           rDate.getMonth() === day.getMonth() && 
                                           rDate.getFullYear() === day.getFullYear();
                                });

                                return (
                                    <tr key={i}>
                                        <td style={{ border: '2px solid #000000', padding: '8px', fontSize: '10px', textAlign: 'center' }}>{i + 1}</td>
                                        <td style={{ border: '2px solid #000000', padding: '8px', fontSize: '10px', textAlign: 'center' }}>{dateStr}</td>
                                        <td style={{ border: '2px solid #000000', padding: '8px', fontSize: '10px', textTransform: 'uppercase' }}>{record?.placeOfVisit || ''}</td>
                                        <td style={{ border: '2px solid #000000', padding: '8px', fontSize: '10px' }}>
                                            {record?.workingStatus === 'Working' 
                                                ? (record?.purposeOfVisit || '') 
                                                : (record ? `${record.workingStatus}${record.reasonNotWorking ? ` - ${record.reasonNotWorking}` : ''}` : '')}
                                        </td>
                                        <td style={{ border: '2px solid #000000', padding: '8px', fontSize: '10px', textAlign: 'center' }}>{record?.workingHours || ''}</td>
                                        <td style={{ border: '2px solid #000000', padding: '8px', fontSize: '10px' }}>{record?.outcomes || ''}</td>
                                    </tr>
                                );
                            })}
                            {/* Total Hours Row */}
                            <tr style={{ backgroundColor: '#f3f4f6' }}>
                                <td colSpan={4} style={{ border: '2px solid #000000', padding: '8px', fontSize: '12px', fontWeight: 'bold', textAlign: 'right' }}>
                                    {currentT.report.total_hours}
                                </td>
                                <td style={{ border: '2px solid #000000', padding: '8px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center' }}>
                                    {stats.totalHours.toFixed(1)}
                                </td>
                                <td style={{ border: '2px solid #000000', padding: '8px' }}></td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Footer / Signature Section */}
                    <div style={{ marginTop: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        {/* Left Side: Staff Signature */}
                        <div style={{ textAlign: 'center', minWidth: '300px' }}>
                            <div style={{ borderTop: '2px solid #000000', width: '100%', marginBottom: '8px' }}></div>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>{currentT.report.staff_sig}</div>
                            <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '4px' }}>({user?.username})</div>
                            <div style={{ textAlign: 'left', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{currentT.report.date_label} ________________</div>
                                <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{currentT.report.place_label} ________________</div>
                            </div>
                        </div>

                        {/* Right Side: Coordinator Signature */}
                        <div style={{ textAlign: 'center', minWidth: '300px' }}>
                            <div style={{ borderTop: '2px solid #000000', width: '100%', marginBottom: '8px' }}></div>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>{currentT.report.coord_sig}</div>
                            <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '4px' }}>{currentT.report.name_designation}</div>
                        </div>
                    </div>

                    {/* System Generation Info */}
                    <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '10px', color: '#666666', fontStyle: 'italic' }}>
                        Bhamini P1198 Field System • Generated: {new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ label: string; value: any; color: string }> = ({ label, value, color }) => (
    <div className={`${color} p-6 rounded-3xl text-white shadow-lg`}>
        <p className="text-[9px] font-black uppercase opacity-60 tracking-widest mb-1">{label}</p>
        <p className="text-3xl font-black">{value}</p>
    </div>
);

export default ReportPage;
