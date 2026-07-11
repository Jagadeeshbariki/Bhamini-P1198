const fs = require('fs');
let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

content = content.replace(/if \(indTarget === 0\)/g, 'if (!indTarget || isNaN(indTarget))');

fs.writeFileSync('components/ContributionPage.tsx', content);
console.log('Fixed NaN check');
