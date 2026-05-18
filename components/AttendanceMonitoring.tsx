
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { STAFF_ATTENDANCE_LOG_URL } from '../config';
import { MapPin, Calendar, Clock, List, Map as MapIcon, ChevronRight, User, Shield, Info } from 'lucide-react';
import { MarkerClusterer } from "@googlemaps/markerclusterer";

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

const AttendanceMonitoring: React.FC = () => {
    const [logs, setLogs] = useState<StaffAttendanceLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [viewMode, setViewMode] = useState<'list' | 'map'>('map');
    const mapRef = useRef<HTMLDivElement>(null);
    const googleMap = useRef<any>(null);
    const markers = useRef<any[]>([]);
    const clusterer = useRef<any>(null);

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
            const res = await fetch(`${STAFF_ATTENDANCE_LOG_URL}&cb=${Date.now()}`);
            if (res.ok) {
                const text = await res.text();
                setLogs(parseCSV(text));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const filteredLogs = useMemo(() => {
        return logs.filter(l => {
            const date = new Date(l.timestamp).toISOString().split('T')[0];
            return date === selectedDate;
        });
    }, [logs, selectedDate]);

    const stats = useMemo(() => {
        const morningCount = filteredLogs.filter(l => l.slot === 'Morning').length;
        const eveningCount = filteredLogs.filter(l => l.slot === 'Evening').length;
        const uniqueStaff = new Set(filteredLogs.map(l => l.username)).size;
        return { morningCount, eveningCount, uniqueStaff };
    }, [filteredLogs]);

    const initMap = useCallback(() => {
        if (!mapRef.current || !window.google) return;

        if (!googleMap.current) {
            googleMap.current = new window.google.maps.Map(mapRef.current, {
                zoom: 12,
                center: { lat: 17.3850, lng: 78.4867 }, // Default Hyderabad or similar
                styles: [
                    { "featureType": "administrative", "elementType": "labels.text.fill", "stylers": [{ "color": "#444444" }] },
                    { "featureType": "landscape", "elementType": "all", "stylers": [{ "color": "#f2f2f2" }] },
                    { "featureType": "poi", "elementType": "all", "stylers": [{ "visibility": "off" }] }
                ]
            });
        }

        // Clear existing markers
        markers.current.forEach(m => m.setMap(null));
        markers.current = [];
        if (clusterer.current) clusterer.current.clearMarkers();

        const bounds = new window.google.maps.LatLngBounds();

        filteredLogs.forEach(log => {
            const position = { lat: log.lat, lng: log.lng };
            const isMorning = log.slot === 'Morning';
            
            const marker = new window.google.maps.Marker({
                position,
                map: googleMap.current,
                title: `${log.staffName} (${log.slot})`,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    fillColor: isMorning ? '#4f46e5' : '#ef4444',
                    fillOpacity: 1,
                    strokeColor: '#FFFFFF',
                    strokeWeight: 2,
                    scale: 10,
                }
            });

            const infoWindowContent = `
                <div style="padding: 12px; min-width: 150px; font-family: sans-serif;">
                    <div style="font-size: 10px; font-weight: 800; color: #4f46e5; text-transform: uppercase;">${log.slot} Check-in</div>
                    <div style="font-size: 14px; font-weight: 900; margin: 4px 0;">${log.staffName}</div>
                    <div style="font-size: 10px; color: #6b7280; font-weight: 600; margin-bottom: 4px;">${log.description || 'No description provided'}</div>
                    <div style="font-size: 10px; color: #9ca3af; margin-bottom: 8px;">${new Date(log.timestamp).toLocaleString()}</div>
                    ${log.photoUrl ? `<img src="${log.photoUrl}" style="width: 100%; height: 120px; object-cover; border-radius: 8px; margin-bottom: 8px;" />` : ''}
                    <a href="https://www.google.com/maps?q=${log.lat},${log.lng}" target="_blank" style="font-size: 10px; color: #4f46e5; font-weight: 700; text-decoration: none;">OPEN IN GOOGLE MAPS →</a>
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

        if (filteredLogs.length > 0) {
            googleMap.current.fitBounds(bounds);
        }

        clusterer.current = new MarkerClusterer({ map: googleMap.current, markers: markers.current });
    }, [filteredLogs]);

    useEffect(() => {
        if (viewMode === 'map') {
            const t = setTimeout(initMap, 500);
            return () => clearTimeout(t);
        }
    }, [viewMode, initMap]);

    const formatDriveUrl = (url: string) => {
        if (!url) return '';
        if (url.includes('drive.google.com')) {
            const idMatch = url.match(/(?:id=|\/d\/|folders\/|file\/d\/|open\?id=)([-\w]{25,})/);
            if (idMatch) return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w400`;
        }
        return url;
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Attendance Monitoring</h1>
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-1">Project Staff Tracking Overview</p>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <button 
                        onClick={() => setViewMode('map')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'map' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                        <MapIcon className="w-3 h-3" /> Map View
                    </button>
                    <button 
                        onClick={() => setViewMode('list')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                        <List className="w-3 h-3" /> List View
                    </button>
                    <div className="w-px h-6 bg-gray-100 dark:bg-gray-700 mx-1"></div>
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-[10px] font-black uppercase text-gray-600 dark:text-gray-300 cursor-pointer"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={<User />} label="Unique Staff" value={stats.uniqueStaff} color="bg-indigo-600" />
                <StatCard icon={<Clock />} label="Morning Marks" value={stats.morningCount} color="bg-emerald-600" />
                <StatCard icon={<Shield />} label="Evening Marks" value={stats.eveningCount} color="bg-orange-600" />
                <StatCard icon={<Calendar />} label="Selected Date" value={new Date(selectedDate).toLocaleDateString([], { month: 'short', day: 'numeric' })} color="bg-gray-900" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
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
                        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-900/50">
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">Staff Name</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">Slot</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">Activity/Description</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">Time</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">Location</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700 text-sm">
                                        {filteredLogs.length > 0 ? (
                                            filteredLogs.map((log, i) => (
                                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                    <td className="px-6 py-4 font-black uppercase text-xs text-gray-900 dark:text-white">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
                                                                <User className="w-3 h-3" />
                                                            </div>
                                                            {log.staffName}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase ${log.slot === 'Morning' ? 'bg-indigo-100 text-indigo-600' : 'bg-red-100 text-red-600'}`}>
                                                            {log.slot}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-[10px] font-bold text-gray-600 dark:text-gray-300 line-clamp-2 max-w-[200px]">
                                                            {log.description || 'N/A'}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-gray-500 text-xs">
                                                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-gray-400 text-[10px]">
                                                        {log.lat.toFixed(4)}, {log.lng.toFixed(4)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <button 
                                                            onClick={() => window.open(`https://www.google.com/maps?q=${log.lat},${log.lng}`, '_blank')}
                                                            className="p-2 bg-gray-50 dark:bg-gray-700 text-gray-400 hover:bg-indigo-600 hover:text-white rounded-lg transition-all"
                                                        >
                                                            <MapPin className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-20 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest">No records found for this date</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                        <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4">Live Activity</h3>
                        <div className="space-y-4">
                            {filteredLogs.slice(0, 10).map((log, i) => (
                                <div key={i} className="flex items-start gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-900/30 rounded-2xl transition-all group">
                                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                                        <img src={formatDriveUrl(log.photoUrl)} alt="Staff" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="min-w-0 flex-grow">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black uppercase text-gray-900 dark:text-white truncate">{log.staffName}</p>
                                            <span className="text-[8px] font-bold text-indigo-500 uppercase">{log.slot}</span>
                                        </div>
                                        <p className="text-[9px] font-bold text-gray-400 group-hover:text-indigo-400 transition-colors">
                                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Map Location →
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0 group-hover:translate-x-1 transition-transform">
                                        <ChevronRight className="w-4 h-4 text-gray-200" />
                                    </div>
                                </div>
                            ))}
                            {filteredLogs.length === 0 && (
                                <div className="text-center py-10 text-[10px] font-black text-gray-300 uppercase tracking-widest">
                                    Queue empty
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-indigo-600 p-6 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 dark:shadow-none">
                        <div className="flex items-center gap-2 mb-4">
                            <Info className="w-4 h-4" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Monitoring Tips</p>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex gap-2 text-[10px] font-bold leading-relaxed">
                                <span className="w-1.5 h-1.5 bg-white/50 rounded-full mt-1 flex-shrink-0"></span>
                                Attendance requires real-time photo capture and GPS lock.
                            </li>
                            <li className="flex gap-2 text-[10px] font-bold leading-relaxed">
                                <span className="w-1.5 h-1.5 bg-white/50 rounded-full mt-1 flex-shrink-0"></span>
                                Morning marks ideally before 12:00 PM.
                            </li>
                            <li className="flex gap-2 text-[10px] font-bold leading-relaxed">
                                <span className="w-1.5 h-1.5 bg-white/50 rounded-full mt-1 flex-shrink-0"></span>
                                Coordinates are captured with accuracy values (± meters).
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
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
