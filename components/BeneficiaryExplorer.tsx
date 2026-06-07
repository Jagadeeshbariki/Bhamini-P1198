
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
    BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, 
    XAxis, YAxis, Tooltip 
} from 'recharts';
import { 
    Users, MapPin, Filter, Search, 
    Download, X, ArrowUpDown, ArrowUp,
    Activity as ActivityIcon, UserCheck,
    ChevronDown, ChevronUp, ArrowLeft
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BENEFICIARY_DATA_URL, ASSET_DISTRIBUTION_URL, MASTER_TARGETS_URL, CONTRIBUTION_DATA_URL, MATERIAL_CONTRIBUTION_URL, getProxyUrl } from '../config';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ActivityTarget {
    cluster: string;
    activity: string;
    target: number;
    contributionTarget: number;
    financialYear: string;
}

interface Asset {
    code: string;
    materialId: string;
    label: string;
    count: number;
    unit: string;
    date: string;
    distributor: string;
    photo?: string;
    parentKey?: string;
    targetContribution?: number;
}

interface Beneficiary {
    hhId: string;
    hhHeadName: string;
    activity: string;
    beneficiaryName: string;
    beneficiaryId: string;
    age: number;
    gender: string;
    phoneNumber: string;
    cluster: string;
    gp: string;
    village: string;
    assets: Asset[];
    contribution: number;
    targetContribution: number;
    financialYear?: string;
}

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#f43f5e'];

const formatDriveUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
        const idMatch = url.match(/[-\w]{25,}/);
        if (idMatch) {
            return `https://docs.google.com/uc?export=view&id=${idMatch[0]}`;
        }
    }
    return url;
};

const MoneyTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 min-w-[140px]">
                <p className="text-[10px] font-black uppercase text-gray-400 mb-2 border-b border-gray-100 dark:border-gray-700 pb-1">{data.name}</p>
                <div className="flex flex-col gap-1.5">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex justify-between items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-[9px] font-black uppercase text-gray-500 dark:text-gray-400">{entry.name}</span>
                            </div>
                            <span className="text-[10px] font-black text-gray-900 dark:text-white">
                                ₹{entry.value >= 1000 ? (entry.value / 1000).toFixed(entry.value % 1000 === 0 ? 0 : 1) + 'k' : entry.value.toLocaleString()}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700">
                <p className="text-[10px] font-black uppercase text-gray-400 mb-1">{data.name}</p>
                <div className="flex items-baseline gap-2">
                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                        {data.value.toLocaleString()}
                    </p>
                    {data.percentage !== undefined && (
                        <p className="text-[10px] font-black text-gray-400">({data.percentage.toFixed(1)}%)</p>
                    )}
                </div>
                <p className="text-[8px] font-black uppercase text-gray-400 mt-1 italic">Click to filter</p>
            </div>
        );
    }
    return null;
};

