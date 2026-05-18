
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { STAFF_ATTENDANCE_GAS_URL, STAFF_ATTENDANCE_LOG_URL } from '../config';

interface StaffAttendanceLog {
    timestamp: string;
    username: string;
    staffName: string;
    slot: string;
    photoUrl: string;
    lat: string;
    lng: string;
    accuracy: string;
}

const MarkStaffAttendance: React.FC = () => {
    const { user } = useAuth();
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [photo, setPhoto] = useState<string | null>(null);
    const [description, setDescription] = useState('');
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    const [location, setLocation] = useState<GeolocationCoordinates | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCameraLoading, setIsCameraLoading] = useState(false);
    const [history, setHistory] = useState<StaffAttendanceLog[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const videoRef = useRef<HTMLVideoElement>(null);

    const getTimeSlot = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Morning';
        return 'Evening';
    };

    const fetchHistory = useCallback(async () => {
        if (!user) return;
        try {
            const res = await fetch(`${STAFF_ATTENDANCE_LOG_URL}&cb=${Date.now()}`);
            if (!res.ok) return;
            const text = await res.text();
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            if (lines.length < 1) return;

            // Robust CSV parsing for quoted strings with commas
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
            const data = lines.slice(1).map(line => {
                const values = parseCSVLine(line);
                const obj: any = {};
                headers.forEach((h, i) => obj[h] = values[i]);
                return {
                    timestamp: obj['Timestamp'] || '',
                    username: obj['Username'] || '',
                    staffName: obj['Staff Name'] || '',
                    slot: obj['Time Slot'] || '',
                    description: obj['Description'] || '',
                    photoUrl: obj['Photo Drive Link'] || '',
                    lat: obj['Latitude'] || '',
                    lng: obj['Longitude'] || '',
                    accuracy: obj['Location Accuracy'] || '',
                } as any;
            });
            
            const userHistory = data.filter(d => d.username && d.username.toLowerCase() === user.username.toLowerCase());
            setHistory(userHistory.reverse());
        } catch (err) {
            console.error("Failed to fetch history:", err);
        }
    }, [user]);

    useEffect(() => {
        const init = async () => {
            if (user) await fetchHistory();
        };
        init();
    }, [user, fetchHistory]);

    useEffect(() => {
        if (stream && videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
                videoRef.current?.play().catch(e => {
                    console.error("Autoplay fail:", e);
                    setError("Feed ready. Tap to start manually.");
                });
            };
        }
    }, [stream]);

    const startCamera = useCallback(async () => {
        setError(null);
        setIsCameraLoading(true);
        try {
            const constraints = {
                video: { 
                    facingMode: { ideal: facingMode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };

            const s = await navigator.mediaDevices.getUserMedia(constraints);
            
            setStream(prev => {
                if (prev) prev.getTracks().forEach(t => t.stop());
                return s;
            });
            setIsCameraLoading(false);
        } catch (err: any) {
            console.error("Camera error:", err);
            setIsCameraLoading(false);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setError("Camera permission denied. Please allow camera access.");
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setError("No camera found on this device.");
            } else {
                try {
                    const simpleStream = await navigator.mediaDevices.getUserMedia({ video: true });
                    setStream(prev => {
                        if (prev) prev.getTracks().forEach(t => t.stop());
                        return simpleStream;
                    });
                } catch {
                    setError(`Camera Error: ${err.message || 'Access denied'}`);
                }
            }
        }
    }, [facingMode]);

    useEffect(() => {
        const restart = async () => {
            if (stream) {
                await startCamera();
            }
        };
        restart();
    }, [facingMode, startCamera, stream]); 

    const toggleCamera = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const capturePhoto = () => {
        const video = videoRef.current;
        if (!video || !stream) {
            setError("Camera feed not available.");
            return;
        }
        
        // Ensure video is actually providing data
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            setError("Camera initializing... please try again in a second.");
            return;
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                setPhoto(dataUrl);
                stopCamera();
            } else {
                setError("Failed to initialize capture canvas.");
            }
        } catch (err: any) {
            console.error("Capture error:", err);
            setError("Capture failed: " + (err.message || "Unknown error"));
        }
    };

    const getGPS = () => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser.");
            return;
        }
        setIsFetchingLocation(true);
        setError(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation(pos.coords);
                setIsFetchingLocation(false);
            },
            () => {
                setError("Failed to get location. Please enable GPS.");
                setIsFetchingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 15000 }
        );
    };

    const handleSubmit = async () => {
        if (!photo || !location || !user) return;
        setIsSubmitting(true);
        setError(null);

        const currentSlot = getTimeSlot();
        const currentDesc = description;
        const currentPos = location;
        const currentPhoto = photo;

        const payload = {
            username: user.username,
            staffName: user.username,
            slot: currentSlot,
            description: currentDesc,
            image: currentPhoto.split(',')[1], // Base64 part only
            lat: currentPos.latitude,
            lng: currentPos.longitude,
            accuracy: currentPos.accuracy,
            device: navigator.userAgent
        };

        try {
            await fetch(STAFF_ATTENDANCE_GAS_URL, {
                method: 'POST',
                mode: 'no-cors', // Common for GAS
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            // Add to history locally immediately for responsiveness
            const newRecord: any = {
                timestamp: new Date().toISOString(),
                username: user.username,
                staffName: user.username,
                slot: currentSlot,
                description: currentDesc,
                photoUrl: currentPhoto, // Show local photo preview until sheet updates
                lat: currentPos.latitude.toString(),
                lng: currentPos.longitude.toString(),
                accuracy: currentPos.accuracy.toString(),
            };

            setHistory(prev => [newRecord, ...prev]);
            
            // Reset form
            setPhoto(null);
            setDescription('');
            setLocation(null);
            setIsSubmitting(false);

            // Fetch from server after a delay (GSheets takes time to update)
            setTimeout(() => {
                fetchHistory();
            }, 3000);
            
        } catch (err) {
            console.error("Submission error:", err);
            setError("Submission failed. Please try again.");
            setIsSubmitting(false);
        }
    };

    const hasTodaySlot = (slot: string) => {
        const today = new Date().toLocaleDateString();
        return history.some(d => {
            const date = new Date(d.timestamp).toLocaleDateString();
            return date === today && d.slot === slot;
        });
    };

    const formatDriveUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('data:image')) return url; // Handle local previews
        if (url.includes('drive.google.com')) {
            const idMatch = url.match(/(?:id=|\/d\/|folders\/|file\/d\/|open\?id=)([-\w]{25,})/);
            if (idMatch) return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w400`;
        }
        return url;
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Staff Attendance</h1>
                        <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-1">Daily {getTimeSlot()} Check-in</p>
                    </div>
                    {hasTodaySlot(getTimeSlot()) ? (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-6 py-3 rounded-2xl border border-emerald-100 dark:border-emerald-800 flex items-center gap-2">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-black uppercase tracking-widest">{getTimeSlot()} Attendance Marked</span>
                        </div>
                    ) : (
                        <div className="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-6 py-3 rounded-2xl border border-orange-100 dark:border-orange-800 flex items-center gap-2">
                            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-black uppercase tracking-widest">Pending: {getTimeSlot()}</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Capture Section */}
                    <div className="space-y-6">
                        {!photo ? (
                            <div className="relative aspect-video bg-gray-100 dark:bg-gray-900 rounded-3xl overflow-hidden border-4 border-gray-50 dark:border-gray-800 shadow-inner group">
                                {stream ? (
                                    <video 
                                    ref={videoRef} 
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="w-full h-full object-cover" 
                                />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                                        <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                        <div className="flex flex-col items-center gap-3">
                                            <button 
                                                onClick={startCamera}
                                                disabled={isCameraLoading}
                                                className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-3 shadow-xl shadow-indigo-200 disabled:opacity-50"
                                            >
                                                {isCameraLoading ? (
                                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                                )}
                                                {isCameraLoading ? 'Initializing...' : 'Open Live Camera'}
                                            </button>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight mt-2">Gallery uploads are not permitted for attendance</p>
                                        </div>
                                    </div>
                                )}
                                {stream && (
                                    <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-6">
                                        <button 
                                            onClick={toggleCamera}
                                            className="p-3 bg-black/30 backdrop-blur-md text-white rounded-full hover:bg-black/50 transition-colors"
                                            title="Switch Camera"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                                        </button>
                                        <button 
                                            onClick={capturePhoto}
                                            className="w-16 h-16 bg-white rounded-full border-4 border-indigo-600 shadow-xl flex items-center justify-center active:scale-90 transition-transform"
                                        >
                                            <div className="w-10 h-10 bg-indigo-100 rounded-full"></div>
                                        </button>
                                        <button 
                                            onClick={stopCamera}
                                            className="p-3 bg-red-600/30 backdrop-blur-md text-white rounded-full hover:bg-red-600/50 transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="relative aspect-video rounded-3xl overflow-hidden border-4 border-indigo-100 dark:border-indigo-900 shadow-lg animate-fade-in">
                                <img src={photo} alt="Capture" className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => { setPhoto(null); startCamera(); }}
                                    className="absolute top-4 right-4 p-2 bg-red-600 text-white rounded-full hover:scale-110 transition-transform shadow-lg"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                            </div>
                        )}

                        <div className="flex flex-col gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-1">Describe your current work/task</label>
                                <textarea 
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Enter details of activities being performed..."
                                    className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-bold min-h-[100px] resize-none"
                                />
                            </div>

                            {!location ? (
                                <button 
                                    onClick={getGPS}
                                    disabled={isFetchingLocation}
                                    className={`w-full p-4 bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl flex items-center justify-center gap-3 text-gray-400 font-bold hover:border-indigo-500 hover:text-indigo-500 transition-all uppercase text-[10px] tracking-widest ${isFetchingLocation ? 'cursor-wait opacity-70' : ''}`}
                                >
                                    {isFetchingLocation ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span>Searching for GPS Signal...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                            Get GPS Location
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border-2 border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-600 rounded-lg text-white">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-indigo-500 tracking-tighter">Location Captured</p>
                                            <p className="text-[8px] font-mono text-indigo-400">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)} • ±{location.accuracy.toFixed(1)}m</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setLocation(null)} className="text-indigo-400 hover:text-red-500 transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                    </button>
                                </div>
                            )}

                            <button 
                                disabled={!photo || !location || !description.trim() || isSubmitting || isFetchingLocation || hasTodaySlot(getTimeSlot())}
                                onClick={handleSubmit}
                                className={`w-full py-5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
                                    (!photo || !location || !description.trim() || hasTodaySlot(getTimeSlot())) 
                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed' 
                                    : 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 active:scale-[0.98]'
                                }`}
                            >
                                <span className="text-sm font-black uppercase tracking-widest">
                                    {isSubmitting ? 'Submitting Attendance...' : isFetchingLocation ? 'Waiting for GPS...' : `Submit ${getTimeSlot()} Attendance`}
                                </span>
                                {(!photo || !location || !description.trim()) && !hasTodaySlot(getTimeSlot()) && (
                                    <span className="text-[8px] font-bold opacity-60 uppercase">Photo, Description and GPS required</span>
                                )}
                            </button>
                        </div>
                        {error && <p className="text-center text-[10px] font-black text-red-500 uppercase bg-red-50 p-2 rounded-xl border border-red-100">{error}</p>}
                    </div>

                    {/* History Section */}
                    <div className="flex flex-col">
                        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-700 flex-grow min-h-[400px]">
                            <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-6 px-1">Check-in History</h3>
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                {history.length > 0 ? (
                                    history.map((h, idx) => (
                                        <div key={idx} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center gap-4 group">
                                            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-100">
                                                {h.photoUrl ? (
                                                    <img src={formatDriveUrl(h.photoUrl)} alt="Staff" className="w-full h-full object-cover scale-150 group-hover:scale-100 transition-transform duration-500" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-grow min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-[10px] font-black uppercase text-indigo-600 truncate">{h.slot}</p>
                                                    <p className="text-[8px] font-bold text-gray-400 uppercase">{new Date(h.timestamp).toLocaleDateString()}</p>
                                                </div>
                                                <p className="text-xs font-black text-gray-900 dark:text-white truncate">{new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                {h.description && (
                                                    <p className="text-[9px] font-medium text-gray-500 truncate mt-0.5">{h.description}</p>
                                                )}
                                                <div className="flex items-center gap-2 mt-2">
                                                    <a 
                                                        href={`https://www.google.com/maps?q=${h.lat},${h.lng}`} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="text-[8px] font-bold text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-1 uppercase bg-gray-50 dark:bg-gray-700 px-2 py-0.5 rounded-full"
                                                    >
                                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                                        View Map
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-30 grayscale">
                                        <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                                        <p className="text-[10px] font-black uppercase tracking-widest">No Records Yet</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MarkStaffAttendance;
