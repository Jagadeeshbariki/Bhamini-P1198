const fs = require('fs');
const content = fs.readFileSync('components/ODKAssetDistribution.tsx', 'utf8');
const actStatsMatch = content.match(/const actStats: any\[\] = useMemo\(\(\) => \{[\s\S]*?\}, \[fTargets, fDist\]\);/);
console.log(actStatsMatch ? "Found actStats" : "Not found actStats");
const matStatsMatch = content.match(/const matStats: any\[\] = useMemo\(\(\) => \{[\s\S]*?\}, \[fTargets, fDist\]\);/);
console.log(matStatsMatch ? "Found matStats" : "Not found matStats");
const tableDataMatch = content.match(/const tableData = useMemo\(\(\) => \{[\s\S]*?\}, \[fTargets, fDist, searchTable\]\);/);
console.log(tableDataMatch ? "Found tableData" : "Not found tableData");