const BeneficiaryExpandedDetails: React.FC<{ b: Beneficiary, setPreviewImage: (url: string) => void, formatDriveUrl: (url: string) => string }> = ({ b, setPreviewImage, formatDriveUrl }) => {
    const totalTarget = b.targetContribution || 0;
    return (
        <div className="animate-fade-in flex flex-col gap-4">
            {/* Material Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="w-full flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-900/50">
                    <h4 className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Material Distribution</h4>
                </div>
                <div className="p-4 border-t border-gray-100 dark:border-gray-700">
                    {b.assets.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {b.assets.map((asset, idx) => (
                                    <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-2">
                                        <div className="flex justify-between items-start">
                                            <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase">{asset.label}</span>
                                            <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded text-[9px] font-black uppercase">
                                                {asset.count} {asset.unit}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[8px] font-bold text-gray-400 uppercase">{asset.date}</span>
                                            <span className="text-[8px] font-bold text-indigo-400 uppercase">{asset.distributor}</span>
                                        </div>
                                        {asset.photo && (
                                            <div 
                                                className="mt-2 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 aspect-video relative group cursor-pointer"
                                                onClick={() => {
                                                    if (asset.photo?.startsWith('http')) {
                                                        setPreviewImage(formatDriveUrl(asset.photo));
                                                    } else if (asset.parentKey && asset.photo) {
                                                        setPreviewImage(`/api/odk/image?submissionId=${encodeURIComponent(asset.parentKey!)}&filename=${encodeURIComponent(asset.photo!)}&cb=${Date.now()}`);
                                                    }
                                                }}
                                            >
                                                <img 
                                                    src={asset.photo.startsWith('http') 
                                                        ? formatDriveUrl(asset.photo) 
                                                        : `/api/odk/image?submissionId=${encodeURIComponent(asset.parentKey!)}&filename=${encodeURIComponent(asset.photo!)}`}
                                                    alt={asset.label}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1592424001806-6953dd469bd0?auto=format&fit=crop&q=80&w=400';
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center py-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                                No material distributed yet.
                            </p>
                        )}
                    </div>
                </div>

            {/* Contribution Details */}
            {(b.contribution > 0 || totalTarget > 0) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="w-full flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-900/50">
                    <h4 className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Contribution Details</h4>
                </div>
                <div className="p-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col gap-2 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg max-w-sm border border-gray-100 dark:border-gray-800">
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase">
                            <span>Activity</span>
                            <span>{b.activity}</span>
                        </div>
                        <div className="w-full h-px bg-gray-200 dark:bg-gray-700 my-1" />
                        
                        {(b.activity.toLowerCase().includes('processing') || b.activity.toLowerCase().includes('asc')) && b.assets.length > 0 && (
                            <div className="flex flex-col gap-1 mb-2">
                                <span className="text-[9px] font-black uppercase text-indigo-500 mb-1">Products Received:</span>
                                {b.assets.map((a, i) => {
                                    const itemContrib = (a.targetContribution || 0) * (a.count || 1);
                                    return (
                                        <div key={i} className="flex justify-between items-center bg-white dark:bg-gray-800 p-1.5 rounded-md border border-gray-100 dark:border-gray-700">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{a.label || a.code || 'Unknown Product'}</span>
                                                <span className="text-[8px] text-gray-500">Qty: {a.count || 1} × ₹{(a.targetContribution || 0).toLocaleString()}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-gray-900 dark:text-white">
                                                ₹{itemContrib.toLocaleString()}
                                            </span>
                                        </div>
                                    );
                                })}
                                <div className="w-full h-px bg-gray-200 dark:bg-gray-700 my-1" />
                            </div>
                        )}

                        <div className="flex justify-between items-center">
                            <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase">Overall Target</span>
                            <span className="text-[11px] font-black uppercase text-gray-700 dark:text-gray-300">
                                ₹{totalTarget.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                            <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase">Paid Contribution</span>
                            <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded text-[11px] font-black uppercase">
                                ₹{b.contribution.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            )}
        </div>
    );
};

interface BeneficiaryExplorerProps {
    onBack?: () => void;
}

const BeneficiaryExplorer: React.FC<BeneficiaryExplorerProps> = ({ onBack }) => {
    const [data, setData] = useState<Beneficiary[]>([]);
    const [targets, setTargets] = useState<ActivityTarget[]>([]);
    const [unitContributionMap, setUnitContributionMap] = useState<Map<string, number>>(new Map());
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [filterCluster, setFilterCluster] = useState('All');
    const [filterGP, setFilterGP] = useState('All');
    const [filterVillage, setFilterVillage] = useState('All');
    const [filterActivity, setFilterActivity] = useState('All');
    const [filterFinancialYear, setFilterFinancialYear] = useState('All');
    const [filterGender, setFilterGender] = useState('All');
    const [filterMaterialStatus, setFilterMaterialStatus] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Beneficiary; direction: 'asc' | 'desc' } | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setPreviewImage(null);
        };
        if (previewImage) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.body.style.overflow = 'unset';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [previewImage]);

    useEffect(() => {
        const handleScroll = () => setShowScrollTop(window.scrollY > 300);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const toggleRow = (index: number) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedRows(newExpanded);
    };

    const parseCSV = (csv: string, sourceName: string): Beneficiary[] => {
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentVal = '';
        let inQuotes = false;

        for (let i = 0; i < csv.length; i++) {
            const char = csv[i];
            const nextChar = csv[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentVal += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                currentRow.push(currentVal.trim());
                currentVal = '';
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
                if (currentVal || currentRow.length > 0) {
                    currentRow.push(currentVal.trim());
                    rows.push(currentRow);
                    currentVal = '';
                    currentRow = [];
                }
                if (char === '\r' && nextChar === '\n') i++;
            } else {
                currentVal += char;
            }
        }
        if (currentVal || currentRow.length > 0) {
            currentRow.push(currentVal.trim());
            rows.push(currentRow);
        }

        if (rows.length < 2) return [];

        const headers = rows[0];
        const normalize = (h: string) => (h || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        const normalizedHeaders = headers.map(normalize);

        const getVal = (row: string[], searchTerms: string[], allowFuzzy = false) => {
            // 1. Try exact matches first
            for (const term of searchTerms) {
                const searchNorm = normalize(term);
                const idx = normalizedHeaders.indexOf(searchNorm);
                if (idx !== -1) return (row[idx] || '').trim();
            }
            
            // 2. Try fuzzy matches only if explicitly allowed and no exact match found
            if (allowFuzzy) {
                for (const term of searchTerms) {
                    const searchNorm = normalize(term);
                    const idx = normalizedHeaders.findIndex(h => h.includes(searchNorm));
                    if (idx !== -1) return (row[idx] || '').trim();
                }
            }
            return '';
        };

        const beneficiaryMap = new Map<string, Beneficiary>();

        rows.slice(1).forEach(row => {
            if (row.length < 3) return;

            const bId = (getVal(row, ['Beneficiary ID', 'Ben_Id', 'bnf_section_-adhaar_number_', 'bnf_section-adhaar_number', 'adhaar'])).trim();
            const hhId = getVal(row, ['HH_Id', 'HH_ID', 'HHID', 'HH ID', 'Farmer ID', 'location-farmer_id', 'location-show_farmer_id', 'farmer_id']);
            
            if (!bId) return;

            const key = bId;
            
            const asset: Asset = {
                code: getVal(row, ['this_material_code'], true),
                materialId: getVal(row, ['Material_ID'], true),
                label: getVal(row, ['this_material_label'], true),
                count: parseFloat(getVal(row, ['materials_details-material_count'], true)) || 0,
                unit: getVal(row, ['materials_details-material_unit'], true),
                date: getVal(row, ['materials_details-distributed_date'], true),
                distributor: getVal(row, ['materials_details-destributor_name'], true),
                photo: getVal(row, ['Photo', 'this_material_photo', 'photo', 'image'], true),
                parentKey: getVal(row, ['PARENT_KEY', 'instanceID', 'meta-instanceID', 'KEY'], true),
            };

            if (beneficiaryMap.has(key)) {
                const existing = beneficiaryMap.get(key)!;
                if (asset.label) {
                    existing.assets.push(asset);
                }
            } else {
                beneficiaryMap.set(key, {
                    hhId: hhId,
                    hhHeadName: getVal(row, ['location-farmer_name', 'location-show_farmer_name', 'HH Head Name', 'farmer_name']),
                    activity: getVal(row, ['activity', 'activity_registration-activity', 'Activity']).replace(/^(BYP-|BFE-|AFT-)/, ''),
                    beneficiaryName: getVal(row, ['Name', 'Beneficiary name', 'bnf_section_-bnf_name_', 'bnf_section-bnf_name', 'bnf_name']),
                    beneficiaryId: bId,
                    age: parseInt(getVal(row, ['age', 'Age', 'bnf_section_-age_', 'bnf_section-age'])) || 0,
                    gender: getVal(row, ['gender', 'Gender', 'bnf_section_-gender_', 'bnf_section-gender']),
                    phoneNumber: getVal(row, ['phone number', 'Ben_phone', 'bnf_section_-phone_number_', 'bnf_section-phone_number']),
                    cluster: getVal(row, ['cluster', 'location-block', 'Cluster', 'CLUSTER']),
                    gp: getVal(row, ['GP', 'location-gp', 'gp']),
                    village: getVal(row, ['Village', 'location-village', 'village']),
                    assets: asset.label ? [asset] : [],
                    financialYear: getVal(row, ['financial_year', 'financial year', 'fy', 'year'])
                });
            }
        });

        console.log(`Parsed ${beneficiaryMap.size} unique beneficiaries from ${sourceName}`);
        return Array.from(beneficiaryMap.values());
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch Data in Parallel
                const [masterRes, distRes, targetRes, contribRes, materialMapRes] = await Promise.all([
                    fetch(getProxyUrl(`${BENEFICIARY_DATA_URL}&t=${Date.now()}`)),
                    fetch(getProxyUrl(`${ASSET_DISTRIBUTION_URL}&t=${Date.now()}`)),
                    fetch(getProxyUrl(`${MASTER_TARGETS_URL}&t=${Date.now()}`)),
                    fetch(getProxyUrl(`${CONTRIBUTION_DATA_URL}&t=${Date.now()}`)),
                    fetch(getProxyUrl(`${MATERIAL_CONTRIBUTION_URL}&t=${Date.now()}`))
                ]);

                const masterText = await masterRes.text();
                const distText = await distRes.text();
                const targetText = targetRes.ok ? await targetRes.text() : '';
                const contribText = contribRes.ok ? await contribRes.text() : '';
                const materialMapText = materialMapRes.ok ? await materialMapRes.text() : '';

                const masterData = parseCSV(masterText, 'Master List');
                const distData = parseCSV(distText, 'Distribution List');

                // Basic generic CSV parser for targets
                const parseGenericCSV = (csv: string) => {
                    const lines = csv.split(/\r?\n/).filter(line => line.trim());
                    if (lines.length < 2) return [];
                    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                    return lines.slice(1).map(line => {
                        const values: string[] = [];
                        let cur = '';
                        let inQuotes = false;
                        for (let i = 0; i < line.length; i++) {
                            if (line[i] === '"') inQuotes = !inQuotes;
                            else if (line[i] === ',' && !inQuotes) { values.push(cur.trim()); cur = ''; }
                            else cur += line[i];
                        }
                        values.push(cur.trim());
                        return headers.reduce((obj, header, index) => {
                            obj[header] = values[index] ? values[index].replace(/^"|"$/g, '') : '';
                            return obj;
                        }, {} as any);
                    });
                };

                const getContribActivityColumn = (activityName: string) => {
                    if (!activityName) return '';
                    const l = activityName.toLowerCase().replace(/_/g, ' ');
                    if (l === 'ns' || l === 'byp-ns') return 'BYP-NS';
                    if (l === 'bfe' || l === 'byp-bfe') return 'BYP-BFE';
                    if (l.includes('fisheries')) return 'Fisheries';
                    if (l === 'crops' || l.includes('crop models')) return 'Crop Models';
                    if (l === 'eco-farmpond' || l === 'eco farmpond') return 'Eco-Farmpond';
                    if (l === 'processing hubs' || l.includes('processing')) return 'Processing Hubs';
                    if (l === 'asc') return 'ASC';
                    if (l === 'goatery' || l.includes('goat shed') || l === 'goat') return 'goatery';
                    if (l === 'mobile irrigation') return 'Mobile Irrigation';
                    if (l === 'fixed irrigation' || l.includes('fixed')) return 'Fixed Irrigation';
                    if (l.includes('irrigation')) return 'Mobile Irrigation';
                    return activityName;
                };

                const rawTargets = parseGenericCSV(targetText);
                const parsedTargets = rawTargets.map((r: any) => ({
                    cluster: r['Cluster'] || r['cluster'] || '',
                    activity: getContribActivityColumn(r['activity'] || r['Activity'] || ''),
                    target: parseFloat(r['Target'] || '0') || 0,
                    contributionTarget: parseFloat(r['Contribution Target'] || '0') || 0,
                    financialYear: r['Financial Year'] || r['Financial year'] || r['financial_year'] || r['FY'] || r['financial_year '] || ''
                }));
                setTargets(parsedTargets);

                const rawContrib = parseGenericCSV(contribText);

                const contribMap = new Map<string, any>();
                rawContrib.forEach((row: any) => {
                    const id = row['Farmer ID'] || row['FARMERID'];
                    if (id) {
                        contribMap.set(id.toString().trim(), row);
                    }
                });

                const rawMaterialMap = parseGenericCSV(materialMapText);
                const assetContributionMap = new Map<string, number>();
                rawMaterialMap.forEach((row: any) => {
                    const code = row['Asset Code'] || row['Asset_code'] || row['this_material_code'] || '';
                    const contrib = parseFloat(row['Contribution']?.toString().replace(/,/g, '') || '0') || 0;
                    if (code) {
                        assetContributionMap.set(code.toString().trim().toLowerCase(), contrib);
                    }
                });

                // Merge Data
                const mergedMap = new Map<string, Beneficiary>();
                
                // Add all from master first
                masterData.forEach(b => {
                    const key = b.beneficiaryId;
                    const hhId = b.hhId;
                    if (key) {
                        const cRow = hhId ? contribMap.get(hhId.toString().trim()) : undefined;
                        let contrib = 0;
                        if (cRow) {
                            const colName = getContribActivityColumn(b.activity);
                            if (colName && cRow[colName]) {
                                contrib = parseFloat(cRow[colName]) || 0;
                            }
                        }
                        b.contribution = contrib;
                        mergedMap.set(key, b);
                    }
                });

                // Merge distribution data
                distData.forEach(b => {
                    const key = b.beneficiaryId;
                    const hhId = b.hhId;

                    b.assets.forEach(a => {
                        a.targetContribution = assetContributionMap.get(a.materialId.trim().toLowerCase()) 
                            || assetContributionMap.get(a.code.trim().toLowerCase()) 
                            || 0;
                    });

                    if (key) {
                        if (mergedMap.has(key)) {
                            const existing = mergedMap.get(key)!;
                            // Add assets from distribution list
                            if (b.assets.length > 0) {
                                // Avoid duplicates if any
                                b.assets.forEach(newAsset => {
                                    const isDuplicate = existing.assets.some(a => 
                                        a.label === newAsset.label && a.date === newAsset.date
                                    );
                                    if (!isDuplicate) existing.assets.push(newAsset);
                                });
                            }
                        } else {
                            // If not in master, add as new (though usually they should be in master)
                            const cRow = hhId ? contribMap.get(hhId.toString().trim()) : undefined;
                            let contrib = 0;
                            if (cRow) {
                                const colName = getContribActivityColumn(b.activity);
                                if (colName && cRow[colName]) {
                                    contrib = parseFloat(cRow[colName]) || 0;
                                }
                            }
                            b.contribution = contrib;
                            mergedMap.set(key, b);
                        }
                    }
                });

                // Final pass for calculating target contribution
                const activityTargetMap = new Map<string, number>();
                rawMaterialMap.forEach((row: any) => {
                    const assetName = row['Asset Name'] || row['Asset Name '] || '';
                    const contrib = parseFloat(row['Contribution']?.toString().replace(/,/g, '') || '0') || 0;
                    if (assetName && contrib > 0) {
                        activityTargetMap.set(assetName.toString().trim().toLowerCase(), contrib);
                    }
                });

                const allMerged = Array.from(mergedMap.values());
                allMerged.forEach(b => {
                    let targetContrib = 0;
                    const normalizedActivity = getContribActivityColumn(b.activity) || b.activity;
                    // Persist the normalized activity so everything aligns correctly for filtering and counting
                    b.activity = normalizedActivity;

                    const activityLower = b.activity.toLowerCase();
                    if (activityLower.includes('processing') || activityLower.includes('asc')) {
                        // calculate based on assets
                        targetContrib = b.assets.reduce((sum, a) => sum + ((a.targetContribution || 0) * (a.count || 1)), 0);
                    } else {
                        targetContrib = activityTargetMap.get(activityLower) || activityTargetMap.get(activityLower.replace(/byp-/, '')) || 0;
                        if (targetContrib === 0) {
                            if (activityLower.includes('eco-farmpond') || activityLower.includes('eco formpond')) targetContrib = activityTargetMap.get('eco-farm pond') || 10000;
                            else if (activityLower === 'ns' || activityLower === 'byp-ns') targetContrib = activityTargetMap.get('ns') || 1000;
                            else if (activityLower === 'bfe' || activityLower === 'byp-bfe') targetContrib = activityTargetMap.get('bfe') || 10000;
                            else if (activityLower.includes('goatery')) targetContrib = activityTargetMap.get('goat shed') || 6000;
                        }
                    }
                    b.targetContribution = targetContrib;
                });

                setUnitContributionMap(activityTargetMap);
                setData(allMerged);
            } catch (err) {
                console.error("Beneficiary fetch failed", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Filter Options
    const clusterOptions = useMemo(() => ['All', ...Array.from(new Set(data.map(d => (d.cluster || '').trim()))).filter(Boolean).sort()], [data]);
    const gpOptions = useMemo(() => ['All', ...Array.from(new Set(data.filter(d => filterCluster === 'All' || d.cluster === filterCluster).map(d => (d.gp || '').trim()))).filter(Boolean).sort()], [data, filterCluster]);
    const villageOptions = useMemo(() => ['All', ...Array.from(new Set(data.filter(d => (filterCluster === 'All' || d.cluster === filterCluster) && (filterGP === 'All' || d.gp === filterGP)).map(d => (d.village || '').trim()))).filter(Boolean).sort()], [data, filterCluster, filterGP]);
    const activityOptions = useMemo(() => ['All', ...Array.from(new Set(data.map(d => (d.activity || '').trim()))).filter(Boolean).sort()], [data]);
    const financialYearOptions = useMemo(() => ['All', ...Array.from(new Set(targets.map(t => (t.financialYear || '').trim()))).filter(Boolean).sort((a,b) => b.localeCompare(a))], [targets]);

    const filteredData = useMemo(() => {
        return data.filter(d => {
            const matchesCluster = filterCluster === 'All' || d.cluster === filterCluster;
            const matchesGP = filterGP === 'All' || d.gp === filterGP;
            const matchesVillage = filterVillage === 'All' || d.village === filterVillage;
            const matchesActivity = filterActivity === 'All' || d.activity === filterActivity;
            const matchesGender = filterGender === 'All' || (() => {
                const g = d.gender?.trim().toLowerCase() || 'unknown';
                const label = g.startsWith('m') ? 'Male' : g.startsWith('f') ? 'Female' : 'Other';
                return label === filterGender;
            })();
            const matchesMaterial = filterMaterialStatus === 'All' || (
                filterMaterialStatus === 'Received' ? d.assets.length > 0 : d.assets.length === 0
            );
            const matchesSearch = d.beneficiaryName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 d.beneficiaryId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 d.hhHeadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 d.hhId.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCluster && matchesGP && matchesVillage && matchesActivity && matchesGender && matchesMaterial && matchesSearch;
        });
    }, [data, filterCluster, filterGP, filterVillage, filterActivity, filterGender, filterMaterialStatus, searchQuery]);

    const sortedData = useMemo(() => {
        const sortableItems = [...filteredData];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filteredData, sortConfig]);

    const requestSort = (key: keyof Beneficiary) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const stats = useMemo(() => {
        const total = filteredData.length;
        
        const activityCounts: Record<string, number> = {};
        const materialCounts = {
            'Received': 0,
            'Not Received': 0
        };

        const clusterCounts: Record<string, number> = {};
        
        const activityContribMap: Record<string, { collected: number, target: number }> = {};
        const clusterContribMap: Record<string, { collected: number, target: number }> = {};
        const activityTargetCountMap: Record<string, number> = {};

        let totalCollectedContrib = 0;
        let totalTargetContrib = 0;
        let totalTargetCount = 0;

        targets.forEach(t => {
            const mCluster = filterCluster === 'All' || t.cluster === filterCluster;
            const targetActivityClean = t.activity.toLowerCase().replace(/_/g, ' ');
            const selectedActivityClean = filterActivity.toLowerCase().replace(/_/g, ' ');
            const mActivity = filterActivity === 'All' || targetActivityClean === selectedActivityClean;
            const mFinancialYear = filterFinancialYear === 'All' || t.financialYear === filterFinancialYear;
            
            if (mCluster && mActivity && mFinancialYear) {
                totalTargetCount += t.target;
                
                if (!activityTargetCountMap[t.activity]) activityTargetCountMap[t.activity] = 0;
                activityTargetCountMap[t.activity] += t.target;

                const activityLower = t.activity.toLowerCase();
                if (!activityLower.includes('processing') && !activityLower.includes('asc')) {
                     let unitPrice = unitContributionMap.get(activityLower) || unitContributionMap.get(activityLower.replace(/byp-/, '')) || 0;
                     if (unitPrice === 0) {
                            if (activityLower.includes('eco-farmpond') || activityLower.includes('eco formpond')) unitPrice = unitContributionMap.get('eco-farm pond') || 10000;
                            else if (activityLower === 'ns' || activityLower === 'byp-ns') unitPrice = unitContributionMap.get('ns') || 1000;
                            else if (activityLower === 'bfe' || activityLower === 'byp-bfe') unitPrice = unitContributionMap.get('bfe') || 10000;
                            else if (activityLower.includes('goatery')) unitPrice = unitContributionMap.get('goat shed') || 6000;
                     }
                     const money = t.target * unitPrice;
                     totalTargetContrib += money;

                     if (!clusterContribMap[t.cluster]) clusterContribMap[t.cluster] = { collected: 0, target: 0 };
                     clusterContribMap[t.cluster].target += money;

                     if (!activityContribMap[t.activity]) activityContribMap[t.activity] = { collected: 0, target: 0 };
                     activityContribMap[t.activity].target += money;
                }
            }
        });

        filteredData.forEach(d => {
            const act = d.activity || 'Unassigned';
            const c = d.cluster || 'Unknown';

            activityCounts[act] = (activityCounts[act] || 0) + 1;
            clusterCounts[c] = (clusterCounts[c] || 0) + 1;
            
            if (d.assets && d.assets.length > 0) {
                materialCounts['Received']++;
            } else {
                materialCounts['Not Received']++;
            }

            const activityLower = act.toLowerCase();
            if (activityLower.includes('processing') || activityLower.includes('asc')) {
                const targetMoney = d.targetContribution || 0;
                totalTargetContrib += targetMoney;
                
                if (!clusterContribMap[c]) clusterContribMap[c] = { collected: 0, target: 0 };
                clusterContribMap[c].target += targetMoney;

                if (!activityContribMap[act]) activityContribMap[act] = { collected: 0, target: 0 };
                activityContribMap[act].target += targetMoney;
            }

            const collectedMoney = d.contribution || 0;
            totalCollectedContrib += collectedMoney;

            if (!clusterContribMap[c]) clusterContribMap[c] = { collected: 0, target: 0 };
            clusterContribMap[c].collected += collectedMoney;

            if (!activityContribMap[act]) activityContribMap[act] = { collected: 0, target: 0 };
            activityContribMap[act].collected += collectedMoney;
        });

        const allActivities = new Set([...Object.keys(activityCounts), ...Object.keys(activityTargetCountMap)]);

        const activityData = Array.from(allActivities)
            .map(name => ({ 
                name, 
                value: activityCounts[name] || 0, // number of beneficiaries (achievement count)
                targetCount: activityTargetCountMap[name] || 0, // target count from sheet
                target: activityContribMap[name]?.target || 0, // money
                collected: activityContribMap[name]?.collected || 0, // money
                percentage: total > 0 ? ((activityCounts[name] || 0) / total) * 100 : 0
            }))
            .sort((a, b) => b.value - a.value);

        const clusterData = Object.entries(clusterCounts)
            .map(([name, value]) => ({
                name,
                value,
                target: clusterContribMap[name]?.target || 0,
                collected: clusterContribMap[name]?.collected || 0,
                percentage: total > 0 ? (value / total) * 100 : 0
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const materialData = [
            { name: 'Received', value: materialCounts['Received'], percentage: total > 0 ? (materialCounts['Received'] / total) * 100 : 0 },
            { name: 'Not Received', value: materialCounts['Not Received'], percentage: total > 0 ? (materialCounts['Not Received'] / total) * 100 : 0 }
        ];

        const genderCounts: Record<string, number> = {};
        filteredData.forEach(d => {
            const g = d.gender?.trim().toLowerCase() || 'unknown';
            const label = g.startsWith('m') ? 'Male' : g.startsWith('f') ? 'Female' : 'Other';
            genderCounts[label] = (genderCounts[label] || 0) + 1;
        });

        const genderData = Object.entries(genderCounts).map(([name, value]) => ({
            name,
            value,
            percentage: total > 0 ? (value / total) * 100 : 0
        }));

        const averageAge = total > 0 ? filteredData.reduce((acc, d) => acc + d.age, 0) / total : 0;
        const uniqueVillages = new Set(filteredData.map(d => d.village)).size;
        const uniqueGPs = new Set(filteredData.map(d => d.gp)).size;

        return { total, totalTarget: totalTargetCount, totalCollectedContrib, totalTargetContrib, activityData, genderData, averageAge, uniqueVillages, uniqueGPs, clusterData, materialData };
    }, [filteredData, targets, filterCluster, filterActivity, filterFinancialYear, unitContributionMap]);

    const clearFilters = () => {
        setFilterCluster('All');
        setFilterGP('All');
        setFilterVillage('All');
        setFilterActivity('All');
        setFilterFinancialYear('All');
        setFilterGender('All');
        setFilterMaterialStatus('All');
        setSearchQuery('');
    };

    const downloadCSV = () => {
        const headers = ['HH Id', 'HH Head', 'Activity', 'Beneficiary', 'ID', 'Age', 'Gender', 'Phone', 'Village', 'GP', 'Cluster'];
        const csvContent = [
            headers.join(','),
            ...filteredData.map(b => [
                `"${b.hhId}"`, `"${b.hhHeadName}"`, `"${b.activity}"`, `"${b.beneficiaryName}"`, 
                `"${b.beneficiaryId}"`, b.age, `"${b.gender}"`, `"${b.phoneNumber}"`, 
                `"${b.village}"`, `"${b.gp}"`, `"${b.cluster}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `beneficiary_report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-pulse">
            <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="mt-6 text-xs font-black uppercase text-gray-400 tracking-[0.3em]">Syncing MIS Core...</p>
        </div>
    );

    return (
        <div className="flex flex-col gap-3 animate-fade-in pb-20">
            {onBack && (
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 transition-colors mb-4 group w-fit"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Dashboards
                </button>
            )}
            {/* 1. HEADER & GLOBAL ACTIONS */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Beneficiary Explorer</h1>
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-1">Real-time Field Intelligence & Demographics</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={downloadCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export Data
                    </button>
                    {(filterCluster !== 'All' || filterGP !== 'All' || filterVillage !== 'All' || filterActivity !== 'All' || filterFinancialYear !== 'All' || filterGender !== 'All' || filterMaterialStatus !== 'All' || searchQuery !== '') && (
                        <button 
                            onClick={clearFilters}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 hover:bg-red-100 transition-all"
                        >
                            <X className="w-3.5 h-3.5" />
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* 2. FILTERS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-2 bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">
                        <MapPin className="w-3 h-3" /> Cluster
                    </label>
                    <select value={filterCluster} onChange={e => { setFilterCluster(e.target.value); setFilterGP('All'); setFilterVillage('All'); }} className="w-full bg-gray-50 dark:bg-gray-900 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer focus:ring-2 focus:ring-indigo-500 transition-all">
                        {clusterOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">
                        <Filter className="w-3 h-3" /> GP
                    </label>
                    <select value={filterGP} onChange={e => { setFilterGP(e.target.value); setFilterVillage('All'); }} className="w-full bg-gray-50 dark:bg-gray-900 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer focus:ring-2 focus:ring-indigo-500 transition-all">
                        {gpOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">
                        <MapPin className="w-3 h-3" /> Village
                    </label>
                    <select value={filterVillage} onChange={e => setFilterVillage(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer focus:ring-2 focus:ring-indigo-500 transition-all">
                        {villageOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">
                        <ActivityIcon className="w-3 h-3" /> Activity
                    </label>
                    <select value={filterActivity} onChange={e => setFilterActivity(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer focus:ring-2 focus:ring-indigo-500 transition-all">
                        {activityOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">
                        <ActivityIcon className="w-3 h-3" /> Financial Year
                    </label>
                    <select value={filterFinancialYear} onChange={e => setFilterFinancialYear(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer focus:ring-2 focus:ring-indigo-500 transition-all">
                        {financialYearOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">
                        <ActivityIcon className="w-3 h-3" /> Material
                    </label>
                    <select value={filterMaterialStatus} onChange={e => setFilterMaterialStatus(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none cursor-pointer focus:ring-2 focus:ring-indigo-500 transition-all">
                        <option value="All">All Status</option>
                        <option value="Received">Material Received Farmer</option>
                        <option value="Not Received">No Material Received Farmers</option>
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">
                        <Search className="w-3 h-3" /> Search
                    </label>
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="NAME / ID..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-900 pl-4 pr-10 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    </div>
                </div>
            </div>

            {/* 3. ANALYTICS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-1">
                {/* Key Metrics Bento */}
                <div className="lg:col-span-3 grid grid-cols-1 gap-1">
                    <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-xl shadow-indigo-100 dark:shadow-none flex flex-col justify-between relative overflow-hidden group min-h-[120px]">
                        <Users className="absolute -right-4 -bottom-4 w-16 h-16 opacity-10 group-hover:scale-110 transition-transform duration-700" />
                        <div className="flex justify-between items-start z-10">
                            <div>
                                <p className="text-[7px] font-black uppercase opacity-60 tracking-[0.2em] mb-1">Total Beneficiaries</p>
                                <p className="text-2xl font-black tracking-tighter">{stats.total.toLocaleString()}</p>
                            </div>
                            {stats.totalTarget > 0 && (
                                <div className="text-right">
                                    <p className="text-[7px] font-black uppercase opacity-60 tracking-[0.1em] mb-1">Target</p>
                                    <p className="text-sm font-black">{stats.totalTarget.toLocaleString()}</p>
                                </div>
                            )}
                        </div>
                        <div className="mt-2 flex items-center gap-2 z-10 relative">
                            {stats.totalTarget > 0 ? (
                                <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-white transition-all duration-1000" style={{ width: `${Math.min((stats.total / stats.totalTarget) * 100, 100)}%` }} />
                                </div>
                            ) : (
                                <div className="h-1 w-6 bg-white/30 rounded-full"></div>
                            )}
                            <span className="text-[6px] font-black uppercase opacity-60">Live Registry</span>
                        </div>
                    </div>
                    <div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-xl shadow-emerald-100 dark:shadow-none flex flex-col justify-between relative overflow-hidden group min-h-[120px]">
                        <ActivityIcon className="absolute -right-4 -bottom-4 w-16 h-16 opacity-10 group-hover:scale-110 transition-transform duration-700" />
                        <div className="flex justify-between items-start z-10">
                            <div>
                                <p className="text-[7px] font-black uppercase opacity-60 tracking-[0.2em] mb-1">Total Contribution</p>
                                <p className="text-xl font-black tracking-tighter">₹{stats.totalCollectedContrib.toLocaleString()}</p>
                            </div>
                            {stats.totalTargetContrib > 0 && (
                                <div className="text-right">
                                    <p className="text-[7px] font-black uppercase opacity-60 tracking-[0.1em] mb-1">Target</p>
                                    <p className="text-sm font-black">₹{stats.totalTargetContrib >= 100000 ? (stats.totalTargetContrib / 100000).toFixed(1) + 'L' : stats.totalTargetContrib >= 1000 ? (stats.totalTargetContrib / 1000).toFixed(0) + 'k' : stats.totalTargetContrib}</p>
                                </div>
                            )}
                        </div>
                        <div className="mt-2 flex items-center gap-2 z-10 relative">
                            {stats.totalTargetContrib > 0 ? (
                                <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-white transition-all duration-1000" style={{ width: `${Math.min((stats.totalCollectedContrib / stats.totalTargetContrib) * 100, 100)}%` }} />
                                </div>
                            ) : (
                                <div className="h-1 w-6 bg-white/30 rounded-full"></div>
                            )}
                            <span className="text-[6px] font-black uppercase opacity-60">Financial</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between h-full">
                            <div>
                                <p className="text-[7px] font-black uppercase text-gray-400 tracking-widest mb-1">Avg. Age</p>
                                <p className="text-lg font-black text-gray-900 dark:text-white">{stats.averageAge.toFixed(1)}</p>
                            </div>
                            <div className="mt-0.5 text-[7px] font-black uppercase text-indigo-500">Years Old</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between h-full">
                            <div>
                                <p className="text-[7px] font-black uppercase text-gray-400 tracking-widest mb-1">Coverage</p>
                                <p className="text-lg font-black text-gray-900 dark:text-white">{stats.uniqueVillages}</p>
                            </div>
                            <div className="mt-0.5 text-[7px] font-black uppercase text-emerald-500">{stats.uniqueGPs} GPs</div>
                        </div>
                    </div>
                </div>

                {/* Activity & Cluster Distribution Column */}
                <div className="lg:col-span-5 flex flex-col gap-1">
                    {/* Activity Target vs Achievement */}
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Activity Target vs Achievement</h3>
                            <ActivityIcon className="w-3 h-3 text-indigo-500" />
                        </div>
                        <div className="flex-grow pb-1">
                            <div className="h-[380px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.activityData} margin={{ top: 30, right: 10, left: 10, bottom: 20 }}>
                                        <XAxis 
                                            dataKey="name" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 9, fontWeight: 900, fill: '#9ca3af', dy: 10 }}
                                            interval={0}
                                            angle={-45}
                                            textAnchor="end"
                                            height={110}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tickFormatter={(value) => value.toLocaleString()}
                                            tick={{ fontSize: 9, fontWeight: 900, fill: '#9ca3af' }}
                                        />
                                        <Tooltip 
                                            cursor={{ fill: 'rgba(0,0,0,0.05)' }} 
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar dataKey="value" name="Achievement Count" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="targetCount" name="Target Count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Cluster Target vs Achievement */}
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-1">
                            <h3 className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Cluster Target vs Achievement</h3>
                            <MapPin className="w-3 h-3 text-emerald-500" />
                        </div>
                        <div className="flex-grow h-[220px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.clusterData} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 9, fontWeight: 900, fill: '#9ca3af', dy: 10 }}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                                        tick={{ fontSize: 9, fontWeight: 900, fill: '#9ca3af' }}
                                    />
                                    <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                                    <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="target" name="Target" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Gender & Material Column */}
                <div className="lg:col-span-4 flex flex-col gap-1">
                    {/* Gender Split Chart */}
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-1">
                            <h3 className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Gender Split</h3>
                            <Users className="w-3 h-3 text-pink-500" />
                        </div>
                        <div className="flex-grow h-[280px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                                    <Pie
                                        data={stats.genderData}
                                        innerRadius={0}
                                        outerRadius={65}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                                        onClick={(data) => setFilterGender(data.name)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {stats.genderData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-1 flex flex-wrap justify-center gap-x-1.5 gap-y-0.5">
                            {stats.genderData.map((g, idx) => (
                                <button 
                                    key={idx} 
                                    onClick={() => setFilterGender(g.name)}
                                    className={cn(
                                        "flex items-center gap-1 px-1 py-0.5 rounded-lg transition-all",
                                        filterGender === g.name ? "bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-200" : "hover:bg-gray-50 dark:hover:bg-gray-700"
                                    )}
                                >
                                    <div className="w-1 h-1 rounded-full" style={{ background: COLORS[idx % COLORS.length] }}></div>
                                    <span className="text-[6px] font-black uppercase text-gray-500">{g.name} {g.percentage.toFixed(0)}%</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Material Distribution Chart */}
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-1">
                            <h3 className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Material Status</h3>
                            <Download className="w-3 h-3 text-amber-500" />
                        </div>
                        <div className="flex-grow h-[280px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                                    <Pie
                                        data={stats.materialData}
                                        innerRadius={0}
                                        outerRadius={65}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                                        onClick={(data) => setFilterMaterialStatus(data.name)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {stats.materialData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.name === 'Received' ? '#10b981' : '#f43f5e'} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-1 flex flex-wrap justify-center gap-x-1.5 gap-y-0.5">
                            {stats.materialData.map((m, idx) => (
                                <button 
                                    key={idx} 
                                    onClick={() => setFilterMaterialStatus(m.name)}
                                    className={cn(
                                        "flex items-center gap-1 px-1 py-0.5 rounded-lg transition-all",
                                        filterMaterialStatus === m.name ? "bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-200" : "hover:bg-gray-50 dark:hover:bg-gray-700"
                                    )}
                                >
                                    <div className="w-1 h-1 rounded-full" style={{ background: m.name === 'Received' ? '#10b981' : '#f43f5e' }}></div>
                                    <span className="text-[6px] font-black uppercase text-gray-500">{m.name}: {m.value}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. DETAILED TABLE */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-50 dark:border-gray-700 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gray-50/50 dark:bg-gray-900/20">
                    <div>
                        <h2 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">Beneficiary Registry</h2>
                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">Detailed Demographics & Activity Log</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
                        <div className="relative flex-1 sm:flex-none">
                            <input 
                                type="text" 
                                placeholder="QUICK SEARCH (NAME/ID/AADHAR)..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full sm:w-72 bg-white dark:bg-gray-800 pl-4 pr-10 py-2.5 rounded-2xl text-[10px] font-black uppercase ring-1 ring-gray-200 dark:ring-gray-700 border-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                            />
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                            <UserCheck className="w-3 h-3" />
                            {filteredData.length.toLocaleString()} Records
                        </div>
                    </div>
                </div>
                
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                                <th 
                                    className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('hhId')}
                                >
                                    <div className="flex items-center gap-2">
                                        HH ID & Head
                                        <ArrowUpDown className={cn("w-3 h-3 transition-opacity", sortConfig?.key === 'hhId' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover:opacity-50")} />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('beneficiaryId')}
                                >
                                    <div className="flex items-center gap-2">
                                        Beneficiary ID & Name
                                        <ArrowUpDown className={cn("w-3 h-3 transition-opacity", sortConfig?.key === 'beneficiaryId' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover:opacity-50")} />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('activity')}
                                >
                                    <div className="flex items-center gap-2">
                                        Activity
                                        <ArrowUpDown className={cn("w-3 h-3 transition-opacity", sortConfig?.key === 'activity' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover:opacity-50")} />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('cluster')}
                                >
                                    <div className="flex items-center gap-2">
                                        Location
                                        <ArrowUpDown className={cn("w-3 h-3 transition-opacity", sortConfig?.key === 'cluster' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover:opacity-50")} />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('age')}
                                >
                                    <div className="flex items-center gap-2">
                                        Age/Gender
                                        <ArrowUpDown className={cn("w-3 h-3 transition-opacity", sortConfig?.key === 'age' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover:opacity-50")} />
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest cursor-pointer group hover:text-indigo-500 transition-colors"
                                    onClick={() => requestSort('phoneNumber')}
                                >
                                    <div className="flex items-center gap-2">
                                        Contact
                                        <ArrowUpDown className={cn("w-3 h-3 transition-opacity", sortConfig?.key === 'phoneNumber' ? "opacity-100 text-indigo-500" : "opacity-20 group-hover:opacity-50")} />
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase text-gray-400 tracking-widest">
                                    More
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {sortedData.length > 0 ? sortedData.map((b, i) => (
                                <React.Fragment key={i}>
                                    <tr 
                                        onClick={() => toggleRow(i)}
                                        className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors group cursor-pointer"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="text-[11px] font-black text-gray-900 dark:text-white uppercase group-hover:text-indigo-600 transition-colors">{b.hhId}</div>
                                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">{b.hhHeadName}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[11px] font-black text-gray-900 dark:text-white uppercase">{b.beneficiaryId}</div>
                                            <div className="text-[9px] font-bold text-indigo-500 uppercase tracking-tighter opacity-80">{b.beneficiaryName}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[8px] font-black uppercase tracking-widest border border-indigo-100/50 dark:border-indigo-900/50">
                                                {b.activity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[11px] font-black text-gray-900 dark:text-white uppercase">{b.cluster}</div>
                                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">{b.gp}, {b.village}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-black text-gray-700 dark:text-gray-300">{b.age} Yrs</span>
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest",
                                                    b.gender?.toLowerCase().startsWith('m') 
                                                        ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                                                        : 'bg-pink-50 text-pink-600 border border-pink-100'
                                                )}>
                                                    {b.gender}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[11px] font-black text-gray-600 dark:text-gray-400 font-mono tracking-tighter">{b.phoneNumber}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button 
                                                className="flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-[9px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 group-hover:bg-indigo-600 group-hover:text-white transition-all"
                                            >
                                                {expandedRows.has(i) ? 'Less' : 'More'}
                                                {expandedRows.has(i) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedRows.has(i) && (
                                        <tr className="bg-gray-50/30 dark:bg-gray-900/20">
                                            <td colSpan={6} className="px-6 py-4">
                                                <BeneficiaryExpandedDetails b={b} setPreviewImage={setPreviewImage} formatDriveUrl={formatDriveUrl} />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                            <Search className="w-12 h-12" />
                                            <p className="text-xs font-black uppercase tracking-[0.3em]">No matching records found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View (Cards) */}
                <div className="md:hidden">
                    {sortedData.length > 0 ? (
                        <div className="divide-y divide-gray-50 dark:divide-gray-800">
                            {sortedData.map((b, i) => (
                                <div key={i} className="p-4 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                    <div className="flex justify-between items-start gap-4" onClick={() => toggleRow(i)}>
                                        <div className="space-y-2 flex-1">
                                            {/* Beneficiary Name */}
                                            <div>
                                                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Beneficiary</p>
                                                <p className="text-sm font-black text-gray-900 dark:text-white uppercase">{b.beneficiaryName}</p>
                                            </div>
                                            
                                            {/* Activity */}
                                            <div>
                                                <span className="inline-flex items-center px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-md text-[8px] font-black uppercase tracking-widest border border-indigo-100/50 dark:border-indigo-900/50">
                                                    {b.activity}
                                                </span>
                                            </div>

                                            {/* HH Head Name */}
                                            <div>
                                                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">HH Head</p>
                                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">{b.hhHeadName}</p>
                                            </div>
                                        </div>
                                        
                                        <button 
                                            className="p-2 text-gray-400 hover:text-indigo-500 transition-colors"
                                        >
                                            {expandedRows.has(i) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedRows.has(i) && (
                                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-4 animate-fade-in">
                                            <div>
                                                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">HH ID</p>
                                                <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300 font-mono">{b.hhId}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Beneficiary ID</p>
                                                <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300 font-mono">{b.beneficiaryId}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Age / Gender</p>
                                                <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{b.age} Yrs / {b.gender}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Phone</p>
                                                <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300 font-mono">{b.phoneNumber}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Location</p>
                                                <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase">{b.village}, {b.gp}, {b.cluster}</p>
                                            </div>

                                            {/* Accordions */}
                                            <div className="col-span-2 mt-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                                                <BeneficiaryExpandedDetails b={b} setPreviewImage={setPreviewImage} formatDriveUrl={formatDriveUrl} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center">
                            <div className="flex flex-col items-center gap-3 opacity-30">
                                <Search className="w-10 h-10" />
                                <p className="text-[10px] font-black uppercase tracking-[0.3em]">No records found</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; }
            `}</style>

            {previewImage && typeof document !== 'undefined' && createPortal(
                <div 
                    className="fixed inset-0 z-[999999] bg-black/95 overflow-y-auto block"
                    onClick={() => setPreviewImage(null)}
                >
                    <button 
                        onClick={() => setPreviewImage(null)}
                        className="fixed top-4 right-4 md:top-6 md:right-6 p-3 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full transition-all z-[10010] border border-gray-600 shadow-xl"
                        aria-label="Close image preview"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    
                    <div className="min-h-full w-full flex items-start justify-center p-4 pt-24 pb-20 md:p-8 md:pt-24" onClick={() => setPreviewImage(null)}>
                        <img 
                            src={previewImage} 
                            alt="Preview Full" 
                            className="w-full max-w-5xl h-auto rounded flex-shrink-0 shadow-2xl relative z-10" 
                            style={{ minHeight: '200px' }}
                            onClick={(e) => e.stopPropagation()}
                            referrerPolicy="no-referrer"
                        />
                    </div>
                </div>,
                document.body
            )}

            {/* Scroll to Top Button */}
            <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className={cn(
                    "fixed bottom-6 right-6 p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-xl transition-all duration-300 z-[99] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                    showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
                )}
                aria-label="Scroll to top"
            >
                <ArrowUp className="w-6 h-6" />
            </button>
        </div>
    );
};

export default BeneficiaryExplorer;
