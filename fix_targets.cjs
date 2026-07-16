const fs = require('fs');
const path = 'components/ODKAssetDistribution.tsx';
let content = fs.readFileSync(path, 'utf8');

const fTargetsRegex = /return targets\.filter\(t => \{\s*if \(filterFY !== 'All' && t\.Financial_Year !== filterFY\) return false;\s*if \(filterCluster !== 'Globally' && t\.Cluster !== filterCluster\) return false;\s*if \(filterActivity !== 'All' && t\.Activity !== filterActivity\) return false;\s*if \(filterMaterial !== 'All' && t\.Asset_Name !== filterMaterial\) return false;\s*return true;\s*\}\);/m;

const fTargetsReplacement = `return targets.filter(t => {
            if (filterFY !== 'All' && t.Financial_Year !== filterFY) return false;
            if (filterCluster !== 'Globally' && t.Cluster !== filterCluster && t.Cluster !== 'Globally') return false;
            if (filterActivity !== 'All' && t.Activity !== filterActivity) return false;
            if (filterMaterial !== 'All' && t.Asset_Name !== filterMaterial) return false;
            return true;
        }).map(t => {
            if (filterCluster !== 'Globally' && t.Cluster === 'Globally') {
                return { ...t, Cluster: filterCluster };
            }
            return t;
        });`;

content = content.replace(fTargetsRegex, fTargetsReplacement);

fs.writeFileSync(path, content);
console.log("Updated fTargets.");
