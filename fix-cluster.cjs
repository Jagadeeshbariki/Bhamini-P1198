const fs = require('fs');
let content = fs.readFileSync('components/BeneficiaryExplorer.tsx', 'utf8');

const regex = /const clusterData = Object\.entries\(clusterCounts\).*?\.sort\(\(a, b\) => a\.name\.localeCompare\(b\.name\)\);/s;

const newClusterData = `const allClusters = new Set([...Object.keys(clusterCounts), ...Object.keys(clusterTargetCountMap)]);
        const clusterData = Array.from(allClusters)
            .map(name => ({
                name,
                collected: clusterCounts[name] || 0,
                target: clusterTargetCountMap[name] || 0,
                percentage: total > 0 ? ((clusterCounts[name] || 0) / total) * 100 : 0
            }))
            .sort((a, b) => a.name.localeCompare(b.name));`;

content = content.replace(regex, newClusterData);
fs.writeFileSync('components/BeneficiaryExplorer.tsx', content);
