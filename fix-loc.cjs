const fs = require('fs');
let content = fs.readFileSync('components/BeneficiaryExplorer.tsx', 'utf8');

content = content.replace(/entry\.value\.toLocaleString\(\)/g, '(entry.value || 0).toLocaleString()');
content = content.replace(/data\.value\.toLocaleString\(\)/g, '(data.value || 0).toLocaleString()');
content = content.replace(/b\.contribution\.toLocaleString\(\)/g, '(b.contribution || 0).toLocaleString()');
content = content.replace(/value\.toLocaleString\(\)/g, '(value || 0).toLocaleString()');
content = content.replace(/stats\.total\.toLocaleString\(\)/g, '(stats.total || 0).toLocaleString()');
content = content.replace(/stats\.totalTarget\.toLocaleString\(\)/g, '(stats.totalTarget || 0).toLocaleString()');
content = content.replace(/\(a\.targetContribution \|\| 0\)\.toLocaleString\(\)/g, '((a.targetContribution || 0) || 0).toLocaleString()');
content = content.replace(/itemContrib\.toLocaleString\(\)/g, '(itemContrib || 0).toLocaleString()');
content = content.replace(/totalTarget\.toLocaleString\(\)/g, '(totalTarget || 0).toLocaleString()');

fs.writeFileSync('components/BeneficiaryExplorer.tsx', content);
