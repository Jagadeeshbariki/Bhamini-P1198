const fs = require('fs');
const path = 'components/ODKAssetDistribution.tsx';
let content = fs.readFileSync(path, 'utf8');

const clusterOptionsRegex = /const clusterOptions = useMemo\(\(\) => \['Globally', \.\.\.Array\.from\(new Set\(\[\.\.\.targets\.map\(t => t\.Cluster\), \.\.\.distributions\.map\(d => d\.Cluster\)\]\.filter\(Boolean\)\)\)\.sort\(\)\], \[targets, distributions\]\);/;
const clusterOptionsReplacement = `const clusterOptions = useMemo(() => ['Globally', ...Array.from(new Set([...targets.map(t => t.Cluster), ...distributions.map(d => d.Cluster)].filter(c => c && c !== 'Globally'))).sort()], [targets, distributions]);`;
content = content.replace(clusterOptionsRegex, clusterOptionsReplacement);

fs.writeFileSync(path, content);
console.log("Updated clusterOptions.");
