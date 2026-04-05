
import React, { useState, useEffect } from 'react';
import { Camera, MapPin, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { GOOGLE_APPS_SCRIPT_URL } from '../config';
import { useAuth } from '../hooks/useAuth';

interface ActivityPhotoUploadModalProps {
    beneficiary: {
        hhId: string;
        name: string;
        activity: string;
    };
    onClose: () => void;
    onSuccess: (url?: string) => void;
}

const ActivityPhotoUploadModal: React.FC<ActivityPhotoUploadModalProps> = ({ beneficiary, onClose, onSuccess }) => {
    const { user } = useAuth();
    const [image, setImage] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Get current location automatically
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (err) => {
                    console.error("Geolocation error:", err);
                    setError("Could not get location. Please enable GPS.");
                }
            );
        }
    }, []);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!image || !location) {
            setError("Please capture/select a photo and ensure location is available.");
            return;
        }

        setStatus('loading');
        setError(null);

        try {
            const reader = new FileReader();
            reader.readAsDataURL(image);
            reader.onloadend = async () => {
                try {
                    if (!reader.result) throw new Error("Failed to read image file.");
                    
                    const base64Data = (reader.result as string).split(',')[1];
                    
                    const payload = {
                        action: 'updateBeneficiaryActivity',
                        hhId: String(beneficiary.hhId || ''),
                        photoData: base64Data,
                        fileName: `activity_${String(beneficiary.activity || 'unknown')}_${String(beneficiary.hhId || 'unknown')}_${Date.now()}.jpg`,
                        mimeType: image.type,
                        lat: location.lat,
                        long: location.lng,
                        uploadedBy: user?.username || 'Unknown'
                    };

                    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                        method: 'POST',
                        mode: 'cors',
                        headers: { 'Content-Type': 'text/plain' },
                        body: JSON.stringify(payload)
                    });

                    const result = await response.json();

                    if (response.ok && result.status === 'success') {
                        setStatus('success');
                        setTimeout(() => {
                            onSuccess(result.url);
                            onClose();
                        }, 2000);
                    } else {
                        throw new Error(result.message || 'Failed to upload image');
                    }
                } catch (err: any) {
                    console.error("Upload error:", err);
                    setStatus('error');
                    setError(err.message || "An unexpected error occurred during upload.");
                }
            };
        } catch (err: any) {
            setStatus('error');
            setError(err.message);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Upload Activity Photo</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">{beneficiary.name} ({beneficiary.hhId})</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Image Preview / Input */}
                    <div className="relative group">
                        {preview ? (
                            <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-indigo-100 dark:border-indigo-900/30">
                                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                                <button 
                                    type="button"
                                    onClick={() => { setImage(null); setPreview(null); }}
                                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-xl shadow-lg hover:scale-110 transition-transform"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center aspect-video rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all cursor-pointer bg-gray-50 dark:bg-gray-800/50 group">
                                <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                                    <Camera className="w-8 h-8 text-indigo-600" />
                                </div>
                                <span className="mt-4 text-xs font-black text-gray-400 uppercase tracking-widest">Click to Capture/Upload</span>
                                <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" />
                            </label>
                        )}
                    </div>

                    {/* Location Info */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${location ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                <MapPin className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">GPS Location</p>
                                {location ? (
                                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                        {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                                    </p>
                                ) : (
                                    <p className="text-xs font-bold text-amber-600 animate-pulse">Acquiring Location...</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                            <p className="text-xs font-bold text-red-600 leading-relaxed">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={status === 'loading' || status === 'success'}
                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl ${
                            status === 'success' 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 disabled:opacity-50'
                        }`}
                    >
                        {status === 'loading' ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Uploading...
                            </>
                        ) : status === 'success' ? (
                            <>
                                <CheckCircle2 className="w-5 h-5" />
                                Uploaded Successfully
                            </>
                        ) : (
                            'Submit Activity Data'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ActivityPhotoUploadModal;
