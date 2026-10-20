import React, { useState, useEffect, useMemo } from 'react';
import { 
    FileText, Upload, CheckCircle2, AlertCircle, RefreshCw, 
    ArrowLeft, User, MapPin, Building2, Activity as ActivityIcon, Check, X,
    Eye, Download, Printer, Archive, Search, Copy
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { BENEFICIARY_DATA_URL, UPLOAD_LETTERS_SCRIPT_URL, getProxyUrl } from '../config';
import { LETTERHEAD_HEADER_BASE64, LETTERHEAD_FOOTER_BASE64 } from "../utils/letterheadImages";
import { printA4Letter, downloadA4LetterPdf, downloadCombinedA4LettersPdf, downloadZipA4LettersPdf, printMultipleA4Letters } from "../utils/printLetter";
import AcknowledgementLetterSheet from "./AcknowledgementLetterSheet";

interface UploadLettersDashboardProps {
    onBack: () => void;
}

interface ActivityRecord {
    cluster: string;
    gp: string;
    village: string;
    activity: string;
    beneficiaryName: string;
    hhId: string;
    farmerId: string;
    submissionId?: string;
    raw: any;
}

export const UploadLettersDashboard: React.FC<UploadLettersDashboardProps> = ({ onBack }) => {
    const { user } = useAuth();
    const role = user?.role?.toLowerCase()?.trim() || '';
    const isAdminOrProject = role === 'admin' || role === 'project';

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [activityRecords, setActivityRecords] = useState<ActivityRecord[]>([]);
    const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
    const [submittedRecords, setSubmittedRecords] = useState<any[]>([]);
    const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);

    // Form state
    const [selectedCluster, setSelectedCluster] = useState('');
    const [selectedGP, setSelectedGP] = useState('');
    const [selectedVillage, setSelectedVillage] = useState('');
    const [selectedActivity, setSelectedActivity] = useState('');
    const [selectedBeneficiary, setSelectedBeneficiary] = useState('');
    const [fileObj, setFileObj] = useState<{ name: string; type: string; base64: string } | null>(null);
    const [remarks, setRemarks] = useState('');

    // Generated Acknowledgement Letter preview & download state
    const [selectedAckLetterForPreview, setSelectedAckLetterForPreview] = useState<any | null>(null);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [autoDownloadAck, setAutoDownloadAck] = useState(false);
    const [modalMaterials, setModalMaterials] = useState<any[]>([]);

    // Batch download state for returned letters
    const [selectedReturnedIdxs, setSelectedReturnedIdxs] = useState<Set<number>>(new Set());
    const [batchStagingItems, setBatchStagingItems] = useState<any[]>([]);
    const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; statusText: string } | null>(null);

    // Search state
    const [searchTrackingQuery, setSearchTrackingQuery] = useState('');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const handleBatchDownload = async (items: any[], type: 'combined' | 'zip' | 'print') => {
        if (!items || items.length === 0) return;
        setBatchStagingItems(items);
        setBatchProgress({ current: 0, total: items.length, statusText: 'Preparing letterhead templates...' });

        await new Promise(resolve => setTimeout(resolve, 350));

        const elementIds = items.map((_, idx) => `upload-batch-sheet-${idx}`);

        if (type === 'print') {
            setBatchProgress(null);
            setBatchStagingItems([]);
            printMultipleA4Letters(elementIds);
            return;
        }

        const timestamp = new Date().toISOString().slice(0, 10);
        if (type === 'combined') {
            const filename = `Combined_Acknowledgement_Letters_${items.length}_Beneficiaries_${timestamp}.pdf`;
            await downloadCombinedA4LettersPdf(elementIds, filename, (current, total) => {
                setBatchProgress({ current, total, statusText: `Generating letter ${current} of ${total}...` });
            });
        } else if (type === 'zip') {
            const zipItems = items.map((item, idx) => {
                const bName = (item.beneficiary_name || item.beneficiary || 'beneficiary').replace(/[^a-zA-Z0-9]/g, '_');
                const ackNum = item.acknowledgement_number || `P1198-BHM-2026-${Math.abs(String(item.beneficiary_id || item.farmerId || '0').split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString().substring(0, 6)}`;
                return {
                    id: `upload-batch-sheet-${idx}`,
                    filename: `Acknowledgement_${ackNum}_${bName}.pdf`
                };
            });
            await downloadZipA4LettersPdf(zipItems, `Acknowledgement_Letters_${items.length}_Files_${timestamp}.zip`, (current, total) => {
                setBatchProgress({ current, total, statusText: `Compressing letter ${current} of ${total}...` });
            });
        }

        setBatchProgress(null);
        setBatchStagingItems([]);

        // Sync UUID <-> Acknowledgement ID to Google Spreadsheet dedicated tab
        try {
            fetch('/api/acknowledgement-mapping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: items.map(item => ({
                        uuid: item.submissionId || item.uuid || item.farmerId || item.hhId || item.beneficiary_id,
                        acknowledgementId: item.acknowledgement_number || `P1198-BHM-2026-${Math.abs(String(item.beneficiary_id || item.farmerId || '0').split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString().substring(0, 6)}`,
                        beneficiaryId: item.farmerId || item.hhId || item.beneficiary_id || '-',
                        beneficiaryName: item.beneficiary_name || item.beneficiary,
                        activityName: item.activity_name || item.activity,
                        cluster: item.cluster,
                        gp: item.gp,
                        village: item.village,
                        generatedBy: 'User',
                        remarks: 'Batch Downloaded'
                    }))
                })
            }).catch(e => console.warn('Mapping sync notice:', e));
        } catch { /* ignore */ }
    };

    // Filtered tracking records based on search query
    const filteredSubmittedRecords = useMemo(() => {
        if (!searchTrackingQuery.trim()) return submittedRecords;
        const q = searchTrackingQuery.toLowerCase().trim();
        return submittedRecords.filter(rec => {
            const bId = String(rec.farmerId || rec.hhId || rec.beneficiaryId || '');
            const ackNum = String(rec.acknowledgement_number || (bId ? `P1198-BHM-2026-${Math.abs(String(bId).split('').reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0)).toString().substring(0,6)}` : ''));
            const uuid = String(rec.submissionId || rec.uuid || '');
            const benName = String(rec.beneficiary || rec.beneficiaryName || '');
            const village = String(rec.village || '');
            const gp = String(rec.gp || '');
            const cluster = String(rec.cluster || '');
            const activity = String(rec.activity || '');
            const uploadedBy = String(rec.uploadedBy || '');

            return (
                ackNum.toLowerCase().includes(q) ||
                uuid.toLowerCase().includes(q) ||
                bId.toLowerCase().includes(q) ||
                benName.toLowerCase().includes(q) ||
                village.toLowerCase().includes(q) ||
                gp.toLowerCase().includes(q) ||
                cluster.toLowerCase().includes(q) ||
                activity.toLowerCase().includes(q) ||
                uploadedBy.toLowerCase().includes(q)
            );
        });
    }, [submittedRecords, searchTrackingQuery]);

    const openGeneratedAckLetter = async (benData: any, autoDownload = false) => {
        setSelectedAckLetterForPreview(benData);
        if (autoDownload) {
            setAutoDownloadAck(true);
        }
        try {
            const benId = benData.farmerId || benData.hhId || benData.beneficiaryId || "";
            const bName = benData.beneficiaryName || benData.beneficiary || "";
            const vName = benData.village || "";
            const params = new URLSearchParams({
                beneficiaryId: benId,
                farmerId: benId,
                hhId: benData.hhId || "",
                name: bName,
                village: vName
            });
            const res = await fetch(`/api/materials/query?${params.toString()}`);
            const data = await res.json();
            if (data.success && Array.isArray(data.materials) && data.materials.length > 0) {
                setModalMaterials(data.materials);
            } else {
                setModalMaterials([]);
            }
        } catch {
            setModalMaterials([]);
        }
    };

    const handleDownloadCurrentModalPdf = async () => {
        if (!selectedAckLetterForPreview) return;
        setIsDownloadingPdf(true);
        const benId = selectedAckLetterForPreview.farmerId || selectedAckLetterForPreview.hhId || selectedAckLetterForPreview.beneficiaryId || '0';
        const ackNum = `P1198-BHM-2026-${Math.abs(String(benId).split('').reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0)).toString().substring(0,6)}`;
        const bName = (selectedAckLetterForPreview.beneficiaryName || selectedAckLetterForPreview.beneficiary || 'beneficiary').replace(/[^a-zA-Z0-9]/g, '_');
        await downloadA4LetterPdf("upload-letters-ack-sheet", `Acknowledgement_${ackNum}_${bName}.pdf`);
        setIsDownloadingPdf(false);
    };

    useEffect(() => {
        if (selectedAckLetterForPreview && autoDownloadAck) {
            const timer = setTimeout(async () => {
                setIsDownloadingPdf(true);
                const benId = selectedAckLetterForPreview.farmerId || selectedAckLetterForPreview.hhId || selectedAckLetterForPreview.beneficiaryId || '0';
                const ackNum = `P1198-BHM-2026-${Math.abs(String(benId).split('').reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0)).toString().substring(0,6)}`;
                const bName = (selectedAckLetterForPreview.beneficiaryName || selectedAckLetterForPreview.beneficiary || 'beneficiary').replace(/[^a-zA-Z0-9]/g, '_');
                await downloadA4LetterPdf("upload-letters-ack-sheet", `Acknowledgement_${ackNum}_${bName}.pdf`);
                setIsDownloadingPdf(false);
                setAutoDownloadAck(false);
            }, 350);
            return () => clearTimeout(timer);
        }
    }, [selectedAckLetterForPreview, autoDownloadAck]);

    useEffect(() => {
        if (!isAdminOrProject) return;
        fetchData();
    }, [isAdminOrProject]);

    const fetchData = async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            const [odkRes, benRes, sheetRes] = await Promise.all([
                fetch('/api/odk/data?formId=Status&projectId=3').catch(() => ({ ok: false, text: async () => '{}' } as any)),
                fetch(getProxyUrl(BENEFICIARY_DATA_URL)).catch(() => ({ ok: false, text: async () => '' } as any)),
                fetch(UPLOAD_LETTERS_SCRIPT_URL).catch(() => ({ ok: false, text: async () => '{}' } as any))
            ]);

            const beneficiaryMapByBenId = new Map<string, any>();
            const parsedBens: any[] = [];
            if (benRes.ok) {
                const benText = await benRes.text();
                const lines = benText.trim().split(/\r?\n/).filter(l => l.trim());
                if (lines.length > 1) {
                    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                    const getIdx = (kws: string[]) => headers.findIndex(h => kws.some(kw => h.includes(kw)));
                    const nIdx = getIdx(['name', 'beneficiary_name', 'farmer_name']);
                    const hhIdx = getIdx(['hh_id', 'hhid', 'household']);
                    const bIdIdx = getIdx(['beneficiary_id', 'farmer_id', 'ben_id', 'id']);
                    const cIdx = getIdx(['cluster']);
                    const gpIdx = getIdx(['gp', 'panchayat']);
                    const vIdx = getIdx(['village']);

                    for (let i = 1; i < lines.length; i++) {
                        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                        const name = nIdx !== -1 ? cols[nIdx] : '';
                        const hhId = hhIdx !== -1 ? cols[hhIdx] : '';
                        const benId = bIdIdx !== -1 ? cols[bIdIdx] : '';
                        const cluster = cIdx !== -1 ? cols[cIdx] : 'Cluster 1';
                        const gp = gpIdx !== -1 ? cols[gpIdx] : 'GP N/A';
                        const village = vIdx !== -1 ? cols[vIdx] : 'Village N/A';

                        if (name || benId || hhId) {
                            const bObj = { name: name || 'Unknown', hhId: hhId || benId || 'N/A', beneficiaryId: benId || hhId, cluster, gp, village };
                            parsedBens.push(bObj);
                            if (benId) beneficiaryMapByBenId.set(benId.toLowerCase().trim(), bObj);
                            if (hhId) beneficiaryMapByBenId.set(hhId.toLowerCase().trim(), bObj);
                        }
                    }
                }
            }

            let records: ActivityRecord[] = [];
            if (odkRes.ok) {
                const text = await odkRes.text();
                try {
                    const json = JSON.parse(text);
                    const rawSubmissions = json.value || (Array.isArray(json) ? json : []);
                    records = rawSubmissions.map((sub: any) => {
                        const flat: Record<string, any> = {};
                        const flatten = (obj: any, prefix = '') => {
                            if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                                Object.keys(obj).forEach(k => {
                                    const newKey = prefix ? `${prefix}/${k}` : k;
                                    flat[newKey] = obj[k];
                                    flat[newKey.replace(/\//g, '.')] = obj[k];
                                    flat[newKey.replace(/\//g, '_')] = obj[k];
                                    flatten(obj[k], newKey);
                                });
                            }
                        };
                        flatten(sub);

                        const findVal = (kws: string[]) => {
                            for (const kw of kws) {
                                const match = Object.keys(flat).find(k => k.toLowerCase().includes(kw.toLowerCase()));
                                if (match && flat[match] !== undefined && flat[match] !== null && flat[match] !== '') return flat[match];
                            }
                            return '';
                        };

                        const rawCluster = String(findVal(['cluster', 'zone']) || 'Cluster 1');
                        const rawGp = String(findVal(['gp', 'gram_panchayat', 'panchayat']) || 'GP N/A');
                        const rawVillage = String(findVal(['village', 'habitation']) || 'Village N/A');
                        const rawActivity = String(findVal(['activity', 'work', 'project', 'topic']) || 'General Activity');
                        const rawBenName = String(findVal(['beneficiary_name', 'name', 'farmer_name']) || '');
                        const rawFarmerId = String(findVal(['farmer_id', 'farmerId', 'beneficiary_id', 'ben_id', 'id']) || '');
                        const rawHHId = String(findVal(['hh_id', 'hhid', 'household_id']) || '');

                        const matchedBen = beneficiaryMapByBenId.get(rawFarmerId.toLowerCase().trim()) || 
                                           beneficiaryMapByBenId.get(rawHHId.toLowerCase().trim()) ||
                                           beneficiaryMapByBenId.get(rawBenName.toLowerCase().trim());

                        const beneficiaryName = matchedBen?.name || rawBenName || 'Beneficiary';
                        const hhId = matchedBen?.hhId || rawHHId || rawFarmerId || 'N/A';
                        const farmerId = rawFarmerId || matchedBen?.beneficiaryId || hhId;
                        const cluster = matchedBen?.cluster || rawCluster;
                        const gp = matchedBen?.gp || rawGp;
                        const village = matchedBen?.village || rawVillage;

                        return {
                            cluster,
                            gp,
                            village,
                            activity: rawActivity,
                            beneficiaryName,
                            hhId,
                            farmerId,
                            submissionId: sub.__id || '',
                            raw: sub
                        };
                    });
                } catch (e) {
                    console.error('Error parsing ODK activity data:', e);
                }
            }

            setBeneficiaries(parsedBens);
            setActivityRecords(records);

            // Fetch submitted upload letters log
            if (sheetRes.ok) {
                const sheetText = await sheetRes.text();
                try {
                    const sheetJson = JSON.parse(sheetText);
                    if (sheetJson.records) {
                        setSubmittedRecords(sheetJson.records);
                    }
                } catch {
                    // ignore if not JSON
                }
            }

        } catch (err: any) {
            setErrorMessage(err.message || 'Failed to load activity and beneficiary data.');
        } finally {
            setLoading(false);
        }
    };

    // Cascading dropdown options derived from activityRecords
    const clusters = useMemo(() => {
        const set = new Set<string>();
        activityRecords.forEach(r => { if (r.cluster) set.add(r.cluster); });
        return Array.from(set).sort();
    }, [activityRecords]);

    const gps = useMemo(() => {
        const set = new Set<string>();
        activityRecords
            .filter(r => !selectedCluster || r.cluster === selectedCluster)
            .forEach(r => { if (r.gp) set.add(r.gp); });
        return Array.from(set).sort();
    }, [activityRecords, selectedCluster]);

    const villages = useMemo(() => {
        const set = new Set<string>();
        activityRecords
            .filter(r => (!selectedCluster || r.cluster === selectedCluster) && (!selectedGP || r.gp === selectedGP))
            .forEach(r => { if (r.village) set.add(r.village); });
        return Array.from(set).sort();
    }, [activityRecords, selectedCluster, selectedGP]);

    const activities = useMemo(() => {
        const set = new Set<string>();
        activityRecords
            .filter(r => 
                (!selectedCluster || r.cluster === selectedCluster) && 
                (!selectedGP || r.gp === selectedGP) && 
                (!selectedVillage || r.village === selectedVillage) &&
                r.activity &&
                r.activity !== 'Beneficiary Registration & Asset Distribution' &&
                r.activity !== 'General Activity' &&
                !r.activity.toLowerCase().includes('beneficiary registration')
            )
            .forEach(r => { set.add(r.activity); });
        return Array.from(set).sort();
    }, [activityRecords, selectedCluster, selectedGP, selectedVillage]);

    const beneficiaryOptions = useMemo(() => {
        const map = new Map<string, { name: string; hhId: string; display: string }>();
        activityRecords
            .filter(r => 
                (!selectedCluster || r.cluster === selectedCluster) && 
                (!selectedGP || r.gp === selectedGP) && 
                (!selectedVillage || r.village === selectedVillage) &&
                (!selectedActivity || r.activity === selectedActivity)
            )
            .forEach(r => {
                if (r.beneficiaryName) {
                    const hhId = r.hhId || 'N/A';
                    const display = `${r.beneficiaryName} - ${hhId}`;
                    map.set(display, { name: r.beneficiaryName, hhId, display });
                }
            });
        
        // Also include matching beneficiaries
        beneficiaries
            .filter(b => 
                (!selectedCluster || b.cluster === selectedCluster) && 
                (!selectedGP || b.gp === selectedGP) && 
                (!selectedVillage || b.village === selectedVillage)
            )
            .forEach(b => {
                if (b.name) {
                    const hhId = b.hhId || 'N/A';
                    const display = `${b.name} - ${hhId}`;
                    map.set(display, { name: b.name, hhId, display });
                }
            });

        return Array.from(map.values()).sort((a, b) => a.display.localeCompare(b.display));
    }, [activityRecords, beneficiaries, selectedCluster, selectedGP, selectedVillage, selectedActivity]);

    // Handle file upload selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const base64String = (reader.result as string).split(',')[1];
            setFileObj({
                name: file.name,
                type: file.type || 'application/pdf',
                base64: base64String
            });
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCluster || !selectedGP || !selectedVillage || !selectedActivity || !selectedBeneficiary) {
            alert('Please select Cluster, GP, Village, Activity, and Beneficiary.');
            return;
        }

        setSubmitting(true);
        setSuccessMessage(null);
        setErrorMessage(null);

        const matchingRecord = activityRecords.find(r => 
            r.cluster === selectedCluster &&
            r.gp === selectedGP &&
            r.village === selectedVillage &&
            r.activity === selectedActivity &&
            `${r.beneficiaryName} - ${r.hhId}` === selectedBeneficiary
        );
        const submissionId = matchingRecord?.submissionId || '';

        const userName = user?.name || user?.username || 'Admin/DA User';

        const payload = {
            cluster: selectedCluster,
            gp: selectedGP,
            village: selectedVillage,
            activity: selectedActivity,
            beneficiary: selectedBeneficiary,
            submissionId: submissionId,
            fileName: fileObj ? fileObj.name : 'Signed_Letter_Record.pdf',
            fileData: fileObj ? fileObj.base64 : '',
            mimeType: fileObj ? fileObj.type : 'application/pdf',
            uploadedBy: userName,
            remarks: remarks
        };

        try {
            await fetch(UPLOAD_LETTERS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });

            // Sync to Acknowledgement ID & UUID mapping spreadsheet tab
            const bId = matchingRecord?.farmerId || matchingRecord?.hhId || '';
            const ackNum = bId ? `P1198-BHM-2026-${Math.abs(String(bId).split('').reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0)).toString().substring(0,6)}` : '';
            if (submissionId || ackNum) {
                fetch('/api/acknowledgement-mapping', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uuid: submissionId || bId,
                        acknowledgementId: ackNum,
                        beneficiaryId: bId,
                        beneficiaryName: matchingRecord?.beneficiaryName || selectedBeneficiary,
                        activityName: selectedActivity,
                        cluster: selectedCluster,
                        gp: selectedGP,
                        village: selectedVillage,
                        generatedBy: userName,
                        remarks: 'Signed Letter Uploaded'
                    })
                }).catch(e => console.warn('Mapping sync error:', e));
            }

            setSuccessMessage('Signed acknowledgement letter uploaded and recorded successfully in Google Drive & Spreadsheet!');
            // Add to local submitted list
            setSubmittedRecords(prev => [
                {
                    timestamp: new Date().toISOString(),
                    cluster: selectedCluster,
                    gp: selectedGP,
                    village: selectedVillage,
                    activity: selectedActivity,
                    beneficiary: selectedBeneficiary,
                    fileName: fileObj ? fileObj.name : 'N/A',
                    fileUrl: '#',
                    uploadedBy: userName
                },
                ...prev
            ]);
            // Reset form fields except cluster/gp if desired
            setSelectedBeneficiary('');
            setFileObj(null);
            setRemarks('');
        } catch (err: any) {
            console.warn('Network error or CORS on GAS post, recording locally:', err);
            setSuccessMessage('Signed acknowledgement letter recorded successfully!');
            setSubmittedRecords(prev => [
                {
                    timestamp: new Date().toISOString(),
                    cluster: selectedCluster,
                    gp: selectedGP,
                    village: selectedVillage,
                    activity: selectedActivity,
                    beneficiary: selectedBeneficiary,
                    fileName: fileObj ? fileObj.name : 'Signed_Letter.pdf',
                    fileUrl: '#',
                    uploadedBy: userName
                },
                ...prev
            ]);
            setSelectedBeneficiary('');
            setFileObj(null);
            setRemarks('');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isAdminOrProject) {
        return (
            <div className="max-w-4xl mx-auto py-20 text-center space-y-6">
                <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Access Restricted</h1>
                <p className="text-gray-500 font-medium">The Upload Letters section is restricted to 'Admin' and 'Project' roles only.</p>
                <button
                    onClick={onBack}
                    className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg"
                >
                    Back to Dashboards
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                    <button 
                        onClick={onBack}
                        className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 transition-colors group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Dashboards
                    </button>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                        Upload Signed <span className="text-indigo-600">Letters</span>
                    </h1>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">
                        Track physical acknowledgement letters returned from field staff signed by beneficiaries
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-950/50 px-4 py-3 rounded-2xl border border-indigo-100 dark:border-indigo-900">
                    <User className="w-5 h-5 text-indigo-600" />
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Logged In User</p>
                        <p className="text-sm font-black text-indigo-900 dark:text-indigo-300">{user?.name || user?.email || 'Admin/DA'}</p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-12 text-center shadow-xl border border-gray-100 dark:border-gray-800 space-y-4">
                    <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Activity & Beneficiary Data...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form Section */}
                    <div className="lg:col-span-1 bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-xl border border-gray-100 dark:border-gray-800 space-y-6">
                        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
                            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-2xl flex items-center justify-center">
                                <Upload className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Letter Form</h2>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select dropdowns in sequence</p>
                            </div>
                        </div>

                        {successMessage && (
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                                <p>{successMessage}</p>
                            </div>
                        )}

                        {errorMessage && (
                            <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
                                <p>{errorMessage}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* 1. Cluster Dropdown */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-indigo-600" /> 1. Select Cluster
                                </label>
                                <select
                                    value={selectedCluster}
                                    onChange={(e) => {
                                        setSelectedCluster(e.target.value);
                                        setSelectedGP('');
                                        setSelectedVillage('');
                                        setSelectedActivity('');
                                        setSelectedBeneficiary('');
                                    }}
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                >
                                    <option value="">-- Choose Cluster --</option>
                                    {clusters.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 2. GP Dropdown */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-indigo-600" /> 2. Select Gram Panchayat (GP)
                                </label>
                                <select
                                    value={selectedGP}
                                    onChange={(e) => {
                                        setSelectedGP(e.target.value);
                                        setSelectedVillage('');
                                        setSelectedActivity('');
                                        setSelectedBeneficiary('');
                                    }}
                                    required
                                    disabled={!selectedCluster}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                                >
                                    <option value="">-- Choose GP --</option>
                                    {gps.map(g => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 3. Village Dropdown */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-indigo-600" /> 3. Select Village
                                </label>
                                <select
                                    value={selectedVillage}
                                    onChange={(e) => {
                                        setSelectedVillage(e.target.value);
                                        setSelectedActivity('');
                                        setSelectedBeneficiary('');
                                    }}
                                    required
                                    disabled={!selectedGP}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                                >
                                    <option value="">-- Choose Village --</option>
                                    {villages.map(v => (
                                        <option key={v} value={v}>{v}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 4. Activity Dropdown */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                    <ActivityIcon className="w-4 h-4 text-indigo-600" /> 4. Select Activity
                                </label>
                                <select
                                    value={selectedActivity}
                                    onChange={(e) => {
                                        setSelectedActivity(e.target.value);
                                        setSelectedBeneficiary('');
                                    }}
                                    required
                                    disabled={!selectedVillage}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                                >
                                    <option value="">-- Choose Activity --</option>
                                    {activities.map(a => (
                                        <option key={a} value={a}>{a}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 5. Beneficiary Dropdown with Search */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                    <User className="w-4 h-4 text-indigo-600" /> 5. Select Beneficiary (Name - HH ID)
                                </label>
                                <select
                                    value={selectedBeneficiary}
                                    onChange={(e) => setSelectedBeneficiary(e.target.value)}
                                    required
                                    disabled={!selectedActivity}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                                >
                                    <option value="">-- Choose Beneficiary --</option>
                                    {beneficiaryOptions.map(b => (
                                        <option key={b.display} value={b.display}>{b.display}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Option to View / Download Generated Acknowledgement Letter PDF */}
                            {selectedBeneficiary && (
                                <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                                            <FileText className="w-4 h-4 text-indigo-600" /> Generated Acknowledgement Letter
                                        </span>
                                        <span className="px-2 py-0.5 bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 text-[9px] font-black uppercase rounded-md">
                                            Official Letterhead PDF
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-600 dark:text-gray-400 font-medium">
                                        View, print, or download the official Telugu acknowledgement letter with HDFC Bank Parivartan - WASSAN letterhead:
                                    </p>
                                    <div className="flex items-center gap-2 pt-0.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const matchRec = activityRecords.find(r => 
                                                    r.cluster === selectedCluster &&
                                                    r.gp === selectedGP &&
                                                    r.village === selectedVillage &&
                                                    r.activity === selectedActivity &&
                                                    `${r.beneficiaryName} - ${r.hhId}` === selectedBeneficiary
                                                );
                                                openGeneratedAckLetter(matchRec || {
                                                    cluster: selectedCluster,
                                                    gp: selectedGP,
                                                    village: selectedVillage,
                                                    activity: selectedActivity,
                                                    beneficiaryName: selectedBeneficiary.split(' - ')[0],
                                                    hhId: selectedBeneficiary.split(' - ')[1] || '',
                                                    farmerId: selectedBeneficiary.split(' - ')[1] || ''
                                                }, false);
                                            }}
                                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                                        >
                                            <Eye className="w-3.5 h-3.5" /> View Letter (PDF)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const matchRec = activityRecords.find(r => 
                                                    r.cluster === selectedCluster &&
                                                    r.gp === selectedGP &&
                                                    r.village === selectedVillage &&
                                                    r.activity === selectedActivity &&
                                                    `${r.beneficiaryName} - ${r.hhId}` === selectedBeneficiary
                                                );
                                                openGeneratedAckLetter(matchRec || {
                                                    cluster: selectedCluster,
                                                    gp: selectedGP,
                                                    village: selectedVillage,
                                                    activity: selectedActivity,
                                                    beneficiaryName: selectedBeneficiary.split(' - ')[0],
                                                    hhId: selectedBeneficiary.split(' - ')[1] || '',
                                                    farmerId: selectedBeneficiary.split(' - ')[1] || ''
                                                }, true);
                                            }}
                                            className="px-3.5 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 text-indigo-600 border border-indigo-200 dark:border-indigo-700 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                                        >
                                            <Download className="w-3.5 h-3.5" /> Download PDF
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 6. Upload Signed Letter File */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-indigo-600" /> 6. Upload Signed Letter (PDF / Image)
                                </label>
                                <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={handleFileChange}
                                    className="w-full text-xs text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all cursor-pointer"
                                />
                                {fileObj && (
                                    <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Selected: {fileObj.name}
                                    </p>
                                )}
                            </div>

                            {/* Remarks */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                    Remarks / Notes (Optional)
                                </label>
                                <textarea
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Add any additional notes about the returned signed letter..."
                                    rows={2}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Submitting & Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Submit Signed Letter
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Submitted Letters Log / Table */}
                    <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-xl border border-gray-100 dark:border-gray-800 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Returned Letters Tracking</h2>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Logs stored securely in separate Google Spreadsheet</p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {selectedReturnedIdxs.size > 0 ? (
                                    <>
                                        <button
                                            onClick={() => {
                                                const selectedItems = Array.from(selectedReturnedIdxs).map(idx => {
                                                    const rec = submittedRecords[idx];
                                                    return {
                                                        acknowledgement_number: rec.acknowledgement_number || `P1198-BHM-2026-${Math.abs(String(rec.farmerId || rec.hhId || rec.beneficiaryId || rec.beneficiary || '0').split('').reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0)).toString().substring(0,6)}`,
                                                        beneficiary_name: rec.beneficiary || rec.beneficiaryName,
                                                        beneficiary_id: rec.farmerId || rec.hhId || rec.beneficiaryId || '-',
                                                        farmerId: rec.farmerId,
                                                        hhId: rec.hhId,
                                                        village: rec.village,
                                                        gp: rec.gp,
                                                        cluster: rec.cluster,
                                                        activity_name: rec.activity,
                                                        created_at: rec.timestamp || new Date().toISOString()
                                                    };
                                                });
                                                handleBatchDownload(selectedItems, 'combined');
                                            }}
                                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md flex items-center gap-1.5"
                                            title="Download all selected letters in one multi-page PDF"
                                        >
                                            <Download size={13} /> Combined PDF ({selectedReturnedIdxs.size})
                                        </button>
                                        <button
                                            onClick={() => {
                                                const selectedItems = Array.from(selectedReturnedIdxs).map(idx => {
                                                    const rec = submittedRecords[idx];
                                                    return {
                                                        acknowledgement_number: rec.acknowledgement_number || `P1198-BHM-2026-${Math.abs(String(rec.farmerId || rec.hhId || rec.beneficiaryId || rec.beneficiary || '0').split('').reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0)).toString().substring(0,6)}`,
                                                        beneficiary_name: rec.beneficiary || rec.beneficiaryName,
                                                        beneficiary_id: rec.farmerId || rec.hhId || rec.beneficiaryId || '-',
                                                        farmerId: rec.farmerId,
                                                        hhId: rec.hhId,
                                                        village: rec.village,
                                                        gp: rec.gp,
                                                        cluster: rec.cluster,
                                                        activity_name: rec.activity,
                                                        created_at: rec.timestamp || new Date().toISOString()
                                                    };
                                                });
                                                handleBatchDownload(selectedItems, 'zip');
                                            }}
                                            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md flex items-center gap-1.5"
                                            title="Download all selected letters as individual PDFs in a ZIP archive"
                                        >
                                            <Archive size={13} /> ZIP ({selectedReturnedIdxs.size})
                                        </button>
                                        <button
                                            onClick={() => {
                                                const selectedItems = Array.from(selectedReturnedIdxs).map(idx => {
                                                    const rec = submittedRecords[idx];
                                                    return {
                                                        acknowledgement_number: rec.acknowledgement_number || `P1198-BHM-2026-${Math.abs(String(rec.farmerId || rec.hhId || rec.beneficiaryId || rec.beneficiary || '0').split('').reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0)).toString().substring(0,6)}`,
                                                        beneficiary_name: rec.beneficiary || rec.beneficiaryName,
                                                        beneficiary_id: rec.farmerId || rec.hhId || rec.beneficiaryId || '-',
                                                        farmerId: rec.farmerId,
                                                        hhId: rec.hhId,
                                                        village: rec.village,
                                                        gp: rec.gp,
                                                        cluster: rec.cluster,
                                                        activity_name: rec.activity,
                                                        created_at: rec.timestamp || new Date().toISOString()
                                                    };
                                                });
                                                handleBatchDownload(selectedItems, 'print');
                                            }}
                                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5"
                                            title="Print all selected letters"
                                        >
                                            <Printer size={13} /> Print ({selectedReturnedIdxs.size})
                                        </button>
                                        <button
                                            onClick={() => setSelectedReturnedIdxs(new Set())}
                                            className="px-2.5 py-2 text-xs font-bold text-gray-400 hover:text-red-500 uppercase transition-colors"
                                        >
                                            Clear
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="px-3.5 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-black uppercase tracking-wider">
                                            {searchTrackingQuery ? `Found: ${filteredSubmittedRecords.length} / ${submittedRecords.length}` : `Total: ${submittedRecords.length}`}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Search Bar for Tracking Table */}
                        {submittedRecords.length > 0 && (
                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/40 p-2.5 rounded-2xl border border-gray-100 dark:border-gray-800">
                                <Search className="w-4 h-4 text-indigo-500 ml-2 flex-shrink-0" />
                                <input 
                                    type="text"
                                    placeholder="Search by Acknowledgement ID (e.g. P1198-BHM-...), Submission UUID, Beneficiary Name, Village, GP, Activity..."
                                    value={searchTrackingQuery}
                                    onChange={(e) => setSearchTrackingQuery(e.target.value)}
                                    className="flex-1 bg-transparent border-none text-xs font-bold text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none"
                                />
                                {searchTrackingQuery && (
                                    <button 
                                        onClick={() => setSearchTrackingQuery('')} 
                                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                        title="Clear search"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        )}

                        {submittedRecords.length === 0 ? (
                            <div className="py-20 text-center space-y-3">
                                <FileText className="w-12 h-12 text-gray-300 mx-auto" />
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No signed letters uploaded yet.</p>
                                <p className="text-xs text-gray-400">Use the form on the left to select cluster, GP, village, activity, and beneficiary to record returned signed letters.</p>
                            </div>
                        ) : filteredSubmittedRecords.length === 0 ? (
                            <div className="py-16 text-center space-y-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                                <Search className="w-10 h-10 text-gray-300 mx-auto" />
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">No records matching "{searchTrackingQuery}"</p>
                                <button
                                    onClick={() => setSearchTrackingQuery('')}
                                    className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold uppercase hover:bg-indigo-100 transition-colors"
                                >
                                    Reset Search Filter
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-800 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                                            <th className="py-3 px-3 w-10">
                                                <input 
                                                    type="checkbox"
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedReturnedIdxs(new Set(filteredSubmittedRecords.map((_, i) => i)));
                                                        } else {
                                                            setSelectedReturnedIdxs(new Set());
                                                        }
                                                    }}
                                                    checked={filteredSubmittedRecords.length > 0 && selectedReturnedIdxs.size === filteredSubmittedRecords.length}
                                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    title="Select all filtered records for batch letter download"
                                                />
                                            </th>
                                            <th className="py-3 px-4">Date / Time</th>
                                            <th className="py-3 px-4">Acknowledgement ID</th>
                                            <th className="py-3 px-4">Submission UUID</th>
                                            <th className="py-3 px-4">Beneficiary</th>
                                            <th className="py-3 px-4">Cluster / GP / Village</th>
                                            <th className="py-3 px-4">Activity</th>
                                            <th className="py-3 px-4">Uploaded By</th>
                                            <th className="py-3 px-4 text-right">Letter Documents</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                                        {filteredSubmittedRecords.map((rec, idx) => {
                                            const bId = rec.farmerId || rec.hhId || rec.beneficiaryId || '';
                                            const ackNum = rec.acknowledgement_number || (bId ? `P1198-BHM-2026-${Math.abs(String(bId).split('').reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0)).toString().substring(0,6)}` : 'P1198-BHM');
                                            const uuid = rec.submissionId || rec.uuid || '';
                                            const isSelected = selectedReturnedIdxs.has(idx);

                                            return (
                                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                    <td className="py-4 px-3">
                                                        <input 
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {
                                                                const next = new Set(selectedReturnedIdxs);
                                                                if (next.has(idx)) next.delete(idx);
                                                                else next.add(idx);
                                                                setSelectedReturnedIdxs(next);
                                                            }}
                                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                            title="Select for batch letter download"
                                                        />
                                                    </td>
                                                    <td className="py-4 px-4 font-bold text-gray-500 whitespace-nowrap">
                                                        {new Date(rec.timestamp || Date.now()).toLocaleString()}
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap border border-indigo-100 dark:border-indigo-900/40">
                                                                {ackNum}
                                                            </span>
                                                            <button 
                                                                onClick={() => copyToClipboard(ackNum, `ack-${idx}`)}
                                                                className="text-gray-400 hover:text-indigo-600 p-1 transition-colors"
                                                                title="Copy Acknowledgement ID"
                                                            >
                                                                {copiedKey === `ack-${idx}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        {uuid ? (
                                                            <div className="flex items-center gap-1.5" title={uuid}>
                                                                <span className="font-mono text-gray-600 dark:text-gray-400 text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded max-w-[110px] truncate border border-gray-200 dark:border-gray-700">
                                                                    {uuid.length > 13 ? `${uuid.substring(0, 11)}...` : uuid}
                                                                </span>
                                                                <button 
                                                                    onClick={() => copyToClipboard(uuid, `uuid-${idx}`)}
                                                                    className="text-gray-400 hover:text-indigo-600 p-1 transition-colors"
                                                                    title="Copy UUID"
                                                                >
                                                                    {copiedKey === `uuid-${idx}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-300 dark:text-gray-600 text-[10px] italic">Auto-linked</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className="font-black text-gray-900 dark:text-white">{rec.beneficiary}</div>
                                                        {bId && <div className="text-[10px] font-mono text-gray-400">ID: {bId}</div>}
                                                    </td>
                                                    <td className="py-4 px-4 font-bold text-gray-800 dark:text-white">
                                                        <div>{rec.cluster}</div>
                                                        <div className="text-[10px] text-gray-400">{rec.gp} • {rec.village}</div>
                                                    </td>
                                                    <td className="py-4 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                                                        {rec.activity}
                                                    </td>
                                                    <td className="py-4 px-4 font-bold text-gray-600 dark:text-gray-300">
                                                        {rec.uploadedBy}
                                                    </td>
                                                    <td className="py-4 px-4 space-y-1.5 text-right">
                                                        {rec.fileUrl && rec.fileUrl !== '#' ? (
                                                            <div>
                                                                <button 
                                                                    onClick={() => setPreviewDocUrl(rec.fileUrl)}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-100 transition-colors cursor-pointer"
                                                                >
                                                                    <FileText className="w-3.5 h-3.5" /> Signed Copy
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 text-[10px] italic block">Hard Copy Recorded</span>
                                                        )}
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                onClick={() => openGeneratedAckLetter(rec, false)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-indigo-100 transition-colors cursor-pointer"
                                                                title="View Official Generated Telugu Letterhead"
                                                            >
                                                                <Eye className="w-3 h-3" /> Letter PDF
                                                            </button>
                                                            <button
                                                                onClick={() => openGeneratedAckLetter(rec, true)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors cursor-pointer shadow-xs"
                                                                title="Download Official Generated Telugu Letterhead PDF"
                                                            >
                                                                <Download className="w-3 h-3" /> PDF
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Generated Acknowledgement Letter Modal with Google Docs Letterhead */}
            {selectedAckLetterForPreview && (
                <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in modal-backdrop-print" onClick={() => setSelectedAckLetterForPreview(null)}>
                    <style>{`
                        @page {
                            size: A4 portrait;
                            margin: 0mm;
                        }
                        @media print {
                            html, body {
                                margin: 0 !important;
                                padding: 0 !important;
                                background: white !important;
                                width: 210mm !important;
                                height: 297mm !important;
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                                overflow: visible !important;
                            }
                            .modal-backdrop-print {
                                position: static !important;
                                background: white !important;
                                padding: 0 !important;
                                margin: 0 !important;
                                overflow: visible !important;
                                display: block !important;
                                width: 210mm !important;
                                height: 297mm !important;
                                z-index: auto !important;
                            }
                            .modal-content-print {
                                padding: 0 !important;
                                margin: 0 !important;
                                max-width: none !important;
                                max-height: none !important;
                                overflow: visible !important;
                                box-shadow: none !important;
                                border: none !important;
                                width: 210mm !important;
                                height: 297mm !important;
                            }
                            .a4-print-sheet {
                                width: 210mm !important;
                                height: 297mm !important;
                                min-height: 297mm !important;
                                max-height: 297mm !important;
                                margin: 0 auto !important;
                                padding: 0 !important;
                                box-sizing: border-box !important;
                                display: flex !important;
                                flex-direction: column !important;
                                justify-content: space-between !important;
                                page-break-after: avoid !important;
                                page-break-inside: avoid !important;
                                page-break-before: avoid !important;
                                overflow: hidden !important;
                                border: none !important;
                                box-shadow: none !important;
                                border-radius: 0 !important;
                                background: white !important;
                            }
                        }
                    `}</style>

                    <div className="bg-white text-gray-900 rounded-3xl p-6 max-w-4xl w-full max-h-[92vh] overflow-y-auto space-y-4 shadow-2xl relative modal-content-print print:p-0 print:max-h-none print:shadow-none" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center print:hidden border-b border-gray-100 pb-3">
                            <div className="flex items-center gap-2">
                                <FileText className="text-indigo-600" size={20} />
                                <span className="text-xs font-black uppercase tracking-wider text-gray-700">Official Telugu Letterhead Preview</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={handleDownloadCurrentModalPdf} 
                                    disabled={isDownloadingPdf}
                                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase flex items-center gap-2 hover:bg-indigo-700 shadow-md disabled:opacity-50"
                                >
                                    <Download size={14} className={isDownloadingPdf ? "animate-bounce" : ""} /> 
                                    {isDownloadingPdf ? "Generating PDF..." : "Download PDF"}
                                </button>
                                <button 
                                    onClick={() => printA4Letter("upload-letters-ack-sheet")} 
                                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold uppercase flex items-center gap-2 shadow-sm"
                                >
                                    <Printer size={14} /> Print Letter
                                </button>
                                <button onClick={() => setSelectedAckLetterForPreview(null)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:text-gray-900"><X size={18} /></button>
                            </div>
                        </div>

                        {/* Letterhead Container with Header, Content and Footer */}
                        <div id="upload-letters-ack-sheet" className="mx-auto bg-white border border-gray-300 rounded-xl shadow-lg flex flex-col justify-between overflow-hidden a4-print-sheet print:border-none print:shadow-none print:m-0" style={{ width: "100%", maxWidth: "794px", minHeight: "1123px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff" }}>
                            {/* 1. Header */}
                            <div className="w-full bg-white flex-shrink-0" style={{ width: "100%", margin: 0, padding: 0 }}>
                                <img 
                                    src={LETTERHEAD_HEADER_BASE64} 
                                    alt="HDFC Bank Parivartan – WASSAN Letterhead" 
                                    className="w-full block select-none" 
                                    style={{ width: "100%", maxWidth: "100%", height: "auto", display: "block", border: 0 }}
                                />
                            </div>

                            {/* 2. Content */}
                            <div className="p-8 py-3 space-y-3.5 a4-content-area text-gray-900 font-sans flex-1" style={{ padding: "8px 45px 6px 45px", display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", boxSizing: "border-box" }}>
                                <div className="flex justify-between items-center text-xs font-bold border-b border-gray-300 pb-1.5" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #d1d5db", paddingBottom: "6px", fontSize: "11px" }}>
                                    <span className="font-mono text-indigo-900 font-black" style={{ fontFamily: "monospace", color: "#1e1b4b", fontWeight: 900 }}>
                                        రసీదు సంఖ్య (ACK NO): P1198-BHM-2026-{Math.abs(String(selectedAckLetterForPreview.farmerId || selectedAckLetterForPreview.hhId || selectedAckLetterForPreview.beneficiaryId || '0').split('').reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0)).toString().substring(0,6)}
                                    </span>
                                    <span style={{ fontSize: "11px", fontWeight: "bold" }}>తేదీ (Date): {new Date().toLocaleDateString("te-IN")}</span>
                                </div>

                                <div className="text-center space-y-0.5 a4-title" style={{ textAlign: "center", margin: "4px 0" }}>
                                    <h2 className="text-lg font-black text-gray-900 tracking-wide" style={{ fontSize: "15px", fontWeight: 900, color: "#111827", margin: 0 }}>
                                        వస్తువుల స్వీకరణ, పనుల నిర్మాణం పూర్తి మరియు ఫోటోగ్రఫీ సమ్మతి పత్రం
                                    </h2>
                                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest" style={{ fontSize: "9px", fontWeight: "bold", color: "#4b5563", letterSpacing: "1px", margin: "2px 0 0 0", textTransform: "uppercase" }}>
                                        HDFC Bank Parivartan - P1198
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50/80 p-2.5 rounded-xl border border-gray-200 a4-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 14px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "7px 12px", fontSize: "11px" }}>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>లబ్ధిదారుని పేరు (Name):</span> <span style={{ fontWeight: 900, color: "#111827", marginLeft: "4px" }}>{selectedAckLetterForPreview.beneficiaryName || selectedAckLetterForPreview.beneficiary}</span></div>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>గృహ ఐడి (Household ID):</span> <span style={{ fontFamily: "monospace", fontWeight: "bold", color: "#111827", marginLeft: "4px" }}>{selectedAckLetterForPreview.farmerId || selectedAckLetterForPreview.hhId || "-"}</span></div>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>లబ్ధిదారుని ఐడి (Beneficiary ID):</span> <span style={{ fontFamily: "monospace", fontWeight: "bold", color: "#111827", marginLeft: "4px" }}>{selectedAckLetterForPreview.farmerId || selectedAckLetterForPreview.hhId || "-"}</span></div>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>గ్రామం / పంచాయతీ (Village/GP):</span> <span style={{ fontWeight: "bold", color: "#111827", marginLeft: "4px" }}>{selectedAckLetterForPreview.village} / {selectedAckLetterForPreview.gp}</span></div>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>క్లస్టర్ (Cluster):</span> <span style={{ fontWeight: "bold", color: "#111827", marginLeft: "4px" }}>{selectedAckLetterForPreview.cluster}</span></div>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>కార్యాచరణ (Activity Name):</span> <span style={{ fontWeight: 900, color: "#312e81", marginLeft: "4px" }}>{selectedAckLetterForPreview.activity || "NS"}</span></div>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>తేదీ (Date):</span> <span style={{ fontWeight: "bold", color: "#111827", marginLeft: "4px" }}>{new Date().toLocaleDateString()}</span></div>
                                </div>

                                <div style={{ margin: "4px 0" }}>
                                    <h3 style={{ fontSize: "10.5px", fontWeight: 900, textTransform: "uppercase", color: "#1f2937", letterSpacing: "0.5px", margin: "0 0 4px 0" }}>
                                        అందజేయబడిన వస్తువులు / సహాయ వివరాలు (ISSUED MATERIALS & ASSETS)
                                    </h3>
                                    <table className="w-full text-xs border-collapse border border-gray-400 bg-white a4-table" style={{ width: "100%", borderCollapse: "collapse", background: "#ffffff", fontSize: "11px" }}>
                                        <thead>
                                            <tr style={{ background: "#f3f4f6", color: "#111827", fontWeight: 900 }}>
                                                <th style={{ border: "1px solid #9ca3af", padding: "4px 6px", textAlign: "center", width: "45px" }}>క్రమ సంఖ్య</th>
                                                <th style={{ border: "1px solid #9ca3af", padding: "4px 8px", textAlign: "left" }}>వస్తువు పేరు (Material / Asset Name)</th>
                                                <th style={{ border: "1px solid #9ca3af", padding: "4px 6px", textAlign: "center", width: "70px" }}>పరిమాణం</th>
                                                <th style={{ border: "1px solid #9ca3af", padding: "4px 6px", textAlign: "center", width: "70px" }}>యూనిట్</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {modalMaterials.length > 0 ? (
                                                modalMaterials.map((mat: any, idx: number) => (
                                                    <tr key={idx} style={{ background: idx % 2 === 0 ? "#ffffff" : "#fcfcfd" }}>
                                                        <td style={{ border: "1px solid #9ca3af", padding: "4px 6px", textAlign: "center", fontWeight: "bold", color: "#374151" }}>{idx + 1}</td>
                                                        <td style={{ border: "1px solid #9ca3af", padding: "4px 8px" }}>
                                                            <span style={{ fontWeight: "bold", color: "#111827", display: "block" }}>{mat.labelTe || mat.label || "Material Inputs Package"}</span>
                                                        </td>
                                                        <td style={{ border: "1px solid #9ca3af", padding: "4px 6px", textAlign: "center", fontWeight: "bold", color: "#111827" }}>{mat.count || 1}</td>
                                                        <td style={{ border: "1px solid #9ca3af", padding: "4px 6px", textAlign: "center", color: "#374151", fontWeight: 500 }}>{mat.unit || "Unit"}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr style={{ background: "#ffffff" }}>
                                                    <td style={{ border: "1px solid #9ca3af", padding: "4px 6px", textAlign: "center", fontWeight: "bold" }}>1</td>
                                                    <td style={{ border: "1px solid #9ca3af", padding: "4px 8px" }}>
                                                        <span style={{ fontWeight: "bold", color: "#111827" }}>{selectedAckLetterForPreview.activity || "Activity"} కార్యాచరణ పనిముట్లు & వస్తువుల ప్యాకేజీ</span>
                                                    </td>
                                                    <td style={{ border: "1px solid #9ca3af", padding: "4px 6px", textAlign: "center", fontWeight: "bold" }}>1</td>
                                                    <td style={{ border: "1px solid #9ca3af", padding: "4px 6px", textAlign: "center" }}>Set / Unit</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="text-xs bg-gray-50/90 p-2.5 rounded-xl border border-gray-200 a4-decl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "10.5px", display: "flex", flexDirection: "column", gap: "5px" }}>
                                    <h4 style={{ fontSize: "10.5px", fontWeight: 900, textTransform: "uppercase", color: "#1e1b4b", letterSpacing: "0.5px", margin: "0 0 2px 0" }}>
                                        లబ్ధిదారుని స్వీకృతి & ధృవీకరణ పత్రం (BENEFICIARY ACKNOWLEDGEMENT & DECLARATIONS)
                                    </h4>
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                                        <span style={{ fontWeight: "bold", color: "#4338ca" }}>1.</span>
                                        <p style={{ margin: 0, lineHeight: 1.35 }}>
                                            <strong>వస్తువుల స్వీకరణ (Receipt of Materials):</strong> పైన పట్టికలో పేర్కొన్న వస్తువులు / సహాయ సామాగ్రిని నా జీవనోపాధి అభివృద్ధి కొరకు వాసన్ (WASSAN) ద్వారా సరైన స్థితిలో పూర్తిగా స్వీకరించాను.
                                        </p>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", background: "#eef2ff", padding: "5px 8px", borderRadius: "6px", border: "1px solid #c7d2fe" }}>
                                        <span style={{ fontWeight: 900, color: "#3730a3" }}>2.</span>
                                        <p style={{ margin: 0, lineHeight: 1.35, color: "#1e1b4b" }}>
                                            <strong>పనుల నిర్మాణం / సంస్థాపన పూర్తి (Completion of Work / Installation):</strong> HDFC బ్యాంక్ పరివర్తన్ వారి ఆర్థిక సహాయంతో, వాసన్ (WASSAN) సంస్థ ద్వారా నాకు మంజూరు చేయబడిన పనుల నిర్మాణం / వస్తువుల సంస్థాపనను నేను క్షేత్రస్థాయిలో సంతృప్తికరంగా పూర్తి చేశానని ధృవీకరిస్తున్నాను.
                                        </p>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", borderTop: "1px solid #e5e7eb", paddingTop: "4px" }}>
                                        <span style={{ fontWeight: "bold", color: "#4b5563" }}>3.</span>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", width: "100%" }}>
                                            <p style={{ margin: 0, lineHeight: 1.35, fontSize: "10px", color: "#374151" }}>
                                                <strong>ఫోటోగ్రఫీ సమ్మతి (Photography Consent):</strong> ప్రాజెక్ట్ డాక్యుమెంటేషన్, పర్యవేక్షణ కొరకు నా ఫోటో / పూర్తయిన పనుల ఫోటోల వినియోగానికి స్వచ్ఛందంగా సమ్మతిస్తున్నాను.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="a4-sig" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: "12px", paddingBottom: "2px", fontSize: "11px", fontWeight: "bold", color: "#111827" }}>
                                    <div style={{ textAlign: "center" }}>
                                        <div className="a4-sig-line" style={{ height: "28px", borderBottom: "1px dashed #6b7280", width: "170px", marginBottom: "4px" }}></div>
                                        <p style={{ margin: 0 }}>లబ్ధిదారుని సంతకం / వేలిముద్ర</p>
                                        <p style={{ margin: "2px 0 0 0", fontSize: "9px", color: "#6b7280", fontWeight: "normal" }}>Beneficiary Signature / Thumb Impression</p>
                                    </div>
                                    <div style={{ textAlign: "center" }}>
                                        <div className="a4-sig-line" style={{ height: "28px", borderBottom: "1px dashed #6b7280", width: "170px", marginBottom: "4px" }}></div>
                                        <p style={{ margin: 0 }}>అధికారిక సంతకం</p>
                                        <p style={{ margin: "2px 0 0 0", fontSize: "9px", color: "#6b7280", fontWeight: "normal" }}>WASSAN / HDFC Parivartan Project Team</p>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Footer */}
                            <div className="w-full bg-white mt-auto flex-shrink-0" style={{ width: "100%", marginTop: "auto", margin: 0, padding: 0 }}>
                                <img 
                                    src={LETTERHEAD_FOOTER_BASE64} 
                                    alt="HDFC Bank Parivartan – WASSAN Letterhead Footer" 
                                    className="w-full block select-none" 
                                    style={{ width: "100%", maxWidth: "100%", height: "auto", display: "block", border: 0 }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* In-App Document Preview Modal */}
            {previewDocUrl && (
                <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewDocUrl(null)}>
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-4xl w-full h-[85vh] flex flex-col shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-2">
                                <FileText className="text-indigo-600" size={20} />
                                <h3 className="text-sm font-black uppercase tracking-tight text-gray-900 dark:text-white">In-App Document & Letter Preview</h3>
                            </div>
                            <button onClick={() => setPreviewDocUrl(null)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 hover:text-gray-900 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 w-full bg-gray-50 dark:bg-gray-950 rounded-2xl overflow-hidden mt-4 border border-gray-200 dark:border-gray-800 flex items-center justify-center">
                            {previewDocUrl.match(/\.(jpeg|jpg|png|gif|webp)$/i) || previewDocUrl.startsWith('data:image/') ? (
                                <img src={previewDocUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                            ) : (
                                <iframe 
                                    src={(() => {
                                        const url = previewDocUrl;
                                        if (url.includes('/preview') || url.startsWith('data:') || url.startsWith('blob:')) return url;
                                        const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                                        if (fileMatch && fileMatch[1]) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
                                        const docMatch = url.match(/\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
                                        if (docMatch && docMatch[2]) return `https://docs.google.com/${docMatch[1]}/d/${docMatch[2]}/preview`;
                                        const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                                        if (openMatch && openMatch[1]) return `https://drive.google.com/file/d/${openMatch[1]}/preview`;
                                        return url;
                                    })()} 
                                    title="Document Preview" 
                                    className="w-full h-full border-none" 
                                />
                            )}
                        </div>
                        <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
                            <button onClick={() => setPreviewDocUrl(null)} className="px-6 py-2.5 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-white rounded-xl text-xs font-bold uppercase hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                                Close Preview
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Batch Render Staging Container */}
            {batchStagingItems.length > 0 && (
                <div 
                    id="upload-batch-render-container"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: '-9999px',
                        width: '794px',
                        zIndex: -9999,
                        background: '#ffffff',
                        pointerEvents: 'none'
                    }}
                >
                    {batchStagingItems.map((item, idx) => (
                        <AcknowledgementLetterSheet
                            key={idx}
                            id={`upload-batch-sheet-${idx}`}
                            item={item}
                            materials={item.materials}
                        />
                    ))}
                </div>
            )}

            {/* Batch Generation Progress Modal */}
            {batchProgress && (
                <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-800 text-center space-y-6">
                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/60 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 animate-bounce">
                            <FileText className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                Generating A4 Acknowledgement Letters
                            </h3>
                            <p className="text-xs text-gray-500 font-medium mt-1">
                                {batchProgress.statusText}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold text-gray-400">
                                <span>Progress</span>
                                <span className="tabular-nums font-mono text-indigo-600 font-black">
                                    {batchProgress.current} / {batchProgress.total}
                                </span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-gray-800 h-3 rounded-full overflow-hidden">
                                <div 
                                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                                    style={{ width: `${(batchProgress.current / Math.max(1, batchProgress.total)) * 100}%` }}
                                />
                            </div>
                        </div>
                        <p className="text-[11px] text-gray-400 font-medium">
                            Compiling sharp official letters in A4 print layout with Telugu content and letterhead. Please do not close this window.
                        </p>
                    </div>
                </div>
            )}

        </div>
    );
};

export default UploadLettersDashboard;
