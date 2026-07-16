const fs = require('fs');
const path = 'components/ODKAssetDistribution.tsx';
let content = fs.readFileSync(path, 'utf8');

const distDateRegex = /const qty = parseFloat\(row\['MATERIALS_DETAILS-MATERIAL_COUNT'\]\) \|\| 0;\s*let dateStr = row\['DATE OF SUBMISSION'\] \|\| row\['MATERIALS_DETAILS-DISTRIBUTED_DATE'\] \|\| '';\s*if \(dateStr\.includes\('T'\)\) dateStr = dateStr\.split\('T'\)\[0\];\s*else if \(dateStr\) \{\s*const d = new Date\(dateStr\);\s*if\(!isNaN\(d\.getTime\(\)\)\) dateStr = d\.toISOString\(\)\.split\('T'\)\[0\];\s*\}/m;

const distDateReplacement = `const qty = parseFloat(row['MATERIALS_DETAILS-MATERIAL_COUNT']) || 0;
                    let dateStr = row['DATE OF SUBMISSION'] || row['MATERIALS_DETAILS-DISTRIBUTED_DATE'] || '';
                    if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
                    else if (dateStr) {
                         const d = new Date(dateStr);
                         if(!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
                    }
                    let fy = '';
                    if (dateStr) {
                        const d = new Date(dateStr);
                        if (!isNaN(d.getTime())) {
                            const month = d.getMonth();
                            const year = d.getFullYear();
                            if (month >= 3) {
                                fy = \`\${year}-\${String(year + 1).slice(2)}\`;
                            } else {
                                fy = \`\${year - 1}-\${String(year).slice(2)}\`;
                            }
                        }
                    }`;

content = content.replace(distDateRegex, distDateReplacement);

const pushRegex = /processedDist\.push\(\{\s*Asset_Code: aCode, Asset_Name: aName, Activity: act, Activity_Code: actCode, \s*Cluster: cluster, Distributed_Qty: qty, Date: dateStr, Beneficiary_Name: benName,\s*Beneficiary_ID: benId, Submitter: submitter, Photo: photo\s*\}\);/m;

const pushReplacement = `processedDist.push({
                            Asset_Code: aCode, Asset_Name: aName, Activity: act, Activity_Code: actCode, 
                            Cluster: cluster, Distributed_Qty: qty, Date: dateStr, Financial_Year: fy, Beneficiary_Name: benName,
                            Beneficiary_ID: benId, Submitter: submitter, Photo: photo
                        });`;
content = content.replace(pushRegex, pushReplacement);

const fDistRegex = /const fDist = useMemo\(\(\) => \{\s*return distributions\.filter\(d => \{\s*if \(filterCluster !== 'Globally' && d\.Cluster !== filterCluster\) return false;\s*if \(filterActivity !== 'All' && d\.Activity !== filterActivity\) return false;\s*if \(filterMaterial !== 'All' && d\.Asset_Name !== filterMaterial\) return false;\s*return true;\s*\}\);\s*\}, \[distributions, filterCluster, filterActivity, filterMaterial\]\);/m;

const fDistReplacement = `const fDist = useMemo(() => {
        return distributions.filter(d => {
            if (filterFY !== 'All' && d.Financial_Year !== filterFY) return false;
            if (filterCluster !== 'Globally' && d.Cluster !== filterCluster) return false;
            if (filterActivity !== 'All' && d.Activity !== filterActivity) return false;
            if (filterMaterial !== 'All' && d.Asset_Name !== filterMaterial) return false;
            return true;
        });
    }, [distributions, filterFY, filterCluster, filterActivity, filterMaterial]);`;

content = content.replace(fDistRegex, fDistReplacement);

const fyOptionsRegex = /const fyOptions = useMemo\(\(\) => \['All', \.\.\.Array\.from\(new Set\(targets\.map\(t => t\.Financial_Year\)\.filter\(Boolean\)\)\)\.sort\(\)\], \[targets\]\);/;
const fyOptionsReplacement = `const fyOptions = useMemo(() => ['All', ...Array.from(new Set([...targets.map(t => t.Financial_Year), ...distributions.map(d => d.Financial_Year)].filter(Boolean))).sort()], [targets, distributions]);`;
content = content.replace(fyOptionsRegex, fyOptionsReplacement);

fs.writeFileSync(path, content);
console.log("Replaced");
