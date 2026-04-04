
import React, { useState, useMemo } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Camera } from 'lucide-react';
import { GOOGLE_APPS_SCRIPT_URL } from '../config';
import { useAuth } from '../hooks/useAuth';

interface AddFarmpondPhotoModalProps {
    data: any[];
    onClose: () => void;
    onSuccess: () => void;
}

const AddFarmpondPhotoModal: React.FC<AddFarmpondPhotoModalProps> = ({ data, onClose, onSuccess }) => {
    const { user } = useAuth();
    const [selectedCluster, setSelectedCluster] = useState('');
    const [selectedGP, setSelectedGP] = useState('');
    const [selectedVillage, setSelectedVillage] = useState('');
    const [selectedBeneficiary, setSelectedBeneficiary] = useState('');
    
    const [image, setImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    // Cascading Data
    const clusters = useMemo(() => Array.from(new Set(data.map(d => d.cluster))).sort(), [data]);
    
    const gps = useMemo(() => {
        if (!selectedCluster) return [];
        return Array.from(new Set(data.filter(d => d.cluster === selectedCluster).map(d => d.gp))).sort();
    }, [data, selectedCluster]);

    const villages = useMemo(() => {
        if (!selectedGP) return [];
        return Array.from(new Set(data.filter(d => d.gp === selectedGP).map(d => d.village))).sort();
    }, [data, selectedGP]);

    const beneficiaries = useMemo(() => {
        if (!selectedVillage) return [];
        return data.filter(d => d.village === selectedVillage).sort((a, b) => a.name.localeCompare(b.name));
    }, [data, selectedVillage]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                setErrorMessage('Image size should be less than 5MB');
                setStatus('error');
                return;
            }
            setImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
            setStatus('idle');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBeneficiary || !image) return;

        setIsSubmitting(true);
        setStatus('idle');

        try {
            const reader = new FileReader();
            reader.readAsDataURL(image);
            reader.onloadend = async () => {
                const base64Data = (reader.result as string).split(',')[1];
                
                const payload = {
                    action: 'uploadFarmpondPhoto',
                    hhId: selectedBeneficiary,
                    photoData: base64Data,
                    fileName: `farmpond_${selectedBeneficiary}_${Date.now()}.jpg`,
                    mimeType: image.type,
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
                        onSuccess();
                        onClose();
                    }, 2000);
                } else {
                    throw new Error(result.message || 'Failed to upload image');
                }
            };
        } catch (err: any) {
            console.error("Upload error:", err);
            setStatus('error');
            setErrorMessage(err.message || 'Something went wrong during upload');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300">
                {/* Header */}
                <div className="p-8 pb-4 flex items-center justify-between border-b border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 rounded-2xl">
                            <Camera className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 leading-none">Add Farm Photo</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Upload beneficiary farmpond image</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                {status === 'success' ? (
                    <div className="p-12 text-center animate-in fade-in slide-in-from-bottom-4">
                        <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Upload Successful!</h3>
                        <p className="text-sm font-bold text-slate-500">The photo link is being updated in the registry.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        {/* Cascading Dropdowns */}
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">1. Select Cluster</label>
                                <select 
                                    required
                                    value={selectedCluster}
                                    onChange={(e) => {
                                        setSelectedCluster(e.target.value);
                                        setSelectedGP('');
                                        setSelectedVillage('');
                                        setSelectedBeneficiary('');
                                    }}
                                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black text-slate-700 focus:border-indigo-500 focus:ring-0 transition-all outline-none appearance-none"
                                >
                                    <option value="">Choose Cluster...</option>
                                    {clusters.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div className={!selectedCluster ? 'opacity-40 pointer-events-none' : ''}>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">2. Select GP</label>
                                <select 
                                    required
                                    value={selectedGP}
                                    onChange={(e) => {
                                        setSelectedGP(e.target.value);
                                        setSelectedVillage('');
                                        setSelectedBeneficiary('');
                                    }}
                                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black text-slate-700 focus:border-indigo-500 focus:ring-0 transition-all outline-none appearance-none"
                                >
                                    <option value="">Choose GP...</option>
                                    {gps.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>

                            <div className={!selectedGP ? 'opacity-40 pointer-events-none' : ''}>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">3. Select Village</label>
                                <select 
                                    required
                                    value={selectedVillage}
                                    onChange={(e) => {
                                        setSelectedVillage(e.target.value);
                                        setSelectedBeneficiary('');
                                    }}
                                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black text-slate-700 focus:border-indigo-500 focus:ring-0 transition-all outline-none appearance-none"
                                >
                                    <option value="">Choose Village...</option>
                                    {villages.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>

                            <div className={!selectedVillage ? 'opacity-40 pointer-events-none' : ''}>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">4. Select Beneficiary</label>
                                <select 
                                    required
                                    value={selectedBeneficiary}
                                    onChange={(e) => setSelectedBeneficiary(e.target.value)}
                                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black text-slate-700 focus:border-indigo-500 focus:ring-0 transition-all outline-none appearance-none"
                                >
                                    <option value="">Choose Farmer...</option>
                                    {beneficiaries.map(b => (
                                        <option key={b.hhId} value={b.hhId}>
                                            {b.name} ({b.hhId})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* File Upload */}
                        <div className={!selectedBeneficiary ? 'opacity-40 pointer-events-none' : ''}>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">5. Upload Farm Image</label>
                            <div className="relative group">
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="hidden"
                                    id="farm-image-upload"
                                    required
                                />
                                <label 
                                    htmlFor="farm-image-upload"
                                    className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-[2rem] cursor-pointer transition-all duration-300 ${
                                        imagePreview 
                                        ? 'border-indigo-500 bg-indigo-50/30' 
                                        : 'border-slate-200 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/50'
                                    }`}
                                >
                                    {imagePreview ? (
                                        <div className="relative w-full h-full p-2">
                                            <img 
                                                src={imagePreview} 
                                                alt="Preview" 
                                                className="w-full h-full object-cover rounded-[1.5rem]"
                                            />
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[1.5rem]">
                                                <p className="text-white text-[10px] font-black uppercase tracking-widest bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm">Change Photo</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center p-6">
                                            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                                <Upload className="w-6 h-6 text-indigo-500" />
                                            </div>
                                            <p className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Click to upload photo</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">PNG, JPG up to 5MB</p>
                                        </div>
                                    )}
                                </label>
                            </div>
                        </div>

                        {status === 'error' && (
                            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 animate-in fade-in">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <p className="text-[10px] font-black uppercase tracking-wider">{errorMessage}</p>
                            </div>
                        )}

                        <div className="flex gap-4 pt-4">
                            <button 
                                type="button" 
                                onClick={onClose}
                                className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                disabled={isSubmitting || !image || !selectedBeneficiary}
                                className="flex-[2] py-4 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                            >
                                {isSubmitting ? 'Uploading...' : 'Submit Photo'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default AddFarmpondPhotoModal;
