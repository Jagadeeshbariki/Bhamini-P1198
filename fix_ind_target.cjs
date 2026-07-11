const fs = require('fs');
let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

const replacementFunc = `
                      let indTarget = farmerTargetMap.get(\`\${normId}-\${normalizedActivity}\`) || 0;
                      if (indTarget === 0) {
                          const activityLower = normalizedActivity.toLowerCase();
                          let unitPrice = activityTargetMap.get(activityLower) || activityTargetMap.get(activityLower.replace(/byp-/, '')) || 0;
                          
                          if (activityLower.includes('eco-farmpond') || activityLower.includes('eco farmpond')) unitPrice = 10000;
                          else if (activityLower === 'ns' || activityLower === 'byp-ns') unitPrice = 1000;
                          else if (activityLower === 'bfe' || activityLower === 'byp-bfe') unitPrice = 10000;
                          else if (activityLower.includes('goatery') || activityLower.includes('goat shed')) unitPrice = 6000;
                          
                          if (unitPrice === 0) {
                                 unitPrice = activityTotalContribMap.get(activityLower) || activityTotalContribMap.get(activityLower.replace(/byp-/, '')) || 0;
                          }
                          indTarget = unitPrice;
                      }
`;

content = content.replace(/const indTarget = farmerTargetMap\.get\(\`\\\${\w+}-\\\${normalizedActivity}\`\) \|\| 0;/g, replacementFunc);

// Remove the financial year filter UI:
const fyFilterRegex = /<div className="flex bg-\[#1e2333\] border border-gray-800 rounded-lg p-1">[\s\S]*?<\/div>/;
content = content.replace(fyFilterRegex, '');

fs.writeFileSync('components/ContributionPage.tsx', content);
console.log('Fixed ind targets and removed FY filter');
