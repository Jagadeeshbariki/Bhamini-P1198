const fs = require('fs');
const path = 'components/ODKAssetDistribution.tsx';
let content = fs.readFileSync(path, 'utf8');

const tableDataRegex = /const k = `\$\{t\.Cluster\}\|\$\{t\.Asset_Code\}`;/g;
const tableDataReplacement = "const k = `${t.Asset_Code}`;";
content = content.replace(tableDataRegex, tableDataReplacement);

const tableDataDistRegex = /const k = `\$\{d\.Cluster\}\|\$\{d\.Asset_Code\}`;/g;
const tableDataDistReplacement = "const k = `${d.Asset_Code}`;";
content = content.replace(tableDataDistRegex, tableDataDistReplacement);

// Fix the map initialization to use filterCluster for display
const mapInitRegex = /if\(!map\[k\]\) map\[k\] = \{ cluster: t\.Cluster,/g;
content = content.replace(mapInitRegex, "if(!map[k]) map[k] = { cluster: filterCluster,");

const mapInitDistRegex = /if\(!map\[k\]\) map\[k\] = \{ cluster: d\.Cluster,/g;
content = content.replace(mapInitDistRegex, "if(!map[k]) map[k] = { cluster: filterCluster,");

fs.writeFileSync(path, content);
console.log("Updated grouping.");
