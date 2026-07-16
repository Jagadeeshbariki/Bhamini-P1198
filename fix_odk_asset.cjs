const fs = require('fs');
const path = 'components/ODKAssetDistribution.tsx';
let content = fs.readFileSync(path, 'utf8');

const fetchLogicRegex = /const processedTargets: any\[\] = \[\];[\s\S]*?if\(qty > 0\) {/m;

const newFetchLogic = `const processedTargets: any[] = [];
                const codeToNameMap: Record<string, {name: string, activity: string}> = {};

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

                    if (aCode) {
                        codeToNameMap[aCode] = { name: aName, activity: act };
                    }

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
                });

                const processedDist: any[] = [];
                parsedDist.forEach(row => {
                    const aCode = row['MATERIAL_ID'] || row['THIS_MATERIAL_CODE'] || '';
                    
                    const mappedInfo = codeToNameMap[aCode];
                    const aName = mappedInfo?.name || row['THIS_MATERIAL_LABEL'] || '';
                    const act = mappedInfo?.activity || row['ACTIVITY'] || '';
                    
                    const actCode = row['ACTIVITY_ID'] || '';
                    let cluster = row['CLUSTER'] || 'Global';
                    if(cluster.toLowerCase() === 'cluster_1') cluster = 'Cluster 1';
                    if(cluster.toLowerCase() === 'cluster_2') cluster = 'Cluster 2';
                    if(cluster.toLowerCase() === 'cluster_3') cluster = 'Cluster 3';

                    const qty = parseFloat(row['MATERIALS_DETAILS-MATERIAL_COUNT']) || 0;
                    let dateStr = row['DATE OF SUBMISSION'] || row['MATERIALS_DETAILS-DISTRIBUTED_DATE'] || '';
                    if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
                    else if (dateStr) {
                         const d = new Date(dateStr);
                         if(!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
                    }

                    const benName = row['BENEFICIARY NAME'] || '';
                    const benId = row['BEN_ID'] || row['FARMER ID'] || '';
                    const submitter = row['SUBMITTER'] || '';
                    const photo = row['PHOTO'] || '';

                    if(qty > 0) {`;

content = content.replace(fetchLogicRegex, newFetchLogic);

// Now fix tableData
const tableDataOld = `    // Unified Table Data
    const tableData = useMemo(() => {
        const map: Record<string, any> = {};
        fTargets.forEach(t => {
            const k = \`\${t.Cluster}|\${t.Activity}|\${t.Asset_Name}|\${t.Asset_Code}\`;
            if(!map[k]) map[k] = { cluster: t.Cluster, activity: t.Activity, material: t.Asset_Name, code: t.Asset_Code, target: 0, dist: 0, lastDate: null };
            map[k].target += t.Target_Qty;
        });
        fDist.forEach(d => {
            const k = \`\${d.Cluster}|\${d.Activity}|\${d.Asset_Name}|\${d.Asset_Code}\`;
            if(!map[k]) map[k] = { cluster: d.Cluster, activity: d.Activity, material: d.Asset_Name, code: d.Asset_Code, target: 0, dist: 0, lastDate: null };
            map[k].dist += d.Distributed_Qty;
            if(!map[k].lastDate || d.Date > map[k].lastDate) map[k].lastDate = d.Date;
        });`;

const tableDataNew = `    // Unified Table Data
    const tableData = useMemo(() => {
        const map: Record<string, any> = {};
        fTargets.forEach(t => {
            const k = \`\${t.Cluster}|\${t.Asset_Code}\`;
            if(!map[k]) map[k] = { cluster: t.Cluster, activity: t.Activity, material: t.Asset_Name, code: t.Asset_Code, target: 0, dist: 0, lastDate: null };
            map[k].target += t.Target_Qty;
            map[k].activity = t.Activity;
            map[k].material = t.Asset_Name;
        });
        fDist.forEach(d => {
            const k = \`\${d.Cluster}|\${d.Asset_Code}\`;
            if(!map[k]) map[k] = { cluster: d.Cluster, activity: d.Activity, material: d.Asset_Name, code: d.Asset_Code, target: 0, dist: 0, lastDate: null };
            map[k].dist += d.Distributed_Qty;
            if(!map[k].lastDate || d.Date > map[k].lastDate) map[k].lastDate = d.Date;
        });`;

content = content.replace(tableDataOld, tableDataNew);

fs.writeFileSync(path, content);
