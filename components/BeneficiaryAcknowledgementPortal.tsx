import { LETTERHEAD_HEADER_BASE64, LETTERHEAD_FOOTER_BASE64 } from "../utils/letterheadImages";
import { 
    printA4Letter, 
    downloadA4LetterPdf, 
    downloadCombinedA4LettersPdf, 
    downloadZipA4LettersPdf, 
    printMultipleA4Letters 
} from "../utils/printLetter";
import AcknowledgementLetterSheet from "./AcknowledgementLetterSheet";
import React, { useState, useEffect, useMemo } from "react";
import { 
    FileText, CheckCircle2, Search, RefreshCw, 
    Printer, ArrowLeft, X, Shield, Clock, Users,
    Check, AlertTriangle, Eye, Download, Archive, Layers, Code, Copy
} from "lucide-react";
import { BENEFICIARY_DATA_URL, ASSET_DISTRIBUTION_URL, ACKNOWLEDGEMENT_MAPPING_SCRIPT_URL, getProxyUrl } from "../config";
import { useAuth } from "../hooks/useAuth";

interface AcknowledgementRecord {
    id: string;
    acknowledgement_number: string;
    activity_status_UUID: string;
    beneficiary_id: string;
    activity_name: string;
    beneficiary_name: string;
    cluster: string;
    gp: string;
    village: string;
    generation_status: "PENDING" | "GENERATED" | "FAILED";
    pdf_storage_path?: string;
    pdf_version: number;
    hard_copy_status: "PENDING" | "RECEIVED" | "VERIFIED";
    received_date?: string | null;
    received_by?: string | null;
    photography_consent: "YES" | "NO" | "NOT_RECORDED";
    remarks?: string;
    created_at: string;
    updated_at: string;
}

interface BeneficiaryAcknowledgementPortalProps {
    onBack?: () => void;
}




const TELUGU_ASSET_LABELS: Record<string, string> = {
    "cement bags": "సిమెంట్ బస్తాలు (Cement Bags)",
    "j bolts (12_inc)": "జే బోల్ట్‌లు (J Bolts 12 Inch)",
    "mesh roll 4ft": "మెష్ రోల్ 4 అడుగులు (Mesh Roll 4ft)",
    "asbestos cement sheets 2m": "ఆస్బెస్టాస్ సిమెంట్ షీట్లు (Asbestos Cement Sheets 2M)",
    "ridge sheet blue sheet": "రిడ్జ్ బ్లూ షీట్ (Ridge Sheet Blue Sheet)",
    "green shaded net": "గ్రీన్ షేడ్ నెట్ (Green Shaded Net)",
    "hammer grinders": "హామర్ గ్రైండర్ ప్రాసెసింగ్ యంత్రం (Hammer Grinders)",
    "bramhastram": "బ్రహ్మాస్త్రం జీవ ద్రావణం (Bramhastram)",
    "agniastram": "అగ్నిఅస్త్రం జీవ ద్రావణం (Agniastram)",
    "panchagavya": "పంచగవ్య జీవ ద్రావణం (Panchagavya)",
    "bio stimulant": "బయో స్టిమ్యులెంట్ (Bio Stimulant)",
    "seeds": "నాణ్యమైన విత్తనాలు (Quality Seeds)"
};

const ACTIVITY_ASSET_CATALOG: Record<string, { label: string; labelTe: string; unit: string; count: number }[]> = {
    "ns": [
        { label: "Cement Bags", labelTe: "సిమెంట్ బస్తాలు (Cement Bags)", unit: "Number", count: 2 },
        { label: "J Bolts (12_Inc)", labelTe: "జే బోల్ట్‌లు (J Bolts 12 Inch)", unit: "Number", count: 12 },
        { label: "Mesh Roll 4ft", labelTe: "మెష్ రోల్ 4 అడుగులు (Mesh Roll 4ft)", unit: "Number", count: 1 },
        { label: "Asbestos Cement Sheets 2M", labelTe: "ఆస్బెస్టాస్ సిమెంట్ షీట్లు (Asbestos Sheets 2M)", unit: "Number", count: 6 },
        { label: "Ridge sheet Blue Sheet", labelTe: "రిడ్జ్ బ్లూ షీట్ (Ridge Sheet)", unit: "sqft", count: 10 },
        { label: "Green Shaded net", labelTe: "గ్రీన్ షేడ్ నెట్ (Green Shaded Net)", unit: "Meters", count: 40 }
    ],
    "elevated goat shed": [
        { label: "Elevated Goat Shed Infrastructure & Wooden Slats", labelTe: "ఎలివేటెడ్ మేకల షెడ్ చెక్క పలకల నిర్మాణం", unit: "Shed Unit", count: 1 },
        { label: "Fodder Feeder & Water Trough Setup", labelTe: "మేత & నీటి తొట్టెల అమరిక", unit: "Set", count: 1 }
    ],
    "goat": [
        { label: "Elevated Goat Shed Infrastructure & Wooden Slats", labelTe: "ఎలివేటెడ్ మేకల షెడ్ చెక్క పలకల నిర్మాణం", unit: "Shed Unit", count: 1 },
        { label: "Fodder Feeder & Water Trough Setup", labelTe: "మేత & నీటి తొట్టెల అమరిక", unit: "Set", count: 1 }
    ],
    "eco farmpond": [
        { label: "Eco Farmpond Excavation & Inflow Silt Trap", labelTe: "సిల్ట్ ట్రాప్‌తో కూడిన రైతు కుంట నిర్మాణం", unit: "Farmpond", count: 1 },
        { label: "Outlet Spillway Stone Pitching", labelTe: "రాతి రక్షణ కట్ట మరియు అవుట్‌లెట్", unit: "Structure", count: 1 }
    ],
    "farmpond": [
        { label: "Eco Farmpond Excavation & Inflow Silt Trap", labelTe: "సిల్ట్ ట్రాప్‌తో కూడిన రైతు కుంట నిర్మాణం", unit: "Farmpond", count: 1 }
    ],
    "processing_hubs": [
        { label: "Hammer Grinder / Pulverizer Processing Machinery", labelTe: "హామర్ గ్రైండర్ ప్రాసెసింగ్ యంత్రం", unit: "Machinery Unit", count: 1 }
    ],
    "crops": [
        { label: "NPM Bio-Formulations (Bramhastram, Agniastram, Panchagavya)", labelTe: "ప్రకృతి వ్యవసాయ జీవ ద్రావణాలు (బ్రహ్మాస్త్రం, అగ్నిఅస్త్రం)", unit: "Liters", count: 10 },
        { label: "Quality Foundation Seeds Package", labelTe: "నాణ్యమైన విత్తనాల ప్యాకేజీ", unit: "Kgs", count: 5 }
    ],
    "kitchen garden": [
        { label: "Kitchen Garden Seasonal Vegetable Seeds Kit", labelTe: "కూరగాయల విత్తనాల కిట్", unit: "Kit", count: 1 },
        { label: "Bio-Nutrient Spray", labelTe: "జీవ పోషక ద్రావణం", unit: "Bottle", count: 1 }
    ],
    "biomass plantation": [
        { label: "Agro-Forestry & Biomass Saplings", labelTe: "బయోమాస్ మొక్కలు & నర్సరీ సామాగ్రి", unit: "Saplings", count: 50 }
    ],
    "vermi compost": [
        { label: "HDPE Vermi Bed Structure & Earthworm Culture", labelTe: "వర్మీ కంపోస్ట్ బెడ్ & వానపాముల యూనిట్", unit: "Unit", count: 1 }
    ],
    "livestock health": [
        { label: "Veterinary First Aid Kit & Deworming Supplements", labelTe: "పశువైద్య ప్రథమ చికిత్స కిట్ & మందులు", unit: "Kit", count: 1 }
    ]
};


