const fs = require('fs');
let code = fs.readFileSync('components/BeneficiaryExplorer.tsx', 'utf8');

const newContribLogic = `
                const rawContrib = parseGenericCSV(contribText);
                const contribMap = new Map<string, Record<string, number>>();
                rawContrib.forEach((row: any) => {
                    const id = row['HH_Id'] || row['HH_ID'] || row['HHID'] || row['HH ID'] || row['Farmer ID'] || row['FARMERID'];
                    const activity = getContribActivityColumn(row['Activity_name'] || row['Activity Name'] || '');
                    let amount = parseFloat((row['Total Amount Paid '] || row['Total Amount Paid'] || row['Contribution Amount'] || '0').toString().replace(/,/g, '')) || 0;
                    if (id && activity) {
                        const hhid = id.toString().trim();
                        if (!contribMap.has(hhid)) contribMap.set(hhid, {});
                        const obj = contribMap.get(hhid);
                        if (obj) {
                            obj[activity] = (obj[activity] || 0) + amount;
                        }
                    }
                });
`;

code = code.replace(
    /const rawContrib = parseGenericCSV\(contribText\);\n.*?contribMap\.set\(id\.toString\(\)\.trim\(\), row\);\n                    \}\n                \}\);/s,
    newContribLogic.trim()
);

const newMergeLogic = `
                    if (key) {
                        const cObj = hhId ? contribMap.get(hhId.toString().trim()) : undefined;
                        let contrib = 0;
                        if (cObj) {
                            const colName = getContribActivityColumn(b.activity);
                            if (colName && cObj[colName]) {
                                contrib = cObj[colName];
                            }
                        }
                        b.contribution = contrib;
                        mergedMap.set(key, b);
                    }
`;

code = code.replace(
    /if \(key\) \{\n                        const cRow = hhId \? contribMap\.get\(hhId\.toString\(\)\.trim\(\)\) : undefined;\n                        let contrib = 0;\n                        if \(cRow\) \{\n                            const colName = getContribActivityColumn\(b\.activity\);\n                            if \(colName && cRow\[colName\]\) \{\n                                contrib = parseFloat\(cRow\[colName\]\) \|\| 0;\n                            \}\n                        \}\n                        b\.contribution = contrib;\n                        mergedMap\.set\(key, b\);\n                    \}/gs,
    newMergeLogic.trim()
);

fs.writeFileSync('components/BeneficiaryExplorer.tsx', code);
