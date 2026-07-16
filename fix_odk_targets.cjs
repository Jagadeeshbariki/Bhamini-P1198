const fs = require('fs');
const path = 'components/ODKAssetDistribution.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldTargetParsing = `                const processedTargets: any[] = [];
                parsedTargets.forEach(row => {
                    const tId = row['TRANSACTION_ID'] || '';
                    const aName = row['ASSET NAME'] || '';
                    const aCode = row['ASSET_CODE'] || '';
                    const act = row['BUDGET HEAD'] || '';
                    const actCode = row['ACTIVITY_CODE'] || '';
                    const fy = row['FY'] || '';
                    const units = row['UNITS'] || '';
                    const globalQty = parseFloat(row['NUMBER OF ASSET PURCHASED']) || 0;
                    
                    const c1 = parseFloat(row['CLUSTER 1 QTY RECEIVED AT STOCK']) || 0;
                    const c2 = parseFloat(row['CLUSTER 2 QTY RECEIVED AT STOCK']) || 0;
                    const c3 = parseFloat(row['CLUSTER 3 QTY RECEIVED AT STOCK']) || 0;

                    if (c1 > 0) processedTargets.push({ Transaction_ID: tId, Asset_Name: aName, Asset_Code: aCode, Activity: act, Activity_Code: actCode, Financial_Year: fy, Target_Units: units, Target_Qty: c1, Cluster: 'Cluster 1' });
                    if (c2 > 0) processedTargets.push({ Transaction_ID: tId, Asset_Name: aName, Asset_Code: aCode, Activity: act, Activity_Code: actCode, Financial_Year: fy, Target_Units: units, Target_Qty: c2, Cluster: 'Cluster 2' });
                    if (c3 > 0) processedTargets.push({ Transaction_ID: tId, Asset_Name: aName, Asset_Code: aCode, Activity: act, Activity_Code: actCode, Financial_Year: fy, Target_Units: units, Target_Qty: c3, Cluster: 'Cluster 3' });
                    
                    if (c1 === 0 && c2 === 0 && c3 === 0 && globalQty > 0) {
                         processedTargets.push({ Transaction_ID: tId, Asset_Name: aName, Asset_Code: aCode, Activity: act, Activity_Code: actCode, Financial_Year: fy, Target_Units: units, Target_Qty: globalQty, Cluster: 'Global' });
                    }
                });`;

const newTargetParsing = `                const processedTargets: any[] = [];
                parsedTargets.forEach(row => {
                    const tId = row['TRANSACTION_ID'] || '';
                    const aName = row['ASSET_NAME'] || row['ASSET NAME'] || '';
                    const aCode = row['ASSET_CODE'] || '';
                    const act = row['ACTIVITY'] || row['BUDGET HEAD'] || '';
                    const actCode = row['ACTIVITY_CODE'] || '';
                    const fy = row['FY'] || '';
                    const units = row['TARGET_UNITS'] || row['UNITS'] || '';
                    const targetQty = parseFloat(row['TARGET_QTY']) || parseFloat(row['NUMBER OF ASSET PURCHASED']) || 0;
                    
                    let cluster = row['CLUSTER'] || 'Global';
                    if (cluster.toLowerCase() === 'cluster_1') cluster = 'Cluster 1';
                    if (cluster.toLowerCase() === 'cluster_2') cluster = 'Cluster 2';
                    if (cluster.toLowerCase() === 'cluster_3') cluster = 'Cluster 3';

                    if (targetQty > 0) {
                        processedTargets.push({ 
                            Transaction_ID: tId, 
                            Asset_Name: aName, 
                            Asset_Code: aCode, 
                            Activity: act, 
                            Activity_Code: actCode, 
                            Financial_Year: fy, 
                            Target_Units: units, 
                            Target_Qty: targetQty, 
                            Cluster: cluster 
                        });
                    }
                });`;

content = content.replace(oldTargetParsing, newTargetParsing);
fs.writeFileSync(path, content);
