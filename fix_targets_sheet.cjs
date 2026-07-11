const fs = require('fs');
let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

const replacement = `
        const targetMap = new Map<string, { cluster: string, activity: string, target: number, contributionTarget: number, financialYear: string }>();

        const isAssetActivity = (act: string) => ['processing', 'asc', 'mobile irr', 'fixed irrig', 'irrigation'].some(a => act.toLowerCase().includes(a));
        const isFixedActivity = (act: string) => ['ns', 'byp-ns', 'bfe', 'byp-bfe', 'goatery', 'goat shed', 'eco-farmpond', 'eco farmpond', 'goat', 'crop mod', 'fisheries'].some(a => act.toLowerCase().includes(a)) || (!isAssetActivity(act));

        // 0. Process Target Sheet for anything else
        rawTargets.forEach((r) => {
          const activity = mapTargetActivity(getFuzzyValue(r, ["ACTIVITY"]) || "");
          const cluster = getFuzzyValue(r, ["CLUSTER"]) || "";
          const rawFy = getFuzzyValue(r, ["FINANCIAL YEAR", "FINANCIAL_YEAR", "FY"]) || "";
          let financialYear = rawFy.trim();
          if (financialYear.match(/^\\d{4}-\\d{2}$/)) {
              const parts = financialYear.split('-');
              financialYear = \`FY20\${parts[1]}\`;
          }
          if (!cluster || !activity) return;

          const countKey = \`\${cluster.toLowerCase()}|\${activity.toLowerCase()}|\${financialYear.toLowerCase()}\`;
          const activityLower = activity.toLowerCase();
          
          if (!isAssetActivity(activityLower) && !isFixedActivity(activityLower)) {
              let target = parseFloat(getFuzzyValue(r, ["TARGET"]) || "0") || 0;
              let unitPrice = activityTargetMap.get(activityLower) || activityTargetMap.get(activityLower.replace(/byp-/, '')) || 0;
              
              if (unitPrice === 0) {
                     unitPrice = activityTotalContribMap.get(activityLower) || activityTotalContribMap.get(activityLower.replace(/byp-/, '')) || 0;
              }
              
              if (target === 0 && (r["TARGET"] === undefined || r["TARGET"] === "") && unitPrice > 0) {
                  target = 1;
              }
              
              const displayActivity = activityOptions.find(o => o.toLowerCase() === activityLower) || activity.toUpperCase();
              const displayCluster = clusters.find(c => c.toLowerCase() === cluster.toLowerCase()) || (cluster.charAt(0).toUpperCase() + cluster.slice(1));
              
              if (targetMap.has(countKey)) {
                  const existing = targetMap.get(countKey)!;
                  existing.target += target;
                  existing.contributionTarget += (target * unitPrice);
              } else {
                  targetMap.set(countKey, {
                      cluster: displayCluster,
                      activity: displayActivity,
                      target,
                      contributionTarget: target * unitPrice,
                      financialYear
                  });
              }
          }
        });

        // 1. Fixed activities from Beneficiary Data
`;

content = content.replace(/\s*const targetMap = new Map.*?;\s*const isAssetActivity.*?;\s*\/\/ 1\. Fixed activities from Beneficiary Data/s, replacement);
fs.writeFileSync('components/ContributionPage.tsx', content);
console.log('Added target sheet processing');
