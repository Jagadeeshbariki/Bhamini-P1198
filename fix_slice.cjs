const fs = require('fs');

let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

content = content.replace(
  '      .filter((c) => c.val > 0 || c.target > 0)\n      .slice(0, 3)\n      .sort((a, b) => b.percent - a.percent);',
  '      .filter((c) => c.val > 0 || c.target > 0)\n      .sort((a, b) => b.percent - a.percent)\n      .slice(0, 3);'
);

fs.writeFileSync('components/ContributionPage.tsx', content);
console.log('Fixed slice');
