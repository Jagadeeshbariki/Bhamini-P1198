
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { MIS_TARGETS_URL, ASSETS_DATA_URL, ASSET_DISTRIBUTION_URL, BENEFICIARY_DATA_URL, CONTRIBUTION_DATA_URL, BUDGET_CSV_URL } from '../config';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface TargetData {
    year: string;
    quarter: string;
    months: string;
    headCode: string;
    budgetHead: string;
    targetAmount: number;
    unitsToCover: number;
    spentAmount: number;
    unitsCovered: number;
}

const FieldMISPage: React.FC = () => {
    const [rawData, setRawData] = useState<TargetData[]>([]);
    const [assetsData, setAssetsData] = useState<any[]>([]);
    const [distributionData, setDistributionData] = useState<any[]>([]);
    const [beneficiaryData, setBeneficiaryData] = useState<any[]>([]);
    const [contributionData, setContributionData] = useState<any[]>([]);
    const [budgetData, setBudgetData] = useState<any[]>([]);
    const [selectedYear, setSelectedYear] = useState<string>('All');
    const [selectedQuarter, setSelectedQuarter] = useState<string>('All');
    const [selectedId, setSelectedId] = useState<string>('');
    const [activeTab, setActiveTab] = useState<number>(0);
    const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const parseCSV = (csv: string): TargetData[] => {
        const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 1) return [];
        const parseLine = (line: string) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
                else current += char;
            }
            result.push(current.trim().replace(/^"|"$/g, ''));
            return result;
        };
        const headers = parseLine(lines[0]).map(h => h.toUpperCase().replace(/\s+/g, ''));
        
        const getVal = (row: string[], search: string) => {
            const idx = headers.findIndex(h => h.toUpperCase().replace(/\s+/g, '').includes(search.toUpperCase().replace(/\s+/g, '')));
            return idx !== -1 ? row[idx] : '';
        };

        return lines.slice(1).map(line => {
            const vals = parseLine(line);
            return {
                year: getVal(vals, 'YEAR'),
                quarter: getVal(vals, 'QUARTER'),
                months: getVal(vals, 'MONTHS'),
                headCode: getVal(vals, 'HEADCODE') || getVal(vals, 'HEAD_CODE') || getVal(vals, 'ID'),
                budgetHead: getVal(vals, 'BUDGETHEAD') || getVal(vals, 'NAME'),
                targetAmount: parseFloat(getVal(vals, 'TARGETAMOUNT')) || 0,
                unitsToCover: parseFloat(getVal(vals, 'UNITSTOCOVER')) || parseFloat(getVal(vals, 'TARGET')) || 0,
                spentAmount: parseFloat(getVal(vals, 'SPENTAMONT') || getVal(vals, 'SPENTAMOUNT')) || 0,
                unitsCovered: parseFloat(getVal(vals, 'UNITSCOVERED')) || 0,
            };
        }).filter(d => d.headCode);
    };

    const parseGenericCSV = (csv: string) => {
        const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 1) return [];
        const parseLine = (line: string) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
                else current += char;
            }
            result.push(current.trim().replace(/^"|"$/g, ''));
            return result;
        };
        const headers = parseLine(lines[0]);
        return lines.slice(1).map(line => {
            const vals = parseLine(line);
            const obj: any = {};
            headers.forEach((h, i) => obj[h] = vals[i] || '');
            return obj;
        });
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [misRes, assetsRes, distRes, benRes, contRes, budgetRes] = await Promise.all([
                fetch(`${MIS_TARGETS_URL}&t=${Date.now()}`),
                fetch(`${ASSETS_DATA_URL}&t=${Date.now()}`),
                fetch(`${ASSET_DISTRIBUTION_URL}&t=${Date.now()}`),
                fetch(`${BENEFICIARY_DATA_URL}&t=${Date.now()}`),
                fetch(`${CONTRIBUTION_DATA_URL}&t=${Date.now()}`),
                fetch(`${BUDGET_CSV_URL}&t=${Date.now()}`)
            ]);

            if (!misRes.ok) throw new Error("Could not sync MIS data");
            
            const [misCsv, assetsCsv, distCsv, benCsv, contCsv, budgetCsv] = await Promise.all([
                misRes.text(),
                assetsRes.text(),
                distRes.text(),
                benRes.text(),
                contRes.text(),
                budgetRes.text()
            ]);

            const parsed = parseCSV(misCsv);
            setRawData(parsed);
            setAssetsData(parseGenericCSV(assetsCsv));
            setDistributionData(parseGenericCSV(distCsv));
            setBeneficiaryData(parseGenericCSV(benCsv));
            setContributionData(parseGenericCSV(contCsv));
            setBudgetData(parseGenericCSV(budgetCsv));
            
            if (parsed.length > 0 && !selectedId) {
                setSelectedId(parsed[0].headCode);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const parseDate = useCallback((dateStr: string) => {
        if (!dateStr) return null;
        let d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;
        const parts = dateStr.split('-');
        if (parts.length === 3 && parts[2].length === 4) {
            const month = isNaN(parts[1] as any) ? parts[1] : parseInt(parts[1]) - 1;
            d = new Date(parts[2] as any, month as any, parts[0] as any);
            if (!isNaN(d.getTime())) return d;
        }
        return null;
    }, []);

    const getYearQuarter = useCallback((dateStr: string) => {
        const d = parseDate(dateStr);
        if (!d) return null;
        const year = d.getFullYear().toString();
        const quarter = `Q${Math.floor(d.getMonth() / 3) + 1}`;
        return { year, quarter };
    }, [parseDate]);

    const getYearMonth = useCallback((dateStr: string) => {
        const d = parseDate(dateStr);
        if (!d) return null;
        const year = d.getFullYear().toString();
        const month = d.toLocaleString('default', { month: 'long' });
        return { year, month };
    }, [parseDate]);

    const getActivityMatch = useCallback((headCode: string, budgetHead: string, activityStr: string) => {
        const act = (activityStr || '').toLowerCase().replace(/_/g, ' ');
        const hName = (budgetHead || '').toLowerCase();
        const hCode = (headCode || '').toLowerCase();

        if (!act) return false;
        if (hName.includes(act) || act.includes(hName)) return true;
        
        // Specific mappings based on headCode or budgetHead
        if (hCode.includes('a1.7') || hCode.includes('a.1.7') || hName.includes('poultry')) {
            return act.includes('desi byp') || act.includes('poultry') || act.includes('byp-bfe') || act.includes('byp bfe');
        }
        if (hCode.includes('a1.3') || hCode.includes('a.1.3') || hName.includes('farm pond')) {
            return act.includes('farmpond') || act.includes('farm pond');
        }
        if (hCode.includes('a1.1') || hCode.includes('a.1.1') || hName.includes('irrigation(solar/fixed)')) {
            return act.includes('fixed irrigation') || act.includes('solar irrigation');
        }
        if (hCode.includes('a1.2') || hCode.includes('a.1.2') || hName.includes('mobile irrigation')) {
            return act.includes('mobile irrigation');
        }
        if (hCode.includes('a1.8') || hCode.includes('a.1.8') || hName.includes('goatery')) {
            return act.includes('goatery');
        }
        if (hCode.includes('a1.9') || hCode.includes('a.1.9') || hName.includes('processing hub')) {
            return act.includes('processing hub');
        }
        if (hCode.includes('a1.10') || hCode.includes('a.1.10') || hName.includes('fish')) {
            return act.includes('fisheries') || act.includes('fish');
        }

        return false;
    }, []);

    const { availableYears, availableQuarters } = useMemo(() => {
        const ySet = new Set<string>();
        const qSet = new Set<string>();

        rawData.forEach(d => {
            if (d.year) ySet.add(d.year);
            if (d.quarter) qSet.add(d.quarter);
        });

        const processDate = (dStr: string) => {
            const yq = getYearQuarter(dStr);
            if (yq) {
                ySet.add(yq.year);
                qSet.add(yq.quarter);
            }
        };

        assetsData.forEach(a => processDate(a['Date Of Purchase'] || a['Date Of Asset Received']));
        distributionData.forEach(d => processDate(d['materials_details-distributed_date'] || d['Date of Submission']));
        beneficiaryData.forEach(b => processDate(b['SubmissionDate'] || b['activity_registration-date_reg']));
        budgetData.forEach(b => {
            if (b['Year']) ySet.add(b['Year']);
            if (b['Quarter']) qSet.add(b['Quarter']);
        });

        return {
            availableYears: ['All', ...Array.from(ySet)].sort(),
            availableQuarters: ['All', ...Array.from(qSet)].sort()
        };
    }, [rawData, assetsData, distributionData, beneficiaryData, budgetData, getYearQuarter]);

    const years = availableYears;
    const quarters = availableQuarters;

    // Filter data based on year and quarter
    const filteredData = useMemo(() => {
        return rawData.filter(d => {
            const matchYear = selectedYear === 'All' || d.year === selectedYear || !d.year;
            const matchQuarter = selectedQuarter === 'All' || d.quarter === selectedQuarter;
            return matchYear && matchQuarter;
        });
    }, [rawData, selectedYear, selectedQuarter]);

    const filteredAssetsData = useMemo(() => {
        return assetsData.filter(a => {
            if (selectedYear === 'All' && selectedQuarter === 'All') return true;
            const yq = getYearQuarter(a['Date Of Purchase'] || a['Date Of Asset Received']);
            if (!yq) return false;
            const matchYear = selectedYear === 'All' || yq.year === selectedYear;
            const matchQuarter = selectedQuarter === 'All' || yq.quarter === selectedQuarter;
            return matchYear && matchQuarter;
        });
    }, [assetsData, selectedYear, selectedQuarter, getYearQuarter]);

    const filteredDistributionData = useMemo(() => {
        return distributionData.filter(d => {
            if (selectedYear === 'All' && selectedQuarter === 'All') return true;
            const yq = getYearQuarter(d['materials_details-distributed_date'] || d['Date of Submission']);
            if (!yq) return false;
            const matchYear = selectedYear === 'All' || yq.year === selectedYear;
            const matchQuarter = selectedQuarter === 'All' || yq.quarter === selectedQuarter;
            return matchYear && matchQuarter;
        });
    }, [distributionData, selectedYear, selectedQuarter, getYearQuarter]);

    const filteredBeneficiaryData = useMemo(() => {
        return beneficiaryData.filter(b => {
            if (selectedYear === 'All' && selectedQuarter === 'All') return true;
            const yq = getYearQuarter(b['SubmissionDate'] || b['activity_registration-date_reg']);
            if (!yq) return false;
            const matchYear = selectedYear === 'All' || yq.year === selectedYear;
            const matchQuarter = selectedQuarter === 'All' || yq.quarter === selectedQuarter;
            return matchYear && matchQuarter;
        });
    }, [beneficiaryData, selectedYear, selectedQuarter, getYearQuarter]);

    const filteredBudgetData = useMemo(() => {
        return budgetData.filter(b => {
            const matchYear = selectedYear === 'All' || (b['Year'] || '').includes(selectedYear);
            const matchQuarter = selectedQuarter === 'All' || (b['Quarter'] || '').includes(selectedQuarter);
            return matchYear && matchQuarter;
        });
    }, [budgetData, selectedYear, selectedQuarter]);

    // Aggregate by Head_code
    const aggregatedComponents = useMemo(() => {
        const map = new Map<string, {
            headCode: string;
            budgetHead: string;
            targetAmount: number;
            unitsToCover: number;
            spentAmount: number;
            unitsCovered: number;
        }>();

        filteredData.forEach(d => {
            if (!map.has(d.headCode)) {
                map.set(d.headCode, {
                    headCode: d.headCode,
                    budgetHead: d.budgetHead,
                    targetAmount: 0,
                    unitsToCover: 0,
                    spentAmount: 0,
                    unitsCovered: 0
                });
            }
            const agg = map.get(d.headCode)!;
            agg.targetAmount += d.targetAmount;
            agg.unitsToCover += d.unitsToCover;
            agg.spentAmount += d.spentAmount;
            agg.unitsCovered += d.unitsCovered;
        });

        // Calculate achievements from budget data, assets and distribution
        Array.from(map.values()).forEach(agg => {
            const budgetRows = filteredBudgetData.filter(b => {
                const bCode = (b['Head_code'] || b['HeadCode'] || '').replace(/\./g, '').toLowerCase();
                const hCode = agg.headCode.replace(/\./g, '').toLowerCase();
                return bCode === hCode;
            });

            // 1. Check budget data for explicit "Units Covered", "Target Amount", and "Spent Amont"
            const budgetUnits = budgetRows.reduce((sum, b) => {
                const val = parseFloat((b['Units Covered'] || '0').replace(/,/g, '')) || 0;
                return sum + val;
            }, 0);

            const budgetTarget = budgetRows.reduce((sum, b) => {
                const val = parseFloat((b['Target Amount'] || '0').replace(/,/g, '')) || 0;
                return sum + val;
            }, 0);

            const budgetSpent = budgetRows.reduce((sum, b) => {
                const val = parseFloat((b['Spent Amont'] || b['Spent Amount'] || '0').replace(/,/g, '')) || 0;
                return sum + val;
            }, 0);

            if (budgetUnits > 0) {
                agg.unitsCovered = budgetUnits;
            }
            
            if (budgetTarget > 0) {
                agg.targetAmount = budgetTarget;
            }

            if (budgetSpent > 0) {
                agg.spentAmount = budgetSpent;
            }

            const relatedAssets = filteredAssetsData.filter(a => {
                const aCode = (a['Activity Code'] || '').replace(/\./g, '').toLowerCase();
                const hCode = agg.headCode.replace(/\./g, '').toLowerCase();
                return aCode === hCode;
            });

            if (agg.targetAmount === 0 && relatedAssets.length > 0) {
                // Try to estimate target budget based on unit cost
                const unitCostStr = (relatedAssets[0]['Cost Of Unit asset '] || relatedAssets[0]['Cost Of Unit asset'] || '').replace(/,/g, '');
                const unitCost = parseFloat(unitCostStr) || 0;
                agg.targetAmount = unitCost * agg.unitsToCover;
            }

            if (agg.spentAmount === 0) {
                agg.spentAmount = relatedAssets.reduce((sum, a) => {
                    const priceStr = (a['Total Price (including GST)'] || '').replace(/,/g, '');
                    return sum + (parseFloat(priceStr) || 0);
                }, 0);
            }

            if (agg.unitsCovered === 0) {
                // Try to match by activity name in distribution data
                const relatedDist = filteredDistributionData.filter(d => {
                    return getActivityMatch(agg.headCode, agg.budgetHead, d['Activity']);
                });
                
                if (relatedDist.length > 0) {
                    // Count unique beneficiaries instead of summing material counts
                    const uniqueBeneficiaries = new Set(relatedDist.map(d => d['Beneficiary name'] || d['Name'] || d['bnf_name']));
                    agg.unitsCovered = uniqueBeneficiaries.size;
                } else {
                    // Fallback to beneficiary data count
                    const relatedBen = filteredBeneficiaryData.filter(b => {
                        return getActivityMatch(agg.headCode, agg.budgetHead, b['activity']);
                    });
                    agg.unitsCovered = relatedBen.length;
                }
            }
        });

        return Array.from(map.values());
    }, [filteredData, filteredAssetsData, filteredDistributionData, filteredBeneficiaryData, filteredBudgetData, getActivityMatch]);

    const aggregatedComponentsWithAll = useMemo(() => {
        const all = {
            headCode: 'All',
            budgetHead: 'All Activities',
            targetAmount: aggregatedComponents.reduce((sum, c) => sum + c.targetAmount, 0),
            unitsToCover: aggregatedComponents.reduce((sum, c) => sum + c.unitsToCover, 0),
            spentAmount: aggregatedComponents.reduce((sum, c) => sum + c.spentAmount, 0),
            unitsCovered: aggregatedComponents.reduce((sum, c) => sum + c.unitsCovered, 0)
        };
        return [all, ...aggregatedComponents];
    }, [aggregatedComponents]);

    const activeComp = useMemo(() => 
        aggregatedComponentsWithAll.find(c => c.headCode === selectedId) || aggregatedComponentsWithAll[0]
    , [aggregatedComponentsWithAll, selectedId]);

    const genderStats = useMemo(() => {
        if (!activeComp) return { male: 0, female: 0, total: 0 };
        const relatedBen = filteredBeneficiaryData.filter(b => {
            return getActivityMatch(activeComp.headCode, activeComp.budgetHead, b['activity']);
        });
        
        let male = 0;
        let female = 0;
        relatedBen.forEach(b => {
            const g = (b['gender'] || b['bnf_section-gender'] || b['bnf_section_-gender_'] || '').toLowerCase();
            if (g.includes('female')) female++;
            else if (g.includes('male')) male++;
        });
        
        return { male, female, total: relatedBen.length };
    }, [activeComp, filteredBeneficiaryData, getActivityMatch]);

    const contributionStats = useMemo(() => {
        if (!activeComp) return 0;
        
        const hName = activeComp.budgetHead.toLowerCase();
        const hCode = activeComp.headCode.toLowerCase();
        
        let colNames: string[] = [];
        if (hCode.includes('a1.7') || hCode.includes('a.1.7') || hName.includes('poultry')) colNames = ['BYP-NS', 'BYP-BFE'];
        else if (hCode.includes('a1.2') || hCode.includes('a.1.2') || hName.includes('mobile irrigation')) colNames = ['Mobile Irrigation'];
        else if (hCode.includes('a1.9') || hCode.includes('a.1.9') || hName.includes('processing hub')) colNames = ['Processing Hubs'];
        else if (hCode.includes('a1.10') || hCode.includes('a.1.10') || hName.includes('fish')) colNames = ['Fisheries'];
        else if (hCode.includes('a1.8') || hCode.includes('a.1.8') || hName.includes('goatery')) colNames = ['Goat Sheds'];
        else if (hCode.includes('a1.3') || hCode.includes('a.1.3') || hName.includes('farm pond')) colNames = ['Eco-Farmpond'];
        else if (hCode.includes('a1.1') || hCode.includes('a.1.1') || hName.includes('irrigation(solar/fixed)')) colNames = ['Fixed Irrigation'];
        
        if (colNames.length === 0) return 0;
        
        return contributionData.reduce((sum, row) => {
            let rowSum = 0;
            colNames.forEach(col => {
                rowSum += parseFloat((row[col] || '0').replace(/,/g, '')) || 0;
            });
            return sum + rowSum;
        }, 0);
    }, [activeComp, contributionData]);

    useEffect(() => {
        if (aggregatedComponents.length > 0 && !aggregatedComponents.find(c => c.headCode === selectedId)) {
            setSelectedId(aggregatedComponents[0].headCode);
        }
    }, [aggregatedComponents, selectedId]);

    const unitsProgressPercent = useMemo(() => {
        if (!activeComp || activeComp.unitsToCover === 0) return 0;
        const calc = (activeComp.unitsCovered / activeComp.unitsToCover) * 100;
        return Math.min(calc, 100);
    }, [activeComp]);

    const budgetProgressPercent = useMemo(() => {
        if (!activeComp || activeComp.targetAmount === 0) return 0;
        const calc = (activeComp.spentAmount / activeComp.targetAmount) * 100;
        return Math.min(calc, 100);
    }, [activeComp]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    const beneficiaryChartsData = useMemo(() => {
        if (!activeComp) return { clusters: [], genders: [], bypStatus: [] };
        
        const relatedBen = filteredBeneficiaryData.filter(b => {
            return getActivityMatch(activeComp.headCode, activeComp.budgetHead, b['activity']);
        });

        const clusterMap = new Map<string, number>();
        const genderMap = new Map<string, number>();
        const statusMap = new Map<string, Map<string, number>>(); // Cluster -> Status -> Count

        relatedBen.forEach(b => {
            const cluster = b['Cluster'] || b['location-cluster'] || 'Unknown';
            clusterMap.set(cluster, (clusterMap.get(cluster) || 0) + 1);

            const gender = (b['gender'] || b['bnf_section-gender'] || 'Unknown').toLowerCase();
            const genderLabel = gender.includes('female') ? 'Female' : (gender.includes('male') ? 'Male' : 'Other');
            genderMap.set(genderLabel, (genderMap.get(genderLabel) || 0) + 1);

            // For BYP contribution status, we look for a status field
            const status = b['contribution_status'] || b['status'] || b['Contribution Status'] || 'Pending';
            if (!statusMap.has(cluster)) statusMap.set(cluster, new Map());
            const clusterStatus = statusMap.get(cluster)!;
            clusterStatus.set(status, (clusterStatus.get(status) || 0) + 1);
        });

        const clusters = Array.from(clusterMap.entries()).map(([name, value]) => ({ name, value }));
        const genders = Array.from(genderMap.entries()).map(([name, value]) => ({ name, value }));
        
        const bypStatus: any[] = [];
        statusMap.forEach((statuses, cluster) => {
            statuses.forEach((count, status) => {
                bypStatus.push({ cluster, status, count });
            });
        });

        return { clusters, genders, bypStatus };
    }, [activeComp, filteredBeneficiaryData, getActivityMatch]);

    const tabs = [
        { id: 0, label: 'Overview', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
        { id: 1, label: 'Asset Management', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
        { id: 2, label: 'Distribution', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
        { id: 3, label: 'Beneficiaries', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
        { id: 4, label: 'Evidence', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' }
    ];

    const toggleAssetExpansion = (assetName: string) => {
        const newSet = new Set(expandedAssets);
        if (newSet.has(assetName)) newSet.delete(assetName);
        else newSet.add(assetName);
        setExpandedAssets(newSet);
    };

    const [expandedBeneficiaries, setExpandedBeneficiaries] = useState<Set<string>>(new Set());

    const toggleBeneficiaryExpansion = (benName: string) => {
        const newSet = new Set(expandedBeneficiaries);
        if (newSet.has(benName)) newSet.delete(benName);
        else newSet.add(benName);
        setExpandedBeneficiaries(newSet);
    };

    const distributionStats = useMemo(() => {
        if (!activeComp) return [];
        
        const activityAssets = filteredAssetsData.filter(a => 
            (a['Activity Code'] || '').replace(/\./g, '').toLowerCase() === activeComp.headCode.replace(/\./g, '').toLowerCase()
        );
        
        const assetMap = new Map<string, { asset: string, received: number, distributed: number }>();

        const normalize = (name: string) => {
            return name.toLowerCase()
                .replace(/\s+/g, ' ')
                .replace(/(\d+)\s*ft/g, '$1 ft')
                .replace(/(\d+)\s*inch/g, '$1 inch')
                .replace(/(\d+)\s*inc/g, '$1 inch')
                .trim();
        };

        activityAssets.forEach(a => {
            const rawName = a['Asset Name'] || 'Unknown Asset';
            const name = normalize(rawName);
            
            // Get keys to access by index or fuzzy match
            const keys = Object.keys(a);
            const getValFuzzy = (search: string[]) => {
                const key = keys.find(k => search.some(s => k.toUpperCase().replace(/\s+/g, '').includes(s.toUpperCase().replace(/\s+/g, ''))));
                return key ? a[key] : '';
            };

            // Use "HOWMANYRECEIVED" if available, otherwise fallback to "Number Of Asset Purchased"
            const qtyReceived = parseFloat((getValFuzzy(['HOWMANYRECEIVED', 'Number Of Asset Received']) || a['Number Of Asset Purchased'] || '0').replace(/,/g, '')) || 0;
            
            // Get distributed qty from clusters (indices 22, 26, 30 in the asset tracking sheet)
            const d1 = parseFloat((a[keys[22]] || '0').replace(/,/g, '')) || 0;
            const d2 = parseFloat((a[keys[26]] || '0').replace(/,/g, '')) || 0;
            const d3 = parseFloat((a[keys[30]] || '0').replace(/,/g, '')) || 0;
            const qtyDistributed = d1 + d2 + d3;

            if (!assetMap.has(name)) {
                assetMap.set(name, { asset: rawName, received: 0, distributed: 0 });
            }
            assetMap.get(name)!.received += qtyReceived;
            assetMap.get(name)!.distributed += qtyDistributed;
        });

        return Array.from(assetMap.values()).sort((a, b) => b.received - a.received);
    }, [activeComp, filteredAssetsData]);

    const beneficiaryDistributionList = useMemo(() => {
        if (!activeComp) return [];
        
        const activityDist = filteredDistributionData.filter(d => 
            getActivityMatch(activeComp.headCode, activeComp.budgetHead, d['Activity'])
        );

        const benMap = new Map<string, { name: string, materials: { material: string, count: string, date: string }[] }>();

        activityDist.forEach(d => {
            const name = d['Beneficiary name'] || d['Name'] || d['bnf_name'] || 'Unknown';
            if (!benMap.has(name)) {
                benMap.set(name, { name, materials: [] });
            }
            benMap.get(name)!.materials.push({
                material: d['this_material_label'],
                count: `${d['materials_details-material_count']} ${d['materials_details-material_unit']}`,
                date: d['materials_details-distributed_date']
            });
        });

        return Array.from(benMap.values());
    }, [activeComp, filteredDistributionData, getActivityMatch]);

    const groupedAssets = useMemo(() => {
        if (!activeComp) return [];
        const activityAssets = filteredAssetsData.filter(a => (a['Activity Code'] || '').replace(/\./g, '').toLowerCase() === activeComp.headCode.replace(/\./g, '').toLowerCase());
        
        const groups = new Map<string, any>();
        activityAssets.forEach(a => {
            const name = a['Asset Name'] || 'Unknown Asset';
            if (!groups.has(name)) {
                groups.set(name, {
                    name,
                    totalCount: 0,
                    totalCost: 0,
                    items: []
                });
            }
            const group = groups.get(name);
            group.totalCount += parseFloat((a['Number Of Asset Purchased'] || '0').replace(/,/g, '')) || 0;
            group.totalCost += parseFloat((a['Total Price (including GST)'] || '').replace(/,/g, '')) || 0;
            group.items.push(a);
        });
        return Array.from(groups.values());
    }, [filteredAssetsData, activeComp]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-[10px]">Processing Master Registry...</p>
        </div>
    );

    if (error) return (
        <div className="p-10 text-center bg-red-50 dark:bg-red-900/10 rounded-[2rem] border border-red-200">
            <p className="text-red-500 font-bold mb-4">Sync Error: {error}</p>
            <button onClick={fetchData} className="px-6 py-2 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase">Retry Sync</button>
        </div>
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
            {/* Header with Selection */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="space-y-1">
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Target vs Achievement Dashboard</h1>
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em]">
                        {activeComp?.headCode === 'All' ? 'Consolidated View' : `${activeComp?.headCode} - ${activeComp?.budgetHead}`}
                    </p>
                </div>
                <div className="w-full md:w-auto flex flex-col md:flex-row gap-3">
                    <select 
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="w-full md:w-32 bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl border-none ring-1 ring-gray-200 dark:ring-gray-700 font-black text-xs uppercase shadow-sm focus:ring-2 focus:ring-indigo-600 transition-all"
                    >
                        {years.map(y => <option key={y} value={y}>{y === 'All' ? 'Financial Year' : y}</option>)}
                    </select>
                    <select 
                        value={selectedId}
                        onChange={(e) => setSelectedId(e.target.value)}
                        className="w-full md:w-80 bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl border-none ring-1 ring-gray-200 dark:ring-gray-700 font-black text-xs uppercase shadow-sm focus:ring-2 focus:ring-indigo-600 transition-all"
                    >
                        {aggregatedComponentsWithAll.map(c => <option key={c.headCode} value={c.headCode}>{c.headCode === 'All' ? 'All Activities' : `${c.headCode} - ${c.budgetHead}`}</option>)}
                    </select>
                    <select 
                        value={selectedQuarter}
                        onChange={(e) => setSelectedQuarter(e.target.value)}
                        className="w-full md:w-40 bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl border-none ring-1 ring-gray-200 dark:ring-gray-700 font-black text-xs uppercase shadow-sm focus:ring-2 focus:ring-indigo-600 transition-all"
                    >
                        {quarters.map(q => <option key={q} value={q}>{q === 'All' ? 'All Quarters' : q}</option>)}
                    </select>
                </div>
            </div>

            {/* Component Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-indigo-600 text-white p-5 rounded-3xl shadow-lg">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Units Covered</p>
                    <p className="text-xl font-black">{activeComp?.unitsCovered || 0} / {activeComp?.unitsToCover || 0}</p>
                </div>
                <div className="bg-emerald-500 text-white p-5 rounded-3xl shadow-lg">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Units Achievement</p>
                    <p className="text-xl font-black">{unitsProgressPercent.toFixed(1)}%</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Budget Spent</p>
                    <p className="text-lg font-black text-gray-800 dark:text-white">{formatCurrency(activeComp?.spentAmount || 0)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Budget Achievement</p>
                    <p className="text-xl font-black text-indigo-600">{budgetProgressPercent.toFixed(1)}%</p>
                </div>
            </div>

            {/* 5-Tab Navigation */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto no-scrollbar">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-5 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 ${
                                activeTab === tab.id 
                                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
                                : 'border-transparent text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={tab.icon}/></svg>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-8 min-h-[400px]">
                    {activeTab === 0 && activeComp && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Units Progress */}
                                <div className="space-y-6">
                                    <h3 className="text-lg font-black uppercase tracking-tight text-gray-800 dark:text-white">Units Progress (MIS Target)</h3>
                                    <div className="relative pt-1">
                                        <div className="flex mb-2 items-center justify-between">
                                            <div>
                                                <span className="text-xs font-black inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-200">
                                                    Achievement
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-black inline-block text-indigo-600">
                                                    {unitsProgressPercent.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                                            <div style={{ width: `${unitsProgressPercent}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600 transition-all duration-1000"></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mt-8">
                                            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-700">
                                                <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Target Units</p>
                                                <p className="text-3xl font-black text-gray-900 dark:text-white">{activeComp.unitsToCover}</p>
                                            </div>
                                            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-700">
                                                <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Achieved Units</p>
                                                <p className="text-3xl font-black text-emerald-600">{activeComp.unitsCovered}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Beneficiary & Contribution Overview */}
                                <div className="space-y-6">
                                    <h3 className="text-lg font-black uppercase tracking-tight text-gray-800 dark:text-white">Beneficiary & Contribution</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl border border-indigo-100 dark:border-indigo-800/50">
                                            <p className="text-[10px] font-black text-indigo-400 uppercase mb-2">Total Beneficiaries</p>
                                            <p className="text-3xl font-black text-indigo-600">{genderStats.total}</p>
                                        </div>
                                        <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl border border-emerald-100 dark:border-emerald-800/50">
                                            <p className="text-[10px] font-black text-emerald-400 uppercase mb-2">Contribution Collected</p>
                                            <p className="text-2xl font-black text-emerald-600">{formatCurrency(contributionStats)}</p>
                                        </div>
                                    </div>
                                    
                                    {/* Gender Distribution Chart */}
                                    <div className="h-64 mt-4 bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-4 border border-gray-100 dark:border-gray-700">
                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-4 text-center">Gender Distribution</p>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Male', value: genderStats.male },
                                                        { name: 'Female', value: genderStats.female }
                                                    ]}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    <Cell fill="#4f46e5" />
                                                    <Cell fill="#ec4899" />
                                                </Pie>
                                                <Tooltip 
                                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Legend verticalAlign="bottom" height={36}/>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Budget Progress */}
                            <div className="pt-8 border-t border-gray-100 dark:border-gray-700">
                                <h3 className="text-lg font-black uppercase tracking-tight text-gray-800 dark:text-white mb-6">Budget Progress</h3>
                                <div className="relative pt-1">
                                    <div className="flex mb-2 items-center justify-between">
                                        <div>
                                            <span className="text-xs font-black inline-block py-1 px-2 uppercase rounded-full text-emerald-600 bg-emerald-200">
                                                Utilization
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-black inline-block text-emerald-600">
                                                {budgetProgressPercent.toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-emerald-100 dark:bg-indigo-900/30">
                                        <div style={{ width: `${budgetProgressPercent}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-600 transition-all duration-1000"></div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                                        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-700">
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Target Budget</p>
                                            <p className="text-xl font-black text-gray-900 dark:text-white">{formatCurrency(activeComp.targetAmount)}</p>
                                        </div>
                                        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-700">
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Spent Budget</p>
                                            <p className="text-xl font-black text-emerald-600">{formatCurrency(activeComp.spentAmount)}</p>
                                        </div>
                                        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-700">
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Male Beneficiaries</p>
                                            <p className="text-xl font-black text-indigo-600">{genderStats.male}</p>
                                        </div>
                                        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-700">
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Female Beneficiaries</p>
                                            <p className="text-xl font-black text-pink-600">{genderStats.female}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ... other tabs remain the same with dynamic ID usage ... */}
                    {(activeTab === 1) && activeComp && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className="text-lg font-black uppercase tracking-tight text-gray-800 dark:text-white">Asset Management</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                            <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Asset Name</th>
                                            <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Total Count</th>
                                            <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Total Price</th>
                                            <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupedAssets.map((group, i) => (
                                            <React.Fragment key={i}>
                                                <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                                    <td className="py-4 px-4 text-sm font-bold text-gray-900 dark:text-white">{group.name}</td>
                                                    <td className="py-4 px-4 text-sm font-bold text-indigo-600 text-center">{group.totalCount}</td>
                                                    <td className="py-4 px-4 text-sm font-bold text-emerald-600">{formatCurrency(group.totalCost)}</td>
                                                    <td className="py-4 px-4 text-sm">
                                                        {group.items.length > 1 ? (
                                                            <button 
                                                                onClick={() => toggleAssetExpansion(group.name)}
                                                                className="flex items-center gap-1 text-indigo-600 font-black text-[10px] uppercase hover:underline"
                                                            >
                                                                {expandedAssets.has(group.name) ? 'Hide Details' : `Show Details (${group.items.length})`}
                                                                <svg className={`w-3 h-3 transition-transform ${expandedAssets.has(group.name) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                                                            </button>
                                                        ) : (
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase">Single Record</span>
                                                        )}
                                                    </td>
                                                </tr>
                                                {(expandedAssets.has(group.name) || group.items.length === 1) && (
                                                    <tr>
                                                        <td colSpan={4} className="bg-gray-50/50 dark:bg-gray-900/30 px-4 py-2">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 py-2">
                                                                {group.items.map((item: any, idx: number) => (
                                                                    <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex justify-between items-center">
                                                                        <div className="space-y-1">
                                                                            <p className="text-[9px] font-black text-gray-400 uppercase">Purchase Date</p>
                                                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{item['Date Of Purchase'] || 'N/A'}</p>
                                                                        </div>
                                                                        <div className="text-right space-y-1">
                                                                            <p className="text-[9px] font-black text-gray-400 uppercase">Amount</p>
                                                                            <p className="text-xs font-black text-emerald-600">{formatCurrency(parseFloat((item['Total Price (including GST)'] || '').replace(/,/g, '')) || 0)}</p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                        {groupedAssets.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="py-8 text-center text-sm text-gray-400 font-bold">No assets found for this activity.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {(activeTab === 2) && activeComp && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-[2rem] p-8 border border-gray-100 dark:border-gray-700">
                                <h3 className="text-lg font-black uppercase tracking-tight text-gray-800 dark:text-white mb-6">Asset-wise Received vs Distributed</h3>
                                <div className="h-[600px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart 
                                            layout="vertical"
                                            data={distributionStats} 
                                            margin={{ top: 20, right: 40, left: 120, bottom: 20 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                                            <XAxis 
                                                type="number"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 10, fontWeight: 900, fill: '#9ca3af' }}
                                            />
                                            <YAxis 
                                                dataKey="asset" 
                                                type="category"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 10, fontWeight: 900, fill: '#9ca3af' }}
                                                width={110}
                                            />
                                            <Tooltip 
                                                cursor={{ fill: '#f3f4f6' }}
                                                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px' }} />
                                            <Bar dataKey="received" name="Received Qty" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20} />
                                            <Bar dataKey="distributed" name="Distributed Qty" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-lg font-black uppercase tracking-tight text-gray-800 dark:text-white">Beneficiary Material Distribution</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Beneficiary Name</th>
                                                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Materials Received</th>
                                                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {beneficiaryDistributionList.map((ben, i) => (
                                                <React.Fragment key={i}>
                                                    <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                                        <td className="py-4 px-4 text-sm font-bold text-gray-900 dark:text-white">{ben.name}</td>
                                                        <td className="py-4 px-4 text-sm font-bold text-indigo-600 text-center">{ben.materials.length} Items</td>
                                                        <td className="py-4 px-4 text-sm text-right">
                                                            <button 
                                                                onClick={() => toggleBeneficiaryExpansion(ben.name)}
                                                                className="inline-flex items-center gap-1 text-indigo-600 font-black text-[10px] uppercase hover:underline"
                                                            >
                                                                {expandedBeneficiaries.has(ben.name) ? 'Hide Materials' : 'Show Materials'}
                                                                <svg className={`w-3 h-3 transition-transform ${expandedBeneficiaries.has(ben.name) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {expandedBeneficiaries.has(ben.name) && (
                                                        <tr>
                                                            <td colSpan={3} className="bg-gray-50/50 dark:bg-gray-900/30 px-4 py-2">
                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 py-2">
                                                                    {ben.materials.map((m, idx) => (
                                                                        <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                                            <div className="flex justify-between items-start mb-1">
                                                                                <p className="text-[10px] font-black text-indigo-600 uppercase">{m.material}</p>
                                                                                <p className="text-[9px] font-black text-gray-400 uppercase">{m.date}</p>
                                                                            </div>
                                                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Quantity: {m.count}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                            {beneficiaryDistributionList.length === 0 && (
                                                <tr>
                                                    <td colSpan={3} className="py-8 text-center text-sm text-gray-400 font-bold">No distribution records found for this activity.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {(activeTab === 3) && activeComp && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Cluster-wise Count */}
                                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-6 border border-gray-100 dark:border-gray-700">
                                    <h4 className="text-xs font-black uppercase text-gray-400 mb-6 tracking-widest text-center">Cluster-wise Beneficiaries</h4>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={beneficiaryChartsData.clusters}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {beneficiaryChartsData.clusters.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip 
                                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Legend verticalAlign="bottom" height={36}/>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Gender-wise Count */}
                                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-6 border border-gray-100 dark:border-gray-700">
                                    <h4 className="text-xs font-black uppercase text-gray-400 mb-6 tracking-widest text-center">Gender Distribution</h4>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={beneficiaryChartsData.genders}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {beneficiaryChartsData.genders.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.name === 'Female' ? '#ec4899' : (entry.name === 'Male' ? '#4f46e5' : '#9ca3af')} />
                                                    ))}
                                                </Pie>
                                                <Tooltip 
                                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Legend verticalAlign="bottom" height={36}/>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Cluster-wise BYP Contribution Status */}
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-6 border border-gray-100 dark:border-gray-700">
                                <h4 className="text-xs font-black uppercase text-gray-400 mb-6 tracking-widest">Cluster-wise BYP Contribution Status</h4>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={beneficiaryChartsData.bypStatus}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                            <XAxis dataKey="cluster" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#9ca3af' }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#9ca3af' }} />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="top" align="right" />
                                            <Bar dataKey="count" name="Count" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-lg font-black uppercase tracking-tight text-gray-800 dark:text-white">Beneficiary List</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Name</th>
                                                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Village</th>
                                                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Gender / Age</th>
                                                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Phone</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredBeneficiaryData.filter(b => {
                                                return getActivityMatch(activeComp.headCode, activeComp.budgetHead, b['activity']);
                                            }).map((b, i) => (
                                                <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                                    <td className="py-4 px-4 text-sm font-bold text-gray-900 dark:text-white">{b['Name'] || b['location-farmer_name']}</td>
                                                    <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">{b['Village'] || b['location-village']}</td>
                                                    <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400 capitalize">{b['gender'] || b['bnf_section-gender']} / {b['age'] || b['bnf_section-age']}</td>
                                                    <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">{b['phone number'] || b['bnf_section-phone_number']}</td>
                                                </tr>
                                            ))}
                                            {filteredBeneficiaryData.filter(b => {
                                                return getActivityMatch(activeComp.headCode, activeComp.budgetHead, b['activity']);
                                            }).length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="py-8 text-center text-sm text-gray-400 font-bold">No beneficiaries found for this activity.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {(activeTab === 4) && (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900/50 rounded-3xl flex items-center justify-center text-gray-300 mb-4">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            </div>
                            <h4 className="text-sm font-black uppercase text-gray-400 tracking-widest">Section Updating</h4>
                            <p className="text-xs text-gray-400 mt-1">Live data feed for {activeComp?.headCode} is being synchronized.</p>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
};

export default FieldMISPage;
