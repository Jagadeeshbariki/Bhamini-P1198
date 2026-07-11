const fs = require('fs');
let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

content = content.replace(/target: d.individualTarget \|\| 0,/g, 'target: d.individualTarget || 0,');
content = content.replace(/entry.amount \+= d.amount;/g, 'entry.amount += d.amount;\n                    entry.target = Math.max(entry.target, d.individualTarget || 0);');

fs.writeFileSync('components/ContributionPage.tsx', content);
console.log('Fixed max target');
