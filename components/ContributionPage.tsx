import React, { useState, useEffect, useMemo } from "react";
import {
  BASELINE_DATA_URL,
  BENEFICIARY_DATA_URL,
  CONTRIBUTION_DATA_URL,
  MASTER_TARGETS_URL,
  MATERIAL_CONTRIBUTION_URL,
  ASSET_DISTRIBUTION_URL,
  getProxyUrl,
} from "../config";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
} from "recharts";

interface BaselineRecord {
  farmerId: string;
  hhHeadName: string;
  cluster: string;
  gp: string;
  village: string;
  category: string;
  dateRegMap: Record<string, string>;
}

interface ActivityTarget {
  cluster: string;
  activity: string;
  target: number;
  contributionTarget: number;
  financialYear: string;
}

interface MergedContribution {
  id: string; // Unique transaction identifier
  farmerId: string;
  name: string;
  cluster: string;
  gp: string;
  village: string;
  amount: number;
  activity: string;
  date: string;
  category: string;
  financialYear: string;
  individualTarget?: number;
  productsReceived?: { name: string; count: number; unitContrib: number; date: string }[];
}

const determineFinancialYear = (dateStr: string) => {
  if (!dateStr || dateStr === 'N/A') return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  const month = d.getMonth();
  const year = d.getFullYear();
  if (month >= 3) {
      return `${year}-${(year + 1).toString().slice(2)}`;
  } else {
      return `${year - 1}-${year.toString().slice(2)}`;
  }
};

const ContributionPage: React.FC = () => {
  const [mergedData, setMergedData] = useState<MergedContribution[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedFinancialYear, setSelectedFinancialYear] = useState("All");
  const [selectedCluster, setSelectedCluster] = useState("All");
  const [selectedGP, setSelectedGP] = useState("All");
  const [selectedVillage, setSelectedVillage] = useState("All");
  const [selectedActivity, setSelectedActivity] = useState("All");
  const [trendYear, setTrendYear] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const parseCSV = (csv: string): Record<string, string>[] => {
    const lines = csv
      .trim()
      .split(/\r?\n/)
      .filter((l) => l.trim());
    if (lines.length < 1) return [];

    const parseLine = (line: string): string[] => {
      const values = [];
      let inQuote = false,
        val = "";
      for (let j = 0; j < line.length; j++) {
        if (line[j] === '"') inQuote = !inQuote;
        else if (line[j] === "," && !inQuote) {
          values.push(val.trim());
          val = "";
        } else val += line[j];
      }
      values.push(val.trim().replace(/^"|"$/g, ""));
      return values;
    };

    const rawHeaders = parseLine(lines[0]);
    const cleanHeaders = rawHeaders.map((h) => h.trim().toUpperCase());

    return lines.slice(1).map((line) => {
      const vals = parseLine(line);
      const obj: any = {};
      cleanHeaders.forEach((h, i) => {
        if (h) obj[h] = vals[i] || "";
      });
      return obj;
    });
  };

  const normalizeId = (id: any): string => {
    if (id === null || id === undefined) return "";
    const str = id
      .toString()
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (/^\d+$/.test(str)) {
      return parseInt(str, 10).toString();
    }
    return str;
  };

  const getFinancialYear = (dateString: string): string => {
    if (!dateString) return "N/A";
    const datePart = dateString.split(' ')[0];
    
    let parsedDate = new Date(datePart);
    
    // Always manual parse first to handle DD-MM-YYYY and DD-Mon-YYYY natively
    // We strictly match only 1-2 digit days, 1-3 char months, and 2-4 digit years.
    const isDDMMYYYY = /^(\d{1,2})[-/]([A-Za-z]{3}|\d{1,2})[-/](\d{2}|\d{4})$/.exec(datePart);
    if (isDDMMYYYY) {
        const p0 = parseInt(isDDMMYYYY[1], 10);
        const p1Str = isDDMMYYYY[2];
        const p1 = parseInt(p1Str, 10);
        let p2 = parseInt(isDDMMYYYY[3], 10);
        
        // Ensure 4-digit year
        if (p2 < 100) p2 += 2000;
        
        let monthIdx = 0;
        if (isNaN(p1)) {
            const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
            const m = p1Str.toLowerCase().slice(0, 3);
            monthIdx = months[m] !== undefined ? months[m] : 0;
        } else {
            // Assume DD-MM-YYYY format
            monthIdx = p1 - 1;
        }
        
        const candidateDate = new Date(p2, monthIdx, p0);
        if (!isNaN(candidateDate.getTime())) {
            parsedDate = candidateDate;
        }
    }

    if (isNaN(parsedDate.getTime())) return "N/A";

    const month = parsedDate.getMonth();
    const year = parsedDate.getFullYear();

    if (month < 3) {
      return `${year - 1}-${year.toString().slice(-2)}`;
    } else {
      return `${year}-${(year + 1).toString().slice(-2)}`;
    }
  };

  const getFuzzyValue = (row: any, keys: string[]) => {
    const rowKeys = Object.keys(row);
    for (const k of keys) {
      const match = rowKeys.find((rk) => {
        const rkUpper = rk.toUpperCase();
        const kUpper = k.toUpperCase();
        return rkUpper === kUpper || rkUpper.includes(kUpper);
      });
      if (match) return row[match];
    }
    return "";
  };

  const [targets, setTargets] = useState<ActivityTarget[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [baselineRes, beneficiaryRes, contribRes, targetsRes, materialRes, distRes] = await Promise.all([
          fetch(getProxyUrl(`${BASELINE_DATA_URL}&cb=${Date.now()}`)),
          fetch(getProxyUrl(`${BENEFICIARY_DATA_URL}&cb=${Date.now()}`)),
          fetch(getProxyUrl(`${CONTRIBUTION_DATA_URL}&cb=${Date.now()}`)),
          fetch(getProxyUrl(`${MASTER_TARGETS_URL}&cb=${Date.now()}`)),
          fetch(getProxyUrl(`${MATERIAL_CONTRIBUTION_URL}&cb=${Date.now()}`)),
          fetch(getProxyUrl(`${ASSET_DISTRIBUTION_URL}&cb=${Date.now()}`)),
        ]);

        if (!baselineRes.ok || !beneficiaryRes.ok || !contribRes.ok)
          throw new Error("Synchronization failure.");

        const baselineText = await baselineRes.text();
        const beneficiaryText = await beneficiaryRes.text();
        const contribText = await contribRes.text();
        const targetsText = targetsRes.ok ? await targetsRes.text() : "";
        const materialText = materialRes.ok ? await materialRes.text() : "";
        const distText = distRes.ok ? await distRes.text() : "";

        const rawBaseline = parseCSV(baselineText);
        const rawBeneficiary = parseCSV(beneficiaryText);
        const rawContrib = parseCSV(contribText);
        const rawTargets = parseCSV(targetsText);
        const rawMaterialMap = parseCSV(materialText);
        const rawDist = parseCSV(distText);

        const activityTargetMap = new Map<string, number>();
        const activityTotalContribMap = new Map<string, number>();

        rawMaterialMap.forEach((row: any) => {
            const assetName = getFuzzyValue(row, ['ASSET NAME', 'ASSET_NAME']);
            const code = getFuzzyValue(row, ['ASSET CODE', 'ASSET_CODE', 'THIS_MATERIAL_CODE']);
            const activityName = getFuzzyValue(row, ['ACTIVITY']);
            const contribStr = getFuzzyValue(row, ['CONTRIBUTION']);
            const contrib = parseFloat(contribStr?.toString().replace(/,/g, '') || '0') || 0;
            if (assetName && contrib > 0) {
                activityTargetMap.set(assetName.toString().trim().toLowerCase(), contrib);
            }
            if (code && contrib > 0) {
                activityTargetMap.set(code.toString().trim().toLowerCase(), contrib);
            }
            if (activityName && contrib > 0) {
                const actKey = activityName.toString().trim().toLowerCase();
                activityTotalContribMap.set(actKey, (activityTotalContribMap.get(actKey) || 0) + contrib);
            }
        });

        // Map CHC to ASC for totals
        if (activityTotalContribMap.has('chc') && !activityTotalContribMap.has('asc')) {
            activityTotalContribMap.set('asc', activityTotalContribMap.get('chc')!);
        }

        const mapTargetActivity = (targetAct: string): string => {
            const l = targetAct.toLowerCase().replace(/_/g, ' ');
            if (l === 'ns' || l === 'byp-ns') return 'BYP-NS';
            if (l === 'bfe' || l === 'byp-bfe') return 'BYP-BFE';
            if (l.includes('fisheries')) return 'FISHERIES';
            if (l === 'crops' || l.includes('crop models')) return 'CROP MODELS';
            if (l === 'eco-farmpond' || l === 'eco farmpond') return 'ECO-FARMPOND';
            if (l === 'processing hubs' || l.includes('processing')) return 'PROCESSING HUBS';
            if (l === 'asc') return 'ASC';
            if (l === 'goatery' || l.includes('goat shed') || l === 'goat') return 'GOATERY';
            if (l === 'mobile irrigation' || l.includes('irrigation')) return 'MOBILE IRR';
            return targetAct.toUpperCase();
        };

        const getContribActivityColumn = (activityName: string) => {
            if (!activityName) return '';
            const l = activityName.toLowerCase().replace(/_/g, ' ');
            if (l === 'ns' || l === 'byp-ns') return 'BYP-NS';
            if (l === 'bfe' || l === 'byp-bfe') return 'BYP-BFE';
            if (l.includes('fisheries')) return 'FISHERIES';
            if (l === 'crops' || l.includes('crop models')) return 'CROP MODELS';
            if (l === 'eco-farmpond' || l === 'eco farmpond') return 'ECO-FARMPOND';
            if (l === 'processing hubs' || l.includes('processing')) return 'PROCESSING HUBS';
            if (l === 'asc') return 'ASC';
            if (l === 'goatery' || l.includes('goat shed') || l === 'goat') return 'GOATERY';
            if (l === 'mobile irrigation') return 'MOBILE IRR';
            if (l === 'fixed irrigation' || l.includes('fixed')) return 'FIXED IRRIG';
            if (l.includes('irrigation')) return 'MOBILE IRR';
            return mapTargetActivity(activityName);
        };

        const baselineMap = new Map<string, BaselineRecord>();
        const processBeneficiaryRecord = (row: any) => {
          const rawId = getFuzzyValue(row, [
            "HH_Id", "HH_ID", "HHID", "HH ID", "FARMERID", "FID", "ID", "FARMER ID"
          ]);
          const normId = normalizeId(rawId);
          if (normId) {
            let existing = baselineMap.get(normId);
            if (!existing) {
                existing = {
                  farmerId: (rawId || "").toString(),
                  hhHeadName: getFuzzyValue(row, [
                    "HHHEADNAME", "FARMERNAME", "NAME", "BENEFICIARYNAME",
                  ]) || "",
                  cluster: getFuzzyValue(row, ["CLUSTER"]) || "",
                  gp: getFuzzyValue(row, ["GP", "GRAMPANCHAYAT"]) || "",
                  village: getFuzzyValue(row, ["VILLAGE"]) || "",
                  category: getFuzzyValue(row, ["CATEGORY", "CASTE"]) || "",
                  dateRegMap: {}
                };
                baselineMap.set(normId, existing);
            }
            const rawActivity = getFuzzyValue(row, [
               "ACTIVITY_REGISTRATION-ACTIVITY", "ACTIVITY", "BENEFICIARYACTIVITY"
            ]);
            const normalizedActivity = getContribActivityColumn((rawActivity || "").replace(/^(BYP-|BFE-|AFT-)/i, ''));
            const dateReg = getFuzzyValue(row, [
              "ACTIVITY_REGISTRATION-DATE_REG", "DATE_REG", "DATE REG", "SUBMISSIONDATE", "DATE"
            ]);
            if (normalizedActivity && dateReg) {
                existing.dateRegMap[normalizedActivity] = dateReg;
            }
            if (dateReg && !existing.dateRegMap['__FALLBACK']) {
                existing.dateRegMap['__FALLBACK'] = dateReg;
            }
          }
        };

        rawBaseline.forEach(processBeneficiaryRecord);
        rawBeneficiary.forEach(processBeneficiaryRecord);

        const beneficiaryCountMap = new Map<string, number>();
        baselineMap.forEach((record) => {
            Object.keys(record.dateRegMap).forEach(activity => {
                if (activity === '__FALLBACK') return;
                const fy = getFinancialYear(record.dateRegMap[activity] || record.dateRegMap['__FALLBACK'] || "");
                const key = `${record.cluster.toLowerCase()}|${activity.toLowerCase()}|${fy.toLowerCase()}`;
                beneficiaryCountMap.set(key, (beneficiaryCountMap.get(key) || 0) + 1);
            });
        });
        const targetMap = new Map<string, { cluster: string, activity: string, target: number, contributionTarget: number, financialYear: string }>();

        const isAssetActivity = (act: string) => ['processing', 'asc', 'mobile irr', 'fixed irrig', 'irrigation'].some(a => act.toLowerCase().includes(a));
        const isFixedActivity = (act: string) => ['ns', 'byp-ns', 'bfe', 'byp-bfe', 'goatery', 'goat shed', 'eco-farmpond', 'eco farmpond', 'goat', 'crop mod', 'fisheries'].some(a => act.toLowerCase().includes(a)) || (!isAssetActivity(act));

        // 0. Process Target Sheet for anything else
        rawTargets.forEach((r) => {
          const activity = mapTargetActivity(getFuzzyValue(r, ["ACTIVITY"]) || "");
          const cluster = getFuzzyValue(r, ["CLUSTER"]) || "";
          const rawFy = getFuzzyValue(r, ["FINANCIAL YEAR", "FINANCIAL_YEAR", "FY"]) || "";
          let financialYear = rawFy.trim();
          if (financialYear.match(/^\d{4}-\d{2}$/)) {
              const parts = financialYear.split('-');
              financialYear = `FY20${parts[1]}`;
          }
          if (!cluster || !activity) return;

          const countKey = `${cluster.toLowerCase()}|${activity.toLowerCase()}|${financialYear.toLowerCase()}`;
          const activityLower = activity.toLowerCase();
          
          if (!isAssetActivity(activityLower) && !isFixedActivity(activityLower)) {
              let target = parseFloat(getFuzzyValue(r, ["TARGET"]) || "0") || 0;
              let unitPrice = activityTargetMap.get(activityLower) || activityTargetMap.get(activityLower.replace(/byp-/, '')) || 0;
              
              if (unitPrice === 0) {
                     unitPrice = activityTotalContribMap.get(activityLower) || activityTotalContribMap.get(activityLower.replace(/byp-/, '')) || 0;
              }
              
              if (target === 0 && (r["TARGET"] === undefined || r["TARGET"] === "") && unitPrice > 0) {
                  target = 1;
              }
              
              const displayActivity = activityOptions.find(o => o.toLowerCase() === activityLower) || activity.toUpperCase();
              const displayCluster = clusters.find(c => c.toLowerCase() === cluster.toLowerCase()) || (cluster.charAt(0).toUpperCase() + cluster.slice(1));
              
              if (targetMap.has(countKey)) {
                  const existing = targetMap.get(countKey)!;
                  existing.target += target;
                  existing.contributionTarget += (target * unitPrice);
              } else {
                  targetMap.set(countKey, {
                      cluster: displayCluster,
                      activity: displayActivity,
                      target,
                      contributionTarget: target * unitPrice,
                      financialYear
                  });
              }
          }
        });

        
        const activityHeaders = [
          "BYP-NS",
          "MOBILE IRR",
          "PROCESSING",
          "ASC",
          "CROP MOD",
          "BYP-BFE",
          "FISHERIES",
          "GOAT SHED",
          "GOATERY",
          "GOAT",
          "ECO-FARMPOND",
          "FIXED IRRIG",
        ];
        const headersInSheet = Object.keys(rawContrib[0] || {});
        // Identify which columns in the sheet are actually activity columns
        // We map each sheet header to its normalized activity name if it matches
        const sheetActivityMap = new Map<string, string>();
        headersInSheet.forEach((h) => {
          const hUpper = h.toUpperCase();
          const matchedActivity = activityHeaders.find(
            (ah) =>
              hUpper === ah.toUpperCase() || hUpper.includes(ah.toUpperCase()),
          );
          if (matchedActivity) {
            let normalized = matchedActivity;
            if (normalized.toUpperCase().includes("GOAT")) {
              normalized = "GOATERY";
            }
            if (normalized === "PROCESSING") {
              normalized = "PROCESSING HUBS";
            }
            sheetActivityMap.set(h, normalized);
          }
        });
        const farmerTargetMap = new Map<string, number>();
        const farmerProductsMap = new Map<string, { name: string; count: number; unitContrib: number; date: string }[]>();
        rawDist.forEach(row => {
            const hhIdRaw = getFuzzyValue(row, ['HH_Id', 'HH_ID', 'HHID', 'HH ID', 'FARMER ID', 'LOCATION-FARMER_ID', 'LOCATION-SHOW_FARMER_ID', 'FARMER_ID', 'FID']);
            const bIdRaw = getFuzzyValue(row, ['BENEFICIARY ID', 'BEN_ID', 'BNF_SECTION_-ADHAAR_NUMBER_', 'BNF_SECTION-ADHAAR_NUMBER', 'ADHAAR']);
            const hhId = normalizeId(hhIdRaw);
            const bId = normalizeId(bIdRaw);
            
            if (!hhId && !bId) return;
            const activityName = getFuzzyValue(row, ['ACTIVITY', 'ACTIVITY_REGISTRATION-ACTIVITY']);
            const activity = getContribActivityColumn((activityName || "").replace(/^(BYP-|BFE-|AFT-)/i, ''));
            
            const code = getFuzzyValue(row, ['THIS_MATERIAL_CODE']);
            const materialId = getFuzzyValue(row, ['MATERIAL_ID']);
            const label = getFuzzyValue(row, ['THIS_MATERIAL_LABEL']);
            const count = parseFloat(getFuzzyValue(row, ['MATERIALS_DETAILS-MATERIAL_COUNT']) || "1");
            const distDate = getFuzzyValue(row, ['MATERIALS_DETAILS-DISTRIBUTED_DATE', 'DATE']);
            
            const unitContrib = activityTargetMap.get((materialId || "").trim().toLowerCase())
                  || activityTargetMap.get((code || "").trim().toLowerCase())
                  || activityTargetMap.get((label || "").trim().toLowerCase())
                  || 0;
            
            if (unitContrib > 0) {
                const keys = [];
                if (hhId) keys.push(`${hhId}-${activity}`);
                if (bId) keys.push(`${bId}-${activity}`);
                
                keys.forEach(key => {
                    farmerTargetMap.set(key, (farmerTargetMap.get(key) || 0) + (unitContrib * count));
                    if (!farmerProductsMap.has(key)) farmerProductsMap.set(key, []);
                    farmerProductsMap.get(key).push({
                        name: label || materialId || code || 'Product',
                        count,
                        unitContrib,
                        date: distDate
                    });
                });
            }
        });
        
        const distTargetMap = new Map<string, number>();
        const distCountMap = new Map<string, number>();
        
        rawDist.forEach(row => {
            const hhIdRaw = getFuzzyValue(row, ['HH_Id', 'HH_ID', 'HHID', 'HH ID', 'FARMER ID', 'LOCATION-FARMER_ID', 'LOCATION-SHOW_FARMER_ID', 'FARMER_ID', 'FID']);
            const bIdRaw = getFuzzyValue(row, ['BENEFICIARY ID', 'BEN_ID', 'BNF_SECTION_-ADHAAR_NUMBER_', 'BNF_SECTION-ADHAAR_NUMBER', 'ADHAAR']);
            const hhId = normalizeId(hhIdRaw);
            const bId = normalizeId(bIdRaw);
            const normId = hhId || bId;
            const baseline = normId ? baselineMap.get(normId) : null;
            
            const activityName = getFuzzyValue(row, ['ACTIVITY', 'ACTIVITY_REGISTRATION-ACTIVITY']);
            const activity = getContribActivityColumn((activityName || "").replace(/^(BYP-|BFE-|AFT-)/i, ''));
            
            const code = getFuzzyValue(row, ['THIS_MATERIAL_CODE']);
            const materialId = getFuzzyValue(row, ['MATERIAL_ID']);
            const label = getFuzzyValue(row, ['THIS_MATERIAL_LABEL']);
            const count = parseFloat(getFuzzyValue(row, ['MATERIALS_DETAILS-MATERIAL_COUNT']) || "1");
            const distDate = getFuzzyValue(row, ['MATERIALS_DETAILS-DISTRIBUTED_DATE', 'DATE']);
            
            const unitContrib = activityTargetMap.get((materialId || "").trim().toLowerCase())
                   || activityTargetMap.get((code || "").trim().toLowerCase())
                   || activityTargetMap.get((label || "").trim().toLowerCase())
                   || 0;
            
            if (unitContrib > 0 && baseline && activity) {
                const fy = getFinancialYear(distDate || "");
                const cluster = baseline.cluster || "";
                const key = `${cluster.toLowerCase()}|${activity.toLowerCase()}|${fy.toLowerCase()}`;
                distTargetMap.set(key, (distTargetMap.get(key) || 0) + (unitContrib * count));
                distCountMap.set(key, (distCountMap.get(key) || 0) + count);
            }
        });

        // 1. Fixed activities from Beneficiary Data
        beneficiaryCountMap.forEach((count, key) => {
            const [cluster, activity, financialYear] = key.split('|');
            const activityLower = activity.toLowerCase();
            
            if (!isAssetActivity(activityLower)) {
                let unitPrice = activityTargetMap.get(activityLower) || activityTargetMap.get(activityLower.replace(/byp-/, '')) || 0;
                
                if (unitPrice === 0) {
                    if (activityLower.includes('eco-farmpond') || activityLower.includes('eco farmpond')) unitPrice = 10000;
                    else if (activityLower === 'ns' || activityLower === 'byp-ns') unitPrice = 1000;
                    else if (activityLower === 'bfe' || activityLower === 'byp-bfe') unitPrice = 10000;
                    else if (activityLower.includes('goatery') || activityLower.includes('goat shed')) unitPrice = 6000;
                }
                
                if (unitPrice === 0) {
                       unitPrice = activityTotalContribMap.get(activityLower) || activityTotalContribMap.get(activityLower.replace(/byp-/, '')) || 0;
                }
                if (unitPrice > 0) {
                    const displayActivity = activityOptions.find(o => o.toLowerCase() === activityLower) || activity.toUpperCase();
                    const displayCluster = clusters.find(c => c.toLowerCase() === cluster) || (cluster.charAt(0).toUpperCase() + cluster.slice(1));
                    
                    targetMap.set(key, {
                        cluster: displayCluster,
                        activity: displayActivity,
                        target: count,
                        contributionTarget: count * unitPrice,
                        financialYear
                    });
                }
            }
        });

        // 2. Asset activities from Material Distribution Data
        distTargetMap.forEach((amount, key) => {
            const [cluster, activity, financialYear] = key.split('|');
            const activityLower = activity.toLowerCase();
            
            if (isAssetActivity(activityLower)) {
                const displayActivity = activityOptions.find(o => o.toLowerCase() === activity) || activity.toUpperCase();
                const displayCluster = clusters.find(c => c.toLowerCase() === cluster) || (cluster.charAt(0).toUpperCase() + cluster.slice(1));
                
                targetMap.set(key, {
                    cluster: displayCluster,
                    activity: displayActivity,
                    target: distCountMap.get(key) || 1,
                    contributionTarget: amount,
                    financialYear
                });
            }
        });

        setTargets(Array.from(targetMap.values()));
        


        const merged: MergedContribution[] = [];

        rawContrib.forEach((row, rowIndex) => {
          const rawId = getFuzzyValue(row, [
            "HH_Id", "HH_ID", "HHID", "HH ID", "FARMERID", "FID", "ID", "FARMER ID"
          ]);
          const normId = normalizeId(rawId);
          
          const date = getFuzzyValue(row, [
            "Date Of Deposite", "Date of deposit", "DATE", "TIMESTAMP", "TIME", "SUBMISSIONDATE", "Date"
          ]) || "N/A";
          
          const isNewFormat = Object.keys(row).some(k => k.toLowerCase().includes('activity_name') || k.toLowerCase().trim() === 'activity name');
          
          if (normId) {
            const baseline = baselineMap.get(normId);
            if (baseline) {
                if (isNewFormat) {
                    const actRaw = getFuzzyValue(row, ["Activity_name", "Activity Name", "Activity"]);
                    const amountRaw = getFuzzyValue(row, ["Contribution Amount", "Total Amount Paid ", "Amount"]);
                    
                    const amount = parseFloat((amountRaw || "").toString().replace(/[^0-9.]/g, "")) || 0;
                    
                    if (amount > 0 && actRaw) {
                        const normalizedActivity = mapTargetActivity(actRaw.toString().trim());
                        const products: { name: string; count: number; unitContrib: number; date: string }[] = farmerProductsMap.get(`${normId}-${normalizedActivity}`) || [];
                        let indTarget = farmerTargetMap.get(`${normId}-${normalizedActivity}`) || 0;
                        if (!indTarget || isNaN(indTarget)) {
                            const activityLower = normalizedActivity.toLowerCase();
                            let unitPrice = activityTargetMap.get(activityLower) || activityTargetMap.get(activityLower.replace(/byp-/, '')) || 0;
                            
                            if (activityLower.includes('eco-farmpond') || activityLower.includes('eco farmpond')) unitPrice = 10000;
                            else if (activityLower === 'ns' || activityLower === 'byp-ns') unitPrice = 1000;
                            else if (activityLower === 'bfe' || activityLower === 'byp-bfe') unitPrice = 10000;
                            else if (activityLower.includes('goatery') || activityLower.includes('goat shed')) unitPrice = 6000;
                            
                            if (unitPrice === 0) {
                                   unitPrice = activityTotalContribMap.get(activityLower) || activityTotalContribMap.get(activityLower.replace(/byp-/, '')) || 0;
                            }
                            indTarget = unitPrice;
                        }
                        merged.push({
                            id: `${normId}-${normalizedActivity}-${rowIndex}`,
                            farmerId: baseline.farmerId,
                            name: baseline.hhHeadName,
                            cluster: baseline.cluster,
                            gp: baseline.gp,
                            village: baseline.village,
                            category: baseline.category,
                            amount: amount,
                            activity: normalizedActivity,
                            date: date,
                            financialYear: determineFinancialYear(date),
                            productsReceived: products,
                            individualTarget: indTarget
                        });
                    }
                } else {
                  // Iterate over the identified activity columns in the sheet (old format)
                  sheetActivityMap.forEach((normalizedActivity, colName) => {
                    const valStr = row[colName] || "0";
                    const amount = parseFloat((valStr || "").toString().replace(/[^0-9.]/g, "")) || 0;

                    if (amount > 0) {
                      const products: { name: string; count: number; unitContrib: number; date: string }[] = farmerProductsMap.get(`${normId}-${normalizedActivity}`) || [];
                      let indTarget = farmerTargetMap.get(`${normId}-${normalizedActivity}`) || 0;
                        if (!indTarget || isNaN(indTarget)) {
                            const activityLower = normalizedActivity.toLowerCase();
                            let unitPrice = activityTargetMap.get(activityLower) || activityTargetMap.get(activityLower.replace(/byp-/, '')) || 0;
                            
                            if (activityLower.includes('eco-farmpond') || activityLower.includes('eco farmpond')) unitPrice = 10000;
                            else if (activityLower === 'ns' || activityLower === 'byp-ns') unitPrice = 1000;
                            else if (activityLower === 'bfe' || activityLower === 'byp-bfe') unitPrice = 10000;
                            else if (activityLower.includes('goatery') || activityLower.includes('goat shed')) unitPrice = 6000;
                            
                            if (unitPrice === 0) {
                                   unitPrice = activityTotalContribMap.get(activityLower) || activityTotalContribMap.get(activityLower.replace(/byp-/, '')) || 0;
                            }
                            indTarget = unitPrice;
                        }
                      merged.push({
                        id: `${normId}-${colName}-${rowIndex}`,
                        farmerId: baseline.farmerId,
                        name: baseline.hhHeadName,
                        cluster: baseline.cluster,
                        gp: baseline.gp,
                        village: baseline.village,
                        category: baseline.category,
                        amount: amount,
                        activity: normalizedActivity,
                        date: date,
                        financialYear: determineFinancialYear(date),
                        productsReceived: products,
                        individualTarget: indTarget
                      });
                    }
                  });
                }
            }
          }
        });

        setMergedData(
          merged.sort((a, b) => {
            const dateA = new Date(a.date).getTime() || 0;
            const dateB = new Date(b.date).getTime() || 0;
            if (dateB !== dateA) return dateB - dateA;
            return a.name.localeCompare(b.name);
          }),
        );
      } catch (err) {
        console.error("Data processing error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const clusters = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(mergedData.map((d) => d.cluster).filter(Boolean)),
      ).sort(),
    ],
    [mergedData],
  );
  const gps = useMemo(() => {
    const filtered =
      selectedCluster === "All"
        ? mergedData
        : mergedData.filter((d) => d.cluster === selectedCluster);
    return [
      "All",
      ...Array.from(new Set(filtered.map((d) => d.gp).filter(Boolean))).sort(),
    ];
  }, [mergedData, selectedCluster]);
  const villages = useMemo(() => {
    const filtered =
      selectedGP === "All"
        ? selectedCluster === "All"
          ? mergedData
          : mergedData.filter((d) => d.cluster === selectedCluster)
        : mergedData.filter((d) => d.gp === selectedGP);
    return [
      "All",
      ...Array.from(
        new Set(filtered.map((d) => d.village).filter(Boolean)),
      ).sort(),
    ];
  }, [mergedData, selectedCluster, selectedGP]);
  const activityOptions = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(mergedData.map((d) => d.activity).filter(Boolean)),
      ).sort(),
    ],
    [mergedData],
  );

  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return mergedData.filter((d) => {
      const matchesCluster =
        selectedCluster === "All" || d.cluster === selectedCluster;
      const matchesGP = selectedGP === "All" || d.gp === selectedGP;
      const matchesVillage =
        selectedVillage === "All" || d.village === selectedVillage;
      const matchesActivity =
        selectedActivity === "All" || d.activity === selectedActivity;
      const matchesFY =
        selectedFinancialYear === "All" || (d.financialYear || "").trim() === selectedFinancialYear;
      const matchesSearch =
        !query ||
        d.name.toLowerCase().includes(query) ||
        d.farmerId.toLowerCase().includes(query) ||
        d.activity.toLowerCase().includes(query);
      return (
        matchesCluster &&
        matchesGP &&
        matchesVillage &&
        matchesActivity &&
        matchesSearch &&
        matchesFY
      );
    });
  }, [
    mergedData,
    selectedCluster,
    selectedGP,
    selectedVillage,
    selectedActivity,
    selectedFinancialYear,
    searchQuery,
  ]);

  
  
  const stats = useMemo(() => {
    
    console.log("CALCULATING STATS. Targets length:", targets.length);
    if (targets.length > 0) {
        console.log("Sample target:", targets[0]);
    }

    const totalAmount = filteredData.reduce((acc, d) => acc + d.amount, 0);
    const uniqueFIDs = new Set(filteredData.map((d) => d.farmerId)).size;

    const clusterMap: Record<string, number> = {};
    const clusterFarmersMap: Record<string, Set<string>> = {};
    const activityMap: Record<string, number> = {};
    const activityFarmersMap: Record<string, Set<string>> = {};

    filteredData.forEach((d) => {
      clusterMap[d.cluster] = (clusterMap[d.cluster] || 0) + d.amount;
      if (!clusterFarmersMap[d.cluster]) clusterFarmersMap[d.cluster] = new Set();
      clusterFarmersMap[d.cluster].add(d.farmerId);
      
      activityMap[d.activity] = (activityMap[d.activity] || 0) + d.amount;
      if (!activityFarmersMap[d.activity]) activityFarmersMap[d.activity] = new Set();
      activityFarmersMap[d.activity].add(d.farmerId);
    });

    const allClusters = new Set([
      
      ...Object.keys(clusterMap),
      ...targets
        .filter(t => (selectedActivity === "All" || t.activity.toLowerCase() === selectedActivity.toLowerCase()) && (selectedFinancialYear === "All" || (t.financialYear || "").trim() === selectedFinancialYear))
        .map(t => t.cluster)
    ]);
    const clusterShare = Array.from(allClusters)
      .filter((c) => selectedCluster === "All" || c.toLowerCase() === selectedCluster.toLowerCase())
      .map((label) => {
        // Find variations with same lower case
        const targetLabelLower = label.toLowerCase();
        let val = 0;
        let farmersPaid = 0;
        Object.keys(clusterMap).forEach(k => {
            if (k.toLowerCase() === targetLabelLower) {
                val += clusterMap[k];
            }
        });
        Object.keys(clusterFarmersMap).forEach(k => {
            if (k.toLowerCase() === targetLabelLower) {
                farmersPaid += clusterFarmersMap[k].size;
            }
        });
        
        const clusterTargets = targets.filter(
          (t) =>
            t.cluster.toLowerCase() === targetLabelLower &&
            (selectedActivity === "All" || t.activity.toLowerCase() === selectedActivity.toLowerCase()) &&
            (selectedFinancialYear === "All" || (t.financialYear || "").trim() === selectedFinancialYear)
        );
        const target = clusterTargets.reduce(
          (acc, t) => acc + t.contributionTarget,
          0
        );
        return {
          label: label.charAt(0).toUpperCase() + label.slice(1),
          val,
          target,
          farmersPaid,
          percent: totalAmount > 0 ? (val / totalAmount) * 100 : 0,
        };
      })
      .filter((c) => c.val > 0 || c.target > 0)
      .reduce((acc, curr) => {
          const existing = acc.find(a => a.label.toLowerCase() === curr.label.toLowerCase());
          if (existing) {
              existing.val += curr.val;
              existing.target += curr.target;
              existing.farmersPaid += curr.farmersPaid;
          } else {
              acc.push(curr);
          }
          return acc;
      }, [])
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 3);

    const allActivities = new Set([
      ...Object.keys(activityMap),
      ...targets
        .filter(t => (selectedCluster === "All" || t.cluster.toLowerCase() === selectedCluster.toLowerCase()) && (selectedFinancialYear === "All" || (t.financialYear || "").trim() === selectedFinancialYear))
        .map(t => t.activity)
    ]);
    const activityShare = Array.from(allActivities)
      .map((label) => {
        const targetLabelLower = label.toLowerCase();
        let val = 0;
        let farmersPaid = 0;
        Object.keys(activityMap).forEach(k => {
            if (k.toLowerCase() === targetLabelLower) val += activityMap[k];
        });
        Object.keys(activityFarmersMap).forEach(k => {
            if (k.toLowerCase() === targetLabelLower) farmersPaid += activityFarmersMap[k].size;
        });

        const actTargets = targets.filter(
          (t) =>
            t.activity.toLowerCase() === targetLabelLower &&
            (selectedCluster === "All" || t.cluster.toLowerCase() === selectedCluster.toLowerCase()) &&
            (selectedFinancialYear === "All" || (t.financialYear || "").trim() === selectedFinancialYear)
        );
        const target = actTargets.reduce(
          (acc, t) => acc + t.contributionTarget,
          0
        );
        return {
          label: label.toUpperCase(),
          val,
          target,
          farmersPaid,
          percent: totalAmount > 0 ? (val / totalAmount) * 100 : 0,
        };
      })
      .filter((a) => a.val > 0 || a.target > 0)
      .reduce((acc, curr) => {
          const existing = acc.find(a => a.label.toLowerCase() === curr.label.toLowerCase());
          if (existing) {
              existing.val += curr.val;
              existing.target += curr.target;
              existing.farmersPaid += curr.farmersPaid;
          } else {
              acc.push(curr);
          }
          return acc;
      }, [])
      .sort((a, b) => b.percent - a.percent);

    // Filter targets
    const filteredTargets = targets.filter((t) => {
      const matchesCluster =
        selectedCluster === "All" || t.cluster.toLowerCase() === selectedCluster.toLowerCase();
      const matchesActivity =
        selectedActivity === "All" || t.activity.toLowerCase() === selectedActivity.toLowerCase();
      const matchesFY =
        selectedFinancialYear === "All" || (t.financialYear || "").trim() === selectedFinancialYear;
      return matchesCluster && matchesActivity && matchesFY;
    });

    const totalTarget = filteredTargets.reduce(
      (acc, t) => acc + t.contributionTarget,
      0
    );

        // Top Contributors
    const topContributorsMap = new Map<string, { name: string, cluster: string, amount: number, activities: Set<string> }>();
    filteredData.forEach(d => {
        if (!topContributorsMap.has(d.farmerId)) {
            topContributorsMap.set(d.farmerId, { name: d.name, cluster: d.cluster, amount: 0, activities: new Set() });
        }
        const entry = topContributorsMap.get(d.farmerId)!;
        entry.amount += d.amount;
                    entry.target = Math.max(entry.target, d.individualTarget || 0);
        entry.activities.add(d.activity);
    });
    const topContributors = Array.from(topContributorsMap.values())
        .map(entry => ({ ...entry, activity: Array.from(entry.activities).join(", ") }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

    // Monthly Trend
    const monthlyMap = new Map<string, { year: number, monthNum: number, label: string, val: number }>();
    filteredData.forEach(d => {
        if (d.date && d.date !== 'N/A') {
            const parsedDate = new Date(d.date);
            if (!isNaN(parsedDate.getTime())) {
                const year = parsedDate.getFullYear();
                const monthNum = parsedDate.getMonth();
                const label = parsedDate.toLocaleString('default', { month: 'short' }) + ' ' + year;
                const sortKey = `${year}-${monthNum.toString().padStart(2, '0')}`;
                
                if (!monthlyMap.has(sortKey)) {
                    monthlyMap.set(sortKey, { year, monthNum, label, val: 0 });
                }
                monthlyMap.get(sortKey)!.val += d.amount;
            }
        }
    });
    
    
    const monthlyTrend = Array.from(monthlyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(e => {
            return {
                month: e[1].label,
                val: e[1].val,
                year: e[1].year.toString(),
                target: totalTarget
            };
        });

    return {
      totalAmount,
      totalTarget,
      count: filteredData.length,
      uniqueFIDs,
      clusterShare,
      activityShare,
      topContributors,
      monthlyTrend,
    };
  }, [filteredData, targets, selectedCluster, selectedActivity, selectedFinancialYear]);

  const financialYears = useMemo(() => {
    const fromTargets = targets.map((t) => (t.financialYear || "").trim());
    const fromMerged = mergedData.map((d) => (d.financialYear || "").trim());
    return [
      "All",
      ...Array.from(new Set([...fromTargets, ...fromMerged].filter(f => f && f !== 'N/A'))).sort()
    ];
  }, [targets, mergedData]);

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 font-black uppercase tracking-widest text-[10px] animate-pulse">
          Mapping Activity Contributions...
        </p>
      </div>
    );

  const achievementPercent = stats.totalTarget > 0 ? ((stats.totalAmount / stats.totalTarget) * 100).toFixed(2) : "0.00";
  const pendingContribution = Math.max(0, stats.totalTarget - stats.totalAmount);
  
  // Mock data for sparklines and trends
  const mockTrend = [
    { value: 20 }, { value: 35 }, { value: 25 }, { value: 45 }, { value: 30 }, { value: 55 }, { value: 60 }
  ];

  return (
    <div className="space-y-4 animate-fade-in w-full pb-12 font-sans bg-[#0f111a] min-h-screen text-white p-4 md:p-6 rounded-3xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h2 className="text-xl font-bold">Contribution Dashboard</h2>
        
      </div>
      {/* Top KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Paid */}
        <div className="bg-[#1e2333] p-5 rounded-2xl shadow-lg border border-gray-800 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400">Total Paid Contribution</p>
              <h2 className="text-2xl font-black text-[#10B981] mt-1">₹{stats.totalAmount.toLocaleString()}</h2>
              <p className="text-[10px] text-gray-500 mt-1">From {stats.uniqueFIDs} Contributors</p>
            </div>
            <div className="p-2 bg-[#10B981]/10 rounded-lg">
              <svg className="w-5 h-5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
            </div>
          </div>
          <div className="flex items-end justify-between mt-4">
             
             <div className="w-16 h-8">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={mockTrend}>
                   <Bar dataKey="value" fill="#10B981" radius={[2,2,0,0]} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>

        {/* Card 2: Target Contribution */}
        <div className="bg-[#1e2333] p-5 rounded-2xl shadow-lg border border-gray-800 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400">Target Contribution</p>
              <h2 className="text-2xl font-black text-white mt-1">₹{stats.totalTarget.toLocaleString()}</h2>
              <p className="text-[10px] text-gray-500 mt-1">For {stats.count} Instances</p>
            </div>
            <div className="p-2 bg-[#8B5CF6]/10 rounded-lg">
              <svg className="w-5 h-5 text-[#8B5CF6]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
          </div>
          <div className="flex items-end justify-between mt-4">
             
             <div className="w-16 h-8">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={mockTrend}>
                   <Bar dataKey="value" fill="#8B5CF6" radius={[2,2,0,0]} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>

        {/* Card 3: Achievement % */}
        <div className="bg-[#1e2333] p-5 rounded-2xl shadow-lg border border-gray-800 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400">Achievement %</p>
              <h2 className="text-2xl font-black text-white mt-1">{achievementPercent}%</h2>
              <p className="text-[10px] text-gray-500 mt-1">Overall Achievement</p>
            </div>
            <div className="p-2 bg-[#F59E0B]/10 rounded-lg">
              <svg className="w-5 h-5 text-[#F59E0B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            </div>
          </div>
          <div className="flex items-end justify-between mt-4">
             
             <div className="w-16 h-8">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={mockTrend}>
                   <Bar dataKey="value" fill="#F59E0B" radius={[2,2,0,0]} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>

        {/* Card 4: Pending Contribution */}
        <div className="bg-[#1e2333] p-5 rounded-2xl shadow-lg border border-gray-800 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400">Pending Contribution</p>
              <h2 className="text-2xl font-black text-white mt-1">₹{pendingContribution.toLocaleString()}</h2>
              <p className="text-[10px] text-gray-500 mt-1">Yet to be Collected</p>
            </div>
            <div className="p-2 bg-[#EF4444]/10 rounded-lg">
              <svg className="w-5 h-5 text-[#EF4444]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
          </div>
          <div className="flex items-end justify-between mt-4">
             
             <div className="w-16 h-8">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={mockTrend}>
                   <Bar dataKey="value" fill="#EF4444" radius={[2,2,0,0]} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Left Column (Bar Chart) - 4 cols */}
        <div className="xl:col-span-5 bg-[#1e2333] p-5 rounded-2xl shadow-lg border border-gray-800 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-300">Cluster Target vs Achievement</h3>
            <div className="flex items-center gap-4 text-[10px] font-bold">
               
               <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#F59E0B] rounded-sm"></div>Target</div><div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#10B981] rounded-sm"></div>Collected</div>
            </div>
          </div>
          <div className="flex-1 w-full min-h-[250px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={stats.clusterShare} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                 <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                 <YAxis tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9CA3AF" }} width={50} />
                 <RechartsTooltip cursor={{ fill: "#374151", opacity: 0.4 }} contentStyle={{ backgroundColor: "#1e2333", border: "1px solid #374151", borderRadius: "8px" }} formatter={(value) => `₹${Number(value).toLocaleString()}`} />
                 <Bar dataKey="target" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={12}><LabelList dataKey="target" position="top" fill="#9CA3AF" fontSize={10} formatter={(value) => `₹${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`} /></Bar>
                 <Bar dataKey="val" fill="#10B981" radius={[4, 4, 0, 0]} barSize={12} />
               </BarChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* Middle Column (Activity Chart) - 4 cols */}
        <div className="xl:col-span-4 bg-[#1e2333] p-5 rounded-2xl shadow-lg border border-gray-800 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-300">Activity Target vs Achievement</h3>
            <div className="flex items-center gap-4 text-[10px] font-bold">
               <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#F59E0B] rounded-sm"></div>Target</div>
               <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#10B981] rounded-sm"></div>Collected</div>
            </div>
          </div>
          <div className="flex-1 w-full min-h-[250px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={stats.activityShare.slice(0, 8)} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                 <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#374151" />
                 <XAxis type="number" tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                 <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#9CA3AF" }} width={80} />
                 <RechartsTooltip cursor={{ fill: "#374151", opacity: 0.4 }} contentStyle={{ backgroundColor: "#1e2333", border: "1px solid #374151", borderRadius: "8px" }} formatter={(value) => `₹${Number(value).toLocaleString()}`} />
                 <Bar dataKey="target" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={8} />
                 <Bar dataKey="val" fill="#10B981" radius={[0, 4, 4, 0]} barSize={8} />
               </BarChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column (Clusters) - 3 cols */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          <div className="bg-[#1e2333] p-5 rounded-2xl shadow-lg border border-gray-800 flex-1">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-xs font-black uppercase tracking-widest text-gray-300">Top Performing Clusters</h3>
               <button className="text-[10px] bg-[#2a3042] px-2 py-1 rounded text-gray-300 hover:text-white transition-colors">View All</button>
             </div>
             <div className="flex flex-col gap-4 mt-2">
               {stats.clusterShare.slice(0, 3).map((c, idx) => {
                 const colors = ["#F59E0B", "#3B82F6", "#EF4444"];
                 return (
                   <div key={idx} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: colors[idx % colors.length] }}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                           <span className="font-bold text-gray-200">{c.label}</span>
                           <span className="text-gray-400">{c.percent.toFixed(2)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5">
                           <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, c.percent)}%`, backgroundColor: colors[idx % colors.length] }}></div>
                        </div>
                      </div>
                   </div>
                 )
               })}
             </div>
          </div>
        </div>
      </div>
      
      {/* Bottom Row */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Trend Line Chart */}
        <div className="xl:col-span-5 bg-[#1e2333] p-5 rounded-2xl shadow-lg border border-gray-800 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-300">Contribution Trend (Monthly)</h3>
            <select 
              className="bg-[#2a3042] text-white border border-gray-700 rounded px-2 py-1 text-[10px] outline-none"
              value={trendYear}
              onChange={(e) => setTrendYear(e.target.value)}
            >
              <option value="All">All Years</option>
              {Array.from(new Set(stats.monthlyTrend.map(t => t.year))).sort().map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <div className="flex items-center gap-4 text-[10px] font-bold">
               <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#10B981] rounded-sm"></div>Collected</div>
            </div>
          </div>
          <div className="flex-1 w-full min-h-[250px]">
             {/* Mock line chart data */}
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={trendYear === "All" ? stats.monthlyTrend : stats.monthlyTrend.filter(t => t.year === trendYear)} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                 <YAxis tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9CA3AF" }} width={50} />
                 <RechartsTooltip cursor={{ fill: "#374151", opacity: 0.4 }} contentStyle={{ backgroundColor: "#1e2333", border: "1px solid #374151", borderRadius: "8px" }} formatter={(value) => `₹${Number(value).toLocaleString()}`} />
                 
                 <Line type="monotone" dataKey="val" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#1e2333', stroke: '#10B981', strokeWidth: 2 }} activeDot={{ r: 6 }} />
               </LineChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* Top Contributors Table */}
        <div className="xl:col-span-4 bg-[#1e2333] p-5 rounded-2xl shadow-lg border border-gray-800 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-300">Top Contributors</h3>
            <button className="text-[10px] bg-[#2a3042] px-2 py-1 rounded text-gray-300 hover:text-white transition-colors">View All</button>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="pb-3 font-medium">Contributor</th>
                  <th className="pb-3 font-medium">Cluster</th>
                  <th className="pb-3 font-medium text-right">Collected Amount</th>
                  <th className="pb-3 font-medium text-center">Activity</th>
                </tr>
              </thead>
              <tbody className="text-gray-200">
                {stats.topContributors.map((c, i) => (
                  <tr key={i} className="border-b border-gray-800/50 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="py-3">{c.name}</td>
                    <td className="py-3 text-gray-400">{c.cluster}</td>
                    <td className="py-3 text-right font-bold">₹{c.amount.toLocaleString()}</td>
                    <td className="py-3 text-center text-gray-400">{c.activity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Insights */}
        <div className="xl:col-span-3 bg-[#1e2333] p-5 rounded-2xl shadow-lg border border-gray-800 flex flex-col">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-300 mb-4">Quick Insights</h3>
          <div className="flex flex-col gap-4 flex-1 justify-center">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-md mt-0.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                {stats.clusterShare.length > 0 ? stats.clusterShare[0].label : "Cluster 3"} has the highest achievement at 
                <span className="font-bold text-white ml-1">{stats.clusterShare.length > 0 ? stats.clusterShare[0].percent.toFixed(2) : "62.45"}%</span>
              </p>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-md mt-0.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                <span className="font-bold text-white mr-1">{stats.activityShare.length > 0 ? stats.activityShare[0].label : "ASC"}</span> 
                activity has the highest collection
              </p>
            </div>
            
            
            
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-rose-500/20 text-rose-400 rounded-md mt-0.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                <span className="font-bold text-white mr-1">{achievementPercent}%</span> of total target has been achieved
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Pills Bottom */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
         <div className="bg-[#1e2333] p-4 rounded-xl border border-gray-800 flex items-center gap-4">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg></div>
            <div>
               <h4 className="text-lg font-black text-white">{stats.count}</h4>
               <p className="text-[10px] text-gray-400">Total Instances</p>
            </div>
         </div>
         <div className="bg-[#1e2333] p-4 rounded-xl border border-gray-800 flex items-center gap-4">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg></div>
            <div>
               <h4 className="text-lg font-black text-white">{stats.uniqueFIDs}</h4>
               <p className="text-[10px] text-gray-400">Total Contributors</p>
            </div>
         </div>
         <div className="bg-[#1e2333] p-4 rounded-xl border border-gray-800 flex items-center gap-4">
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
            <div>
               <h4 className="text-lg font-black text-white">1,982</h4>
               <p className="text-[10px] text-gray-400">Total Collections</p>
            </div>
         </div>
         
         <div className="bg-[#1e2333] p-4 rounded-xl border border-gray-800 flex items-center gap-4">
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
            <div>
               <h4 className="text-lg font-black text-white">₹{(pendingContribution / 1000000).toFixed(2)}M</h4>
               <p className="text-[10px] text-gray-400">Pending Amount</p>
            </div>
         </div>
         
      </div>
      
      
      {/* Filters & Farmer Details Table */}
      <div className="bg-[#1e2333] p-5 rounded-2xl shadow-lg border border-gray-800 flex flex-col gap-4 mt-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-300">Farmer Details</h3>
            
            <div className="flex flex-wrap items-center gap-3">
             <select
               className="bg-[#0f111a] text-white border border-gray-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
               value={selectedCluster}
               onChange={(e) => {
                 setSelectedCluster(e.target.value);
                 setSelectedGP("All");
                 setSelectedVillage("All");
                 setCurrentPage(1);
               }}
             >
               {clusters.map((c) => (
                 <option key={c} value={c}>
                   {c === "All" ? "All Clusters" : c}
                 </option>
               ))}
             </select>

             <select
               className="bg-[#0f111a] text-white border border-gray-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
               value={selectedGP}
               onChange={(e) => {
                 setSelectedGP(e.target.value);
                 setSelectedVillage("All");
                 setCurrentPage(1);
               }}
               disabled={selectedCluster === "All"}
             >
               {gps.map((g) => (
                 <option key={g} value={g}>
                   {g === "All" ? "All GPs" : g}
                 </option>
               ))}
             </select>

             <select
               className="bg-[#0f111a] text-white border border-gray-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
               value={selectedVillage}
               onChange={(e) => { setSelectedVillage(e.target.value); setCurrentPage(1); }}
               disabled={selectedGP === "All"}
             >
               {villages.map((v) => (
                 <option key={v} value={v}>
                   {v === "All" ? "All Villages" : v}
                 </option>
               ))}
             </select>
             
             <select
               className="bg-[#0f111a] text-white border border-gray-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
               value={selectedActivity}
               onChange={(e) => { setSelectedActivity(e.target.value); setCurrentPage(1); }}
             >
               {activityOptions.map((a) => (
                 <option key={a} value={a}>
                   {a === "All" ? "All Activities" : a}
                 </option>
               ))}
             </select>

             <input
               type="text"
               placeholder="Search farmers..."
               className="bg-[#0f111a] text-white border border-gray-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500 min-w-[150px]"
               value={searchQuery}
               onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
             />
            </div>
        </div>

        <div className="flex-1 overflow-x-auto mt-2">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="text-gray-400 border-b border-gray-800 bg-[#2a3042]/50">
              <tr>
                <th className="p-3 font-medium rounded-tl-lg">Farmer ID</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Cluster</th>
                <th className="p-3 font-medium">GP</th>
                <th className="p-3 font-medium">Village</th>
                <th className="p-3 font-medium">Activity</th>
                <th className="p-3 font-medium text-right">Target</th>
                <th className="p-3 font-medium text-right">Achievement</th>
                <th className="p-3 font-medium text-right rounded-tr-lg">% Achieved</th>
              </tr>
            </thead>
            <tbody className="text-gray-200">
              {(() => {
                const map = new Map();
                filteredData.forEach(d => {
                    const key = `${d.farmerId}-${d.activity}`;
                    if (!map.has(key)) {
                        map.set(key, {
                            farmerId: d.farmerId,
                            name: d.name,
                            cluster: d.cluster,
                            gp: d.gp,
                            village: d.village,
                            activity: d.activity,
                            amount: 0,
                            target: d.individualTarget || 0,
                        });
                    }
                    const entry = map.get(key);
                    entry.amount += d.amount;
                    entry.target = Math.max(entry.target, d.individualTarget || 0);
                });
                
                const grouped = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
                const start = (currentPage - 1) * 10;
                const paginated = grouped.slice(start, start + 10);
                const totalPages = Math.ceil(grouped.length / 10);
                
                return (
                  <>
                    {paginated.map((r, i) => (
                      <tr key={i} className="border-b border-gray-800/50 last:border-0 hover:bg-white/5 transition-colors">
                        <td className="p-3 font-mono text-[10px] text-gray-400">{r.farmerId}</td>
                        <td className="p-3 font-medium">{r.name}</td>
                        <td className="p-3 text-gray-400">{r.cluster}</td>
                        <td className="p-3 text-gray-400">{r.gp}</td>
                        <td className="p-3 text-gray-400">{r.village}</td>
                        <td className="p-3">
                          <span className="bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded text-[10px] font-bold">
                            {r.activity}
                          </span>
                        </td>
                        <td className="p-3 text-right text-gray-400">₹{r.target.toLocaleString()}</td>
                        <td className="p-3 text-right font-bold text-[#10B981]">₹{r.amount.toLocaleString()}</td>
                        <td className="p-3 text-right">
                          {r.target > 0 ? (
                            <span className={r.amount >= r.target ? "text-[#10B981]" : "text-[#F59E0B]"}>
                              {((r.amount / r.target) * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-500">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {grouped.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-gray-500">
                          No records found matching the current filters.
                        </td>
                      </tr>
                    )}
                    {grouped.length > 0 && (
                      <tr className="bg-transparent">
                        <td colSpan={9} className="p-3 text-center">
                          <div className="flex justify-between items-center text-xs text-gray-400">
                            <span>Showing {start + 1} to {Math.min(start + 10, grouped.length)} of {grouped.length} entries</span>
                            <div className="flex gap-2">
                              <button 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="px-3 py-1 bg-[#2a3042] rounded disabled:opacity-50 hover:bg-[#374151] transition-colors"
                              >
                                Prev
                              </button>
                              <button 
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                className="px-3 py-1 bg-[#2a3042] rounded disabled:opacity-50 hover:bg-[#374151] transition-colors"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default ContributionPage;
