const fs = require('fs');
const path = 'components/ContributionPage.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    /tickFormatter=\{\(val\) => \`₹\$\{val >= 1000 \? \(val \/ 1000\)\.toFixed\(0\) \+ 'k' : val\}\`\}/g,
    "tickFormatter={(val: any) => `₹${Number(val) >= 1000 ? (Number(val) / 1000).toFixed(0) + 'k' : val}`}"
);

fs.writeFileSync(path, content);
console.log("Fixed ts3");
