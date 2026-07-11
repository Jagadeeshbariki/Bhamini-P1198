const fs = require('fs');

let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

const rawContribStart = content.indexOf('const merged: MergedContribution[] = [];');
const setMergedData = content.indexOf('        setMergedData(');

if (rawContribStart === -1 || setMergedData === -1) {
    console.error('Could not find rawContrib marker');
    process.exit(1);
}

const newLoop = `const merged: MergedContribution[] = [];
        rawContrib.forEach((row, rowIndex) => {
          const rawId = getFuzzyValue(row, [
            "HH_Id", "HH_ID", "HHID", "HH ID", "FARMERID", "FID", "ID", "FARMER ID"
          ]);
          const normId = normalizeId(rawId);
          
          let date = getFuzzyValue(row, [
            "Date Of Deposite", "Date of deposit", "DATE", "TIMESTAMP", "TIME", "SUBMISSIONDATE", "Date"
          ]) || "N/A";
          
          const isNewFormat = Object.keys(row).some(k => k.toLowerCase().includes('activity_name') || k.toLowerCase().trim() === 'activity name');
          
          if (normId) {
            const baseline = baselineMap.get(normId);
            if (baseline) {
                if (isNewFormat) {
                    const actRaw = getFuzzyValue(row, ["Activity_name", "Activity Name", "Activity"]);
                    const amountRaw = getFuzzyValue(row, ["Contribution Amount", "Total Amount Paid ", "Amount"]);
                    
                    const amount = parseFloat((amountRaw || "").toString().replace(/[^0-9.]/g, "")) || 0;
                    
                    if (amount > 0 && actRaw) {
                        const normalizedActivity = mapTargetActivity(actRaw.toString().trim());
                        const products: { name: string; count: number; unitContrib: number; date: string }[] = farmerProductsMap.get(\`\${normId}-\${normalizedActivity}\`) || [];
                        const indTarget = farmerTargetMap.get(\`\${normId}-\${normalizedActivity}\`) || 0;
                        merged.push({
                            id: \`\${normId}-\${normalizedActivity}-\${rowIndex}\`,
                            farmerId: baseline.farmerId,
                            name: baseline.hhHeadName,
                            cluster: baseline.cluster,
                            gp: baseline.gp,
                            village: baseline.village,
                            category: baseline.category,
                            amount: amount,
                            activity: normalizedActivity,
                            date: date,
                            financialYear: determineFinancialYear(date),
                            productsReceived: products,
                            individualTarget: indTarget
                        });
                    }
                } else {
                  // Iterate over the identified activity columns in the sheet (old format)
                  sheetActivityMap.forEach((normalizedActivity, colName) => {
                    const valStr = row[colName] || "0";
                    const amount = parseFloat((valStr || "").toString().replace(/[^0-9.]/g, "")) || 0;

                    if (amount > 0) {
                      const products: { name: string; count: number; unitContrib: number; date: string }[] = farmerProductsMap.get(\`\${normId}-\${normalizedActivity}\`) || [];
                      const indTarget = farmerTargetMap.get(\`\${normId}-\${normalizedActivity}\`) || 0;
                      merged.push({
                        id: \`\${normId}-\${colName}-\${rowIndex}\`,
                        farmerId: baseline.farmerId,
                        name: baseline.hhHeadName,
                        cluster: baseline.cluster,
                        gp: baseline.gp,
                        village: baseline.village,
                        category: baseline.category,
                        amount: amount,
                        activity: normalizedActivity,
                        date: date,
                        financialYear: determineFinancialYear(date),
                        productsReceived: products,
                        individualTarget: indTarget
                      });
                    }
                  });
                }
            }
          }
        });

`;

content = content.slice(0, rawContribStart) + newLoop + content.slice(setMergedData);

fs.writeFileSync('components/ContributionPage.tsx', content);
console.log('Update applied');
