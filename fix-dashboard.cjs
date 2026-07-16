const fs = require('fs');
let content = fs.readFileSync('components/BeneficiaryExplorer.tsx', 'utf8');

// Add clusterTargetCountMap
content = content.replace(
    `const activityTargetCountMap: Record<string, number> = {};`,
    `const activityTargetCountMap: Record<string, number> = {};\n        const clusterTargetCountMap: Record<string, number> = {};`
);

// Populate clusterTargetCountMap
content = content.replace(
    `if (!activityTargetCountMap[t.activity]) activityTargetCountMap[t.activity] = 0;\n                activityTargetCountMap[t.activity] += t.target;`,
    `if (!activityTargetCountMap[t.activity]) activityTargetCountMap[t.activity] = 0;\n                activityTargetCountMap[t.activity] += t.target;\n                if (!clusterTargetCountMap[t.cluster]) clusterTargetCountMap[t.cluster] = 0;\n                clusterTargetCountMap[t.cluster] += t.target;`
);

// Map clusterData
const oldClusterData = `        const clusterData = Object.entries(clusterCounts)
            .map(([name, value]) => ({
                name,
                value,
                target: clusterContribMap[name]?.target || 0,
                collected: clusterContribMap[name]?.collected || 0,
                percentage: total > 0 ? (value / total) * 100 : 0
            }))
            .sort((a, b) => a.name.localeCompare(b.name));`;

const newClusterData = `        const allClusters = new Set([...Object.keys(clusterCounts), ...Object.keys(clusterTargetCountMap)]);
        const clusterData = Array.from(allClusters)
            .map(name => ({
                name,
                value: clusterCounts[name] || 0, // collected count
                target: clusterTargetCountMap[name] || 0, // target count
                percentage: total > 0 ? ((clusterCounts[name] || 0) / total) * 100 : 0
            }))
            .sort((a, b) => a.name.localeCompare(b.name));`;

content = content.replace(oldClusterData, newClusterData);

// Remove the "Total Contribution" card
const startStr = `<div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-xl shadow-emerald-100 dark:shadow-none flex flex-col justify-between relative overflow-hidden group min-h-[120px]">`;
const startIdx = content.indexOf(startStr);
let endIdx = content.indexOf(`</div>`, startIdx);
for (let i=0; i<3; i++) { // find matching </div> for card
    endIdx = content.indexOf(`</div>`, endIdx + 1);
}
endIdx = content.indexOf(`</div>`, endIdx + 1); // might need more careful regex or indexOf

// It's safer to use regex replacement for the card.
