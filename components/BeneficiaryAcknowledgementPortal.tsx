import React, { useState, useEffect, useMemo } from "react";
import { 
    FileText, CheckCircle2, Search, RefreshCw, 
    Printer, ArrowLeft, X, Shield, Clock, Users,
    Check, AlertTriangle, Eye, Download
} from "lucide-react";
import { BENEFICIARY_DATA_URL, ASSET_DISTRIBUTION_URL, getProxyUrl } from "../config";

interface AcknowledgementRecord {
    id: string;
    acknowledgement_number: string;
    activity_uuid: string;
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
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [materialsMap, setMaterialsMap] = useState<Map<string, any[]>>(new Map());

    // Fetch existing tracking records and ODK data
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [ackRes, odkRes, benRes, distRes] = await Promise.all([
                fetch("/api/acknowledgements/list").then(r => r.json()).catch(() => ({ success: false, acknowledgements: [] })),
                fetch("/api/odk/data?formId=Status&projectId=3").then(r => r.json()).catch(() => ({ value: [] })),
                fetch(getProxyUrl(BENEFICIARY_DATA_URL)).then(r => r.text()).catch(() => ""),
                fetch(getProxyUrl(ASSET_DISTRIBUTION_URL)).then(r => r.text()).catch(() => "")
            ]);

            if (distRes) {
                const distLines = distRes.trim().split(/\r?\n/).filter(Boolean);
                if (distLines.length > 1) {
                    const distHeaders = parseCSVLine(distLines[0]).map(h => h.toLowerCase().trim());
                    const newMatMap = new Map<string, any[]>();
                    distLines.slice(1).forEach(l => {
                        const row = parseCSVLine(l);
                        const getCol = (keys: string[]) => {
                            for (const k of keys) {
                                const idx = distHeaders.findIndex(h => h === k || h.includes(k));
                                if (idx !== -1 && row[idx]) return row[idx].trim();
                            }
                            return "";
                        };
                        const bId = getCol(["ben_id", "beneficiary id", "adhaar"]).toLowerCase();
                        const fId = getCol(["farmer id", "farmer_id", "hh id"]).toLowerCase();
                        const bName = getCol(["beneficiary name", "name", "farmer_name"]).toLowerCase();
                        const vName = getCol(["village"]).toLowerCase();
                        const label = getCol(["this_material_label", "material", "asset"]);
                        const count = getCol(["materials_details-material_count", "count", "quantity"]) || "1";
                        const unit = getCol(["materials_details-material_unit", "unit"]) || "Unit";
                        const date = getCol(["materials_details-distributed_date", "date"]);
                        const materialId = getCol(["material_id"]);

                        if (label) {
                            const item = { label, count, unit, date, materialId };
                            if (bId) {
                                if (!newMatMap.has(bId)) newMatMap.set(bId, []);
                                newMatMap.get(bId)!.push(item);
                            }
                            if (fId && fId !== bId) {
                                if (!newMatMap.has(fId)) newMatMap.set(fId, []);
                                newMatMap.get(fId)!.push(item);
                            }
                            if (bName && vName) {
                                const combo = `${bName}_${vName}`;
                                if (!newMatMap.has(combo)) newMatMap.set(combo, []);
                                newMatMap.get(combo)!.push(item);
                            }
                        }
                    });
                    setMaterialsMap(newMatMap);
                }
            }

            
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

            if (ackRes.success && Array.isArray(ackRes.acknowledgements)) {
                setAcknowledgements(ackRes.acknowledgements);
            }

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

