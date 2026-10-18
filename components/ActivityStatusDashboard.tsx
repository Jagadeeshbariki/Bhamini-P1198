import React, { useState, useEffect, useMemo } from 'react';
import { 
    Activity, Calendar, Users, CheckCircle2, AlertCircle, 
    Search, RefreshCw, LayoutGrid, List, Image as ImageIcon,
    ArrowLeft, X, ChevronDown, ChevronUp, Filter, Printer, FileText
} from 'lucide-react';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, Legend 
} from 'recharts';
import PhotoGallery from './PhotoGallery';
import { BENEFICIARY_DATA_URL, ASSET_DISTRIBUTION_URL, getProxyUrl } from '../config';

interface StatusRecord {
    id: string;
    date: string;
    benefitDate: string;
    activity: string;
    cluster: string;
    gp: string;
    village: string;
    status: string;
    submitter: string;
    photo: string;
    farmerId: string;
    hhId: string;
    beneficiaryAdhaar: string;
    beneficiaryName: string;
    hhHeadName: string;
    age: string;
    gender: string;
    phoneNumber: string;
    financialYear: string;
    reason: string;
    raw: any;
}

const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700/50 rounded-2xl ${className}`} />
);

interface ActivityStatusDashboardProps {
    onBack?: () => void;
}



const ACTIVITY_ASSET_CATALOG: Record<string, { label: string; labelTe: string; unit: string; count: number; code: string }[]> = {
    "ns": [
        { label: "Nutrition Garden Vegetable Seeds Kit", labelTe: "పోషక పెరటి తోట కూరగాయల విత్తనాల కిట్", unit: "Kit", count: 1, code: "HDFC-NG-01" },
        { label: "Bio-Fertilizer & Organic Input Package", labelTe: "జీవ ఎరువులు & సహజ ద్రావణాల కిట్", unit: "Package", count: 1, code: "HDFC-NG-02" }
    ],
    "elevated goat shed": [
        { label: "Elevated Goat Shed Infrastructure & Wooden Slats", labelTe: "ఎలివేటెడ్ మేకల షెడ్ చెక్క పలకల నిర్మాణం", unit: "Shed Unit", count: 1, code: "HDFC-GS-01" },
        { label: "Fodder Feeder & Water Trough Setup", labelTe: "మేత & నీటి తొట్టెల అమరిక", unit: "Set", count: 1, code: "HDFC-GS-02" }
    ],
    "goat": [
        { label: "Elevated Goat Shed Infrastructure & Wooden Slats", labelTe: "ఎలివేటెడ్ మేకల షెడ్ చెక్క పలకల నిర్మాణం", unit: "Shed Unit", count: 1, code: "HDFC-GS-01" },
        { label: "Fodder Feeder & Water Trough Setup", labelTe: "మేత & నీటి తొట్టెల అమరిక", unit: "Set", count: 1, code: "HDFC-GS-02" }
    ],
    "eco farmpond": [
        { label: "Eco Farmpond Excavation & Inflow Silt Trap", labelTe: "సిల్ట్ ట్రాప్‌తో కూడిన రైతు కుంట నిర్మాణం", unit: "Farmpond", count: 1, code: "HDFC-FP-01" },
        { label: "Outlet Spillway Stone Pitching", labelTe: "రాతి రక్షణ కట్ట మరియు అవుట్‌లెట్", unit: "Structure", count: 1, code: "HDFC-FP-02" }
    ],
    "farmpond": [
        { label: "Eco Farmpond Excavation & Inflow Silt Trap", labelTe: "సిల్ట్ ట్రాప్‌తో కూడిన రైతు కుంట నిర్మాణం", unit: "Farmpond", count: 1, code: "HDFC-FP-01" }
    ],
    "processing_hubs": [
        { label: "Hammer Grinder / Pulverizer Processing Machinery", labelTe: "హామర్ గ్రైండర్ ప్రాసెసింగ్ యంత్రం", unit: "Machinery Unit", count: 1, code: "HDFC-A1.9-0126" }
    ],
    "crops": [
        { label: "NPM Bio-Formulations (Bramhastram, Agniastram, Panchagavya)", labelTe: "ప్రకృతి వ్యవసాయ జీవ ద్రావణాలు (బ్రహ్మాస్త్రం, అగ్నిఅస్త్రం)", unit: "Liters", count: 10, code: "HDFC-A1.11-0049" },
        { label: "Quality Foundation Seeds Package", labelTe: "నాణ్యమైన విత్తనాల ప్యాకేజీ", unit: "Kgs", count: 5, code: "HDFC-SD-01" }
    ],
    "kitchen garden": [
        { label: "Kitchen Garden Seasonal Vegetable Seeds Kit", labelTe: "కూరగాయల విత్తనాల కిట్", unit: "Kit", count: 1, code: "HDFC-KG-01" },
        { label: "Bio-Nutrient Spray", labelTe: "జీవ పోషక ద్రావణం", unit: "Bottle", count: 1, code: "HDFC-KG-02" }
    ],
    "biomass plantation": [
        { label: "Agro-Forestry & Biomass Saplings", labelTe: "బయోమాస్ మొక్కలు & నర్సరీ సామాగ్రి", unit: "Saplings", count: 50, code: "HDFC-BP-01" }
    ],
    "vermi compost": [
        { label: "HDPE Vermi Bed Structure & Earthworm Culture", labelTe: "వర్మీ కంపోస్ట్ బెడ్ & వానపాముల యూనిట్", unit: "Unit", count: 1, code: "HDFC-VC-01" }
    ],
    "livestock health": [
        { label: "Veterinary First Aid Kit & Deworming Supplements", labelTe: "పశువైద్య ప్రథమ చికిత్స కిట్ & మందులు", unit: "Kit", count: 1, code: "HDFC-LH-01" }
    ]
};

const parseCSVLine = (line: string): string[] => {
    const vals: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === "," && !inQuotes) {
            vals.push(cur.trim().replace(/^"|"$/g, ""));
            cur = "";
        } else {
            cur += char;
        }
    }
    vals.push(cur.trim().replace(/^"|"$/g, ""));
    return vals;
};

const ActivityStatusDashboard: React.FC<ActivityStatusDashboardProps> = ({ onBack }) => {
    const [data, setData] = useState<StatusRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCluster, setSelectedCluster] = useState('ALL');
    const [selectedActivity, setSelectedActivity] = useState('ALL');
    const [selectedStatus, setSelectedStatus] = useState('ALL');
    const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
    const [ackLetterData, setAckLetterData] = useState<any | null>(null);
    const [modalMaterials, setModalMaterials] = useState<any[]>([]);
    const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<"overview" | "eligible" | "letters" | "tracking">("overview");
    const [selectedFY, setSelectedFY] = useState('ALL');
    const [viewMode, setViewMode] = useState<'grid' | 'table' | 'gallery'>('grid');
    const [debugMode, setDebugMode] = useState(false);
    const [rawSample, setRawSample] = useState<any>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});
    const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
    const [materialsMap, setMaterialsMap] = useState<Map<string, any[]>>(new Map());

    // Escape key listener for photo preview modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setPreviewImage(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const parseCSV = (csv: string): any[] => {
        const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 1) return [];
        
        const parseLine = (line: string) => {
            const vals: string[] = [];
            let cur = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                    vals.push(cur.trim().replace(/^"|"$/g, ''));
                    cur = '';
                } else {
                    cur += char;
                }
            }
            vals.push(cur.trim().replace(/^"|"$/g, ''));
            return vals;
        };

        const headers = parseLine(lines[0]).map(h => h.toLowerCase().trim());
        const getCol = (vals: string[], keywords: string[]) => {
            for (const kw of keywords) {
                const idx = headers.findIndex(h => h === kw || h.includes(kw));
                if (idx !== -1 && vals[idx]) return vals[idx];
            }
            return '';
        };

        return lines.slice(1).map(line => {
            const vals = parseLine(line);
            return {
                beneficiaryId: getCol(vals, ['beneficiary_id', 'beneficiaryid', 'ben_id', 'id', 'farmer_id']),
                beneficiaryAdhaar: getCol(vals, ['beneficiary_adhaar', 'beneficiary_aadhaar', 'adhaar', 'aadhaar_number', 'aadhaar_no', 'aadhaar_num']),
                hhId: getCol(vals, ['hh_id', 'hhid', 'household_id']),
                name: getCol(vals, ['beneficiary_name', 'name', 'farmer_name']),
                hhHeadName: getCol(vals, ['hh_head', 'household_head', 'head_name', 'head']),
                age: getCol(vals, ['age']),
                gender: getCol(vals, ['gender', 'sex']),
                phoneNumber: getCol(vals, ['phone', 'mobile', 'contact']),
                benefitDate: getCol(vals, ['benefitted_date', 'benefit_date', 'date', 'registration_date', 'timestamp']),
                cluster: getCol(vals, ['cluster']),
                gp: getCol(vals, ['gp', 'gram_panchayat', 'panchayat']),
                village: getCol(vals, ['village', 'habitation']),
                activity: (() => {
                    const actIdx = headers.findIndex(h => h === 'activity' || h === 'activity_registration-activity' || h === 'activity_name');
                    if (actIdx !== -1 && vals[actIdx] && !/\d{4}/.test(vals[actIdx]) && !/\d{1,2}-[A-Za-z]{3}-\d{4}/.test(vals[actIdx])) {
                        return vals[actIdx];
                    }
                    for (let i = 0; i < headers.length; i++) {
                        if (headers[i].includes('activity') && !headers[i].includes('date') && !headers[i].includes('time') && !headers[i].includes('remarks')) {
                            const val = vals[i];
                            if (val && !/\d{4}/.test(val) && !/\d{1,2}-[A-Za-z]{3}-\d{4}/.test(val)) return val;
                        }
                    }
                    return '';
                })()
            };
        }).filter(b => b.beneficiaryId || b.beneficiaryAdhaar || b.name);
    };

    const getFinancialYear = (dateStr: string): string => {
        if (!dateStr) return 'FY - 2025-26';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'FY - 2025-26';
        const m = d.getMonth() + 1; // 1-12
        const y = d.getFullYear();
        const fyYear = m <= 3 ? y - 1 : y;
        return `FY - ${fyYear}-${String(fyYear + 1).slice(2)}`;
    };

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        setRawSample(null);

        try {
            const targetFormId = 'Status';
            const [odkRes, benRes] = await Promise.all([
                fetch(`/api/odk/data?formId=${encodeURIComponent(targetFormId)}&projectId=3`),
                fetch(getProxyUrl(BENEFICIARY_DATA_URL)).catch(() => ({ ok: false, text: async () => '' } as any))
            ]);

            const odataText = await odkRes.text();
            let json;
            try {
                json = JSON.parse(odataText);
            } catch {
                if (odataText.includes('<!DOCTYPE') || odataText.includes('<html')) {
                    throw new Error(`The server returned a webpage instead of data. Status: ${odkRes.status}`);
                }
                throw new Error(`Failed to parse ODK data for "${targetFormId}". Response: ${odataText.substring(0, 100)}`);
            }

            if (!odkRes.ok) {
                const details = json.details || json.message || 'No details provided';
                const errorMsg = json.error || `ODK Central returned an error (${odkRes.status})`;
                throw new Error(`${errorMsg}: ${details}`);
            }

            const rawSubmissions = json.value || (Array.isArray(json) ? json : []);
            if (rawSubmissions.length > 0) {
                setRawSample(rawSubmissions[0]);
            }

            // Parse beneficiary data from the single Beneficiary table
            let parsedBens: any[] = [];
            if (benRes.ok) {
                const benText = await benRes.text();
                parsedBens = parseCSV(benText).map(b => ({
                    ...b,
                    activity: b.activity && !/\d{4}/.test(b.activity) ? b.activity : 'NS'
                }));
                setBeneficiaries(parsedBens);
            }

            const beneficiaryMapByBenId = new Map<string, any>();
            const beneficiaryMapByAdhaar = new Map<string, any>();
            parsedBens.forEach(b => {
                if (b.beneficiaryId) beneficiaryMapByBenId.set(b.beneficiaryId.toLowerCase().trim(), b);
                if (b.beneficiaryAdhaar) beneficiaryMapByAdhaar.set(b.beneficiaryAdhaar.toLowerCase().trim(), b);
            });

            const records: StatusRecord[] = rawSubmissions.map((sub: any) => {
                const flatData: Record<string, any> = {};
                const flatten = (obj: any, prefix = '') => {
                    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                        Object.keys(obj).forEach(k => {
                            const newKey = prefix ? `${prefix}/${k}` : k;
                            flatData[newKey] = obj[k];
                            flatData[newKey.replace(/\//g, '.')] = obj[k];
                            flatData[newKey.replace(/\//g, '_')] = obj[k];
                            flatten(obj[k], newKey);
                        });
                    }
                };
                flatten(sub);

                const findInFlat = (keywords: string[]) => {
                    for (const kw of keywords) {
                        if (flatData[kw] !== undefined && flatData[kw] !== null && flatData[kw] !== '') return flatData[kw];
                    }
                    const allKeys = Object.keys(flatData);
                    for (const kw of keywords) {
                        const match = allKeys.find(k => k.toLowerCase().endsWith(kw.toLowerCase()));
                        if (match && flatData[match] !== undefined && flatData[match] !== null && flatData[match] !== '') return flatData[match];
                    }
                    for (const kw of keywords) {
                        const match = allKeys.find(k => k.toLowerCase().includes(kw.toLowerCase()));
                        if (match && flatData[match] !== undefined && flatData[match] !== null && flatData[match] !== '') return flatData[match];
                    }
                    return null;
                };

                const activityKeywords = ['basic_info-activity', 'basic_info/activity', 'basic_info.activity', 'activity', 'activity_name', 'work', 'task', 'project', 'topic', 'Name'];
                const clusterKeywords = ['cluster', 'location_info/cluster', 'zone'];
                const gpKeywords = ['gp', 'gram_panchayat', 'panchayat'];
                const villageKeywords = ['village', 'habitation'];
                const statusKeywords = ['activity_works-work_status', 'activity_works/work_status', 'work_status', 'status', 'completion_status', 'completed', 'state', 'progress'];
                const submitterKeywords = ['submittername', 'submitter', 'staff', 'user', 'name_of_reporter', 'created_by', 'Data_sub_by'];
                const photoKeywords = ['photo', 'image', 'picture', 'pic', 'attachment', 'media', 'file', 'upload'];
                
                const benIdKeywords = ['beneficiary_id', 'beneficiaryId', 'ben_id', 'farmer_id', 'id'];
                const benAdhaarKeywords = ['beneficiary_details-beneficiary_adhaar', 'beneficiary_details/beneficiary_adhaar', 'beneficiary_adhaar', 'beneficiary_aadhaar', 'adhaar', 'aadhaar_number'];
                const hhIdKeywords = ['hh_id', 'hhid', 'household_id', 'hh_id_number'];
                const beneficiaryKeywords = ['beneficiary_details-beneficiary_name', 'beneficiary_name', 'beneficiaryName', 'beneficiary', 'farmer_name'];
                const reasonKeywords = ['reason', 'incomplete_reason', 'not_completed_reason', 'remarks', 'comment', 'note', 'details', 'why'];

                const activity = String(findInFlat(activityKeywords) || 'General Activity');
                const cluster = String(findInFlat(clusterKeywords) || 'Cluster 1');
                const gp = String(findInFlat(gpKeywords) || 'GP N/A');
                const village = String(findInFlat(villageKeywords) || 'Village N/A');
                
                const rawBenId = String(findInFlat(benIdKeywords) || '');
                const rawBenAdhaar = String(findInFlat(benAdhaarKeywords) || '');
                const rawHHId = String(findInFlat(hhIdKeywords) || '');
                const beneficiaryName = String(findInFlat(beneficiaryKeywords) || '-');
                const reason = String(findInFlat(reasonKeywords) || '');

                const normBenId = rawBenId.toLowerCase().trim();
                const normBenAdhaar = rawBenAdhaar.toLowerCase().trim();

                const matchedBen = beneficiaryMapByBenId.get(normBenId) || beneficiaryMapByAdhaar.get(normBenAdhaar);

                const resolvedBeneficiaryName = matchedBen?.name || beneficiaryName;
                const resolvedHHId = matchedBen?.hhId || rawHHId || '-';
                const resolvedFarmerId = matchedBen?.beneficiaryId || rawBenId || '-';
                const resolvedAdhaar = matchedBen?.beneficiaryAdhaar || rawBenAdhaar || '-';
                const resolvedHhHead = matchedBen?.hhHeadName || '-';
                const resolvedAge = matchedBen?.age || '-';
                const resolvedGender = matchedBen?.gender || '-';
                const resolvedPhone = matchedBen?.phoneNumber || '-';
                const resolvedBenefitDate = matchedBen?.benefitDate || findInFlat(['date', 'today', 'timestamp']) || sub.__system?.submissionDate || '';
                
                const rawStatus = findInFlat(statusKeywords);
                let status = 'In Progress';
                if (rawStatus !== null && rawStatus !== undefined && String(rawStatus).trim() !== '') {
                    const strStatus = String(rawStatus).toLowerCase().trim();
                    if (
                        strStatus.includes('not') || 
                        strStatus.includes('incomplete') || 
                        strStatus.includes('in_complete') ||
                        strStatus.includes('pending') || 
                        strStatus.includes('progress') ||
                        strStatus === 'no' || 
                        strStatus === '0' ||
                        strStatus === 'false' ||
                        strStatus === 'not_completed'
                    ) {
                        status = 'In Progress';
                    } else if (
                        strStatus === 'completed' || 
                        strStatus === 'complete' || 
                        strStatus === 'yes' || 
                        strStatus === '1' || 
                        strStatus === 'done' ||
                        (strStatus.includes('complete') && !strStatus.includes('not') && !strStatus.includes('in'))
                    ) {
                        status = 'Completed';
                    } else {
                        status = String(rawStatus);
                    }
                } else {
                    status = 'In Progress';
                }

                const submitter = String(sub.__system?.submitterName || findInFlat(submitterKeywords) || sub.__system?.submitterId || 'Field Staff');
                const date = findInFlat(['date', 'today', 'timestamp']) || sub.__system?.submissionDate || '';
                const financialYear = getFinancialYear(resolvedBenefitDate || date);

                let foundPhotoValue = '';
                for (const k of Object.keys(flatData)) {
                    const val = flatData[k];
                    if (typeof val === 'string' && val.length > 4) {
                        const lower = val.toLowerCase();
                        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp') || lower.endsWith('.gif')) {
                            foundPhotoValue = val;
                            break;
                        }
                    }
                }

                if (!foundPhotoValue) {
                    for (const k of Object.keys(flatData)) {
                        if (photoKeywords.some(pk => k.toLowerCase().includes(pk))) {
                            const val = flatData[k];
                            if (typeof val === 'string' && val.length > 2) {
                                foundPhotoValue = val;
                                break;
                            }
                        }
                    }
                }

                let photo = '';
                if (foundPhotoValue) {
                    const filename = foundPhotoValue.includes('/') ? foundPhotoValue.split('/').pop() : foundPhotoValue;
                    if (filename) {
                        photo = `/api/odk/image?submissionId=${encodeURIComponent(sub.__id)}&filename=${encodeURIComponent(filename)}&form=Status`;
                    }
                }

                return {
                    id: sub.__id,
                    date,
                    benefitDate: resolvedBenefitDate,
                    activity,
                    cluster,
                    gp,
                    village,
                    status,
                    submitter,
                    photo,
                    farmerId: resolvedFarmerId,
                    hhId: resolvedHHId,
                    beneficiaryAdhaar: resolvedAdhaar,
                    beneficiaryName: resolvedBeneficiaryName,
                    hhHeadName: resolvedHhHead,
                    age: resolvedAge,
                    gender: resolvedGender,
                    phoneNumber: resolvedPhone,
                    financialYear,
                    reason,
                    raw: sub
                };
            });

            
            // Preload complete materials map from server
            try {
                const matAllRes = await fetch("/api/materials/all").then(r => r.json()).catch(() => ({ success: false, map: {} }));
                if (matAllRes.success && matAllRes.map) {
                    const loadedMap = new Map<string, any[]>();
                    for (const [k, v] of Object.entries(matAllRes.map)) {
                        loadedMap.set(k.toLowerCase().trim(), v as any[]);
                    }
                    setMaterialsMap(loadedMap);
                }
            } catch (matLoadErr) {
                console.warn("Failed to preload materials map:", matLoadErr);
            }

            const sortedRecords = records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setData(sortedRecords);

            const initialExpanded: Record<string, boolean> = {};
            Array.from(new Set(sortedRecords.map(r => r.activity))).forEach(act => {
                initialExpanded[act] = true;
            });
            setExpandedActivities(initialExpanded);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const clustersList = useMemo(() => {
        return ['ALL', ...Array.from(new Set(data.map(d => d.cluster))).sort()];
    }, [data]);

    const activitiesList = useMemo(() => {
        return ['ALL', ...Array.from(new Set(data.map(d => d.activity))).sort()];
    }, [data]);

    const statusesList = useMemo(() => {
        return ['ALL', ...Array.from(new Set(data.map(d => d.status))).sort()];
    }, [data]);

    const financialYearsList = useMemo(() => {
        return ['ALL', ...Array.from(new Set(data.map(d => d.financialYear))).sort()];
    }, [data]);

    
    const eligibleBeneficiaries = useMemo(() => {
        return data.filter(d => {
            const isCompleted = d.status.toLowerCase().includes("complete") || d.status === "Completed";
            const matchesSearch = !searchQuery || 
                (d.beneficiaryName && d.beneficiaryName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (d.farmerId && d.farmerId.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (d.village && d.village.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesCluster = selectedCluster === "ALL" || d.cluster === selectedCluster;
            const matchesActivity = selectedActivity === "ALL" || d.activity === selectedActivity;
            return isCompleted && matchesSearch && matchesCluster && matchesActivity;
        });
    }, [data, searchQuery, selectedCluster, selectedActivity]);

    
    
    
        const openAckLetter = async (item: any) => {
        setAckLetterData(item);
        // Pre-fill synchronously if available
        const instantMats = getIssuedMaterials(item);
        if (instantMats && instantMats.length > 0) {
            setModalMaterials(instantMats);
        } else {
            setModalMaterials([]);
        }

        try {
            const benId = item.beneficiaryId || item.beneficiaryAdhaar || "";
            const farmerId = item.farmerId || item.hhId || "";
            const bName = item.beneficiaryName || item.name || "";
            const vName = item.village || "";
            const params = new URLSearchParams({
                beneficiaryId: benId,
                farmerId: farmerId,
                hhId: item.hhId || "",
                name: bName,
                village: vName
            });
            const res = await fetch(`/api/materials/query?${params.toString()}`);
            const data = await res.json();
            if (data.success && Array.isArray(data.materials) && data.materials.length > 0) {
                setModalMaterials(data.materials);
            }
        } catch (e) {
            console.warn("Failed to query materials:", e);
        }
    };
    const getIssuedMaterials = (item: any) => {
        if (!item) return [];
        const candidates = [
            item.farmerId,
            item.beneficiaryId,
            item.hhId,
            item.beneficiaryAdhaar,
            item.adhaar,
            item.id
        ].filter(Boolean).map(s => String(s).toLowerCase().trim());

        for (const cid of candidates) {
            if (materialsMap.has(cid)) {
                return materialsMap.get(cid)!;
            }
        }

        const rawName = (item.beneficiaryName || item.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const rawVillage = (item.village || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (rawName && rawVillage && materialsMap.has(`${rawName}_${rawVillage}`)) {
            return materialsMap.get(`${rawName}_${rawVillage}`)!;
        }
        if (rawName && materialsMap.has(rawName)) {
            return materialsMap.get(rawName)!;
        }

        // If not found in recorded distribution, look up from activity catalog!
        const rawAct = String(item.activity || item.activityName || "NS").toLowerCase().trim();
        for (const [catKey, catItems] of Object.entries(ACTIVITY_ASSET_CATALOG)) {
            if (rawAct === catKey || rawAct.includes(catKey) || catKey.includes(rawAct)) {
                return catItems;
            }
        }

        const actDisplay = item.activity || item.activityName || "NS";
        return [
            {
                label: `${actDisplay} Activity Work & Material Inputs Package`,
                labelTe: `${actDisplay} కార్యాచరణ పనిముట్లు & వస్తువుల ప్యాకేజీ`,
                count: 1,
                unit: "Set / Unit",
                code: "HDFC-P1198-01"
            }
        ];
    };
    const handleBulkGenerateSelected = async () => {
        const selected = eligibleBeneficiaries.filter(b => bulkSelected.has(b.id || b.farmerId));
        if (selected.length === 0) {
            alert("Please select eligible beneficiaries using the checkboxes first.");
            return;
        }
        try {
            const res = await fetch("/api/acknowledgements/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: selected.map(s => ({
                        activityUuid: s.id,
                        beneficiaryId: s.farmerId || s.hhId || "BEN",
                        activityName: s.activity,
                        beneficiaryName: s.beneficiaryName,
                        cluster: s.cluster,
                        gp: s.gp,
                        village: s.village
                    }))
                })
            });
            const d = await res.json();
            if (d.success) {
                alert(`Successfully generated ${d.count} acknowledgements!`);
                setBulkSelected(new Set());
                setActiveTab("letters");
            }
        } catch (e: any) {
            alert("Error in bulk generation: " + e.message);
        }
    };

    const filteredData = useMemo(() => {
        return data.filter(d => {
            const matchesSearch = 
                d.activity.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.village.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.submitter.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.beneficiaryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.beneficiaryAdhaar.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.hhId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.farmerId.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesCluster = selectedCluster === 'ALL' || d.cluster === selectedCluster;
            const matchesActivity = selectedActivity === 'ALL' || d.activity === selectedActivity;
            const matchesStatus = selectedStatus === 'ALL' || d.status === selectedStatus;
            const matchesFY = selectedFY === 'ALL' || d.financialYear === selectedFY;

            return matchesSearch && matchesCluster && matchesActivity && matchesStatus && matchesFY;
        });
    }, [data, searchQuery, selectedCluster, selectedActivity, selectedStatus, selectedFY]);

    const stats = useMemo(() => {
        const subMapById = new Map<string, any>();
        const subMapByAdhaar = new Map<string, any>();
        data.forEach(d => {
            if (d.beneficiaryId) subMapById.set(d.beneficiaryId.toLowerCase().trim(), d);
            if (d.beneficiaryAdhaar) subMapByAdhaar.set(d.beneficiaryAdhaar.toLowerCase().trim(), d);
        });

        const targetBeneficiaries = beneficiaries.length > 0 ? beneficiaries : data.map(d => ({
            beneficiaryId: d.beneficiaryId,
            beneficiaryAdhaar: d.beneficiaryAdhaar,
            activity: d.activity,
            cluster: d.cluster,
            benefitDate: d.date
        }));

        const filteredBeneficiaries = targetBeneficiaries.filter(b => {
            const fy = getFinancialYear(b.benefitDate);
            const matchesFY = selectedFY === 'ALL' || fy === selectedFY;
            const matchesCluster = selectedCluster === 'ALL' || b.cluster === selectedCluster;
            const bActivity = b.activity || (b.beneficiaryId && subMapById.get(b.beneficiaryId.toLowerCase().trim())?.activity) || 'General Activity';
            const matchesActivity = selectedActivity === 'ALL' || bActivity === selectedActivity;
            return matchesFY && matchesCluster && matchesActivity;
        });

        const fullActivityMap: Record<string, { activity: string; completed: number; pending: number; total: number; statusCounts: Record<string, number> }> = {};

        filteredBeneficiaries.forEach(b => {
            const act = b.activity || (b.beneficiaryId && subMapById.get(b.beneficiaryId.toLowerCase().trim())?.activity) || (b.beneficiaryAdhaar && subMapByAdhaar.get(b.beneficiaryAdhaar.toLowerCase().trim())?.activity) || 'General Activity';
            if (!fullActivityMap[act]) {
                fullActivityMap[act] = { activity: act, completed: 0, pending: 0, total: 0, statusCounts: {} };
            }
            fullActivityMap[act].total += 1;

            const sub = (b.beneficiaryId && subMapById.get(b.beneficiaryId.toLowerCase().trim())) ||
                        (b.beneficiaryAdhaar && subMapByAdhaar.get(b.beneficiaryAdhaar.toLowerCase().trim()));
            
            const st = sub ? (sub.status || 'In Progress') : 'Not Started';
            fullActivityMap[act].statusCounts[st] = (fullActivityMap[act].statusCounts[st] || 0) + 1;

            if (st.toLowerCase().includes('complete') || st === 'Completed') {
                fullActivityMap[act].completed += 1;
            } else {
                fullActivityMap[act].pending += 1;
            }
        });

        const activitySummary = Object.values(fullActivityMap).sort((a, b) => b.total - a.total);
        const activityChartData = activitySummary.map(item => ({
            activity: item.activity.length > 25 ? item.activity.substring(0, 22) + '...' : item.activity,
            completed: item.completed,
            pending: item.pending,
            total: item.total
        }));

        const total = filteredBeneficiaries.length;
        const completed = Object.values(fullActivityMap).reduce((acc, cur) => acc + cur.completed, 0);
        const pending = total - completed;

        const clusterMap: Record<string, { cluster: string; completed: number; pending: number; total: number }> = {};
        filteredBeneficiaries.forEach(b => {
            const cluster = b.cluster || 'Unknown';
            if (!clusterMap[cluster]) {
                clusterMap[cluster] = { cluster, completed: 0, pending: 0, total: 0 };
            }
            clusterMap[cluster].total += 1;
            const sub = (b.beneficiaryId && subMapById.get(b.beneficiaryId.toLowerCase().trim())) ||
                        (b.beneficiaryAdhaar && subMapByAdhaar.get(b.beneficiaryAdhaar.toLowerCase().trim()));
            const st = sub ? (sub.status || 'In Progress') : 'Not Started';
            if (st.toLowerCase().includes('complete') || st === 'Completed') {
                clusterMap[cluster].completed += 1;
            } else {
                clusterMap[cluster].pending += 1;
            }
        });
        const clusterChartData = Object.values(clusterMap);

        return { total, completed, pending, clusterChartData, activityChartData, activitySummary };
    }, [beneficiaries, data, selectedFY, selectedCluster, selectedActivity]);

    const fySummary = useMemo(() => {
        const fyMap: Record<string, { fy: string; beneficiaryCount: number; completedCount: number; totalCount: number }> = {};
        beneficiaries.forEach(b => {
            const fy = getFinancialYear(b.benefitDate);
            if (!fyMap[fy]) {
                fyMap[fy] = { fy, beneficiaryCount: 0, completedCount: 0, totalCount: 0 };
            }
            fyMap[fy].beneficiaryCount += 1;
        });
        data.forEach(d => {
            const fy = d.financialYear || 'FY - 2025-26';
            if (!fyMap[fy]) {
                fyMap[fy] = { fy, beneficiaryCount: 0, completedCount: 0, totalCount: 0 };
            }
            fyMap[fy].totalCount += 1;
            if (d.status.toLowerCase().includes('complete') || d.status === 'Completed') {
                fyMap[fy].completedCount += 1;
            }
        });
        return Object.values(fyMap).sort((a, b) => b.fy.localeCompare(a.fy));
    }, [beneficiaries, data]);

    const groupedByActivity = useMemo(() => {
        const map: Record<string, StatusRecord[]> = {};
        filteredData.forEach(d => {
            if (!map[d.activity]) {
                map[d.activity] = [];
            }
            map[d.activity].push(d);
        });
        return map;
    }, [filteredData]);

    const toggleActivityAccordion = (activityName: string) => {
        setExpandedActivities(prev => ({
            ...prev,
            [activityName]: !prev[activityName]
        }));
    };

    if (loading) {
        return (
            <div className="space-y-8 pb-10">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-10 w-24" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-3xl" />)}
                </div>
                <Skeleton className="h-96 rounded-3xl" />
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-16">
            {onBack && (
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 transition-colors group mb-4"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Dashboards
                </button>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-1 bg-indigo-600 rounded-full" />
                        <span className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.2em]">Live ODK & House Hold Id / Beneficiary Id Linked Monitoring</span>
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Activity-Wise Beneficiary & Status Dashboard</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium max-w-xl">
                        Real-time activity-wise tracking linked via Beneficiary ID & Aadhaar, categorized into total registered beneficiaries, status progress, cluster distribution, and photo evidence.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={fetchData}
                        className="p-3 rounded-2xl bg-white dark:bg-gray-800 text-gray-400 hover:text-indigo-600 shadow-sm border border-gray-100 dark:border-gray-700 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-5"
                    >
                        <RefreshCw size={16} />
                        Refresh Data
                    </button>
                    <button 
                        onClick={() => setDebugMode(!debugMode)}
                        className={`p-3 rounded-2xl transition-all shadow-sm border ${debugMode ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-gray-700'}`}
                        title="Diagnostic Console"
                    >
                        <AlertCircle size={18} />
                    </button>
                </div>
            </div>

            {/* Diagnostic Console */}
            {debugMode && (
                <div className="bg-indigo-900/10 dark:bg-indigo-950/30 p-6 rounded-3xl border border-indigo-200 dark:border-indigo-800 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                            <AlertCircle size={14} />
                            Status Form & Beneficiary ID/Aadhaar Linked Diagnostic Console ({data.length} Submissions Loaded)
                        </h3>
                        <button onClick={() => setDebugMode(false)} className="text-[9px] font-black uppercase text-rose-500 hover:underline">Close Console</button>
                    </div>
                    {rawSample && (
                        <pre className="p-4 bg-gray-950 rounded-2xl text-[9px] text-emerald-500 overflow-x-auto font-mono max-h-48">
                            {JSON.stringify(rawSample, null, 2)}
                        </pre>
                    )}
                </div>
            )}

            {error && (
                <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 p-8 rounded-3xl flex items-center gap-4 text-rose-600">
                    <AlertCircle size={24} />
                    <div className="flex-1">
                        <p className="text-xs font-black uppercase tracking-widest">Error Loading Status Data</p>
                        <p className="text-sm font-bold">{error}</p>
                    </div>
                    <button onClick={fetchData} className="px-6 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Retry</button>
                </div>
            )}

            
            {/* Primary Tab Navigation */}
            <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 pb-4 overflow-x-auto">
                <button
                    onClick={() => setActiveTab("overview")}
                    className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === "overview" ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50"}`}
                >
                    Activity Overview & Summary
                </button>
                <button
                    onClick={() => setActiveTab("eligible")}
                    className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === "eligible" ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50"}`}
                >
                    <span>Eligible Beneficiaries</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold">
                        {eligibleBeneficiaries.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab("letters")}
                    className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === "letters" ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50"}`}
                >
                    Generated Acknowledgements
                </button>
            </div>

            {/* TAB 2: ELIGIBLE BENEFICIARIES VIEW */}
            {activeTab === "eligible" && (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                Eligible Beneficiaries for Acknowledgement
                            </h3>
                            <p className="text-xs text-gray-500 font-medium">
                                Verified completed activities from ODK Central and Beneficiary Registration
                            </p>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto">
                            <div className="relative w-64">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search name, Ben ID, village..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <select
                                value={selectedActivity}
                                onChange={(e) => setSelectedActivity(e.target.value)}
                                className="bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-xl text-xs font-bold border-none"
                            >
                                {activitiesList.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                            {bulkSelected.size > 0 && (
                                <button
                                    onClick={handleBulkGenerateSelected}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2"
                                >
                                    <FileText size={14} /> Generate Selected ({bulkSelected.size})
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-700 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                                    <th className="py-4 px-4 w-10">
                                        <input
                                            type="checkbox"
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setBulkSelected(new Set(eligibleBeneficiaries.map(b => b.id || b.farmerId)));
                                                } else {
                                                    setBulkSelected(new Set());
                                                }
                                            }}
                                            checked={bulkSelected.size === eligibleBeneficiaries.length && eligibleBeneficiaries.length > 0}
                                            className="rounded border-gray-300"
                                        />
                                    </th>
                                    <th className="py-4 px-6">Beneficiary Name</th>
                                    <th className="py-4 px-6">Beneficiary ID</th>
                                    <th className="py-4 px-6">Activity</th>
                                    <th className="py-4 px-6">Village / GP</th>
                                    <th className="py-4 px-6">Completion Status</th>
                                    <th className="py-4 px-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-xs font-medium">
                                {eligibleBeneficiaries.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-gray-400 font-bold">
                                            No completed eligible beneficiaries match the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    eligibleBeneficiaries.map(item => {
                                        const key = item.id || item.farmerId;
                                        const isChecked = bulkSelected.has(key);
                                        return (
                                            <tr key={key} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors">
                                                <td className="py-4 px-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {
                                                            const next = new Set(bulkSelected);
                                                            if (next.has(key)) next.delete(key);
                                                            else next.add(key);
                                                            setBulkSelected(next);
                                                        }}
                                                        className="rounded border-gray-300"
                                                    />
                                                </td>
                                                <td className="py-4 px-6 font-bold text-gray-900 dark:text-white">{item.beneficiaryName || "Beneficiary"}</td>
                                                <td className="py-4 px-6 font-mono text-gray-500">{item.farmerId || item.hhId}</td>
                                                <td className="py-4 px-6">
                                                    <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 rounded-lg text-[10px] font-black uppercase">
                                                        {item.activity}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-gray-500">{item.village} ({item.gp})</td>
                                                <td className="py-4 px-6">
                                                    <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                                                        <CheckCircle2 size={14} /> Completed
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-right">
                                                    <button
                                                        onClick={() => openAckLetter(item)}
                                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase transition-colors flex items-center gap-1.5 ml-auto"
                                                    >
                                                        <Printer size={13} /> Generate Letter
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* OVERVIEW CONTENT */}
            {activeTab === "overview" && (
                <>

{/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Filtered Submissions</p>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">{stats.total}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl text-emerald-600">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Completed Status</p>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">{stats.completed}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6">
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-2xl text-amber-600">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">In Progress / Pending</p>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">{stats.pending}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6">
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-2xl text-purple-600">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Active Clusters</p>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">{Math.max(0, clustersList.length - 1)}</h3>
                    </div>
                </div>
            </div>

            {/* Activity-Wise Beneficiary & Completion Summary (Filtered by Active FY) */}
            <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Activity-Wise Beneficiary & Completion Summary</h3>
                        <p className="text-xs text-gray-500 font-medium">Total registered and completed beneficiaries for each activity</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.activitySummary.map((item) => (
                        <div key={item.activity} onClick={() => { setSelectedActivity(item.activity); setActiveTab("eligible"); }} className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 space-y-3 cursor-pointer hover:border-indigo-500 hover:shadow-lg transition-all group" title="Click to view eligible beneficiaries for this activity">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black px-3 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 rounded-xl uppercase tracking-wider truncate max-w-[160px]" title={item.activity}>{item.activity}</span>
                                <span className="text-[10px] font-bold text-gray-400">Activity</span>
                            </div>
                                <div className="space-y-1 pt-1 border-t border-gray-200/50 dark:border-gray-800">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-bold uppercase">Total Beneficiaries:</span>
                                        <span className="font-black text-gray-900 dark:text-white tabular-nums text-sm">{item.total}</span>
                                    </div>
                                    {Object.entries(item.statusCounts).map(([statusName, count]) => (
                                        <div key={statusName} className="flex justify-between items-center text-xs">
                                            <span className="text-gray-500 font-medium capitalize">{statusName}:</span>
                                            <span className={`font-black tabular-nums text-xs ${statusName.toLowerCase().includes('complete') ? 'text-emerald-600' : 'text-amber-600'}`}>{count}</span>
                                        </div>
                                    ))}
                                </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                                <div 
                                    className="bg-indigo-600 h-full rounded-full transition-all" 
                                    style={{ width: `${item.total > 0 ? (item.completed / item.total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Filter & Controls */}
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="relative w-full lg:w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        type="text"
                        placeholder="Search activity, Ben ID, Aadhaar, village..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-gray-400">Financial Year:</span>
                        <select 
                            value={selectedFY} 
                            onChange={(e) => setSelectedFY(e.target.value)}
                            className="bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-xl text-xs font-bold border-none"
                        >
                            {financialYearsList.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-gray-400">Cluster:</span>
                        <select 
                            value={selectedCluster} 
                            onChange={(e) => setSelectedCluster(e.target.value)}
                            className="bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-xl text-xs font-bold border-none"
                        >
                            {clustersList.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-gray-400">Activity:</span>
                        <select 
                            value={selectedActivity} 
                            onChange={(e) => setSelectedActivity(e.target.value)}
                            className="bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-xl text-xs font-bold border-none max-w-[140px] truncate"
                        >
                            {activitiesList.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-gray-400">Status:</span>
                        <select 
                            value={selectedStatus} 
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-xl text-xs font-bold border-none"
                        >
                            {statusesList.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-gray-50 dark:bg-gray-900/50 rounded-xl ml-auto">
                        {(['grid', 'table', 'gallery'] as const).map((mode) => (
                            <button 
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`p-2 rounded-lg transition-all ${viewMode === mode ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                                title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} View`}
                            >
                                {mode === 'grid' && <LayoutGrid className="w-4 h-4" />}
                                {mode === 'table' && <List className="w-4 h-4" />}
                                {mode === 'gallery' && <ImageIcon className="w-4 h-4" />}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Charts Section with Filter Indicator */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
                        <Filter size={14} className="text-indigo-600" />
                        Charts Filtered by Active Selection (FY: {selectedFY}, Cluster: {selectedCluster}, Activity: {selectedActivity}, Status: {selectedStatus})
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Cluster-wise Status Distribution</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Completed vs In Progress by Cluster</p>
                        </div>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.clusterChartData}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis dataKey="cluster" tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[8, 8, 0, 0]} />
                                    <Bar dataKey="pending" name="In Progress" fill="#F59E0B" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Activity-wise Breakdown</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Top Activities Status</p>
                        </div>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.activityChartData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis type="number" tick={{ fontSize: 10 }} />
                                    <YAxis dataKey="activity" type="category" width={110} tick={{ fontSize: 9 }} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="completed" name="Completed" fill="#6366F1" radius={[0, 8, 8, 0]} />
                                    <Bar dataKey="pending" name="In Progress" fill="#EC4899" radius={[0, 8, 8, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area: Activity-wise Accordions with Lazy-loaded Photos */}
            {filteredData.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 p-16 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 text-center space-y-6">
                    <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto text-gray-300">
                        <Activity className="w-10 h-10" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">No Activity Status Records Found</h3>
                        <p className="text-sm font-medium text-gray-500 max-w-xs mx-auto">
                            No records match your current search or filter criteria.
                        </p>
                    </div>
                </div>
            ) : viewMode === 'gallery' ? (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Field Photo Documentation (All Activities)</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Individual and site-wise images linked via Beneficiary ID & Aadhaar</p>
                        </div>
                        <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-full">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                                {filteredData.filter(d => d.photo).length} photos found
                            </span>
                        </div>
                    </div>
                    <PhotoGallery 
                        images={filteredData
                            .filter(d => d.photo)
                            .map(d => ({
                                url: d.photo,
                                topic: `${d.activity} (${d.financialYear})`,
                                participants: 1,
                                description: `${d.cluster} · ${d.village} (${d.gp}) · Ben ID: ${d.farmerId} · Aadhaar: ${d.beneficiaryAdhaar} · ${d.beneficiaryName} (${d.gender}, ${d.age}y) · Head: ${d.hhHeadName} · Benefitted Date: ${d.benefitDate ? new Date(d.benefitDate).toLocaleDateString() : '-'} · Phone: ${d.phoneNumber} · ${d.status}${d.reason ? ` - Reason: ${d.reason}` : ''} · By: ${d.submitter}`
                            }))
                        } 
                    />
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(groupedByActivity).map(([activityName, records]) => {
                        const isExpanded = !!expandedActivities[activityName];
                        const completedCount = records.filter(r => r.status === 'Completed').length;
                        const pendingCount = records.length - completedCount;
                        const photoCount = records.filter(r => r.photo).length;

                        return (
                            <div key={activityName} className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-all">
                                <div 
                                    onClick={() => toggleActivityAccordion(activityName)}
                                    className="p-6 sm:p-8 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors"
                                >
                                    <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 flex-shrink-0">
                                            <Activity className="w-6 h-6" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight truncate">
                                                    {activityName}
                                                </h3>
                                                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest">
                                                    {records.length} Submissions
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 mt-2 text-xs font-bold text-gray-500 flex-wrap">
                                                <span className="flex items-center gap-1.5 text-emerald-600">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                                    {completedCount} Completed
                                                </span>
                                                <span className="flex items-center gap-1.5 text-amber-600">
                                                    <span className="w-2 h-2 rounded-full bg-amber-600" />
                                                    {pendingCount} In Progress
                                                </span>
                                                {photoCount > 0 && (
                                                    <span className="flex items-center gap-1 text-indigo-600">
                                                        <ImageIcon className="w-3.5 h-3.5" />
                                                        {photoCount} Photos
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-black text-indigo-600 uppercase tracking-wider hidden sm:inline">
                                            {isExpanded ? 'Collapse' : 'Expand & Load Photos'}
                                        </span>
                                        <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-xl text-gray-500">
                                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="p-6 sm:p-8 pt-0 border-t border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/10 space-y-6">
                                        <div className="pt-6">
                                            {viewMode === 'grid' ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                    {records.map((record) => (
                                                        <div key={record.id} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all group flex flex-col">
                                                            <div 
                                                                className="relative h-48 overflow-hidden bg-gray-50 dark:bg-gray-950 cursor-pointer"
                                                                onClick={() => record.photo && setPreviewImage(record.photo)}
                                                            >
                                                                {record.photo ? (
                                                                    <img src={record.photo} alt={record.activity} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                                                ) : (
                                                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                                                                        <ImageIcon className="w-10 h-10 opacity-20" />
                                                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">No Photo</span>
                                                                    </div>
                                                                )}
                                                                <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
                                                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-white shadow-sm ${record.status === 'Completed' ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                                                                        {record.status}
                                                                    </span>
                                                                    <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white shadow-sm">
                                                                        {record.financialYear}
                                                                    </span>
                                                                </div>
                                                                <div className="absolute top-4 right-4">
                                                                    <div className="px-3 py-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-lg shadow-sm">
                                                                        <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase">
                                                                            {record.cluster}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="p-5 flex-grow flex flex-col space-y-3">
                                                                <div className="space-y-1.5 text-xs font-bold text-gray-500">
                                                                    <div className="flex justify-between">
                                                                        <span className="uppercase text-[9px] font-black text-gray-400">Village / GP:</span>
                                                                        <span className="text-gray-800 dark:text-gray-200">{record.village} ({record.gp})</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="uppercase text-[9px] font-black text-gray-400">House Hold Id / Beneficiary Id:</span>
                                                                        <span className="text-gray-800 dark:text-gray-200 font-mono text-[10px]">{record.farmerId} / {record.beneficiaryAdhaar}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="uppercase text-[9px] font-black text-gray-400">Beneficiary:</span>
                                                                        <span className="text-gray-800 dark:text-gray-200">{record.beneficiaryName}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="uppercase text-[9px] font-black text-gray-400">Benefitted Date:</span>
                                                                        <span className="text-indigo-600 font-black tabular-nums">{record.benefitDate ? new Date(record.benefitDate).toLocaleDateString() : '-'}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="uppercase text-[9px] font-black text-gray-400">HH Head / Age / Gender:</span>
                                                                        <span className="text-gray-800 dark:text-gray-200">{record.hhHeadName} ({record.age}y, {record.gender})</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="uppercase text-[9px] font-black text-gray-400">Phone:</span>
                                                                        <span className="text-gray-800 dark:text-gray-200 font-mono">{record.phoneNumber}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="uppercase text-[9px] font-black text-gray-400">Submitter:</span>
                                                                        <span className="text-indigo-600">{record.submitter}</span>
                                                                    </div>
                                                                    {record.status !== 'Completed' && record.reason && (
                                                                        <div className="pt-2 border-t border-amber-100 dark:border-amber-900/30">
                                                                            <span className="uppercase text-[9px] font-black text-amber-600 block mb-0.5">Reason (Not Completed):</span>
                                                                            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium italic">{record.reason}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-left border-collapse">
                                                            <thead>
                                                                <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b dark:border-gray-700">
                                                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Benefitted Date / FY</th>
                                                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Location & Beneficiary Details</th>
                                                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status / Reason</th>
                                                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Submitter</th>
                                                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Photo</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                                {records.map((record) => (
                                                                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                                                                        <td className="px-6 py-4 text-xs font-bold text-gray-500 tabular-nums">
                                                                            <div>{record.benefitDate ? new Date(record.benefitDate).toLocaleDateString() : '-'}</div>
                                                                            <div className="text-[9px] font-black text-indigo-600 mt-0.5">{record.financialYear}</div>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-xs font-bold text-gray-500 space-y-1">
                                                                            <div>{record.cluster} · {record.village} ({record.gp})</div>
                                                                            <div className="text-[10px] text-gray-400">
                                                                                Ben ID: <span className="font-mono text-gray-700 dark:text-gray-300">{record.farmerId}</span> | Aadhaar: <span className="font-mono text-gray-700 dark:text-gray-300">{record.beneficiaryAdhaar}</span>
                                                                            </div>
                                                                            <div className="text-[10px] text-gray-800 dark:text-gray-200 font-black">
                                                                                {record.beneficiaryName} · Head: {record.hhHeadName} ({record.age}y, {record.gender}) · Ph: {record.phoneNumber}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <div className="space-y-1">
                                                                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider text-white inline-block ${record.status === 'Completed' ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                                                                                    {record.status}
                                                                                </span>
                                                                                {record.status !== 'Completed' && record.reason && (
                                                                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 italic font-medium">Reason: {record.reason}</p>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-xs font-bold text-indigo-600">{record.submitter}</td>
                                                                        <td className="px-6 py-4">
                                                                            <div className="flex justify-center">
                                                                                {record.photo ? (
                                                                                    <div 
                                                                                        className="w-10 h-10 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 cursor-pointer hover:scale-110 transition-transform shadow-sm"
                                                                                        onClick={() => setPreviewImage(record.photo)}
                                                                                    >
                                                                                        <img src={record.photo} alt="" className="w-full h-full object-cover" />
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-gray-300 text-[10px]">None</span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            
            </>
            )}

            
            {/* TAB 3: GENERATED ACKNOWLEDGEMENTS VIEW */}
            {activeTab === "letters" && (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                Generated Acknowledgement Records
                            </h3>
                            <p className="text-xs text-gray-500 font-medium">
                                Official Telugu letters generated with Google Docs letterhead
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-700 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                                    <th className="py-4 px-6">Beneficiary Name</th>
                                    <th className="py-4 px-6">Beneficiary ID</th>
                                    <th className="py-4 px-6">Activity</th>
                                    <th className="py-4 px-6">Village / GP</th>
                                    <th className="py-4 px-6">Generated Letter</th>
                                    <th className="py-4 px-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-xs font-medium">
                                {eligibleBeneficiaries.slice(0, 15).map(item => (
                                    <tr key={item.id || item.farmerId} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors">
                                        <td className="py-4 px-6 font-bold text-gray-900 dark:text-white">{item.beneficiaryName || "Beneficiary"}</td>
                                        <td className="py-4 px-6 font-mono text-gray-500">{item.farmerId || item.hhId}</td>
                                        <td className="py-4 px-6">
                                            <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 rounded-lg text-[10px] font-black uppercase">
                                                {item.activity}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-gray-500">{item.village} ({item.gp})</td>
                                        <td className="py-4 px-6 font-mono font-bold text-indigo-600">
                                            P1198-BHM-2026-{Math.abs((item.farmerId || item.hhId || "0").split("").reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0)).toString().substring(0,6)}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <button
                                                onClick={() => openAckLetter(item)}
                                                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 rounded-xl text-xs font-bold uppercase transition-colors flex items-center gap-1.5 ml-auto"
                                            >
                                                <Printer size={13} /> View Telugu Letter
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Beneficiary Profile Modal */}
            {selectedProfile && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedProfile(null)}>
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelectedProfile(null)} className="absolute top-6 right-6 p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 hover:text-gray-900"><X size={18} /></button>
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/40 rounded-2xl flex items-center justify-center text-indigo-600 text-xl font-black">
                                {selectedProfile.name ? selectedProfile.name.charAt(0) : 'B'}
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase">{selectedProfile.name || selectedProfile.beneficiaryName}</h2>
                                <p className="text-xs text-gray-500 font-bold">Ben ID: {selectedProfile.beneficiaryId || selectedProfile.farmerId} · Aadhaar: {selectedProfile.beneficiaryAdhaar || '-'}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl">
                            <div><span className="text-gray-400 uppercase">Cluster / Village:</span> {selectedProfile.cluster} / {selectedProfile.village} ({selectedProfile.gp})</div>
                            <div><span className="text-gray-400 uppercase">Gender / Age:</span> {selectedProfile.gender || '-'} / {selectedProfile.age || '-'}</div>
                            <div><span className="text-gray-400 uppercase">HH ID / Phone:</span> {selectedProfile.hhId || '-'} / {selectedProfile.phoneNumber || '-'}</div>
                            <div><span className="text-gray-400 uppercase">Registered Activity:</span> <span className="text-indigo-600 font-bold">{selectedProfile.activity || 'NS'}</span></div>
                        </div>
                        <div className="space-y-3">
                            <h4 className="text-xs font-black uppercase text-gray-400 tracking-widest">Activity Status & History</h4>
                            <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-gray-700 dark:text-gray-300">Activity: {selectedProfile.activity || 'NS'}</span>
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${(selectedProfile.status || '').toLowerCase().includes('complete') ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {selectedProfile.status || 'Not Started'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-500">Benefitted Date: {selectedProfile.benefitDate ? new Date(selectedProfile.benefitDate).toLocaleDateString() : '-'}</p>
                                {selectedProfile.reason && <p className="text-[11px] text-gray-500">Remarks: {selectedProfile.reason}</p>}
                                {selectedProfile.photo && (
                                    <div className="mt-2">
                                        <p className="text-[10px] font-bold text-gray-400 mb-1">Completion Photo:</p>
                                        <img src={selectedProfile.photo} alt="Completion" className="w-full h-36 object-cover rounded-xl" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                            <button onClick={() => { setAckLetterData(selectedProfile); setSelectedProfile(null); }} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase hover:bg-indigo-700 transition-colors flex items-center gap-2">
                                <Printer size={14} /> Generate Acknowledgement
                            </button>
                            <button onClick={() => setSelectedProfile(null)} className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold uppercase">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Acknowledgement Letter Modal (HDFC Bank Parivartan - WASSAN Letterhead) */}
            {ackLetterData && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setAckLetterData(null)}>
                    <div className="bg-white text-gray-900 rounded-3xl p-6 max-w-4xl w-full max-h-[92vh] overflow-y-auto space-y-4 shadow-2xl relative print:p-0 print:max-h-none print:shadow-none" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center print:hidden border-b border-gray-100 pb-3">
                            <div className="flex items-center gap-2">
                                <FileText className="text-indigo-600" size={20} />
                                <span className="text-xs font-black uppercase tracking-wider text-gray-700">Official Telugu Letterhead Preview</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => window.print()} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase flex items-center gap-2 hover:bg-indigo-700 shadow-md">
                                    <Printer size={14} /> Print / Download PDF
                                </button>
                                <button onClick={() => setAckLetterData(null)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:text-gray-900"><X size={18} /></button>
                            </div>
                        </div>

                        {/* Letterhead Container with Header, Content and Footer */}
                        <div className="mx-auto bg-white border border-gray-300 rounded-xl shadow-lg flex flex-col justify-between overflow-hidden print:border-none print:shadow-none print:m-0" style={{ width: "100%", maxWidth: "800px", minHeight: "1120px" }}>
                            {/* 1. Official Google Docs Letterhead Header */}
                            <div className="w-full bg-white">
                                <img 
                                    src="/letterhead_header.png" 
                                    alt="HDFC Bank Parivartan – WASSAN Letterhead" 
                                    className="w-full block select-none" 
                                />
                            </div>

                            {/* 2. Letter Content Area */}
                            <div className="p-8 py-3 space-y-4 text-gray-900 font-sans flex-1">
                                {/* Ack Number and Date Header */}
                                <div className="flex justify-between items-center text-xs font-bold border-b border-gray-300 pb-2">
                                    <span className="font-mono text-indigo-900 font-black">
                                        రసీదు సంఖ్య (ACK NO): P1198-BHM-2026-{Math.abs((ackLetterData.beneficiaryId || ackLetterData.farmerId || '0').split('').reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0)).toString().substring(0,6)}
                                    </span>
                                    <span>తేదీ (Date): {new Date().toLocaleDateString("te-IN")}</span>
                                </div>

                                {/* Telugu Letter Title */}
                                <div className="text-center space-y-0.5">
                                    <h2 className="text-lg font-black text-gray-900 tracking-wide">
                                        వస్తువుల స్వీకరణ, పనుల నిర్మాణం పూర్తి మరియు ఫోటోగ్రఫీ సమ్మతి పత్రం
                                    </h2>
                                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                                        HDFC Bank Parivartan – WASSAN Livelihood Initiative (Project Bhamini-P1198)
                                    </p>
                                </div>

                                {/* Beneficiary Information Grid */}
                                <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50/80 p-3 rounded-xl border border-gray-200">
                                    <div><span className="font-bold text-gray-600">లబ్ధిదారుని పేరు (Name):</span> <span className="font-black text-gray-900">{ackLetterData.beneficiaryName || ackLetterData.name}</span></div>
                                    <div><span className="font-bold text-gray-600">లబ్ధిదారుని ఐడి (Beneficiary ID):</span> <span className="font-mono font-bold text-gray-900">{ackLetterData.beneficiaryId || ackLetterData.farmerId}</span></div>
                                    <div><span className="font-bold text-gray-600">గ్రామం / పంచాయతీ (Village/GP):</span> <span className="font-bold text-gray-900">{ackLetterData.village} / {ackLetterData.gp}</span></div>
                                    <div><span className="font-bold text-gray-600">క్లస్టర్ (Cluster):</span> <span className="font-bold text-gray-900">{ackLetterData.cluster}</span></div>
                                    <div><span className="font-bold text-gray-600">కార్యాచరణ (Activity Name):</span> <span className="font-black text-indigo-900">{ackLetterData.activity || 'NS'}</span></div>
                                    <div><span className="font-bold text-gray-600">పూర్తయిన తేదీ (Completion Date):</span> <span className="font-bold text-gray-900">{ackLetterData.benefitDate ? new Date(ackLetterData.benefitDate).toLocaleDateString() : new Date().toLocaleDateString()}</span></div>
                                </div>

                                {/* Material Details Table */}
                                <div className="space-y-1.5">
                                    <h3 className="text-[11px] font-black uppercase text-gray-800 tracking-wider">
                                        అందజేయబడిన వస్తువులు / సహాయ వివరాలు (Issued Materials & Assets)
                                    </h3>
                                    <table className="w-full text-xs border-collapse border border-gray-400 bg-white">
                                        <thead>
                                            <tr className="bg-gray-100 text-gray-900 font-black">
                                                <th className="border border-gray-400 p-2 text-center w-12">క్రమ సంఖ్య</th>
                                                <th className="border border-gray-400 p-2 text-left">వస్తువు పేరు (Material / Asset Name)</th>
                                                <th className="border border-gray-400 p-2 text-center w-20">పరిమాణం</th>
                                                <th className="border border-gray-400 p-2 text-center w-20">యూనిట్</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const mats = modalMaterials.length > 0 ? modalMaterials : getIssuedMaterials(ackLetterData);
                                                return mats.map((mat: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-gray-50/50">
                                                        <td className="border border-gray-400 p-2 text-center font-bold text-gray-700">{idx + 1}</td>
                                                        <td className="border border-gray-400 p-2">
                                                            <span className="font-bold text-gray-900 block">{mat.labelTe || mat.label}</span>
                                                            {mat.labelTe && mat.label && mat.labelTe !== mat.label && (
                                                                <span className="text-[10px] text-gray-600 block">{mat.label}</span>
                                                            )}
                                                            {(mat.code || mat.materialId) && (
                                                                <span className="text-[9px] text-indigo-700 font-mono font-medium block">
                                                                    కోడ్ / ID: {mat.code || mat.materialId} {mat.date ? `· తేదీ: ${mat.date}` : ""}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="border border-gray-400 p-2 text-center font-bold text-gray-900">{mat.count || 1}</td>
                                                        <td className="border border-gray-400 p-2 text-center text-gray-700 font-medium">{mat.unit || "Unit"}</td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Beneficiary Acknowledgement & Declarations (All 3 Key Points) */}
                                <div className="text-xs space-y-2 bg-gray-50/90 p-3.5 rounded-xl border border-gray-200">
                                    <h4 className="text-[11px] font-black uppercase text-indigo-950 tracking-wider">
                                        లబ్ధిదారుని స్వీకృతి & ధృవీకరణ పత్రం (Beneficiary Acknowledgement & Declarations)
                                    </h4>
                                    
                                    {/* Point 1: Receipt of Materials */}
                                    <div className="flex items-start gap-2">
                                        <span className="font-bold text-indigo-700">1.</span>
                                        <p className="leading-snug">
                                            <strong>వస్తువుల స్వీకరణ (Receipt of Materials):</strong> పైన పట్టికలో పేర్కొన్న వస్తువులు / సహాయ సామాగ్రిని నా జీవనోపాధి అభివృద్ధి కొరకు వాసన్ (WASSAN) ద్వారా సరైన స్థితిలో పూర్తిగా స్వీకరించాను.
                                        </p>
                                    </div>

                                    {/* Point 2: Construction / Installation Completion (Requested by User) */}
                                    <div className="flex items-start gap-2 bg-indigo-50/80 p-2 rounded-lg border border-indigo-200">
                                        <span className="font-black text-indigo-800">2.</span>
                                        <p className="leading-snug text-indigo-950">
                                            <strong>పనుల నిర్మాణం / సంస్థాపన పూర్తి (Completion of Work / Installation):</strong> HDFC బ్యాంక్ పరివర్తన్ (HDFC Bank Parivartan) వారి ఆర్థిక సహాయంతో, వాసన్ (WASSAN) సంస్థ ద్వారా నాకు మంజూరు చేయబడిన పనుల నిర్మాణం / వస్తువుల సంస్థాపన (Construction of work / Installation) ను నేను క్షేత్రస్థాయిలో విజయవంతంగా మరియు సంతృప్తికరంగా పూర్తి చేశానని దీనిద్వారా ధృవీకరిస్తున్నాను / అంగీకరిస్తున్నాను.
                                        </p>
                                    </div>

                                    {/* Point 3: Photography Consent */}
                                    <div className="flex items-start gap-2 pt-1 border-t border-gray-200">
                                        <span className="font-bold text-gray-700">3.</span>
                                        <div className="space-y-1">
                                            <p className="leading-snug text-[11px] text-gray-700">
                                                <strong>ఫోటోగ్రఫీ సమ్మతి (Photography Consent):</strong> ప్రాజెక్ట్ డాక్యుమెంటేషన్, పర్యవేక్షణ కొరకు నా ఫోటో / పూర్తయిన పనుల ఫోటోల వినియోగానికి స్వచ్ఛందంగా సమ్మతిస్తున్నాను (ఫోటోగ్రఫీ సమ్మతి నిరాకరించడం వలన ప్రాజెక్ట్ ప్రయోజనాలపై ఎటువంటి ప్రభావం ఉండదు).
                                            </p>
                                            <div className="flex items-center gap-6 text-xs font-bold pt-0.5">
                                                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border border-gray-500 inline-block rounded bg-white"></span> సమ్మతిస్తున్నాను (Yes)</span>
                                                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border border-gray-500 inline-block rounded bg-white"></span> సమ్మతించడం లేదు (No)</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Signatures */}
                                <div className="flex justify-between items-end pt-8 pb-2 text-xs font-bold text-gray-900">
                                    <div className="text-center">
                                        <div className="h-10 border-b border-dashed border-gray-500 w-48 mb-1.5"></div>
                                        <p>లబ్ధిదారుని సంతకం / వేలిముద్ర</p>
                                        <p className="text-[9px] text-gray-500 font-normal">Beneficiary Signature / Thumb Impression</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="h-10 border-b border-dashed border-gray-500 w-48 mb-1.5"></div>
                                        <p>అధికారిక సంతకం</p>
                                        <p className="text-[9px] text-gray-500 font-normal">WASSAN / HDFC Parivartan Project Team</p>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Official Google Docs Letterhead Footer */}
                            <div className="w-full bg-white mt-auto">
                                <img 
                                    src="/letterhead_footer.png" 
                                    alt="HDFC Bank Parivartan – WASSAN Letterhead Footer" 
                                    className="w-full block select-none" 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Photo Preview Modal */}
            {previewImage && (
                <div 
                    className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-2xl p-2" onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => setPreviewImage(null)}
                            className="absolute top-4 right-4 z-10 p-3 bg-black/60 hover:bg-black text-white rounded-full transition-colors backdrop-blur-sm"
                            title="Close Preview (Esc)"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-2xl mx-auto" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityStatusDashboard;
