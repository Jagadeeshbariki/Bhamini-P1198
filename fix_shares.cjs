const fs = require('fs');
const path = 'components/ContributionPage.tsx';
let content = fs.readFileSync(path, 'utf8');

const clusterShareRegex = /const allClusters = new Set\(\[[\s\S]*?\]\);\s*const clusterShare = Array\.from\(allClusters\)[\s\S]*?\.slice\(0, 3\);/m;

const newClusterShare = `const clusterShareMap: Record<string, any> = {};
    Object.keys(clusterMap).forEach(k => {
        const lower = k.toLowerCase();
        if (!clusterShareMap[lower]) clusterShareMap[lower] = { label: k, val: 0, target: 0, farmersPaid: 0 };
        clusterShareMap[lower].val += clusterMap[k];
    });
    Object.keys(clusterFarmersMap).forEach(k => {
        const lower = k.toLowerCase();
        if (!clusterShareMap[lower]) clusterShareMap[lower] = { label: k, val: 0, target: 0, farmersPaid: 0 };
        clusterShareMap[lower].farmersPaid += clusterFarmersMap[k].size;
    });
    targets
        .filter(t => (selectedActivity === "All" || t.activity.toLowerCase() === selectedActivity.toLowerCase()) && (selectedFinancialYear === "All" || (t.financialYear || "").trim() === selectedFinancialYear))
        .filter(t => selectedCluster === "All" || t.cluster.toLowerCase() === selectedCluster.toLowerCase())
        .forEach(t => {
            const lower = t.cluster.toLowerCase();
            if (!clusterShareMap[lower]) clusterShareMap[lower] = { label: t.cluster, val: 0, target: 0, farmersPaid: 0 };
            clusterShareMap[lower].target += t.contributionTarget;
        });

    const clusterShare = Object.values(clusterShareMap)
      .map((c: any) => ({
          label: c.label.charAt(0).toUpperCase() + c.label.slice(1),
          val: c.val,
          target: c.target,
          farmersPaid: c.farmersPaid,
          percent: totalAmount > 0 ? (c.val / totalAmount) * 100 : 0,
      }))
      .filter((c) => selectedCluster === "All" || c.label.toLowerCase() === selectedCluster.toLowerCase())
      .filter((c) => c.val > 0 || c.target > 0)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 3);`;

content = content.replace(clusterShareRegex, newClusterShare);

const activityShareRegex = /const allActivities = new Set\(\[[\s\S]*?\]\);\s*const activityShare = Array\.from\(allActivities\)[\s\S]*?\.sort\(\(a, b\) => b\.percent - a\.percent\);/m;

const newActivityShare = `const activityShareMap: Record<string, any> = {};
    Object.keys(activityMap).forEach(k => {
        const lower = k.toLowerCase();
        if (!activityShareMap[lower]) activityShareMap[lower] = { label: k, val: 0, target: 0, farmersPaid: 0 };
        activityShareMap[lower].val += activityMap[k];
    });
    Object.keys(activityFarmersMap).forEach(k => {
        const lower = k.toLowerCase();
        if (!activityShareMap[lower]) activityShareMap[lower] = { label: k, val: 0, target: 0, farmersPaid: 0 };
        activityShareMap[lower].farmersPaid += activityFarmersMap[k].size;
    });
    targets
        .filter(t => (selectedCluster === "All" || t.cluster.toLowerCase() === selectedCluster.toLowerCase()) && (selectedFinancialYear === "All" || (t.financialYear || "").trim() === selectedFinancialYear))
        .forEach(t => {
            const lower = t.activity.toLowerCase();
            if (!activityShareMap[lower]) activityShareMap[lower] = { label: t.activity, val: 0, target: 0, farmersPaid: 0 };
            activityShareMap[lower].target += t.contributionTarget;
        });

    const activityShare = Object.values(activityShareMap)
      .map((c: any) => ({
          label: c.label.toUpperCase(),
          val: c.val,
          target: c.target,
          farmersPaid: c.farmersPaid,
          percent: totalAmount > 0 ? (c.val / totalAmount) * 100 : 0,
      }))
      .filter((a) => a.val > 0 || a.target > 0)
      .sort((a, b) => b.percent - a.percent);`;

content = content.replace(activityShareRegex, newActivityShare);

fs.writeFileSync(path, content);
console.log("Updated both shares.");