const getAssetDisplayLabel = (mat: any): { title: string } => {
    const rawLabel = (mat.label || "").trim();
    const lower = rawLabel.toLowerCase();
    if (TELUGU_ASSET_LABELS[lower]) {
        return { title: TELUGU_ASSET_LABELS[lower] };
    }
    if (mat.labelTe && mat.labelTe !== rawLabel) {
        return { title: mat.labelTe };
    }
    return { title: rawLabel };
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

const safeJson = async (res: Response) => {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(text || `Server error (${res.status})`);
    }
};

const BeneficiaryAcknowledgementPortal: React.FC<BeneficiaryAcknowledgementPortalProps> = ({ onBack }) => {
    const [acknowledgements, setAcknowledgements] = useState<AcknowledgementRecord[]>([]);
    const [odkSubmissions, setOdkSubmissions] = useState<any[]>([]);
    const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCluster, setSelectedCluster] = useState("ALL");
    const [selectedActivity, setSelectedActivity] = useState("ALL");
    const [selectedHardCopy, setSelectedHardCopy] = useState("ALL");
    const [selectedTab, setSelectedTab] = useState<"dashboard" | "eligible" | "generate" | "tracking">("dashboard");
    const [selectedAckForPrint, setSelectedAckForPrint] = useState<any | null>(null);
    const [modalMaterials, setModalMaterials] = useState<any[]>([]);
    const [selectedBeneficiaryIds, setSelectedBeneficiaryIds] = useState<Set<string>>(new Set());
    const [selectedAckIds, setSelectedAckIds] = useState<Set<string>>(new Set());
    const [batchStagingItems, setBatchStagingItems] = useState<any[]>([]);
    const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; statusText: string } | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [materialsMap, setMaterialsMap] = useState<Map<string, any[]>>(new Map());
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [autoDownloadAck, setAutoDownloadAck] = useState(false);
    const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    // Fetch existing tracking records and ODK data
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const gasDirectUrl = `/api/gas-proxy?url=${encodeURIComponent(ACKNOWLEDGEMENT_MAPPING_SCRIPT_URL)}`;
            const [ackRes, mapRes, gasRes, odkRes, benRes] = await Promise.all([
                fetch("/api/acknowledgements/list").then(safeJson).catch(() => ({ success: false, acknowledgements: [] })),
                fetch("/api/acknowledgement-mapping/list").then(safeJson).catch(() => ({ success: false, records: [] })),
                fetch(gasDirectUrl).then(safeJson).catch(() => ({ success: false, records: [] })),
                fetch("/api/odk/data?formId=Status&projectId=3").then(safeJson).catch(() => ({ value: [] })),
                fetch(getProxyUrl(BENEFICIARY_DATA_URL)).then(r => r.text()).catch(() => "")
            ]);

            // Preload complete materials map from server
            try {
                const matAllRes = await fetch("/api/materials/all").then(safeJson).catch(() => ({ success: false, map: {} }));
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

            const existingAcks = ackRes.success && Array.isArray(ackRes.acknowledgements) ? ackRes.acknowledgements : [];
            const mappedRecords = [
                ...(mapRes.success && Array.isArray(mapRes.records) ? mapRes.records : []),
                ...(gasRes.success && Array.isArray(gasRes.records) ? gasRes.records : [])
            ];

            const mergedAcks = [...existingAcks];
            for (const m of mappedRecords) {
                if (m.acknowledgementId && m.uuid) {
                    const alreadyExists = mergedAcks.some(a => 
                        a.acknowledgement_number === m.acknowledgementId || a.activity_status_UUID === m.uuid
                    );
                    if (!alreadyExists) {
                        mergedAcks.push({
                            id: m.uuid || m.acknowledgementId,
                            acknowledgement_number: m.acknowledgementId,
                            activity_status_UUID: m.uuid,
                            beneficiary_id: m.beneficiaryId || '-',
                            activity_name: m.activity || '-',
                            beneficiary_name: m.beneficiaryName || 'Beneficiary',
                            cluster: m.cluster || '-',
                            gp: m.gp || '-',
                            village: m.village || '-',
                            generation_status: "GENERATED",
                            pdf_version: 1,
                            hard_copy_status: "PENDING",
                            photography_consent: "NOT_RECORDED",
                            remarks: m.remarks || 'Synced from Ack_UUID_Mapping',
                            created_at: m.timestamp || new Date().toISOString(),
                            updated_at: m.timestamp || new Date().toISOString()
                        });
                    }
                }
            }
            setAcknowledgements(mergedAcks);

            const rawOdk = odkRes.value || (Array.isArray(odkRes) ? odkRes : []);
            setOdkSubmissions(rawOdk);

            if (benRes) {
                const lines = benRes.trim().split("\n");
                if (lines.length > 1) {
                    const headers = lines[0].split(",").map((h: string) => h.toLowerCase().trim().replace(/^"|"$/g, ""));
                    const parsed = lines.slice(1).map((l: string) => {
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
                            cluster: get(["cluster", "location_info/cluster"]),
                            gp: get(["gp", "location-gp"]),
                            village: get(["village", "location-village"]),
                            activity: get(["activity", "activity_registration-activity"]) || "NS",
                            fatherSpouse: get(["father/spouse", "location-father_or_spouse_name", "hh head"])
                        };
                    }).filter((b: any) => b.beneficiaryId || b.name);
                    setBeneficiaries(parsed);
                }
            }
        } catch (err: any) {
            setError(err.message || "Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Match Activity Status submissions with Beneficiary Registration where status is completed
    const eligibleRecords = useMemo(() => {
        const benMap = new Map<string, any>();
        beneficiaries.forEach(b => {
            if (b.beneficiaryId) benMap.set(b.beneficiaryId.toLowerCase().trim(), b);
            if (b.name) benMap.set(b.name.toLowerCase().trim(), b);
        });

        const list: any[] = [];
        odkSubmissions.forEach(sub => {
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
                return '';
            };

            const uuid = sub.__id || sub["meta/instanceID"] || sub.instanceID || sub["KEY"] || ("uuid-" + Math.random().toString(36).substring(2, 8));
            const rawBenId = String(findInFlat(['farmer_id', 'farmerId', 'beneficiary_id', 'beneficiaryId', 'id', 'ben_id'])).trim();
            const rawBenName = String(findInFlat(['beneficiary_name', 'name', 'farmer_name'])).trim();
            const rawStatus = String(findInFlat(['work_status', 'status', 'completion_status', 'completed'])).trim().toLowerCase();

            const isCompleted = 
                rawStatus.includes('complete') || 
                rawStatus === 'yes' || 
                rawStatus === '1' || 
                rawStatus === 'done' || 
                rawStatus === 'true';

            const matchedBen = benMap.get(rawBenId.toLowerCase()) || benMap.get(rawBenName.toLowerCase());
            const benId = rawBenId || matchedBen?.beneficiaryId || ("BEN-" + Math.abs(uuid.split('').reduce((a: number, b: string)=>((a<<5)-a)+b.charCodeAt(0),0)).toString().substring(0,5));
            const benName = matchedBen?.name || rawBenName || 'Beneficiary';
            const activityName = String(findInFlat(['activity', 'work', 'project', 'topic']) || matchedBen?.activity || 'NS');
            const cluster = String(findInFlat(['cluster', 'zone']) || matchedBen?.cluster || 'Cluster 1');
            const gp = String(findInFlat(['gp', 'gram_panchayat', 'panchayat']) || matchedBen?.gp || 'GP');
            const village = String(findInFlat(['village', 'habitation']) || matchedBen?.village || 'Village');
            const completionDate = findInFlat(['date_work_completed', 'date', 'today', 'timestamp']) || sub.__system?.submissionDate || new Date().toISOString();

            if (isCompleted || rawStatus === '') {
                const isExplicitlyIncomplete = rawStatus.includes('not') || rawStatus.includes('incomplete') || rawStatus === 'no' || rawStatus === '0' || rawStatus === 'false';
                if (!isExplicitlyIncomplete) {
                    const existingAck = acknowledgements.find(a => a.activity_status_UUID === uuid || (a.beneficiary_id && a.beneficiary_id === benId));
                    list.push({
                        uuid,
                        beneficiaryId: benId,
                        beneficiaryName: benName,
                        activityName,
                        cluster,
                        gp,
                        village,
                        completionDate,
                        status: "Completed",
                        isGenerated: !!existingAck,
                        acknowledgement: existingAck || null
                    });
                }
            }
        });

        return list;
    }, [odkSubmissions, beneficiaries, acknowledgements]);

    const filteredEligible = useMemo(() => {
        return eligibleRecords.filter(item => {
            const matchesSearch = 
                item.beneficiaryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.beneficiaryId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.village.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCluster = selectedCluster === "ALL" || item.cluster === selectedCluster;
            const matchesActivity = selectedActivity === "ALL" || item.activityName === selectedActivity;
            return matchesSearch && matchesCluster && matchesActivity;
        });
    }, [eligibleRecords, searchQuery, selectedCluster, selectedActivity]);

    // Summary Statistics
    const stats = useMemo(() => {
        const totalEligible = eligibleRecords.length;
        const generated = acknowledgements.filter(a => a.generation_status === "GENERATED").length;
        const pendingGeneration = Math.max(0, totalEligible - generated);
        const hardCopyReceived = acknowledgements.filter(a => a.hard_copy_status === "RECEIVED").length;
        const hardCopyPending = Math.max(0, generated - hardCopyReceived);
        const consentYes = acknowledgements.filter(a => a.photography_consent === "YES").length;
        const consentNo = acknowledgements.filter(a => a.photography_consent === "NO").length;
        const consentNotRecorded = Math.max(0, generated - consentYes - consentNo);

        return {
            totalEligible,
            generated,
            pendingGeneration,
            hardCopyReceived,
            hardCopyPending,
            consentYes,
            consentNo,
            consentNotRecorded
        };
    }, [eligibleRecords, acknowledgements]);

    const [ackSearchQuery, setAckSearchQuery] = useState("");

    const filteredAcknowledgements = useMemo(() => {
        if (!ackSearchQuery) return acknowledgements;
        const q = ackSearchQuery.toLowerCase().trim();
        return acknowledgements.filter(a => 
            (a.acknowledgement_number && a.acknowledgement_number.toLowerCase().includes(q)) ||
            (a.activity_status_UUID && a.activity_status_UUID.toLowerCase().includes(q)) ||
            (a.beneficiary_id && a.beneficiary_id.toLowerCase().includes(q)) ||
            (a.beneficiary_name && a.beneficiary_name.toLowerCase().includes(q)) ||
            (a.village && a.village.toLowerCase().includes(q)) ||
            (a.activity_name && a.activity_name.toLowerCase().includes(q))
        );
    }, [acknowledgements, ackSearchQuery]);

    // Handle Generation
    const handleGenerate = async (item: any) => {
        if (!isAdminOrProject) {
            alert("Only authorized users (Admin, Project, DA) are permitted to generate acknowledgment letters.");
            return;
        }
        try {
                const currentUserName = user?.name || user?.username || 'Admin';
                const res = await fetch("/api/acknowledgements/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        activityStatusUuid: item.uuid,
                        beneficiaryId: item.beneficiaryId,
                        activityName: item.activityName,
                        beneficiaryName: item.beneficiaryName,
                        cluster: item.cluster,
                        gp: item.gp,
                        village: item.village,
                        generatedBy: currentUserName
                    })
                });
                const data = await safeJson(res);
                if (data.success) {
                    // Sync UUID <-> Acknowledgement ID mapping to tracking sheet
                    fetch("/api/acknowledgement-mapping", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            uuid: item.uuid || item.beneficiaryId,
                            acknowledgementId: data.acknowledgement.acknowledgement_number,
                            beneficiaryId: item.beneficiaryId,
                            beneficiaryName: item.beneficiaryName,
                            activityName: item.activityName,
                            cluster: item.cluster,
                            gp: item.gp,
                            village: item.village,
                            generatedBy: currentUserName
                        })
                    }).catch(e => console.warn("Mapping sync notice:", e.message));

                setSuccessMessage(`Acknowledgement generated: ${data.acknowledgement.acknowledgement_number}`);
                fetchData();
                openPortalAckLetter(data.acknowledgement);
            } else {
                alert(data.error || "Failed to generate");
            }
        } catch (err: any) {
            alert("Error: " + err.message);
        }
    };

    // Bulk Generation
    const handleBulkGenerate = async () => {
        if (!isAdminOrProject) {
            alert("Only authorized users (Admin, Project, DA) are permitted to generate acknowledgment letters.");
            return;
        }
        const selectedItems = eligibleRecords.filter(r => selectedBeneficiaryIds.has(r.beneficiaryId) && !r.isGenerated);
        if (selectedItems.length === 0) {
            alert("No ungenerated records selected for bulk creation.");
            return;
        }

        try {
            const currentUserName = user?.name || user?.username || 'Admin';
            const res = await fetch("/api/acknowledgements/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: selectedItems.map(item => ({
                        activityStatusUuid: item.uuid,
                        beneficiaryId: item.beneficiaryId,
                        activityName: item.activityName,
                        beneficiaryName: item.beneficiaryName,
                        cluster: item.cluster,
                        gp: item.gp,
                        village: item.village
                    })),
                    generatedBy: currentUserName
                })
            });
            const data = await safeJson(res);
            if (data.success) {
                // Sync bulk mappings to tracking sheet
                if (Array.isArray(data.acknowledgements)) {
                    fetch("/api/acknowledgement-mapping", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            items: data.acknowledgements.map((ack: any) => ({
                                uuid: ack.activity_status_UUID || ack.beneficiary_id,
                                acknowledgementId: ack.acknowledgement_number,
                                beneficiaryId: ack.beneficiary_id,
                                beneficiaryName: ack.beneficiary_name,
                                activityName: ack.activity_name,
                                cluster: ack.cluster,
                                gp: ack.gp,
                                village: ack.village,
                                generatedBy: 'User'
                            }))
                        })
                    }).catch(e => console.warn("Bulk mapping sync notice:", e.message));
                }

                setSuccessMessage(`Successfully generated ${data.count} acknowledgements in bulk.`);
                setSelectedBeneficiaryIds(new Set());
                fetchData();
            }
        } catch (err: any) {
            alert("Bulk generation error: " + err.message);
        }
    };

    const handleBatchDownload = async (items: any[], type: 'combined' | 'zip' | 'print') => {
        if (!items || items.length === 0) return;
        setBatchProgress({ current: 0, total: items.length, statusText: 'Resolving materials & asset catalogs...' });

        const resolvedItems = await Promise.all(items.map(async (item) => {
            let mats = getIssuedMaterials(item);
            if (!mats || mats.length === 0) {
                try {
                    const benId = item.beneficiary_id || item.beneficiaryId || "";
                    const farmerId = item.farmerId || item.hhId || "";
                    const bName = item.beneficiary_name || item.beneficiaryName || "";
                    const vName = item.village || "";
                    const params = new URLSearchParams({ beneficiaryId: benId, farmerId, hhId: item.hhId || "", name: bName, village: vName });
                    const res = await fetch(`/api/materials/query?${params.toString()}`);
                    const data = await safeJson(res);
                    if (data.success && Array.isArray(data.materials) && data.materials.length > 0) {
                        mats = data.materials;
                    }
                } catch {
                    // ignore
                }
            }
            if (!mats || mats.length === 0) {
                const actKey = String(item.activity_name || item.activityName || item.activity || "ns").toLowerCase().trim();
                let catalogKey = "ns";
                if (actKey.includes("goat") || actKey.includes("shed")) catalogKey = "elevated goat shed";
                else if (actKey.includes("farmpond") || actKey.includes("rk")) catalogKey = "eco farmpond";
                else if (actKey.includes("processing") || actKey.includes("hub") || actKey.includes("hammer")) catalogKey = "processing_hubs";
                else if (actKey.includes("crop") || actKey.includes("seed") || actKey.includes("npm")) catalogKey = "crops";
                else if (actKey.includes("kitchen")) catalogKey = "kitchen garden";
                else if (actKey.includes("biomass")) catalogKey = "biomass plantation";
                else if (actKey.includes("vermi")) catalogKey = "vermi compost";
                else if (actKey.includes("livestock")) catalogKey = "livestock health";
                mats = ACTIVITY_ASSET_CATALOG[catalogKey] || ACTIVITY_ASSET_CATALOG["ns"];
            }
            return {
                ...item,
                materials: mats
            };
        }));

        setBatchStagingItems(resolvedItems);
        setBatchProgress({ current: 0, total: items.length, statusText: 'Preparing letterhead templates...' });

        // Allow React to mount staging sheets into DOM
        await new Promise(resolve => setTimeout(resolve, 400));

        const elementIds = items.map((_, idx) => `portal-batch-sheet-${idx}`);

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
            const zipItems = resolvedItems.map((item, idx) => {
                const bName = (item.beneficiary_name || item.beneficiaryName || item.name || 'beneficiary').replace(/[^a-zA-Z0-9]/g, '_');
                const ackNum = item.acknowledgement_number || `P1198-BHM-2026-${Math.abs(String(item.beneficiary_id || item.beneficiaryId || item.farmerId || '0').split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString().substring(0, 6)}`;
                return {
                    id: `portal-batch-sheet-${idx}`,
                    filename: `Acknowledgement_${ackNum}_${bName}.pdf`
                };
            });
            await downloadZipA4LettersPdf(zipItems, `Acknowledgement_Letters_${items.length}_Files_${timestamp}.zip`, (current, total) => {
                setBatchProgress({ current, total, statusText: `Compressing letter ${current} of ${total}...` });
            });
        }

        setBatchProgress(null);
        setBatchStagingItems([]);
        setSuccessMessage(`Successfully processed ${items.length} acknowledgement letters.`);
        setTimeout(() => setSuccessMessage(null), 5000);
    };

    
    
    
        const openPortalAckLetter = async (item: any, autoDownload = false) => {
        setSelectedAckForPrint(item);
        if (autoDownload) {
            setAutoDownloadAck(true);
        }
        const instantMats = getIssuedMaterials(item);
        if (instantMats && instantMats.length > 0) {
            setModalMaterials(instantMats);
        } else {
            setModalMaterials([]);
        }

        try {
            const benId = item.beneficiary_id || item.beneficiaryId || "";
            const farmerId = item.farmerId || item.hhId || "";
            const bName = item.beneficiary_name || item.beneficiaryName || item.name || "";
            const vName = item.village || "";
            const params = new URLSearchParams({
                beneficiaryId: benId,
                farmerId: farmerId,
                hhId: item.hhId || "",
                name: bName,
                village: vName
            });
            const res = await fetch(`/api/materials/query?${params.toString()}`);
            const data = await safeJson(res);
            if (data.success && Array.isArray(data.materials) && data.materials.length > 0) {
                setModalMaterials(data.materials);
            }
        } catch (e) {
            console.warn("Failed to query materials:", e);
        }
    };

    const downloadA4LetterDirect = (item: any) => {
        openPortalAckLetter(item, true);
    };

    const handleDownloadCurrentModalPdf = async () => {
        if (!selectedAckForPrint) return;
        setIsDownloadingPdf(true);
        const ackNum = selectedAckForPrint.acknowledgement_number || 'P1198';
        const bName = (selectedAckForPrint.beneficiary_name || 'beneficiary').replace(/[^a-zA-Z0-9]/g, '_');
        await downloadA4LetterPdf("portal-ack-sheet", `Acknowledgement_${ackNum}_${bName}.pdf`);
        setIsDownloadingPdf(false);
    };

    useEffect(() => {
        if (selectedAckForPrint && autoDownloadAck) {
            const timer = setTimeout(async () => {
                setIsDownloadingPdf(true);
                const ackNum = selectedAckForPrint.acknowledgement_number || 'P1198';
                const bName = (selectedAckForPrint.beneficiary_name || 'beneficiary').replace(/[^a-zA-Z0-9]/g, '_');
                await downloadA4LetterPdf("portal-ack-sheet", `Acknowledgement_${ackNum}_${bName}.pdf`);
                setIsDownloadingPdf(false);
                setAutoDownloadAck(false);
            }, 350);
            return () => clearTimeout(timer);
        }
    }, [selectedAckForPrint, autoDownloadAck]);
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

        // If not found in recorded distribution, look up from activity catalog with precise matching!
        const rawAct = String(item.activity || item.activityName || "NS").toLowerCase().trim();
        let matchedKey = "";
        if (rawAct === "ns" || rawAct.includes("nursery") || rawAct.includes("net shed") || (rawAct.includes("ns") && !rawAct.includes("nutri") && !rawAct.includes("van"))) {
            matchedKey = "ns";
        } else if (rawAct.includes("goat") || rawAct.includes("shed")) {
            matchedKey = "elevated goat shed";
        } else if (rawAct.includes("farmpond") || rawAct.includes("rk") || rawAct.includes("కుంట")) {
            matchedKey = "eco farmpond";
        } else if (rawAct.includes("processing") || rawAct.includes("hub") || rawAct.includes("hammer")) {
            matchedKey = "processing_hubs";
        } else if (rawAct.includes("crop") || rawAct.includes("seed") || rawAct.includes("npm")) {
            matchedKey = "crops";
        } else if (rawAct.includes("kitchen") || rawAct.includes("nutri") || rawAct.includes("vegetable")) {
            matchedKey = "kitchen garden";
        } else if (rawAct.includes("biomass") || rawAct.includes("plantation") || rawAct.includes("sapling")) {
            matchedKey = "biomass plantation";
        } else if (rawAct.includes("vermi") || rawAct.includes("compost")) {
            matchedKey = "vermi compost";
        } else if (rawAct.includes("livestock") || rawAct.includes("veterinary") || rawAct.includes("health")) {
            matchedKey = "livestock health";
        } else {
            for (const catKey of Object.keys(ACTIVITY_ASSET_CATALOG)) {
                if (rawAct === catKey) {
                    matchedKey = catKey;
                    break;
                }
            }
        }
        if (matchedKey && ACTIVITY_ASSET_CATALOG[matchedKey]) {
            return ACTIVITY_ASSET_CATALOG[matchedKey];
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
    const handleUpdateHardCopy = async (id: string, status: string) => {
        try {
            const res = await fetch("/api/acknowledgements/hardcopy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status })
            });
            const data = await safeJson(res);
            if (data.success) {
                setSuccessMessage("Hard-copy status updated.");
                fetchData();
            }
        } catch (err: any) {
            alert("Error: " + err.message);
        }
    };

    const handleUpdateConsent = async (id: string, consent: string) => {
        try {
            const res = await fetch("/api/acknowledgements/consent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, consent })
            });
            const data = await safeJson(res);
            if (data.success) {
                setSuccessMessage("Photography consent updated.");
                fetchData();
            }
        } catch (err: any) {
            alert("Error: " + err.message);
        }
    };

    const clustersList = useMemo(() => {
        return ["ALL", ...Array.from(new Set(eligibleRecords.map(r => r.cluster))).filter(Boolean).sort()];
    }, [eligibleRecords]);

    const activitiesList = useMemo(() => {
        return ["ALL", ...Array.from(new Set(eligibleRecords.map(r => r.activityName))).filter(Boolean).sort()];
    }, [eligibleRecords]);

    const { user } = useAuth();
    const role = user?.role?.toLowerCase()?.trim() || '';
    const isAdminOrProject = role === "admin" || role === "project" || role === "da";
    const isAdmin = role === "admin";

    if (!isAdminOrProject) {
        return (
            <div className="max-w-4xl mx-auto py-20 text-center space-y-6">
                <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Access Restricted</h1>
                <p className="text-gray-500 font-medium">The Beneficiary Acknowledgement section is restricted to 'Admin', 'Project', and 'DA' roles only.</p>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg"
                    >
                        Back to Dashboards
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-16 animate-fade-in">
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
                        <span className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.2em]">HDFC Bank Parivartan – WASSAN Project Bhamini-P1198</span>
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Beneficiary Acknowledgement & Tracking</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium max-w-2xl">
                        Generate official Telugu acknowledgement letters using original HDFC Bank Parivartan–WASSAN letterhead, track office hard-copy receipts, and manage photography consent.
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <button 
                        onClick={fetchData}
                        className="p-3 rounded-2xl bg-white dark:bg-gray-800 text-gray-400 hover:text-indigo-600 shadow-sm border border-gray-100 dark:border-gray-700 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-5"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        Refresh Data
                    </button>
                </div>
            </div>

            {/* Success Banner */}
            {successMessage && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                    <span>{successMessage}</span>
                    <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:underline">Dismiss</button>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-4 overflow-x-auto">
                {[
                    { id: "dashboard", label: "Dashboard & Metrics" },
                    { id: "eligible", label: `Eligible Beneficiaries (${eligibleRecords.length})` },
                    { id: "generate", label: `Generated Letters (${acknowledgements.length})` },
                    { id: "tracking", label: "Hard-Copy & Consent Tracking" }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setSelectedTab(tab.id as any)}
                        className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${selectedTab === tab.id ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50"}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading && (
                <div className="space-y-6 animate-pulse py-12">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-3xl p-6 h-32" />
                        ))}
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-3xl p-12 h-96 flex flex-col items-center justify-center space-y-4 shadow-sm border border-gray-100 dark:border-gray-800">
                        <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading Beneficiary Acknowledgements & Sheet Data...</p>
                    </div>
                </div>
            )}

            {/* TAB 1: DASHBOARD */}
            {!loading && selectedTab === "dashboard" && (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6">
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600"><Users className="w-6 h-6" /></div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Eligible</p>
                                <h3 className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">{stats.totalEligible}</h3>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6">
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl text-emerald-600"><CheckCircle2 className="w-6 h-6" /></div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Generated</p>
                                <h3 className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">{stats.generated}</h3>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6">
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-2xl text-amber-600"><Clock className="w-6 h-6" /></div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Pending Generation</p>
                                <h3 className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">{stats.pendingGeneration}</h3>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6">
                            <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-2xl text-purple-600"><Shield className="w-6 h-6" /></div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Hard Copies Received</p>
                                <h3 className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">{stats.hardCopyReceived}</h3>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Photography Consent Tracking</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs font-bold p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl">
                                    <span className="text-emerald-600">Consent Given (Yes)</span>
                                    <span className="tabular-nums font-black text-sm">{stats.consentYes}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl">
                                    <span className="text-rose-600">Consent Declined (No)</span>
                                    <span className="tabular-nums font-black text-sm">{stats.consentNo}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl">
                                    <span className="text-gray-400">Consent Not Recorded</span>
                                    <span className="tabular-nums font-black text-sm">{stats.consentNotRecorded}</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Signed Hard-Copy Receipts</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs font-bold p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl">
                                    <span className="text-emerald-600">Received at Field Office</span>
                                    <span className="tabular-nums font-black text-sm">{stats.hardCopyReceived}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl">
                                    <span className="text-amber-600">Pending Collection from Field</span>
                                    <span className="tabular-nums font-black text-sm">{stats.hardCopyPending}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: ELIGIBLE BENEFICIARIES */}
            {!loading && selectedTab === "eligible" && (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                        <div className="relative w-full lg:w-72">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text"
                                placeholder="Search by name, ID, village..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
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
                                    className="bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-xl text-xs font-bold border-none"
                                >
                                    {activitiesList.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                            {selectedBeneficiaryIds.size > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        onClick={handleBulkGenerate}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md flex items-center gap-1.5"
                                        title="Generate acknowledgement records"
                                    >
                                        <FileText size={13} /> Generate Selected ({selectedBeneficiaryIds.size})
                                    </button>
                                    <button
                                        onClick={() => {
                                            const selectedItems = filteredEligible
                                                .filter(r => selectedBeneficiaryIds.has(r.beneficiaryId))
                                                .map(r => r.acknowledgement || {
                                                    acknowledgement_number: `P1198-BHM-2026-${Math.abs(String(r.farmerId || r.beneficiaryId || '0').split('').reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0)).toString().substring(0,6)}`,
                                                    beneficiary_name: r.beneficiaryName,
                                                    beneficiary_id: r.beneficiaryId,
                                                    farmerId: r.farmerId,
                                                    hhId: r.farmerId,
                                                    village: r.village,
                                                    gp: r.gp,
                                                    cluster: r.cluster,
                                                    activity_name: r.activityName,
                                                    created_at: new Date().toISOString()
                                                });
                                            handleBatchDownload(selectedItems, 'combined');
                                        }}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md flex items-center gap-1.5"
                                        title="Download all selected letters in one multi-page PDF"
                                    >
                                        <Download size={13} /> Combined PDF ({selectedBeneficiaryIds.size})
                                    </button>
                                    <button
                                        onClick={() => {
                                            const selectedItems = filteredEligible
                                                .filter(r => selectedBeneficiaryIds.has(r.beneficiaryId))
                                                .map(r => r.acknowledgement || {
                                                    acknowledgement_number: `P1198-BHM-2026-${Math.abs(String(r.farmerId || r.beneficiaryId || '0').split('').reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0)).toString().substring(0,6)}`,
                                                    beneficiary_name: r.beneficiaryName,
                                                    beneficiary_id: r.beneficiaryId,
                                                    farmerId: r.farmerId,
                                                    hhId: r.farmerId,
                                                    village: r.village,
                                                    gp: r.gp,
                                                    cluster: r.cluster,
                                                    activity_name: r.activityName,
                                                    created_at: new Date().toISOString()
                                                });
                                            handleBatchDownload(selectedItems, 'zip');
                                        }}
                                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md flex items-center gap-1.5"
                                        title="Download all selected letters as individual PDFs in a ZIP archive"
                                    >
                                        <Archive size={13} /> ZIP ({selectedBeneficiaryIds.size})
                                    </button>
                                    <button
                                        onClick={() => {
                                            const selectedItems = filteredEligible
                                                .filter(r => selectedBeneficiaryIds.has(r.beneficiaryId))
                                                .map(r => r.acknowledgement || {
                                                    acknowledgement_number: `P1198-BHM-2026-${Math.abs(String(r.farmerId || r.beneficiaryId || '0').split('').reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0)).toString().substring(0,6)}`,
                                                    beneficiary_name: r.beneficiaryName,
                                                    beneficiary_id: r.beneficiaryId,
                                                    farmerId: r.farmerId,
                                                    hhId: r.farmerId,
                                                    village: r.village,
                                                    gp: r.gp,
                                                    cluster: r.cluster,
                                                    activity_name: r.activityName,
                                                    created_at: new Date().toISOString()
                                                });
                                            handleBatchDownload(selectedItems, 'print');
                                        }}
                                        className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5"
                                        title="Print all selected letters"
                                    >
                                        <Printer size={13} /> Print ({selectedBeneficiaryIds.size})
                                    </button>
                                    <button
                                        onClick={() => setSelectedBeneficiaryIds(new Set())}
                                        className="px-3 py-2 text-xs font-bold text-gray-400 hover:text-red-500 uppercase transition-colors"
                                    >
                                        Clear
                                    </button>
                                </div>
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
                                                    setSelectedBeneficiaryIds(new Set(filteredEligible.map(r => r.beneficiaryId)));
                                                } else {
                                                    setSelectedBeneficiaryIds(new Set());
                                                }
                                            }}
                                            checked={selectedBeneficiaryIds.size === filteredEligible.length && filteredEligible.length > 0}
                                            className="rounded border-gray-300"
                                        />
                                    </th>
                                    <th className="py-4 px-6">Beneficiary Name</th>
                                    <th className="py-4 px-6">Beneficiary ID</th>
                                    <th className="py-4 px-6">Activity</th>
                                    <th className="py-4 px-6">Village / GP</th>
                                    <th className="py-4 px-6">Completion Status</th>
                                    <th className="py-4 px-6 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-xs font-medium">
                                {filteredEligible.map((item) => {
                                    const isSelected = selectedBeneficiaryIds.has(item.beneficiaryId);
                                    return (
                                        <tr key={item.uuid + item.beneficiaryId} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors">
                                            <td className="py-4 px-4">
                                                <input 
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        const next = new Set(selectedBeneficiaryIds);
                                                        if (next.has(item.beneficiaryId)) next.delete(item.beneficiaryId);
                                                        else next.add(item.beneficiaryId);
                                                        setSelectedBeneficiaryIds(next);
                                                    }}
                                                    className="rounded border-gray-300"
                                                />
                                            </td>
                                            <td className="py-4 px-6 font-bold text-gray-900 dark:text-white">{item.beneficiaryName}</td>
                                            <td className="py-4 px-6 font-mono text-gray-500">{item.beneficiaryId}</td>
                                            <td className="py-4 px-6">
                                                <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 rounded-lg text-[10px] font-black uppercase">
                                                    {item.activityName}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-gray-500">{item.village} ({item.gp})</td>
                                            <td className="py-4 px-6">
                                                <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                                                    <CheckCircle2 size={14} /> Verified Completed
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                {item.isGenerated ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button 
                                                            onClick={() => openPortalAckLetter(item.acknowledgement)}
                                                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-indigo-600 rounded-xl text-xs font-bold uppercase transition-colors flex items-center gap-1.5"
                                                            title="View Telugu Letter Preview"
                                                        >
                                                            <Eye size={13} /> View Letter
                                                        </button>
                                                        <button 
                                                            onClick={() => downloadA4LetterDirect(item.acknowledgement)}
                                                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 rounded-xl text-xs font-bold uppercase transition-colors flex items-center gap-1.5 shadow-sm"
                                                            title="Download Official A4 PDF"
                                                        >
                                                            <Download size={13} /> Download PDF
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleGenerate(item)}
                                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase transition-colors shadow-sm"
                                                    >
                                                        Generate Letter
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: GENERATED LETTERS */}
            {!loading && selectedTab === "generate" && (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Generated Acknowledgement Records</h3>
                            <p className="text-xs text-gray-500 font-medium">Linked with Submission UUID & ready for download or search</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {selectedAckIds.size > 0 ? (
                                <>
                                    <button
                                        onClick={() => {
                                            const selectedItems = filteredAcknowledgements.filter(a => selectedAckIds.has(a.id));
                                            handleBatchDownload(selectedItems, 'combined');
                                        }}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md flex items-center gap-1.5"
                                        title="Download all selected letters in one multi-page PDF"
                                    >
                                        <Download size={13} /> Combined PDF ({selectedAckIds.size})
                                    </button>
                                    <button
                                        onClick={() => {
                                            const selectedItems = filteredAcknowledgements.filter(a => selectedAckIds.has(a.id));
                                            handleBatchDownload(selectedItems, 'zip');
                                        }}
                                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md flex items-center gap-1.5"
                                        title="Download all selected letters as individual PDFs in a ZIP archive"
                                    >
                                        <Archive size={13} /> ZIP ({selectedAckIds.size})
                                    </button>
                                    <button
                                        onClick={() => {
                                            const selectedItems = filteredAcknowledgements.filter(a => selectedAckIds.has(a.id));
                                            handleBatchDownload(selectedItems, 'print');
                                        }}
                                        className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5"
                                        title="Print all selected letters"
                                    >
                                        <Printer size={13} /> Print ({selectedAckIds.size})
                                    </button>
                                    <button
                                        onClick={() => setSelectedAckIds(new Set())}
                                        className="px-3 py-2 text-xs font-bold text-gray-400 hover:text-red-500 uppercase transition-colors"
                                    >
                                        Clear
                                    </button>
                                </>
                            ) : filteredAcknowledgements.length > 0 ? (
                                <>
                                    <button
                                        onClick={() => handleBatchDownload(filteredAcknowledgements, 'combined')}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md flex items-center gap-1.5"
                                        title="Download all generated letters in one multi-page PDF"
                                    >
                                        <Download size={13} /> Download All ({filteredAcknowledgements.length}) Combined PDF
                                    </button>
                                    <button
                                        onClick={() => handleBatchDownload(filteredAcknowledgements, 'zip')}
                                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md flex items-center gap-1.5"
                                        title="Download all generated letters as a ZIP file"
                                    >
                                        <Archive size={13} /> Download All ZIP
                                    </button>
                                    <span className="px-3 py-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-wider">
                                        Total: {filteredAcknowledgements.length}
                                    </span>
                                </>
                            ) : null}
                        </div>
                    </div>

                    {/* Search Bar for Searching by Acknowledgement ID or UUID */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                        <div className="relative w-full sm:w-96">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by Acknowledgement ID (P1198-...), UUID, Name, Ben ID..."
                                value={ackSearchQuery}
                                onChange={(e) => setAckSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        {ackSearchQuery && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-indigo-600 font-bold">
                                    Found {filteredAcknowledgements.length} of {acknowledgements.length} records
                                </span>
                                <button 
                                    onClick={() => setAckSearchQuery("")}
                                    className="text-xs text-gray-400 hover:text-red-500 font-bold"
                                >
                                    Clear Search
                                </button>
                            </div>
                        )}
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
                                                    setSelectedAckIds(new Set(filteredAcknowledgements.map(a => a.id)));
                                                } else {
                                                    setSelectedAckIds(new Set());
                                                }
                                            }}
                                            checked={selectedAckIds.size === filteredAcknowledgements.length && filteredAcknowledgements.length > 0}
                                            className="rounded border-gray-300"
                                        />
                                    </th>
                                    <th className="py-4 px-6">Ack Number</th>
                                    <th className="py-4 px-6">Linked UUID</th>
                                    <th className="py-4 px-6">Beneficiary Name</th>
                                    <th className="py-4 px-6">Beneficiary ID</th>
                                    <th className="py-4 px-6">Activity</th>
                                    <th className="py-4 px-6">Generated Date</th>
                                    <th className="py-4 px-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-xs font-medium">
                                {filteredAcknowledgements.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-8 text-center text-gray-400">
                                            {ackSearchQuery ? `No records found matching "${ackSearchQuery}"` : "No acknowledgements generated yet."}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAcknowledgements.map((ack) => {
                                        const isSelected = selectedAckIds.has(ack.id);
                                        return (
                                            <tr key={ack.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors">
                                                <td className="py-4 px-4">
                                                    <input 
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            const next = new Set(selectedAckIds);
                                                            if (next.has(ack.id)) next.delete(ack.id);
                                                            else next.add(ack.id);
                                                            setSelectedAckIds(next);
                                                        }}
                                                        className="rounded border-gray-300"
                                                    />
                                                </td>
                                                <td className="py-4 px-6 font-mono font-bold text-indigo-600">
                                                    <div className="flex items-center gap-1.5">
                                                        <span>{ack.acknowledgement_number}</span>
                                                        <button 
                                                            onClick={() => copyToClipboard(ack.acknowledgement_number, `ack-${ack.id}`)}
                                                            className="text-gray-400 hover:text-indigo-600 p-1 transition-colors"
                                                            title="Copy Acknowledgement Number"
                                                        >
                                                            {copiedKey === `ack-${ack.id}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 font-mono text-[11px] text-gray-500">
                                                    <div className="flex items-center gap-1.5" title={ack.activity_status_UUID || ack.beneficiary_id}>
                                                        <span className="max-w-[130px] truncate">{ack.activity_status_UUID || ack.beneficiary_id || '-'}</span>
                                                        {(ack.activity_status_UUID || ack.beneficiary_id) && (
                                                            <button 
                                                                onClick={() => copyToClipboard(ack.activity_status_UUID || ack.beneficiary_id, `uuid-${ack.id}`)}
                                                                className="text-gray-400 hover:text-indigo-600 p-1 transition-colors"
                                                                title="Copy Linked UUID"
                                                            >
                                                                {copiedKey === `uuid-${ack.id}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 font-bold text-gray-900 dark:text-white">{ack.beneficiary_name}</td>
                                                <td className="py-4 px-6 font-mono text-gray-500">{ack.beneficiary_id}</td>
                                                <td className="py-4 px-6">
                                                    <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 rounded-lg text-[10px] font-black uppercase">
                                                        {ack.activity_name}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-gray-500">{new Date(ack.created_at).toLocaleDateString()}</td>
                                                <td className="py-4 px-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button 
                                                            onClick={() => openPortalAckLetter(ack)}
                                                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-indigo-600 rounded-xl text-xs font-bold uppercase transition-colors flex items-center gap-1.5"
                                                            title="View Telugu Letter Preview"
                                                        >
                                                            <Eye size={13} /> View Letter
                                                        </button>
                                                        <button 
                                                            onClick={() => downloadA4LetterDirect(ack)}
                                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase transition-colors flex items-center gap-1.5 shadow-sm"
                                                            title="Download Official A4 PDF"
                                                        >
                                                            <Download size={13} /> Download PDF
                                                        </button>
                                                    </div>
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

            {/* TAB 4: TRACKING */}
            {!loading && selectedTab === "tracking" && (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
                    <div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Hard-Copy Office Receipt & Consent Tracker</h3>
                        <p className="text-xs text-gray-500 font-medium">Record returned signed physical copies and voluntary photography consent</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-700 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                                    <th className="py-4 px-6">Ack Number</th>
                                    <th className="py-4 px-6">Beneficiary</th>
                                    <th className="py-4 px-6">Activity</th>
                                    <th className="py-4 px-6">Hard-Copy Status</th>
                                    <th className="py-4 px-6">Photography Consent</th>
                                    <th className="py-4 px-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-xs font-medium">
                                {acknowledgements.map((ack) => (
                                    <tr key={ack.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors">
                                        <td className="py-4 px-6 font-mono font-bold text-indigo-600">{ack.acknowledgement_number}</td>
                                        <td className="py-4 px-6 font-bold text-gray-900 dark:text-white">{ack.beneficiary_name}</td>
                                        <td className="py-4 px-6">{ack.activity_name}</td>
                                        <td className="py-4 px-6">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${ack.hard_copy_status === "RECEIVED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                                {ack.hard_copy_status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <select
                                                value={ack.photography_consent}
                                                onChange={(e) => handleUpdateConsent(ack.id, e.target.value)}
                                                className="bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-xl text-xs font-bold border-none"
                                            >
                                                <option value="NOT_RECORDED">Not Recorded</option>
                                                <option value="YES">Yes</option>
                                                <option value="NO">No</option>
                                            </select>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            {ack.hard_copy_status !== "RECEIVED" ? (
                                                <button 
                                                    onClick={() => handleUpdateHardCopy(ack.id, "RECEIVED")}
                                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase transition-colors"
                                                >
                                                    Mark Hard-Copy Received
                                                </button>
                                            ) : (
                                                <span className="text-xs text-emerald-600 font-bold">Received</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Print Modal with Exact Letterhead Background from Google Docs */}
            {selectedAckForPrint && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in modal-backdrop-print" onClick={() => setSelectedAckForPrint(null)}>
                    {/* Embedded Print CSS for Guaranteed Single-Page A4 Letterhead with Header & Footer */}
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
                            .a4-content-area {
                                padding: 1.5mm 12mm 1mm 12mm !important;
                                gap: 2mm !important;
                                display: flex !important;
                                flex-direction: column !important;
                                flex: 1 !important;
                            }
                            .a4-grid {
                                padding: 2mm 3mm !important;
                                font-size: 8pt !important;
                                line-height: 1.25 !important;
                                gap: 1mm 3mm !important;
                            }
                            .a4-table th, .a4-table td {
                                padding: 1.2mm 2mm !important;
                                font-size: 8pt !important;
                                line-height: 1.2 !important;
                            }
                            .a4-decl {
                                padding: 2mm 3mm !important;
                                font-size: 8pt !important;
                                line-height: 1.2 !important;
                                gap: 1.2mm !important;
                            }
                            .a4-sig {
                                padding-top: 2.5mm !important;
                                padding-bottom: 0.5mm !important;
                                font-size: 8pt !important;
                            }
                            .a4-sig-line {
                                height: 7mm !important;
                                width: 42mm !important;
                            }
                            .a4-title h2 {
                                font-size: 10.5pt !important;
                                line-height: 1.2 !important;
                            }
                            .a4-title p {
                                font-size: 6.5pt !important;
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
                                    onClick={() => printA4Letter("portal-ack-sheet")} 
                                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold uppercase flex items-center gap-2 shadow-sm"
                                >
                                    <Printer size={14} /> Print Letter
                                </button>
                                <button onClick={() => setSelectedAckForPrint(null)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:text-gray-900"><X size={18} /></button>
                            </div>
                        </div>

                        {/* Letterhead Container with Header, Content and Footer */}
                        <div id="portal-ack-sheet" className="mx-auto bg-white border border-gray-300 rounded-xl shadow-lg flex flex-col justify-between overflow-hidden a4-print-sheet print:border-none print:shadow-none print:m-0" style={{ width: "100%", maxWidth: "794px", minHeight: "1123px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff" }}>
                            {/* 1. Official Google Docs Letterhead Header */}
                            <div className="w-full bg-white flex-shrink-0" style={{ width: "100%", margin: 0, padding: 0 }}>
                                <img 
                                    src={LETTERHEAD_HEADER_BASE64} 
                                    alt="HDFC Bank Parivartan – WASSAN Letterhead" 
                                    className="w-full block select-none" 
                                    style={{ width: "100%", maxWidth: "100%", height: "auto", display: "block", border: 0 }}
                                />
                            </div>

                            {/* 2. Letter Content Area */}
                            <div className="p-8 py-3 space-y-3.5 a4-content-area text-gray-900 font-sans flex-1" style={{ padding: "8px 45px 6px 45px", display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", boxSizing: "border-box" }}>
                                {/* Ack Number and Date Header */}
                                <div className="flex justify-between items-center text-xs font-bold border-b border-gray-300 pb-1.5" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #d1d5db", paddingBottom: "6px", fontSize: "11px" }}>
                                    <span className="font-mono text-indigo-900 font-black" style={{ fontFamily: "monospace", color: "#1e1b4b", fontWeight: 900 }}>
                                        రసీదు సంఖ్య (ACK NO): {selectedAckForPrint.acknowledgement_number}
                                    </span>
                                    <span style={{ fontSize: "11px", fontWeight: "bold" }}>తేదీ (Date): {new Date().toLocaleDateString("te-IN")}</span>
                                </div>

                                {/* Telugu Letter Title */}
                                <div className="text-center space-y-0.5 a4-title" style={{ textAlign: "center", margin: "4px 0" }}>
                                    <h2 className="text-lg font-black text-gray-900 tracking-wide" style={{ fontSize: "15px", fontWeight: 900, color: "#111827", margin: 0 }}>
                                        వస్తువుల స్వీకరణ, పనుల నిర్మాణం పూర్తి మరియు ఫోటోగ్రఫీ సమ్మతి పత్రం
                                    </h2>
                                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest" style={{ fontSize: "9px", fontWeight: "bold", color: "#4b5563", letterSpacing: "1px", margin: "2px 0 0 0", textTransform: "uppercase" }}>
                                        HDFC Bank Parivartan - P1198
                                    </p>
                                </div>

                                {/* Beneficiary Information Grid */}
                                <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50/80 p-2.5 rounded-xl border border-gray-200 a4-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 14px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "7px 12px", fontSize: "11px" }}>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>లబ్ధిదారుని పేరు (Name):</span> <span style={{ fontWeight: 900, color: "#111827", marginLeft: "4px" }}>{selectedAckForPrint.beneficiary_name}</span></div>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>గృహ ఐడి (Household ID):</span> <span style={{ fontFamily: "monospace", fontWeight: "bold", color: "#111827", marginLeft: "4px" }}>{selectedAckForPrint.farmerId || selectedAckForPrint.hhId || "-"}</span></div>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>లబ్ధిదారుని ఐడి (Beneficiary ID):</span> <span style={{ fontFamily: "monospace", fontWeight: "bold", color: "#111827", marginLeft: "4px" }}>{selectedAckForPrint.beneficiary_id || selectedAckForPrint.beneficiaryAdhaar || "-"}</span></div>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>గ్రామం / పంచాయతీ (Village/GP):</span> <span style={{ fontWeight: "bold", color: "#111827", marginLeft: "4px" }}>{selectedAckForPrint.village} / {selectedAckForPrint.gp}</span></div>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>క్లస్టర్ (Cluster):</span> <span style={{ fontWeight: "bold", color: "#111827", marginLeft: "4px" }}>{selectedAckForPrint.cluster}</span></div>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>కార్యాచరణ (Activity Name):</span> <span style={{ fontWeight: 900, color: "#312e81", marginLeft: "4px" }}>{selectedAckForPrint.activity_name || selectedAckForPrint.activity || "NS"}</span></div>
                                    <div><span style={{ fontWeight: "bold", color: "#4b5563" }}>పూర్తయిన తేదీ (Completion Date):</span> <span style={{ fontWeight: "bold", color: "#111827", marginLeft: "4px" }}>{new Date(selectedAckForPrint.created_at).toLocaleDateString()}</span></div>
                                </div>

                                {/* Material Details Table */}
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
                                            {(() => {
                                                const mats = modalMaterials.length > 0 ? modalMaterials : getIssuedMaterials(selectedAckForPrint);
                                                const rowPad = mats.length > 7 ? "2px 5px" : mats.length > 4 ? "3px 6px" : "4px 8px";
                                                const rowFontSize = mats.length > 7 ? "9.5px" : mats.length > 4 ? "10.5px" : "11px";
                                                return mats.map((mat: any, idx: number) => {
                                                    const display = getAssetDisplayLabel(mat);
                                                    return (
                                                        <tr key={idx} style={{ background: idx % 2 === 0 ? "#ffffff" : "#fcfcfd", fontSize: rowFontSize }}>
                                                            <td style={{ border: "1px solid #9ca3af", padding: rowPad, textAlign: "center", fontWeight: "bold", color: "#374151" }}>{idx + 1}</td>
                                                            <td style={{ border: "1px solid #9ca3af", padding: rowPad }}>
                                                                <span style={{ fontWeight: "bold", color: "#111827", display: "block" }}>{display.title}</span>
                                                            </td>
                                                            <td style={{ border: "1px solid #9ca3af", padding: rowPad, textAlign: "center", fontWeight: "bold", color: "#111827" }}>{mat.count || 1}</td>
                                                            <td style={{ border: "1px solid #9ca3af", padding: rowPad, textAlign: "center", color: "#374151", fontWeight: 500 }}>{mat.unit || "Unit"}</td>
                                                        </tr>
                                                    );
                                                });
                                            })()}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Beneficiary Acknowledgement & Declarations (All 3 Key Points) */}
                                <div className="text-xs bg-gray-50/90 p-2.5 rounded-xl border border-gray-200 a4-decl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "10.5px", display: "flex", flexDirection: "column", gap: "5px" }}>
                                    <h4 style={{ fontSize: "10.5px", fontWeight: 900, textTransform: "uppercase", color: "#1e1b4b", letterSpacing: "0.5px", margin: "0 0 2px 0" }}>
                                        లబ్ధిదారుని స్వీకృతి & ధృవీకరణ పత్రం (BENEFICIARY ACKNOWLEDGEMENT & DECLARATIONS)
                                    </h4>
                                    
                                    {/* Point 1: Receipt of Materials */}
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                                        <span style={{ fontWeight: "bold", color: "#4338ca" }}>1.</span>
                                        <p style={{ margin: 0, lineHeight: 1.35 }}>
                                            <strong>వస్తువుల స్వీకరణ (Receipt of Materials):</strong> పైన పట్టికలో పేర్కొన్న వస్తువులు / సహాయ సామాగ్రిని నా జీవనోపాధి అభివృద్ధి కొరకు వాసన్ (WASSAN) ద్వారా సరైన స్థితిలో పూర్తిగా స్వీకరించాను.
                                        </p>
                                    </div>

                                    {/* Point 2: Construction / Installation Completion */}
                                    <div className="a4-decl-highlight" style={{ display: "flex", alignItems: "flex-start", gap: "6px", background: "#eef2ff", padding: "5px 8px", borderRadius: "6px", border: "1px solid #c7d2fe" }}>
                                        <span style={{ fontWeight: 900, color: "#3730a3" }}>2.</span>
                                        <p style={{ margin: 0, lineHeight: 1.35, color: "#1e1b4b" }}>
                                            <strong>పనుల నిర్మాణం / సంస్థాపన పూర్తి (Completion of Work / Installation):</strong> HDFC బ్యాంక్ పరివర్తన్ (HDFC Bank Parivartan) వారి ఆర్థిక సహాయంతో, వాసన్ (WASSAN) సంస్థ ద్వారా నాకు మంజూరు చేయబడిన పనుల నిర్మాణం / వస్తువుల సంస్థాపన (Construction of work / Installation) ను నేను క్షేత్రస్థాయిలో విజయవంతంగా మరియు సంతృప్తికరంగా పూర్తి చేశానని దీనిద్వారా ధృవీకరిస్తున్నాను / అంగీకరిస్తున్నాను.
                                        </p>
                                    </div>

                                    {/* Point 3: Photography Consent */}
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", borderTop: "1px solid #e5e7eb", paddingTop: "4px" }}>
                                        <span style={{ fontWeight: "bold", color: "#4b5563" }}>3.</span>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", width: "100%" }}>
                                            <p style={{ margin: 0, lineHeight: 1.35, fontSize: "10px", color: "#374151" }}>
                                                <strong>ఫోటోగ్రఫీ సమ్మతి (Photography Consent):</strong> ప్రాజెక్ట్ డాక్యుమెంటేషన్, పర్యవేక్షణ కొరకు నా ఫోటో / పూర్తయిన పనుల ఫోటోల వినియోగానికి స్వచ్ఛందంగా సమ్మతిస్తున్నాను (ఫోటోగ్రఫీ సమ్మతి నిరాకరించడం వలన ప్రాజెక్ట్ ప్రయోజనాలపై ఎటువంటి ప్రభావం ఉండదు).
                                            </p>
                                            <div style={{ display: "flex", alignItems: "center", gap: "24px", fontSize: "10.5px", fontWeight: "bold", paddingTop: "2px" }}>
                                                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "13px", height: "13px", border: "1px solid #6b7280", display: "inline-block", borderRadius: "3px", background: "#ffffff" }}></span> సమ్మతిస్తున్నాను (Yes)</span>
                                                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "13px", height: "13px", border: "1px solid #6b7280", display: "inline-block", borderRadius: "3px", background: "#ffffff" }}></span> సమ్మతించడం లేదు (No)</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Signatures */}
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

                            {/* 3. Official Google Docs Letterhead Footer */}
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

            {/* Hidden Batch Render Staging Container */}
            {batchStagingItems.length > 0 && (
                <div 
                    id="portal-batch-render-container"
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
                            id={`portal-batch-sheet-${idx}`}
                            item={item}
                            materials={item.materials || getIssuedMaterials(item)}
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
                                Generating Acknowledgement Letters
                            </h3>
                            <p className="text-xs text-gray-500 font-medium mt-1">
                                {batchProgress.statusText || `Processing ${batchProgress.current} of ${batchProgress.total}`}
                            </p>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden p-0.5 border border-gray-200 dark:border-gray-700">
                            <div 
                                className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.round((batchProgress.current / Math.max(batchProgress.total, 1)) * 100)}%` }}
                            />
                        </div>

                        <div className="flex justify-between items-center text-xs font-mono font-bold text-gray-400">
                            <span>{batchProgress.current} / {batchProgress.total} Letters</span>
                            <span>{Math.round((batchProgress.current / Math.max(batchProgress.total, 1)) * 100)}%</span>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default BeneficiaryAcknowledgementPortal;
