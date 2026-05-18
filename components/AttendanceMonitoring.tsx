
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { STAFF_ATTENDANCE_LOG_URL, getProxyUrl } from '../config';
import { Calendar, Clock, ChevronRight, User, Shield, Info, AlertCircle, X, ChevronLeft, Map as MapIcon } from 'lucide-react';
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { generateCalendarDays } from '../utils/calendar';

interface StaffAttendanceLog {
    timestamp: string;
    username: string;
    staffName: string;
    slot: string;
    photoUrl: string;
    description: string;
    lat: number;
    lng: number;
    accuracy: number;
}

interface StaffDaySummary {
    staffName: string;
    username: string;
    morningLog?: StaffAttendanceLog;
    eveningLog?: StaffAttendanceLog;
}

const AttendanceMonitoring: React.FC = () => {
    const [logs, setLogs] = useState<StaffAttendanceLog[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedStaff, setSelectedStaff] = useState<StaffDaySummary | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [viewMode, setViewMode] = useState<'calendar' | 'map'>('calendar');
    const [mapLoaded, setMapLoaded] = useState(false);
    const [loading, setLoading] = useState(false);

    const mapRef = useRef<HTMLDivElement>(null);
    const googleMap = useRef<any>(null);
    const markers = useRef<any[]>([]);
    const clusterer = useRef<any>(null);

    // Load Google Maps Script
    useEffect(() => {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
        if (!window.google && !document.getElementById('google-maps-script')) {
            const script = document.createElement('script');
            script.id = 'google-maps-script';
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
            script.async = true;
            script.defer = true;
            script.onload = () => setMapLoaded(true);
            document.head.appendChild(script);
        } else if (window.google) {
            setMapLoaded(true);
        }
    }, []);

    const parseCSV = (csv: string): StaffAttendanceLog[] => {
        const lines = csv.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 1) return [];

        const parseCSVLine = (line: string) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        };

        const headers = parseCSVLine(lines[0]);
        return lines.slice(1).map(line => {
            const values = parseCSVLine(line);
            const obj: any = {};
            headers.forEach((h, i) => obj[h] = values[i]);
            return {
                timestamp: obj['Timestamp'] || '',
                username: obj['Username'] || '',
                staffName: obj['Staff Name'] || '',
                slot: obj['Time Slot'] || '',
                photoUrl: obj['Photo Drive Link'] || '',
                description: obj['Description'] || '',
                lat: parseFloat(obj['Latitude']) || 0,
                lng: parseFloat(obj['Longitude']) || 0,
                accuracy: parseFloat(obj['Location Accuracy']) || 0,
            };
        }).filter(d => d.lat !== 0 && d.lng !== 0);
    };

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(getProxyUrl(`${STAFF_ATTENDANCE_LOG_URL}&cb=${Date.now()}`));
            if (res.ok) {
                const text = await res.text();
                setLogs(parseCSV(text));
            } else {
                console.error(`Fetch error: ${res.status}`);
            }
        } catch (err) {
            console.error("Failed to fetch logs:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchLogs();
    }, [fetchLogs]);

    const filteredLogs = useMemo(() => {
        return logs.filter(l => {
            if (!l.timestamp) return false;
            try {
                const date = new Date(l.timestamp).toISOString().split('T')[0];
                return date === selectedDate;
            } catch {
                return false;
            }
        });
    }, [logs, selectedDate]);

    const calendarDays = useMemo(() => generateCalendarDays(currentMonth), [currentMonth]);

    const getAttendanceCountForDate = useCallback((date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        const dayLogs = logs.filter(l => {
            if (!l.timestamp) return false;
            try {
                return new Date(l.timestamp).toISOString().split('T')[0] === dateStr;
            } catch {
                return false;
            }
        });
        return new Set(dayLogs.map(l => l.username)).size;
    }, [logs]);

    const staffSummaries = useMemo(() => {
        const staffMap = new Map<string, StaffDaySummary>();
        filteredLogs.forEach(log => {
            if (!staffMap.has(log.username)) {
                staffMap.set(log.username, { 
                    staffName: log.staffName, 
                    username: log.username 
                });
            }
            const summary = staffMap.get(log.username)!;
            if (log.slot === 'Morning') summary.morningLog = log;
            else if (log.slot === 'Evening') summary.eveningLog = log;
        });
        return Array.from(staffMap.values()).sort((a, b) => {
            const timeA = Math.max(
                a.morningLog ? new Date(a.morningLog.timestamp).getTime() : 0,
                a.eveningLog ? new Date(a.eveningLog.timestamp).getTime() : 0
            );
            const timeB = Math.max(
                b.morningLog ? new Date(b.morningLog.timestamp).getTime() : 0,
                b.eveningLog ? new Date(b.eveningLog.timestamp).getTime() : 0
            );
            return timeB - timeA;
        });
    }, [filteredLogs]);

    const stats = useMemo(() => {
        const morningCount = filteredLogs.filter(l => l.slot === 'Morning').length;
        const eveningCount = filteredLogs.filter(l => l.slot === 'Evening').length;
        const uniqueStaff = new Set(filteredLogs.map(l => l.username)).size;
        return { morningCount, eveningCount, uniqueStaff };
    }, [filteredLogs]);

    const initMap = useCallback(() => {
        if (!mapLoaded || !mapRef.current || !window.google) return;

        if (!googleMap.current) {
            googleMap.current = new window.google.maps.Map(mapRef.current, {
                zoom: 12,
                center: { lat: 17.3850, lng: 78.4867 },
                mapTypeId: 'satellite',
                mapTypeControl: true,
                streetViewControl: false,
                fullscreenControl: true,
            });
        }

        markers.current.forEach(m => m.setMap(null));
        markers.current = [];
        if (clusterer.current) clusterer.current.clearMarkers();

        const bounds = new window.google.maps.LatLngBounds();
        let hasValidPoints = false;

        filteredLogs.forEach(log => {
            if (isNaN(log.lat) || isNaN(log.lng) || log.lat === 0 || log.lng === 0) return;
            hasValidPoints = true;

            const position = { lat: log.lat, lng: log.lng };
            const isMorning = log.slot === 'Morning';
            
            const marker = new window.google.maps.Marker({
                position,
                map: googleMap.current,
                title: `${log.staffName} (${log.slot})`,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    fillColor: isMorning ? '#10b981' : '#e11d48',
                    fillOpacity: 1,
                    strokeColor: '#FFFFFF',
                    strokeWeight: 2,
                    scale: 8,
                }
            });

            const infoWindowContent = `
                <div style="padding: 12px; min-width: 180px; font-family: sans-serif;">
                    <div style="font-size: 10px; font-weight: 800; color: ${isMorning ? '#10b981' : '#e11d48'}; text-transform: uppercase;">${log.slot} Log</div>
                    <div style="font-size: 14px; font-weight: 900; margin: 4px 0;">${log.staffName}</div>
                    <div style="font-size: 11px; color: #666; margin-bottom: 8px;">${new Date(log.timestamp).toLocaleTimeString()}</div>
                    <button onclick="window.dispatchEvent(new CustomEvent('map-select-staff', {detail: '${log.username}'}))" style="width: 100%; padding: 6px; background: #4f46e5; color: white; border: none; border-radius: 4px; font-size: 10px; font-weight: 800; cursor: pointer;">VIEW FULL DETAILS</button>
                </div>
            `;

            const infoWindow = new window.google.maps.InfoWindow({
                content: infoWindowContent
            });

            marker.addListener('click', () => {
                infoWindow.open(googleMap.current, marker);
            });

            markers.current.push(marker);
            bounds.extend(position);
        });

        if (hasValidPoints) {
            googleMap.current.fitBounds(bounds);
        }

        clusterer.current = new MarkerClusterer({ map: googleMap.current, markers: markers.current });
    }, [filteredLogs, mapLoaded]);

    useEffect(() => {
        if (viewMode === 'map') {
            const t = setTimeout(initMap, 300);
            return () => clearTimeout(t);
        }
    }, [viewMode, initMap]);

    useEffect(() => {
        const handleSelect = (e: any) => {
            const summary = staffSummaries.find(s => s.username === e.detail);
            if (summary) setSelectedStaff(summary);
        };
        window.addEventListener('map-select-staff', handleSelect);
        return () => window.removeEventListener('map-select-staff', handleSelect);
    }, [staffSummaries]);

    const [showReminder, setShowReminder] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
        typeof window !== 'undefined' ? (Notification.permission || 'default' as NotificationPermission) : 'default'
    );

    useEffect(() => {
        const checkAttendance = () => {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentTimeInMinutes = (currentHour * 60) + currentMinute;

            const morningDeadline = (10 * 60); 
            const eveningDeadline = (18 * 60); 

            const isNearMorningEnd = currentTimeInMinutes >= (morningDeadline - 30) && currentTimeInMinutes < morningDeadline;
            const isNearEveningEnd = currentTimeInMinutes >= (eveningDeadline - 30) && currentTimeInMinutes < eveningDeadline;

            if (isNearMorningEnd || isNearEveningEnd) {
                const requiredSlot = isNearMorningEnd ? 'Morning' : 'Evening';
                const hasLogged = filteredLogs.some(log => {
                    const logDate = new Date(log.timestamp);
                    return logDate.toDateString() === now.toDateString() && log.slot === requiredSlot;
                });

                if (!hasLogged) {
                    setShowReminder(true);
                    if (Notification.permission === 'granted') {
                        new Notification("Attendance Reminder", {
                            body: `You haven't completed your ${requiredSlot} attendance. Please do so before the deadline!`,
                            icon: "/icon-192x192.png"
                        });
                    }
                }
            }
        };

        const interval = setInterval(checkAttendance, 60000 * 5); 
        checkAttendance();
        return () => clearInterval(interval);
    }, [filteredLogs]);

    const requestPermission = async () => {
        if ("Notification" in window) {
            const permission = await Notification.requestPermission();
            setPermissionStatus(permission);
        }
    };

    const formatDriveUrl = (url: string) => {
        if (!url) return '';
        if (url.includes('drive.google.com') || url.includes('google.com/open') || url.includes('docs.google.com') || url.includes('drive.usercontent.google.com')) {
            const idMatch = url.match(/(?:id=|\/d\/|folders\/|file\/d\/|open\?id=)([-\w]{25,})/);
            if (idMatch) {
                return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w800`;
            }
        }
        return url;
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Attendance Monitoring</h1>
                    {permissionStatus === 'default' && (
                        <button 
                            onClick={requestPermission}
                            className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-bold uppercase tracking-wider hover:bg-blue-100 transition-colors"
                        >
                            Enable Alerts
                        </button>
                    )}
                    {showReminder && (
                        <div className="flex items-center gap-2 bg-rose-50 text-rose-600 px-3 py-1 rounded-full animate-pulse border border-rose-100">
                            <AlertCircle size={12} />
                            <span className="text-[10px] font-black uppercase tracking-wider">Missing Log</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setViewMode('calendar')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${viewMode === 'calendar' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                        <Calendar className="w-3 h-3" /> Calendar
                    </button>
                    <button 
                        onClick={() => setViewMode('map')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${viewMode === 'map' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                        <MapIcon className="w-3 h-3" /> Attendance Map
                    </button>
                    <div className="w-px h-6 bg-gray-100 dark:bg-gray-700 mx-1 flex-shrink-0"></div>
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 cursor-pointer flex-shrink-0"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={<User />} label="Unique Staff" value={stats.uniqueStaff} color="bg-indigo-600" />
                <StatCard icon={<Clock />} label="Morning Marks" value={stats.morningCount} color="bg-emerald-600" />
                <StatCard icon={<Shield />} label="Evening Marks" value={stats.eveningCount} color="bg-orange-600" />
                <StatCard icon={<Calendar />} label="Selected Date" value={new Date(selectedDate).toLocaleDateString([], { month: 'short', day: 'numeric' })} color="bg-gray-900" />
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className="w-full">
                    {viewMode === 'map' ? (
                        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm relative h-[600px]">
                            <div ref={mapRef} className="w-full h-full" />
                            {loading && (
                                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden p-6">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-sm font-black uppercase text-gray-900 dark:text-white tracking-widest flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-indigo-600" />
                                    Attendance Calendar
                                </h3>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                                    >
                                        <ChevronLeft size={20} className="text-gray-500" />
                                    </button>
                                    <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 min-w-[120px] text-center">
                                        {currentMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}
                                    </span>
                                    <button 
                                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                                    >
                                        <ChevronRight size={20} className="text-gray-500" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-gray-700 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                    <div key={d} className="bg-gray-50 dark:bg-gray-900 py-3 text-center text-[10px] font-black uppercase text-gray-400 tracking-wider">
                                        {d}
                                    </div>
                                ))}
                                {calendarDays.map((day, i) => {
                                    const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                                    const isToday = day.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
                                    const isSelected = day.toISOString().split('T')[0] === selectedDate;
                                    const count = getAttendanceCountForDate(day);
                                    
                                    return (
                                        <button 
                                            key={i}
                                            onClick={() => setSelectedDate(day.toISOString().split('T')[0])}
                                            className={`
                                                relative h-24 p-3 flex flex-col items-start transition-all
                                                ${!isCurrentMonth ? 'bg-gray-50/50 dark:bg-gray-900/50 text-gray-300 dark:text-gray-600' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10'}
                                                ${isSelected ? 'ring-2 ring-inset ring-indigo-600 z-10' : ''}
                                            `}
                                        >
                                            <span className={`text-xs font-black ${isToday ? 'bg-indigo-600 text-white w-6 h-6 flex items-center justify-center rounded-full -ml-1' : ''}`}>
                                                {day.getDate()}
                                            </span>
                                            {count > 0 && (
                                                <div className="mt-auto flex flex-col gap-1 w-full text-left">
                                                    <div className="h-1.5 w-full bg-indigo-100 dark:bg-indigo-900/30 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-indigo-600 transition-all" 
                                                            style={{ width: `${Math.min(100, (count / (stats.uniqueStaff || 1)) * 100)}%` }} 
                                                        />
                                                    </div>
                                                    <span className="text-[8px] font-black uppercase text-indigo-600 dark:text-indigo-400 truncate">
                                                        {count} Staff
                                                    </span>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
                                <div className="flex items-center justify-between mb-6">
                                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">Staff Attendance for {new Date(selectedDate).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {staffSummaries.map((summary, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => setSelectedStaff(summary)}
                                            className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-transparent hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-left group"
                                        >
                                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-gray-100 flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                                                <img 
                                                    src={formatDriveUrl(summary.morningLog?.photoUrl || summary.eveningLog?.photoUrl || '')} 
                                                    className="w-full h-full object-cover" 
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(summary.staffName)}&background=4f46e5&color=fff`;
                                                        target.onerror = null;
                                                    }}
                                                />
                                            </div>
                                            <div className="min-w-0 flex-grow">
                                                <p className="text-[11px] font-black uppercase text-gray-900 dark:text-white truncate">{summary.staffName}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className={`w-2 h-2 rounded-full ${summary.morningLog ? 'bg-emerald-500' : 'bg-gray-200'}`} title="Morning"></div>
                                                    <div className={`w-2 h-2 rounded-full ${summary.eveningLog ? 'bg-rose-500' : 'bg-gray-200'}`} title="Evening"></div>
                                                    <span className="text-[8px] font-bold text-gray-400 ml-1">
                                                        {[summary.morningLog, summary.eveningLog].filter(Boolean).length} Marks
                                                    </span>
                                                </div>
                                            </div>
                                            <ChevronRight size={16} className="text-gray-200 group-hover:text-indigo-400 transition-colors" />
                                        </button>
                                    ))}
                                    {staffSummaries.length === 0 && (
                                        <div className="col-span-full py-12 text-center text-[10px] font-black text-gray-300 uppercase tracking-widest border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-[2rem]">
                                            No staff attendance logged for this date
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Staff Detail Modal */}
            {selectedStaff && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-md" onClick={() => setSelectedStaff(null)} />
                    <div className="relative bg-white dark:bg-gray-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-scale-up border border-white/20">
                        <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{selectedStaff.staffName}</h3>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Attendance Details • {new Date(selectedDate).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                            </div>
                            <button 
                                onClick={() => setSelectedStaff(null)}
                                className="p-3 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto max-h-[70vh]">
                            {/* Tips for Drive Images */}
                            <div className="col-span-full bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 p-4 rounded-2xl flex items-start gap-3">
                                <Info className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
                                <div>
                                    <p className="text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider">Image Loading Note</p>
                                    <p className="text-[9px] font-medium text-amber-700 dark:text-amber-500 mt-0.5 leading-relaxed">
                                        Google Drive images require files to be set as <span className="font-bold underline">"Anyone with the link can view"</span> in sharing settings. Private files will appear as placeholders.
                                    </p>
                                </div>
                            </div>

                            {/* Morning Log */}
                            <div className={`space-y-4 ${!selectedStaff.morningLog ? 'opacity-40 grayscale' : ''}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Login (Morning)</h4>
                                </div>
                                {selectedStaff.morningLog ? (
                                    <>
                                        <div className="aspect-square rounded-3xl overflow-hidden bg-gray-100 border border-gray-100">
                                            <img 
                                                src={formatDriveUrl(selectedStaff.morningLog.photoUrl)} 
                                                className="w-full h-full object-cover" 
                                                referrerPolicy="no-referrer"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    const idMatch = selectedStaff.morningLog?.photoUrl.match(/(?:id=|\/d\/|file\/d\/|open\?id=)([-\w]{25,})/);
                                                    if (idMatch && !target.src.includes('thumbnail')) {
                                                        target.src = `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w600`;
                                                    } else {
                                                        target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedStaff.staffName)}+Morning&background=10b981&color=fff`;
                                                    }
                                                    target.onerror = null;
                                                }}
                                            />
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Clock size={12} className="text-emerald-500" />
                                                <span className="text-xs font-black text-gray-900 dark:text-white">
                                                    {new Date(selectedStaff.morningLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-bold text-gray-500 mt-2 line-clamp-3 italic">"{selectedStaff.morningLog.description || 'No description'}"</p>
                                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                                <span className="text-[8px] font-black uppercase text-gray-400">Accuracy: ±{Math.round(selectedStaff.morningLog.accuracy)}m</span>
                                                <button 
                                                    onClick={() => window.open(`https://www.google.com/maps?q=${selectedStaff.morningLog?.lat},${selectedStaff.morningLog?.lng}`, '_blank')}
                                                    className="text-[8px] font-black uppercase text-indigo-600 hover:underline"
                                                >
                                                    View Map
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="aspect-square rounded-3xl border-2 border-dashed border-gray-200 flex items-center justify-center text-[10px] font-black uppercase text-gray-300">
                                        No Login Record
                                    </div>
                                )}
                            </div>

                            {/* Evening Log */}
                            <div className={`space-y-4 ${!selectedStaff.eveningLog ? 'opacity-40 grayscale' : ''}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Logout (Evening)</h4>
                                </div>
                                {selectedStaff.eveningLog ? (
                                    <>
                                        <div className="aspect-square rounded-3xl overflow-hidden bg-gray-100 border border-gray-100">
                                            <img 
                                                src={formatDriveUrl(selectedStaff.eveningLog.photoUrl)} 
                                                className="w-full h-full object-cover" 
                                                referrerPolicy="no-referrer"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    const idMatch = selectedStaff.eveningLog?.photoUrl.match(/(?:id=|\/d\/|file\/d\/|open\?id=)([-\w]{25,})/);
                                                    if (idMatch && !target.src.includes('thumbnail')) {
                                                        target.src = `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w600`;
                                                    } else {
                                                        target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedStaff.staffName)}+Evening&background=e11d48&color=fff`;
                                                    }
                                                    target.onerror = null;
                                                }}
                                            />
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Clock size={12} className="text-rose-500" />
                                                <span className="text-xs font-black text-gray-900 dark:text-white">
                                                    {new Date(selectedStaff.eveningLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-bold text-gray-500 mt-2 line-clamp-3 italic">"{selectedStaff.eveningLog.description || 'No description'}"</p>
                                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                                <span className="text-[8px] font-black uppercase text-gray-400">Accuracy: ±{Math.round(selectedStaff.eveningLog.accuracy)}m</span>
                                                <button 
                                                    onClick={() => window.open(`https://www.google.com/maps?q=${selectedStaff.eveningLog?.lat},${selectedStaff.eveningLog?.lng}`, '_blank')}
                                                    className="text-[8px] font-black uppercase text-indigo-600 hover:underline"
                                                >
                                                    View Map
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="aspect-square rounded-3xl border-2 border-dashed border-gray-200 flex items-center justify-center text-[10px] font-black uppercase text-gray-300">
                                        No Logout Record
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard: React.FC<{ icon: any; label: string; value: any; color: string }> = ({ icon, label, value, color }) => (
    <div className={`${color} p-6 rounded-[2.5rem] text-white shadow-lg flex items-center gap-4`}>
        <div className="p-3 bg-white/20 rounded-2xl">
            {React.cloneElement(icon, { size: 20 })}
        </div>
        <div>
            <p className="text-[9px] font-black uppercase opacity-60 tracking-widest mb-1">{label}</p>
            <p className="text-2xl font-black">{value}</p>
        </div>
    </div>
);

export default AttendanceMonitoring;
