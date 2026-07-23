const fs = require('fs');
const path = 'components/ContributionPage.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    /topContributorsMap\.set\(d\.farmerId, \{ name: d\.name, cluster: d\.cluster, amount: 0, activities: new Set\(\) \}\);/g,
    "topContributorsMap.set(d.farmerId, { name: d.name, cluster: d.cluster, amount: 0, target: 0, activities: new Set() });"
);

// We also have errors at line 1079
// `components/ContributionPage.tsx(1079,188): error TS2365: Operator '>=' cannot be applied to types 'string | number | boolean' and 'number'.`
// Let's see what is there.
fs.writeFileSync(path, content);
console.log("Fixed map");