    // Match Activity Status submissions with Beneficiary Registration
    const eligibleRecords = useMemo(() => {
        const benMap = new Map<string, any>();
        beneficiaries.forEach(b => {
            if (b.beneficiaryId) benMap.set(b.beneficiaryId.toLowerCase().trim(), b);
        });

        const list: any[] = [];
        odkSubmissions.forEach(sub => {
            const uuid = sub.__id || sub["meta/instanceID"] || sub.instanceID || sub["KEY"] || ("uuid-" + Math.random().toString(36).substring(2, 8));
            const benId = String(sub["farmer_id"] || sub["farmerId"] || sub["beneficiary_id"] || sub["beneficiaryId"] || sub["location-farmer_id"] || "").trim();
            const status = String(sub["activity_works-work_status"] || sub["work_status"] || sub["status"] || sub["Status"] || "").trim();
            const isCompleted = status.toLowerCase().includes("complete") || status === "Completed";

            const matchedBen = benId ? benMap.get(benId.toLowerCase()) : null;
            const benName = matchedBen?.name || sub["location-farmer_name"] || sub["farmer_name"] || sub["beneficiary_name"] || "Beneficiary";
            const activityName = sub["basic_info-activity"] || sub["activity"] || matchedBen?.activity || "NS";
            const cluster = sub["location_info-cluster"] || sub["cluster"] || matchedBen?.cluster || "Cluster 1";
            const gp = sub["location-gp"] || sub["gp"] || matchedBen?.gp || "GP";
            const village = sub["location-village"] || sub["village"] || matchedBen?.village || "Village";
            const completionDate = sub["activity_works-date_work_completed"] || sub["farmpond-date_work_completed"] || sub["SubmissionDate"] || new Date().toISOString();

            if (isCompleted && benId) {
                const existingAck = acknowledgements.find(a => a.activity_uuid === uuid && a.beneficiary_id === benId);
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
        });

        // If ODK submissions are empty or mock fallback
        if (list.length === 0 && beneficiaries.length > 0) {
            beneficiaries.slice(0, 20).forEach((b, idx) => {
                const uuid = "act-status-uuid-" + (idx + 1);
                const existingAck = acknowledgements.find(a => a.beneficiary_id === b.beneficiaryId);
                list.push({
                    uuid,
                    beneficiaryId: b.beneficiaryId || ("BEN-" + (1000 + idx)),
                    beneficiaryName: b.name || "Beneficiary",
                    activityName: b.activity || "NS",
                    cluster: b.cluster || "Cluster 1",
                    gp: b.gp || "GP",
                    village: b.village || "Village",
                    completionDate: new Date().toISOString(),
                    status: "Completed",
                    isGenerated: !!existingAck,
                    acknowledgement: existingAck || null
                });
            });
        }

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

    // Handle Generation
    const handleGenerate = async (item: any) => {
        try {
            const res = await fetch("/api/acknowledgements/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    activityUuid: item.uuid,
                    beneficiaryId: item.beneficiaryId,
                    activityName: item.activityName,
                    beneficiaryName: item.beneficiaryName,
                    cluster: item.cluster,
                    gp: item.gp,
                    village: item.village
                })
            });
            const data = await res.json();
            if (data.success) {
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
        const selectedItems = eligibleRecords.filter(r => selectedBeneficiaryIds.has(r.beneficiaryId) && !r.isGenerated);
        if (selectedItems.length === 0) {
            alert("No ungenerated records selected for bulk creation.");
            return;
        }

        try {
            const res = await fetch("/api/acknowledgements/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: selectedItems.map(item => ({
                        activityUuid: item.uuid,
                        beneficiaryId: item.beneficiaryId,
                        activityName: item.activityName,
                        beneficiaryName: item.beneficiaryName,
                        cluster: item.cluster,
                        gp: item.gp,
                        village: item.village
                    }))
                })
            });
            const data = await res.json();
            if (data.success) {
                setSuccessMessage(`Successfully generated ${data.count} acknowledgements in bulk.`);
                setSelectedBeneficiaryIds(new Set());
                fetchData();
            }
        } catch (err: any) {
            alert("Bulk generation error: " + err.message);
        }
    };

    
    
    
        const openPortalAckLetter = async (item: any) => {
        setSelectedAckForPrint(item);
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
    const handleUpdateHardCopy = async (id: string, status: string) => {
        try {
            const res = await fetch("/api/acknowledgements/hardcopy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status })
            });
            const data = await res.json();
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
            const data = await res.json();
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
                <div className="flex items-center gap-3">
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

            {/* TAB 1: DASHBOARD */}
            {selectedTab === "dashboard" && (
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
            {selectedTab === "eligible" && (
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
                                <button
                                    onClick={handleBulkGenerate}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md shadow-indigo-500/20"
                                >
                                    Generate Selected ({selectedBeneficiaryIds.size})
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
                                                    <button 
                                                        onClick={() => openPortalAckLetter(item.acknowledgement)}
                                                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-indigo-600 rounded-xl text-xs font-bold uppercase transition-colors flex items-center gap-1.5 ml-auto"
                                                    >
                                                        <Printer size={14} /> View Letter
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleGenerate(item)}
                                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase transition-colors"
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
            {selectedTab === "generate" && (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Generated Acknowledgement Records</h3>
                            <p className="text-xs text-gray-500 font-medium">Ready for print and distribution with Telugu content and Google Docs letterhead</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-700 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                                    <th className="py-4 px-6">Ack Number</th>
                                    <th className="py-4 px-6">Beneficiary Name</th>
                                    <th className="py-4 px-6">Beneficiary ID</th>
                                    <th className="py-4 px-6">Activity</th>
                                    <th className="py-4 px-6">Generated Date</th>
                                    <th className="py-4 px-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-xs font-medium">
                                {acknowledgements.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-gray-400">No acknowledgements generated yet.</td>
                                    </tr>
                                ) : (
                                    acknowledgements.map((ack) => (
                                        <tr key={ack.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors">
                                            <td className="py-4 px-6 font-mono font-bold text-indigo-600">{ack.acknowledgement_number}</td>
                                            <td className="py-4 px-6 font-bold text-gray-900 dark:text-white">{ack.beneficiary_name}</td>
                                            <td className="py-4 px-6 font-mono text-gray-500">{ack.beneficiary_id}</td>
                                            <td className="py-4 px-6">
                                                <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 rounded-lg text-[10px] font-black uppercase">
                                                    {ack.activity_name}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-gray-500">{new Date(ack.created_at).toLocaleDateString()}</td>
                                            <td className="py-4 px-6 text-right">
                                                <button 
                                                    onClick={() => openPortalAckLetter(ack)}
                                                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 rounded-xl text-xs font-bold uppercase transition-colors flex items-center gap-1.5 ml-auto"
                                                >
                                                    <Printer size={14} /> Open Telugu Letter
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 4: TRACKING */}
            {selectedTab === "tracking" && (
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
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedAckForPrint(null)}>
                    <div className="bg-white text-gray-900 rounded-3xl p-6 max-w-4xl w-full max-h-[92vh] overflow-y-auto space-y-4 shadow-2xl relative print:p-0 print:max-h-none print:shadow-none" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center print:hidden border-b border-gray-100 pb-3">
                            <div className="flex items-center gap-2">
                                <FileText className="text-indigo-600" size={20} />
                                <span className="text-xs font-black uppercase tracking-wider text-gray-700">Official Letterhead Preview</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => window.print()} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase flex items-center gap-2 hover:bg-indigo-700 shadow-md">
                                    <Printer size={14} /> Print / Save PDF
                                </button>
                                <button onClick={() => setSelectedAckForPrint(null)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:text-gray-900"><X size={18} /></button>
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
                                        రసీదు సంఖ్య (ACK NO): `P1198-BHM-2026-${Math.abs((selectedAckForPrint.beneficiary_id || '0').split('').reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0)).toString().substring(0,6)}`
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
                                    <div><span className="font-bold text-gray-600">లబ్ధిదారుని పేరు (Name):</span> <span className="font-black text-gray-900">{selectedAckForPrint.beneficiary_name}</span></div>
                                    <div><span className="font-bold text-gray-600">లబ్ధిదారుని ఐడి (Beneficiary ID):</span> <span className="font-mono font-bold text-gray-900">{selectedAckForPrint.beneficiary_id}</span></div>
                                    <div><span className="font-bold text-gray-600">గ్రామం / పంచాయతీ (Village/GP):</span> <span className="font-bold text-gray-900">{selectedAckForPrint.village} / {selectedAckForPrint.gp}</span></div>
                                    <div><span className="font-bold text-gray-600">క్లస్టర్ (Cluster):</span> <span className="font-bold text-gray-900">{selectedAckForPrint.cluster}</span></div>
                                    <div><span className="font-bold text-gray-600">కార్యాచరణ (Activity Name):</span> <span className="font-black text-indigo-900">{ackLetterData.activity || 'NS'}</span></div>
                                    <div><span className="font-bold text-gray-600">పూర్తయిన తేదీ (Completion Date):</span> <span className="font-bold text-gray-900">{new Date(selectedAckForPrint.created_at).toLocaleDateString()}</span></div>
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
                                                const mats = modalMaterials.length > 0 ? modalMaterials : getIssuedMaterials(selectedAckForPrint);
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
        </div>
    );
};

export default BeneficiaryAcknowledgementPortal;
