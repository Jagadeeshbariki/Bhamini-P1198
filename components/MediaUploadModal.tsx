
import React, { useState } from 'react';
import { GOOGLE_APPS_SCRIPT_URL } from '../config';
import { useAuth } from '../hooks/useAuth';

interface MediaUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadSuccess: () => void;
}

    const MediaUploadModal: React.FC<MediaUploadModalProps> = ({ isOpen, onClose, onUploadSuccess }) => {
    const { user } = useAuth();
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [photoDescription, setPhotoDescription] = useState('');
    const [uploadType, setUploadType] = useState<'slider' | 'gallery'>('gallery');
    const [photoActivity, setPhotoActivity] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<{ success: boolean, message: string } | null>(null);

    const activityContextOptions = [
        'Irrigation', 'Mobile Irrigation', 'Eco-farm pond', 'BRC', 'CHC',
        'Enterprise & IB', 'Desi BYP', 'Goatery', 'Processing Hubs',
        'Fisheries', 'Crop Diversity', 'CB_Event', 'CB_Training', 'Admin'
    ];

    if (!isOpen) return null;

    const handleUploadMedia = async () => {
        if (selectedFiles.length === 0 || !photoActivity) {
            setUploadStatus({ success: false, message: 'Missing files or activity context' });
            return;
        }
        setIsUploading(true);
        setUploadStatus(null);

        let successCount = 0;
        let errorCount = 0;
        let lastErrorMessage = '';

        try {
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                const preview = previewUrls[i];
                const base64Data = preview.split(',')[1];

                const payload = {
                    action: "addPhoto",
                    fileName: file.name,
                    mimeType: file.type,
                    type: uploadType,
                    description: photoDescription || 'Field Entry',
                    activity: photoActivity,
                    uploadedBy: user?.username || 'Unknown',
                    data: base64Data
                };

                const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify(payload)
                });

                const raw = await response.text();
                try {
                    const data = JSON.parse(raw);
                    if (data.status === 'success') {
                        successCount++;
                    } else {
                        errorCount++;
                        lastErrorMessage = data.message || 'Unknown error from script';
                    }
                } catch {
                    errorCount++;
                    lastErrorMessage = 'Invalid JSON response from script.';
                }
            }

            if (successCount > 0) {
                setUploadStatus({
                    success: true,
                    message: `Successfully uploaded ${successCount} image(s).${errorCount > 0 ? ` ${errorCount} failed.` : ''}`
                });
                setSelectedFiles([]);
                setPreviewUrls([]);
                setPhotoDescription('');
                setPhotoActivity('');
                setTimeout(() => {
                    onUploadSuccess();
                    onClose();
                }, 1500);
            } else {
                setUploadStatus({ success: false, message: `All uploads failed. Script Error: ${lastErrorMessage}` });
            }
        } catch (err) {
            setUploadStatus({ success: false, message: `Connection error: ${err instanceof Error ? err.message : 'Unknown error'}` });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-scale-in">
                <div className="p-8">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase">Upload Documentation</h2>
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">Field Registry Update</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 px-1">Placement Type</label>
                            <select value={uploadType} onChange={e => setUploadType(e.target.value as any)} className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl font-black text-xs uppercase border-none ring-1 ring-gray-100">
                                <option value="gallery">Field Activity Gallery</option>
                                <option value="slider">Hero Highlights Slider</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 px-1">Select Files (Max 5)</label>
                            <div className="relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={e => {
                                        const files = Array.from(e.target.files || []).slice(0, 5);
                                        if (files.length > 0) {
                                            setSelectedFiles(files);
                                            const newPreviews: string[] = [];
                                            let loadedCount = 0;

                                            files.forEach((file, index) => {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    newPreviews[index] = reader.result as string;
                                                    loadedCount++;
                                                    if (loadedCount === files.length) {
                                                        setPreviewUrls(newPreviews);
                                                    }
                                                };
                                                reader.readAsDataURL(file);
                                            });
                                        }
                                    }}
                                    className="hidden"
                                    id="file-upload"
                                />
                                <label htmlFor="file-upload" className="flex items-center justify-center w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 cursor-pointer hover:border-indigo-500 transition-colors">
                                    <div className="text-center">
                                        <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-[10px] font-black uppercase text-gray-500">
                                            {selectedFiles.length > 0 ? `${selectedFiles.length} files selected` : 'Click to select photos'}
                                        </span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {previewUrls.length > 0 && (
                            <div className="grid grid-cols-5 gap-2">
                                {previewUrls.map((url, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border-2 border-white shadow-md">
                                        <img src={url} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 px-1">Activity Context</label>
                            <select value={photoActivity} onChange={e => setPhotoActivity(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl font-bold text-sm border-none ring-1 ring-gray-100">
                                <option value="">Select Activity...</option>
                                {activityContextOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 px-1">Description</label>
                            <textarea
                                value={photoDescription}
                                onChange={e => setPhotoDescription(e.target.value)}
                                rows={2}
                                placeholder="Brief description of the activity..."
                                className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl font-bold text-sm border-none ring-1 ring-gray-100"
                            />
                        </div>

                        <button
                            onClick={handleUploadMedia}
                            disabled={isUploading || selectedFiles.length === 0 || !photoActivity}
                            className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl disabled:opacity-50 hover:bg-indigo-700 transition-all transform active:scale-95"
                        >
                            {isUploading ? `Publishing (${selectedFiles.length})...` : "Commit to Registry"}
                        </button>

                        {uploadStatus && (
                            <div className={`p-4 rounded-2xl text-center text-[10px] font-black uppercase ${uploadStatus.success ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                {uploadStatus.message}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes scale-in {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-scale-in { animation: scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
};

export default MediaUploadModal;
