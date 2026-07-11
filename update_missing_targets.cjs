const fs = require('fs');
let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

const replacement = `
        // Add completely new targets from distTargetMap if they didn't exist in parsedTargets
        distTargetMap.forEach((amount, key) => {
            const [cluster, activity, financialYear] = key.split('|');
            const exists = finalParsedTargets.some(t => t.cluster.toLowerCase() === cluster && t.activity.toLowerCase() === activity && t.financialYear.toLowerCase() === financialYear);
            if (!exists) {
                const displayActivity = activityOptions.find(o => o.toLowerCase() === activity) || activity.toUpperCase();
                const displayCluster = clusters.find(c => c.toLowerCase() === cluster) || (cluster.charAt(0).toUpperCase() + cluster.slice(1));
                finalParsedTargets.push({
                    cluster: displayCluster,
                    activity: displayActivity,
                    target: distCountMap.get(key) || 1,
                    contributionTarget: amount,
                    financialYear
                });
            }
        });

        // Add missing targets from beneficiary data for fixed activities
        beneficiaryCountMap.forEach((count, key) => {
            const [cluster, activity, financialYear] = key.split('|');
            const activityLower = activity.toLowerCase();
            const isFixed = ['ns', 'byp-ns', 'bfe', 'byp-bfe', 'goatery', 'goat shed', 'eco-farmpond', 'eco farmpond'].includes(activityLower) || activityTotalContribMap.has(activityLower);
            
            if (isFixed) {
                const exists = finalParsedTargets.some(t => t.cluster.toLowerCase() === cluster && t.activity.toLowerCase() === activityLower && t.financialYear.toLowerCase() === financialYear);
                if (!exists) {
                    let unitPrice = activityTargetMap.get(activityLower) || activityTargetMap.get(activityLower.replace(/byp-/, '')) || 0;
                    
                    if (activityLower.includes('eco-farmpond') || activityLower.includes('eco farmpond')) unitPrice = 10000;
                    else if (activityLower === 'ns' || activityLower === 'byp-ns') unitPrice = 1000;
                    else if (activityLower === 'bfe' || activityLower === 'byp-bfe') unitPrice = 10000;
                    else if (activityLower.includes('goatery') || activityLower.includes('goat shed')) unitPrice = 6000;
                    
                    if (unitPrice === 0) {
                           unitPrice = activityTotalContribMap.get(activityLower) || activityTotalContribMap.get(activityLower.replace(/byp-/, '')) || 0;
                    }
                    if (unitPrice > 0) {
                        const displayActivity = activityOptions.find(o => o.toLowerCase() === activityLower) || activity.toUpperCase();
                        const displayCluster = clusters.find(c => c.toLowerCase() === cluster) || (cluster.charAt(0).toUpperCase() + cluster.slice(1));
                        
                        finalParsedTargets.push({
                            cluster: displayCluster,
                            activity: displayActivity,
                            target: count,
                            contributionTarget: count * unitPrice,
                            financialYear
                        });
                    }
                }
            }
        });
`;

content = content.replace(/\/\/ Add completely new targets from distTargetMap if they didn't exist in parsedTargets[\s\S]*?\}\);/, replacement);
fs.writeFileSync('components/ContributionPage.tsx', content);
console.log('Fixed missing targets');
