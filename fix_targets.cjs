const fs = require('fs');
let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

const startMarker = "const targetMap = new Map<string, { cluster: string, activity: string, target: number, contributionTarget: number, financialYear: string }>();";
const endMarker = "setTargets(Array.from(targetMap.values()));";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker) + endMarker.length;

if (startIndex === -1 || endIndex === -1) {
    console.error("Markers not found");
    process.exit(1);
}

const replacement = `
        const targetMap = new Map<string, { cluster: string, activity: string, target: number, contributionTarget: number, financialYear: string }>();

        const isAssetActivity = (act: string) => ['processing', 'asc', 'mobile irr', 'fixed irrig', 'irrigation'].some(a => act.toLowerCase().includes(a));

        // 1. Fixed activities from Beneficiary Data
        beneficiaryCountMap.forEach((count, key) => {
            const [cluster, activity, financialYear] = key.split('|');
            const activityLower = activity.toLowerCase();
            
            if (!isAssetActivity(activityLower)) {
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
                    
                    targetMap.set(key, {
                        cluster: displayCluster,
                        activity: displayActivity,
                        target: count,
                        contributionTarget: count * unitPrice,
                        financialYear
                    });
                }
            }
        });

        // 2. Asset activities from Material Distribution Data
        distTargetMap.forEach((amount, key) => {
            const [cluster, activity, financialYear] = key.split('|');
            const activityLower = activity.toLowerCase();
            
            if (isAssetActivity(activityLower)) {
                const displayActivity = activityOptions.find(o => o.toLowerCase() === activity) || activity.toUpperCase();
                const displayCluster = clusters.find(c => c.toLowerCase() === cluster) || (cluster.charAt(0).toUpperCase() + cluster.slice(1));
                
                targetMap.set(key, {
                    cluster: displayCluster,
                    activity: displayActivity,
                    target: distCountMap.get(key) || 1,
                    contributionTarget: amount,
                    financialYear
                });
            }
        });

        setTargets(Array.from(targetMap.values()));
`;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync('components/ContributionPage.tsx', newContent);
console.log('Fixed targets fully');
