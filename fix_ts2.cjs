const fs = require('fs');
const path = 'components/ContributionPage.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    /formatter=\{\(value\) => \`₹\$\{value >= 1000 \? \(value \/ 1000\)\.toFixed\(0\) \+ 'k' : value\}\`\}/g,
    "formatter={(value: any) => `₹${Number(value) >= 1000 ? (Number(value) / 1000).toFixed(0) + 'k' : value}`}"
);

fs.writeFileSync(path, content);
console.log("Fixed ts2");
