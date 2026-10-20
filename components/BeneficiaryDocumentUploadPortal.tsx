import React, { useState, useEffect, useMemo } from 'react';
import { 
    Upload, FileText, CheckCircle2, AlertTriangle, ArrowLeft, 
    Search, User, MapPin, Building, Activity as ActivityIcon, Check, Shield
} from 'lucide-react';
import { BENEFICIARY_DATA_URL, getProxyUrl } from '../config';
import { useAuth } from '../hooks/useAuth';

interface BeneficiaryDocumentUploadPortalProps {
    onBack: () => void;
}

interface BeneficiaryRecord {
    beneficiaryId: string;
    name: string;
    block: string;
    cluster: string;
    gp: string;
    village: string;
    activity: string;
    fatherSpouse: string;
}

export const BeneficiaryDocumentUploadPortal: React.FC<BeneficiaryDocumentUploadPortalProps> = ({ onBack }) => {
    const { user } = useAuth();
    const [beneficiaries, setBeneficiaries] = useState<BeneficiaryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [selectedBlock, setSelectedBlock] = useState('ALL');
    const [selectedCluster, setSelectedCluster] = useState('ALL');
    const [selectedGp, setSelectedGp] = useState('ALL');
    const [selectedVillage, setSelectedVillage] = useState('ALL');
    const [selectedActivity, setSelectedActivity] = useState('ALL');
    const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState('');

    // Upload states
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [remarks, setRemarks] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [recentUploads, setRecentUploads] = useState<any[]>([]);

    // Fetch beneficiary data from spreadsheet
    useEffect(() => {
        const fetchBeneficiaries = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(getProxyUrl(BENEFICIARY_DATA_URL));
                const text = await res.text();
                if (!text) {
                    throw new Error("Failed to load beneficiary data");
                }
                const lines = text.trim().split("\n");
                if (lines.length > 1) {
                    const headers = lines[0].split(",").map((h: string) => h.toLowerCase().trim().replace(/^"|"$/g, ""));
                    const parsed: BeneficiaryRecord[] = lines.slice(1).map((l: string) => {
                        const cols = l.split(",").map((c: string) => c.trim().replace(/^"|"$/g, ""));
                        const get = (keys: string[]) => {
                            for (const k of keys) {
                                const idx = headers.indexOf(k);
                                if (idx !== -1 && cols[idx]) return cols[idx];
                            }
                            return "";
                        };
                        return {
                            beneficiaryId: get(["beneficiary id", "farmer_id", "beneficiary_id", "bnf_section_-adhaar_number_"]),
                            name: get(["name", "beneficiary name", "farmer_name", "location-farmer_name"]),
                            block: get(["block", "location-block"]) || "Block 1",
                            cluster: get(["cluster", "location_info/cluster", "location-cluster"]) || "Cluster 1",
                            gp: get(["gp", "location-gp"]) || "GP",
                            village: get(["village", "location-village"]) || "Village",
                            activity: get(["activity", "activity_registration-activity"]) || "NS",
                            fatherSpouse: get(["father/spouse", "location-father_or_spouse_name", "hh head"]) || "-"
                        };
                    }).filter((b: BeneficiaryRecord) => b.beneficiaryId || b.name);
                    setBeneficiaries(parsed);
                }
            } catch (err: any) {
                setError(err.message || "Failed to load beneficiary database");
            } finally {
                setLoading(false);
            }
        };
        fetchBeneficiaries();
    }, []);

    // Unique lists for cascading dropdowns
    const blocks = useMemo(() => {
        const set = new Set<string>();
        beneficiaries.forEach(b => { if (b.block) set.add(b.block); });
        return Array.from(set).sort();
    }, [beneficiaries]);

    const clusters = useMemo(() => {
        const set = new Set<string>();
        beneficiaries.forEach(b => {
            if (selectedBlock === 'ALL' || b.block === selectedBlock) {
                if (b.cluster) set.add(b.cluster);
            }
        });
        return Array.from(set).sort();
    }, [beneficiaries, selectedBlock]);

    const gps = useMemo(() => {
        const set = new Set<string>();
        beneficiaries.forEach(b => {
            if ((selectedBlock === 'ALL' || b.block === selectedBlock) &&
                (selectedCluster === 'ALL' || b.cluster === selectedCluster)) {
                if (b.gp) set.add(b.gp);
            }
        });
        return Array.from(set).sort();
    }, [beneficiaries, selectedBlock, selectedCluster]);

    const villages = useMemo(() => {
        const set = new Set<string>();
        beneficiaries.forEach(b => {
            if ((selectedBlock === 'ALL' || b.block === selectedBlock) &&
                (selectedCluster === 'ALL' || b.cluster === selectedCluster) &&
                (selectedGp === 'ALL' || b.gp === selectedGp)) {
                if (b.village) set.add(b.village);
            }
        });
        return Array.from(set).sort();
    }, [beneficiaries, selectedBlock, selectedCluster, selectedGp]);

    const activities = useMemo(() => {
        const set = new Set<string>();
        beneficiaries.forEach(b => {
            if ((selectedBlock === 'ALL' || b.block === selectedBlock) &&
                (selectedCluster === 'ALL' || b.cluster === selectedCluster) &&
                (selectedGp === 'ALL' || b.gp === selectedGp) &&
                (selectedVillage === 'ALL' || b.village === selectedVillage)) {
                if (b.activity) set.add(b.activity);
            }
        });
        return Array.from(set).sort();
    }, [beneficiaries, selectedBlock, selectedCluster, selectedGp, selectedVillage]);

    // Filtered beneficiaries for the beneficiary dropdown
    const filteredBeneficiaries = useMemo(() => {
        return beneficiaries.filter(b => {
            if (selectedBlock !== 'ALL' && b.block !== selectedBlock) return false;
            if (selectedCluster !== 'ALL' && b.cluster !== selectedCluster) return false;
            if (selectedGp !== 'ALL' && b.gp !== selectedGp) return false;
            if (selectedVillage !== 'ALL' && b.village !== selectedVillage) return false;
            if (selectedActivity !== 'ALL' && b.activity !== selectedActivity) return false;
            return true;
        });
    }, [beneficiaries, selectedBlock, selectedCluster, selectedGp, selectedVillage, selectedActivity]);

    const selectedBeneficiary = useMemo(() => {
        return beneficiaries.find(b => b.beneficiaryId === selectedBeneficiaryId || b.name === selectedBeneficiaryId);
    }, [beneficiaries, selectedBeneficiaryId]);

    // File change handler with 5MB validation and JPG/PDF check
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFileError(null);
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
            if (!validTypes.includes(file.type)) {
                setFileError('Invalid file format. Please upload a JPG, JPEG, PNG, or PDF file.');
                setUploadFile(null);
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                setFileError('File size exceeds 5MB limit. Please select a smaller file.');
                setUploadFile(null);
                return;
            }
            setUploadFile(file);
        }
    };

    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBeneficiary) {
            alert('Please select a beneficiary from the dropdown.');
            return;
        }
        if (!uploadFile) {
            alert('Please select a valid document (JPG, PNG or PDF, max 5MB).');
            return;
        }

        setSubmitting(true);
        setSuccessMessage(null);

        try {
            // Convert file to base64
            const reader = new FileReader();
            const base64Promise = new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
                reader.readAsDataURL(uploadFile);
            });
            const base64Data = await base64Promise;

            const payload = {
                beneficiaryId: selectedBeneficiary.beneficiaryId || selectedBeneficiary.name,
                beneficiaryName: selectedBeneficiary.name,
                block: selectedBeneficiary.block,
                cluster: selectedBeneficiary.cluster,
                gp: selectedBeneficiary.gp,
                village: selectedBeneficiary.village,
                activity: selectedBeneficiary.activity,
                fileBase64: base64Data,
                fileName: uploadFile.name,
                fileSize: uploadFile.size,
                receivedBy: user?.username || 'Data Assistant',
                remarks: remarks || 'Hard-copy document uploaded by DA'
            };

            const res = await fetch('/api/beneficiary-documents/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                setSuccessMessage(`Document successfully uploaded and synced for beneficiary ${selectedBeneficiary.name}!`);
                setRecentUploads(prev => [data.record || { ...payload, timestamp: new Date().toISOString() }, ...prev]);
                setUploadFile(null);
                setRemarks('');
                setSelectedBeneficiaryId('');
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (err: any) {
            alert('Upload error: ' + (err.message || 'Failed to upload document'));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading Beneficiary Database & Geographic Hierarchy...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-xl mx-auto p-8 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-200 text-center space-y-4">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase">Failed to load data</h3>
                <p className="text-sm text-red-600">{error}</p>
                <button onClick={onBack} className="px-6 py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase">
                    Back to Dashboards
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            {/* Top Navigation & Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <button
                    onClick={onBack}
                    className="inline-flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-amber-600 transition-colors group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Dashboards
                </button>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-full text-xs font-black uppercase tracking-wider">
                    <Shield className="w-4 h-4" />
                    Data Assistant (DA) & Admin Portal
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-gray-100 dark:border-gray-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
                <div className="relative z-10 space-y-4">
                    <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-3xl flex items-center justify-center mb-4">
                        <Upload className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                        Beneficiary Document <span className="text-amber-600">Upload Portal</span>
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed font-medium">
                        Select geographic location and activity hierarchy below, choose a beneficiary from the dropdown, and upload the signed hard-copy acknowledgment receipt or beneficiary document (JPG, PNG, or PDF, max 5 MB).
                    </p>
                </div>
            </div>

            {successMessage && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-6 rounded-2xl flex items-center gap-4 text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                    <div className="text-sm font-black uppercase tracking-wide">{successMessage}</div>
                </div>
            )}

            <form onSubmit={handleUploadSubmit} className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 md:p-12 shadow-xl border border-gray-100 dark:border-gray-800 space-y-8">
                <div className="border-b border-gray-100 dark:border-gray-800 pb-6">
                    <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-amber-600" />
                        Step 1: Geographic & Activity Hierarchy Selection
                    </h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                        Filter by block, cluster, GP, village, and activity to narrow down beneficiaries
                    </p>
                </div>

                {/* Cascading Dropdowns Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Block */}
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">Block</label>
                        <select
                            value={selectedBlock}
                            onChange={(e) => {
                                setSelectedBlock(e.target.value);
                                setSelectedCluster('ALL');
                                setSelectedGp('ALL');
                                setSelectedVillage('ALL');
                                setSelectedActivity('ALL');
                                setSelectedBeneficiaryId('');
                            }}
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="ALL">All Blocks ({blocks.length})</option>
                            {blocks.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>

                    {/* Cluster */}
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">Cluster</label>
                        <select
                            value={selectedCluster}
                            onChange={(e) => {
                                setSelectedCluster(e.target.value);
                                setSelectedGp('ALL');
                                setSelectedVillage('ALL');
                                setSelectedActivity('ALL');
                                setSelectedBeneficiaryId('');
                            }}
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="ALL">All Clusters ({clusters.length})</option>
                            {clusters.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* GP */}
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">Gram Panchayat (GP)</label>
                        <select
                            value={selectedGp}
                            onChange={(e) => {
                                setSelectedGp(e.target.value);
                                setSelectedVillage('ALL');
                                setSelectedActivity('ALL');
                                setSelectedBeneficiaryId('');
                            }}
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="ALL">All GPs ({gps.length})</option>
                            {gps.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>

                    {/* Village */}
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">Village</label>
                        <select
                            value={selectedVillage}
                            onChange={(e) => {
                                setSelectedVillage(e.target.value);
                                setSelectedActivity('ALL');
                                setSelectedBeneficiaryId('');
                            }}
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="ALL">All Villages ({villages.length})</option>
                            {villages.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>

                    {/* Activity */}
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">Activity</label>
                        <select
                            value={selectedActivity}
                            onChange={(e) => {
                                setSelectedActivity(e.target.value);
                                setSelectedBeneficiaryId('');
                            }}
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="ALL">All Activities ({activities.length})</option>
                            {activities.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                </div>

                {/* Beneficiary Dropdown */}
                <div className="pt-6 border-t border-gray-100 dark:border-gray-800 space-y-4">
                    <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                        <User className="w-5 h-5 text-amber-600" />
                        Step 2: Select Beneficiary ({filteredBeneficiaries.length} available)
                    </h2>
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">Beneficiary Name & ID</label>
                        <select
                            value={selectedBeneficiaryId}
                            onChange={(e) => setSelectedBeneficiaryId(e.target.value)}
                            required
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="">-- Select Beneficiary --</option>
                            {filteredBeneficiaries.map((b, idx) => (
                                <option key={`${b.beneficiaryId}-${idx}`} value={b.beneficiaryId || b.name}>
                                    {b.name} (ID: {b.beneficiaryId || 'N/A'}) - Village: {b.village} | Activity: {b.activity}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedBeneficiary && (
                        <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 p-6 rounded-3xl grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div>
                                <span className="font-bold text-gray-400 uppercase tracking-widest block mb-1">Beneficiary Name</span>
                                <span className="font-black text-gray-900 dark:text-white text-sm">{selectedBeneficiary.name}</span>
                            </div>
                            <div>
                                <span className="font-bold text-gray-400 uppercase tracking-widest block mb-1">Beneficiary ID / Adhaar</span>
                                <span className="font-black text-gray-900 dark:text-white text-sm font-mono">{selectedBeneficiary.beneficiaryId}</span>
                            </div>
                            <div>
                                <span className="font-bold text-gray-400 uppercase tracking-widest block mb-1">Location</span>
                                <span className="font-black text-gray-900 dark:text-white text-sm">{selectedBeneficiary.village}, {selectedBeneficiary.gp}</span>
                            </div>
                            <div>
                                <span className="font-bold text-gray-400 uppercase tracking-widest block mb-1">Activity</span>
                                <span className="font-black text-amber-600 text-sm uppercase">{selectedBeneficiary.activity}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Document Upload Section */}
                <div className="pt-6 border-t border-gray-100 dark:border-gray-800 space-y-4">
                    <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                        <Upload className="w-5 h-5 text-amber-600" />
                        Step 3: Upload Hard-Copy Document (JPG, PNG or PDF, Max 5MB)
                    </h2>

                    <div className="space-y-4">
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-3xl p-8 text-center bg-gray-50 dark:bg-gray-800/50 hover:bg-amber-50/20 transition-colors">
                            <input
                                type="file"
                                id="doc-upload"
                                accept=".jpg,.jpeg,.png,.pdf"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <label htmlFor="doc-upload" className="cursor-pointer flex flex-col items-center space-y-3">
                                <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-2xl flex items-center justify-center">
                                    <Upload className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-black text-gray-900 dark:text-white uppercase">
                                    {uploadFile ? uploadFile.name : 'Click to select signed receipt or document'}
                                </span>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    Supported formats: JPG, PNG, PDF (Max size: 5MB)
                                </span>
                            </label>
                        </div>

                        {fileError && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-2xl text-xs font-bold">
                                {fileError}
                            </div>
                        )}

                        {uploadFile && (
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-200">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-amber-600" />
                                    <span>Selected: {uploadFile.name} ({(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setUploadFile(null)}
                                    className="text-red-500 font-black uppercase text-[10px] hover:underline"
                                >
                                    Remove
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2 pt-2">
                        <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">Remarks / Hard-Copy Notes</label>
                        <input
                            type="text"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="e.g. Hard-copy received with beneficiary signature and thumb impression"
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>
                </div>

                <div className="pt-6">
                    <button
                        type="submit"
                        disabled={submitting || !selectedBeneficiary || !uploadFile}
                        className="w-full py-5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black rounded-2xl uppercase tracking-widest transition-all duration-300 shadow-xl shadow-amber-600/20 flex items-center justify-center gap-3 text-sm"
                    >
                        {submitting ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Uploading & Syncing...
                            </>
                        ) : (
                            <>
                                <Upload className="w-5 h-5" />
                                Upload & Sync Beneficiary Document
                            </>
                        )}
                    </button>
                </div>
            </form>

            {recentUploads.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-xl border border-gray-100 dark:border-gray-800 space-y-6">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                        <Check className="w-5 h-5 text-emerald-600" />
                        Recently Uploaded Documents ({recentUploads.length})
                    </h3>
                    <div className="space-y-3">
                        {recentUploads.map((up, idx) => (
                            <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl flex items-center justify-between text-xs">
                                <div>
                                    <p className="font-black text-gray-900 dark:text-white text-sm">{up.beneficiaryName} <span className="text-gray-400 font-mono text-xs">(ID: {up.beneficiaryId})</span></p>
                                    <p className="text-gray-500 font-medium mt-1">File: {up.fileName} | Village: {up.village} | Activity: {up.activity}</p>
                                </div>
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black uppercase">
                                    Uploaded by {up.receivedBy}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BeneficiaryDocumentUploadPortal;
