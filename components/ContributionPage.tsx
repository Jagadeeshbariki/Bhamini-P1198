import React, { useState, useEffect, useMemo } from "react";
import {
  BASELINE_DATA_URL,
  CONTRIBUTION_DATA_URL,
  MASTER_TARGETS_URL,
  MATERIAL_CONTRIBUTION_URL,
  ASSET_DISTRIBUTION_URL,
  getProxyUrl,
} from "../config";
import {
  BarChart,
  Bar,
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
  individualTarget?: number;
  productsReceived?: { name: string; count: number; unitContrib: number; date: string }[];
}

const CHART_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#3b82f6",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
];

const PieChart: React.FC<{ data: { label: string; percent: number }[] }> = ({
  data,
}) => {
  const radius = 40;
  const circ = 2 * Math.PI * radius;

  if (data.length === 0)
    return <div className="text-[10px] font-black text-gray-300">NO DATA</div>;

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
      {data.map((item, idx) => {
        const dash = (item.percent / 100) * circ;
        const offset = circ - dash;
        const stroke = CHART_COLORS[idx % CHART_COLORS.length];

        // Calculate cumulative rotation based on previous items
        const rotation =
          (data.slice(0, idx).reduce((acc, curr) => acc + curr.percent, 0) /
            100) *
          360;

        return (
          <circle
            key={idx}
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke={stroke}
            strokeWidth="12"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{
              transformOrigin: "center",
              transform: `rotate(${rotation}deg)`,
              transition: "all 1s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        );
      })}
      <circle
        cx="50"
        cy="50"
        r="30"
        fill="white"
        className="dark:fill-gray-800"
      />
    </svg>
  );
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
  const [searchQuery, setSearchQuery] = useState("");

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

  const getFuzzyValue = (row: any, keys: string[]) => {
    const rowKeys = Object.keys(row);
    for (const k of keys) {
      const match = rowKeys.find((rk) => {
        const rkUpper = rk.toUpperCase();
        const kUpper = k.toUpperCase();
        return (
          rkUpper === kUpper ||
          rkUpper.includes(kUpper) ||
          kUpper.includes(rkUpper)
        );
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
        const [baselineRes, contribRes, targetsRes, materialRes, distRes] = await Promise.all([
          fetch(getProxyUrl(`${BASELINE_DATA_URL}&cb=${Date.now()}`)),
          fetch(getProxyUrl(`${CONTRIBUTION_DATA_URL}&cb=${Date.now()}`)),
          fetch(getProxyUrl(`${MASTER_TARGETS_URL}&cb=${Date.now()}`)),
          fetch(getProxyUrl(`${MATERIAL_CONTRIBUTION_URL}&cb=${Date.now()}`)),
          fetch(getProxyUrl(`${ASSET_DISTRIBUTION_URL}&cb=${Date.now()}`)),
        ]);

        if (!baselineRes.ok || !contribRes.ok) {
          throw new Error(`Synchronization failure. baseline: ${baselineRes.status}, contrib: ${contribRes.status}`);
        }

        const baselineText = await baselineRes.text();
        const contribText = await contribRes.text();
        const targetsText = targetsRes.ok ? await targetsRes.text() : "";
        const materialText = materialRes.ok ? await materialRes.text() : "";
        const distText = distRes.ok ? await distRes.text() : "";

        const rawBaseline = parseCSV(baselineText);
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

        const parsedTargets = rawTargets.map((r) => {
          const activity = mapTargetActivity(r["ACTIVITY"] || r["activity"] || "");
          let target = parseFloat(r["TARGET"] || "0") || 0;
          let unitPrice = 0;
          const activityLower = activity.toLowerCase();
          
          unitPrice = activityTargetMap.get(activityLower) || activityTargetMap.get(activityLower.replace(/byp-/, '')) || 0;
          
          if (unitPrice === 0) {
                 if (activityLower.includes('eco-farmpond') || activityLower.includes('eco farmpond')) unitPrice = activityTargetMap.get('eco-farm pond') || 10000;
                 else if (activityLower === 'ns' || activityLower === 'byp-ns') unitPrice = activityTargetMap.get('ns') || 1000;
                 else if (activityLower === 'bfe' || activityLower === 'byp-bfe') unitPrice = activityTargetMap.get('bfe') || 10000;
                 else if (activityLower.includes('goatery')) unitPrice = activityTargetMap.get('goat shed') || 6000;
          }
          
          if (unitPrice === 0) {
                 unitPrice = activityTotalContribMap.get(activityLower) || activityTotalContribMap.get(activityLower.replace(/byp-/, '')) || 0;
          }

          // Default missing target counts to 1 if unitPrice exists and the row was explicitly provided for this activity
          if (target === 0 && (r["TARGET"] === undefined || r["TARGET"] === "") && unitPrice > 0) {
              target = 1;
          }

          let contributionTarget = parseFloat(r["CONTRIBUTION TARGET"] || r["contribution target"] || "0") || 0;
          if (contributionTarget === 0 && unitPrice > 0) {
              contributionTarget = target * unitPrice;
          }
          
          return {
            cluster: r["CLUSTER"] || r["cluster"] || "",
            activity,
            target,
            contributionTarget,
            financialYear: r["FINANCIAL YEAR"] || r["financial year"] || r["Financial Year"] || r["financial_year"] || "",
          };
        });
        setTargets(parsedTargets);

        const baselineMap = new Map<string, BaselineRecord>();
        rawBaseline.forEach((row) => {
          const rawId = getFuzzyValue(row, [
            "FARMERID",
            "FID",
            "ID",
            "FARMER ID",
            "HHID",
            "HH ID",
            "HH_ID",
          ]);
          const normId = normalizeId(rawId);
          if (normId) {
            baselineMap.set(normId, {
              farmerId: (rawId || "").toString(),
              hhHeadName: getFuzzyValue(row, [
                "HHHEADNAME",
                "FARMERNAME",
                "NAME",
                "BENEFICIARYNAME",
              ]),
              cluster: getFuzzyValue(row, ["CLUSTER"]),
              gp: getFuzzyValue(row, ["GP", "GRAMPANCHAYAT"]),
              village: getFuzzyValue(row, ["VILLAGE"]),
              category: getFuzzyValue(row, ["CATEGORY", "CASTE"]),
            });
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

        rawDist.forEach(row => {
            const hhIdRaw = getFuzzyValue(row, ['HH ID', 'FARMER ID', 'LOCATION-FARMER_ID', 'LOCATION-SHOW_FARMER_ID', 'FARMER_ID', 'FID']);
            const bIdRaw = getFuzzyValue(row, ['BENEFICIARY ID', 'BEN_ID', 'BNF_SECTION_-ADHAAR_NUMBER_', 'BNF_SECTION-ADHAAR_NUMBER', 'ADHAAR']);
            const hhId = normalizeId(hhIdRaw);
            const bId = normalizeId(bIdRaw);
            
            if (!hhId && !bId) return;

            const activityName = getFuzzyValue(row, ['ACTIVITY', 'ACTIVITY_REGISTRATION-ACTIVITY']);
            const activity = getContribActivityColumn(activityName.replace(/^(BYP-|BFE-|AFT-)/i, ''));
            
            const code = getFuzzyValue(row, ['THIS_MATERIAL_CODE']);
            const materialId = getFuzzyValue(row, ['MATERIAL_ID']);
            const label = getFuzzyValue(row, ['THIS_MATERIAL_LABEL']);
            const count = parseFloat(getFuzzyValue(row, ['MATERIALS_DETAILS-MATERIAL_COUNT'])) || 1;
            const distDate = getFuzzyValue(row, ['MATERIALS_DETAILS-DISTRIBUTED_DATE', 'DATE']);
            
            const unitContrib = activityTargetMap.get(materialId.trim().toLowerCase()) 
                 || activityTargetMap.get(code.trim().toLowerCase()) 
                 || activityTargetMap.get(label.trim().toLowerCase()) 
                 || 0;
            
            if (unitContrib > 0) {
                const keys = [];
                if (hhId) keys.push(`${hhId}-${activity}`);
                if (bId) keys.push(`${bId}-${activity}`);
                
                keys.forEach(key => {
                    farmerTargetMap.set(key, (farmerTargetMap.get(key) || 0) + (unitContrib * count));
                    if (!farmerProductsMap.has(key)) farmerProductsMap.set(key, []);
                    farmerProductsMap.get(key)!.push({
                        name: label || materialId || code || 'Product',
                        count,
                        unitContrib,
                        date: distDate
                    });
                });
            }
        });

        const merged: MergedContribution[] = [];
        rawContrib.forEach((row, rowIndex) => {
          const rawId = getFuzzyValue(row, [
            "FARMERID",
            "FID",
            "ID",
            "FARMER ID",
            "HHID",
            "HH ID",
            "HH_ID",
          ]);
          const normId = normalizeId(rawId);
          const date =
            getFuzzyValue(row, [
              "DATE",
              "TIMESTAMP",
              "TIME",
              "SUBMISSIONDATE",
            ]) || "N/A";

          if (normId) {
            const baseline = baselineMap.get(normId);
            if (baseline) {
              // Iterate over the identified activity columns in the sheet
              sheetActivityMap.forEach((normalizedActivity, colName) => {
                const valStr = row[colName] || "0";
                const amount =
                  parseFloat(
                    (valStr || "").toString().replace(/[^0-9.]/g, ""),
                  ) || 0;

                if (amount > 0) {
                  const products: { name: string; count: number; unitContrib: number; date: string }[] = farmerProductsMap.get(`${normId}-${normalizedActivity}`) || [];
                  const indTarget = farmerTargetMap.get(`${normId}-${normalizedActivity}`) || 0;
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
                    individualTarget: indTarget,
                    productsReceived: products.length > 0 ? products : undefined
                  });
                }
              });
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
        matchesSearch
      );
    });
  }, [
    mergedData,
    selectedCluster,
    selectedGP,
    selectedVillage,
    selectedActivity,
    searchQuery,
  ]);

  const stats = useMemo(() => {
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
        .filter(t => (selectedActivity === "All" || t.activity === selectedActivity) && (selectedFinancialYear === "All" || t.financialYear === selectedFinancialYear))
        .map(t => t.cluster)
    ]);

    const clusterShare = Array.from(allClusters)
      .filter((c) => selectedCluster === "All" || c === selectedCluster)
      .map((label) => {
        const val = clusterMap[label] || 0;
        const farmersPaid = clusterFarmersMap[label] ? clusterFarmersMap[label].size : 0;
        const clusterTargets = targets.filter(
          (t) =>
            t.cluster === label &&
            (selectedActivity === "All" || t.activity === selectedActivity) &&
            (selectedFinancialYear === "All" || t.financialYear === selectedFinancialYear)
        );
        const target = clusterTargets.reduce(
          (acc, t) => acc + t.contributionTarget,
          0
        );
        return {
          label,
          val,
          target,
          farmersPaid,
          percent: totalAmount > 0 ? (val / totalAmount) * 100 : 0,
        };
      })
      .filter((c) => c.val > 0 || c.target > 0)
      .sort((a, b) => b.percent - a.percent);

    const allActivities = new Set([
      ...Object.keys(activityMap),
      ...targets
        .filter(t => (selectedCluster === "All" || t.cluster === selectedCluster) && (selectedFinancialYear === "All" || t.financialYear === selectedFinancialYear))
        .map(t => t.activity)
    ]);

    const activityShare = Array.from(allActivities)
      .map((label) => {
        const val = activityMap[label] || 0;
        const farmersPaid = activityFarmersMap[label] ? activityFarmersMap[label].size : 0;
        const actTargets = targets.filter(
          (t) =>
            t.activity === label &&
            (selectedCluster === "All" || t.cluster === selectedCluster) &&
            (selectedFinancialYear === "All" || t.financialYear === selectedFinancialYear)
        );
        const target = actTargets.reduce(
          (acc, t) => acc + t.contributionTarget,
          0
        );
        return {
          label,
          val,
          target,
          farmersPaid,
          percent: totalAmount > 0 ? (val / totalAmount) * 100 : 0,
        };
      })
      .filter((a) => a.val > 0 || a.target > 0)
      .sort((a, b) => b.percent - a.percent);

    // Filter targets
    const filteredTargets = targets.filter((t) => {
      const matchesCluster =
        selectedCluster === "All" || t.cluster === selectedCluster;
      const matchesActivity =
        selectedActivity === "All" || t.activity === selectedActivity;
      const matchesFY =
        selectedFinancialYear === "All" || t.financialYear === selectedFinancialYear;
      return matchesCluster && matchesActivity && matchesFY;
    });
    const totalTarget = filteredTargets.reduce(
      (acc, t) => acc + t.contributionTarget,
      0
    );

    return {
      totalAmount,
      totalTarget,
      count: filteredData.length,
      uniqueFIDs,
      clusterShare,
      activityShare,
    };
  }, [filteredData, targets, selectedCluster, selectedActivity, selectedFinancialYear]);

  const financialYears = useMemo(() => {
    return [
      "All",
      ...Array.from(new Set(targets.map((t) => t.financialYear).filter(Boolean))).sort()
    ];
  }, [targets]);

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 font-black uppercase tracking-widest text-[10px] animate-pulse">
          Mapping Activity Contributions...
        </p>
      </div>
    );

  return (
    <div className="space-y-6 animate-fade-in w-full pb-12">
      {/* Top Row: KPI Box & Cluster Target vs Achievement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* KPI Box */}
        <div className="bg-[#111827] p-6 md:p-8 rounded-[2rem] shadow-xl flex flex-col font-sans h-[380px] relative justify-center">
          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-black uppercase tracking-widest text-emerald-400">Paid Contribution</p>
              <div className="flex flex-col">
                 <h2 className="text-4xl lg:text-5xl font-black text-emerald-500">₹{stats.totalAmount.toLocaleString()}</h2>
                 <span className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-widest mt-1">
                   from {stats.uniqueFIDs} contributors
                 </span>
              </div>
            </div>

            <div className="w-full h-px bg-gray-700/50"></div>

            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-black uppercase tracking-widest text-gray-400">Target Contribution</p>
              <div className="flex flex-col">
                 <h2 className="text-3xl lg:text-4xl font-black text-white">₹{stats.totalTarget.toLocaleString()}</h2>
                 <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">
                   for {stats.count} instances
                 </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cluster Target vs Achievement */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-xl flex flex-col gap-4 w-full h-[380px] overflow-hidden">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-50 dark:border-gray-700 pb-2 flex-shrink-0">
            Cluster Target vs Achievement
          </h3>
          <div className="flex-1 w-full min-h-0 min-w-0 relative">
            <div className="absolute inset-0 overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">
              <div className="min-w-[400px] h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.clusterShare}
                    margin={{ top: 25, right: 0, left: -25, bottom: 45 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="label" angle={-45} textAnchor="end" height={60} axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "#9CA3AF", fontWeight: "bold" }} interval={0} />
                    <YAxis domain={[0, 'auto']} tickCount={8} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#9CA3AF" }} tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`} />
                    <RechartsTooltip cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: "1rem", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)", fontSize: "12px" }} formatter={(value: number) => `₹${value.toLocaleString()}`} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: '9px', paddingBottom: '20px', top: -5 }} verticalAlign="top" align="right" />
                    <Bar dataKey="target" name="Target" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={24}>
                      <LabelList dataKey="target" position="top" formatter={(val: number) => `₹${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`} style={{ fontSize: '9px', fill: '#6B7280', fontWeight: 'bold' }} offset={5} />
                    </Bar>
                    <Bar dataKey="val" name="Collected" fill="#10B981" radius={[4, 4, 0, 0]} barSize={24}>
                      <LabelList dataKey="val" position="top" formatter={(val: number) => `₹${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`} style={{ fontSize: '9px', fill: '#6B7280', fontWeight: 'bold' }} offset={5} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Row: Activity Target vs Achievement */}
      <div className="w-full">
        {/* Activity Target vs Achievement */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-xl flex flex-col gap-4 w-full h-[420px] overflow-hidden">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-50 dark:border-gray-700 pb-2 flex-shrink-0">
            Activity Target vs Achievement
          </h3>
          <div className="flex-1 w-full min-h-0 min-w-0 relative">
            <div className="absolute inset-0 overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">
              <div className="min-w-[700px] md:min-w-[900px] h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.activityShare}
                    margin={{ top: 25, right: 0, left: -25, bottom: 45 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="label" angle={-45} textAnchor="end" height={60} axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "#9CA3AF", fontWeight: "bold" }} interval={0} />
                    <YAxis domain={[0, 'auto']} tickCount={8} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#9CA3AF" }} tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`} />
                    <RechartsTooltip cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: "1rem", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)", fontSize: "12px" }} formatter={(value: number) => `₹${value.toLocaleString()}`} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: '9px', paddingBottom: '20px', top: -5 }} verticalAlign="top" align="right" />
                    <Bar dataKey="target" name="Target" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={24}>
                      <LabelList dataKey="target" position="top" formatter={(val: number) => `₹${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`} style={{ fontSize: '9px', fill: '#6B7280', fontWeight: 'bold' }} offset={5} />
                    </Bar>
                    <Bar dataKey="val" name="Collected" fill="#10B981" radius={[4, 4, 0, 0]} barSize={24}>
                      <LabelList dataKey="val" position="top" formatter={(val: number) => `₹${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`} style={{ fontSize: '9px', fill: '#6B7280', fontWeight: 'bold' }} offset={5} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <select
            value={selectedFinancialYear}
            onChange={(e) => setSelectedFinancialYear(e.target.value)}
            className="bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-black text-[10px] uppercase cursor-pointer text-indigo-600 dark:text-indigo-400"
          >
            <option value="All">All FYs</option>
            {financialYears.filter(fy => fy !== "All").map((fy) => (
              <option key={fy} value={fy}>{fy}</option>
            ))}
          </select>
          <div className="relative group">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-bold focus:ring-2 focus:ring-emerald-500 text-xs transition-all shadow-inner"
            />
            <svg
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <select
            value={selectedActivity}
            onChange={(e) => setSelectedActivity(e.target.value)}
            className="bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-black text-[10px] uppercase cursor-pointer text-indigo-600"
          >
            <option value="All">All Activities</option>
            {activityOptions
              .filter((o) => o !== "All")
              .map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
          </select>

          <select
            value={selectedCluster}
            onChange={(e) => {
              setSelectedCluster(e.target.value);
              setSelectedGP("All");
              setSelectedVillage("All");
            }}
            className="bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-black text-[10px] uppercase cursor-pointer"
          >
            <option value="All">All Clusters</option>
            {clusters
              .filter((c) => c !== "All")
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </select>

          <select
            value={selectedGP}
            onChange={(e) => {
              setSelectedGP(e.target.value);
              setSelectedVillage("All");
            }}
            className="bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-black text-[10px] uppercase cursor-pointer"
          >
            <option value="All">All GPs</option>
            {gps
              .filter((g) => g !== "All")
              .map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
          </select>

          <select
            value={selectedVillage}
            onChange={(e) => setSelectedVillage(e.target.value)}
            className="bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl border-none ring-1 ring-gray-100 dark:ring-gray-700 font-black text-[10px] uppercase cursor-pointer"
          >
            <option value="All">All Villages</option>
            {villages
              .filter((v) => v !== "All")
              .map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Detailed Transaction Table */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900/80 border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                  Beneficiary Details
                </th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                  Activity Head
                </th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                  Village Profile
                </th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">
                  Fund Value
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {filteredData.map((row) => {
                const indTargetObj = targets.find(
                  (t) =>
                    t.cluster === row.cluster &&
                    t.activity === row.activity
                );
                
                let individualTarget = row.individualTarget || 0;
                
                if (individualTarget === 0 && indTargetObj && indTargetObj.target > 0 && row.activity !== "PROCESSING HUBS" && row.activity !== "ASC") {
                    individualTarget = indTargetObj.contributionTarget / indTargetObj.target;
                }

                const isExpanded = expandedRows.has(row.id);

                return (
                  <React.Fragment key={row.id}>
                  <tr
                    onClick={() => toggleRow(row.id)}
                    className="hover:bg-emerald-50/20 dark:hover:bg-emerald-900/10 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-5">
                      <div className="font-black text-gray-900 dark:text-white text-sm group-hover:text-emerald-600 transition-colors leading-tight">
                        {row.name}
                      </div>
                      <div className="flex flex-col mt-1">
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight">
                          FID: {row.farmerId}
                        </span>
                        <span className="text-[9px] font-black text-gray-400 uppercase">
                          {row.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 leading-snug max-w-xs uppercase">
                        {row.activity}
                      </div>
                      
                      <div className="text-[9px] font-black uppercase text-gray-400 mt-1">
                        {row.date}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-xs font-bold text-gray-800 dark:text-gray-100">
                        {row.village}
                      </div>
                      <div className="text-[9px] font-black uppercase text-gray-400 tracking-tighter">
                        {row.gp} • {row.cluster}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {individualTarget > 0 && (
                        <div className="text-[9px] font-black text-gray-400 uppercase mb-1 tracking-widest">
                          Target: ₹{individualTarget.toLocaleString()}
                        </div>
                      )}
                      <div className="inline-block px-5 py-2 bg-emerald-600 text-white rounded-full font-black text-sm shadow-lg shadow-emerald-200 dark:shadow-none border border-white/10 group-hover:scale-105 transition-transform">
                        {individualTarget > 0 ? "Coll: " : ""}₹
                        {row.amount.toLocaleString()}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                      <tr>
                        <td colSpan={4} className="p-0 border-none">
                            <div className="px-6 py-4 bg-gray-50/80 dark:bg-gray-800/80 animate-fade-in border-b border-gray-100 dark:border-gray-700">
                                <div className="max-w-lg">
                                  <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">Paid Contribution vs Target</h4>
                                  <div className="flex justify-between items-center bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700 mb-4">
                                      <div className="flex flex-col">
                                          <span className="text-[9px] font-bold text-gray-400 uppercase">Paid</span>
                                          <span className="text-sm font-black text-emerald-600">₹{row.amount.toLocaleString()}</span>
                                      </div>
                                      <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 mx-4"></div>
                                      <div className="flex flex-col items-end">
                                          <span className="text-[9px] font-bold text-gray-400 uppercase">Target</span>
                                          <span className="text-sm font-black text-gray-900 dark:text-gray-100">₹{individualTarget.toLocaleString()}</span>
                                      </div>
                                  </div>

                                  <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3 mt-5">Materials Received</h4>
                                  {row.productsReceived && row.productsReceived.length > 0 ? (
                                    <div className="flex flex-col gap-2">
                                      {row.productsReceived.map((p, pIdx) => {
                                          let daysAgo = -1;
                                          if (p.date && p.date !== 'N/A') {
                                            const dateParts = p.date.split(/[-/]/);
                                            let dDate = new Date(p.date); // Generic fallback
                                            if (dateParts.length === 3) {
                                              // Try to guess format (if year is first or last)
                                              if (dateParts[0].length === 4) {
                                                // YYYY-MM-DD
                                                dDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1])-1, parseInt(dateParts[2]));
                                              } else if (dateParts[2].length === 4) {
                                                // DD/MM/YYYY (common in India)
                                                dDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[1])-1, parseInt(dateParts[0]));
                                              }
                                            }
                                            if (!isNaN(dDate.getTime())) {
                                              const diff = new Date().getTime() - dDate.getTime();
                                              daysAgo = Math.floor(diff / (1000 * 3600 * 24));
                                            }
                                          }
                                          return (
                                              <div key={pIdx} className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                                  <div className="flex justify-between items-start mb-2">
                                                      <span className="text-xs font-black text-gray-900 dark:text-white">{p.name}</span>
                                                      <span className="text-[10px] font-black text-indigo-500 uppercase">Total: ₹{(p.unitContrib * p.count).toLocaleString()}</span>
                                                  </div>
                                                  <div className="grid grid-cols-2 gap-2 mt-2">
                                                      <div>
                                                        <p className="text-[8px] font-black text-gray-400 uppercase">Quantity × MSRP</p>
                                                        <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300">
                                                          {p.count} × ₹{p.unitContrib.toLocaleString()}
                                                        </p>
                                                      </div>
                                                      <div>
                                                        <p className="text-[8px] font-black text-gray-400 uppercase">Issued On</p>
                                                        <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300">
                                                          {p.date || 'N/A'} {daysAgo >= 0 ? `(${daysAgo} days ago)` : ''}
                                                        </p>
                                                      </div>
                                                  </div>
                                              </div>
                                          )
                                      })}
                                    </div>
                                  ) : (
                                    <div className="p-4 rounded-xl text-[10px] font-black uppercase text-center text-gray-400 bg-gray-100/50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                                      No material distributed yet
                                    </div>
                                  )}
                                </div>
                            </div>
                        </td>
                      </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredData.length === 0 && (
          <div className="p-32 text-center text-gray-300 font-black uppercase tracking-[0.4em] text-[10px] italic">
            No Matching Contribution Records Found
          </div>
        )}
      </div>

      <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
    </div>
  );
};

export default ContributionPage;
