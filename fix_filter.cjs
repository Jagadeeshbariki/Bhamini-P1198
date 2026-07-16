const fs = require('fs');
const path = 'components/ODKAssetDistribution.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Rename 'All' to 'Globally' in filterCluster state
content = content.replace("const [filterCluster, setFilterCluster] = useState('All');", "const [filterCluster, setFilterCluster] = useState('Globally');");

// 2. Rename 'All' to 'Globally' in clusterOptions
const clusterOptionsRegex = /const clusterOptions = useMemo\(\(\) => \['All', \.\.\.Array\.from\(new Set\(\[\.\.\.targets\.map\(t => t\.Cluster\), \.\.\.distributions\.map\(d => d\.Cluster\)\]\.filter\(Boolean\)\)\)\.sort\(\)\], \[targets, distributions\]\);/;
const clusterOptionsReplacement = `const clusterOptions = useMemo(() => ['Globally', ...Array.from(new Set([...targets.map(t => t.Cluster), ...distributions.map(d => d.Cluster)].filter(Boolean))).sort()], [targets, distributions]);`;
content = content.replace(clusterOptionsRegex, clusterOptionsReplacement);

// 3. Update fTargets logic
const fTargetsRegex = /if \(filterCluster !== 'All' && t\.Cluster !== filterCluster\) return false;/;
const fTargetsReplacement = `if (filterCluster !== 'Globally' && t.Cluster !== filterCluster) return false;`;
content = content.replace(fTargetsRegex, fTargetsReplacement);

// 4. Update fDist logic
const fDistRegex = /if \(filterCluster !== 'All' && d\.Cluster !== filterCluster\) return false;/;
const fDistReplacement = `if (filterCluster !== 'Globally' && d.Cluster !== filterCluster) return false;`;
content = content.replace(fDistRegex, fDistReplacement);

// 5. Replace 'Global' data mapping with 'Globally' ?
// Actually, let's replace 'Global' with 'Globally' throughout the component's data logic to match user expectation.
content = content.replace(/let cluster = row\['CLUSTER'\] \|\| 'Global';/g, "let cluster = row['CLUSTER'] || 'Globally';");

fs.writeFileSync(path, content);
console.log("Updated filter logic.");
