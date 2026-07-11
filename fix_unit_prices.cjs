const fs = require('fs');
let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

const regex = /unitPrice = activityTargetMap\.get\(activityLower\) \|\| activityTargetMap\.get\(activityLower\.replace\(\/byp-\/, ''\)\) \|\| 0;[\s\S]*?if \(unitPrice === 0\) \{[\s\S]*?unitPrice = activityTotalContribMap\.get\(activityLower\) \|\| activityTotalContribMap\.get\(activityLower\.replace\(\/byp-\/, ''\)\) \|\| 0;\n          \}/g;

const replacement = `unitPrice = activityTargetMap.get(activityLower) || activityTargetMap.get(activityLower.replace(/byp-/, '')) || 0;
          
          if (activityLower.includes('eco-farmpond') || activityLower.includes('eco farmpond')) unitPrice = 10000;
          else if (activityLower === 'ns' || activityLower === 'byp-ns') unitPrice = 1000;
          else if (activityLower === 'bfe' || activityLower === 'byp-bfe') unitPrice = 10000;
          else if (activityLower.includes('goatery') || activityLower.includes('goat shed')) unitPrice = 6000;
          
          if (unitPrice === 0) {
                 unitPrice = activityTotalContribMap.get(activityLower) || activityTotalContribMap.get(activityLower.replace(/byp-/, '')) || 0;
          }`;

content = content.replace(regex, replacement);


const regex2 = /let unitPrice = activityTargetMap\.get\(activity\) \|\| activityTargetMap\.get\(activity\.replace\(\/byp-\/, ''\)\) \|\| 0;[\s\S]*?if \(unitPrice === 0\) \{[\s\S]*?unitPrice = activityTotalContribMap\.get\(activity\) \|\| activityTotalContribMap\.get\(activity\.replace\(\/byp-\/, ''\)\) \|\| 0;\n                \}/g;

const replacement2 = `let unitPrice = activityTargetMap.get(activity) || activityTargetMap.get(activity.replace(/byp-/, '')) || 0;
                
                if (activity.includes('eco-farmpond') || activity.includes('eco farmpond')) unitPrice = 10000;
                else if (activity === 'ns' || activity === 'byp-ns') unitPrice = 1000;
                else if (activity === 'bfe' || activity === 'byp-bfe') unitPrice = 10000;
                else if (activity.includes('goatery') || activity.includes('goat shed')) unitPrice = 6000;

                if (unitPrice === 0) {
                     unitPrice = activityTotalContribMap.get(activity) || activityTotalContribMap.get(activity.replace(/byp-/, '')) || 0;
                }`;

content = content.replace(regex2, replacement2);

fs.writeFileSync('components/ContributionPage.tsx', content);
console.log('Fixed unit prices');
