const fs = require('fs');
let code = fs.readFileSync('components/ExecutiveDashboard.tsx', 'utf8');

const updatedDateLogic = `
        // Time series for registration (if date available)
        const dateMap: Record<string, number> = {};
        filteredData.forEach((d: any) => {
            if (d.registrationDate) {
                try {
                    let dStr = d.registrationDate;
                    let monthYear = '';
                    if (dStr.includes('-')) {
                        const parts = dStr.split('-');
                        if (parts.length === 3) {
                            if (isNaN(parts[1])) {
                                monthYear = \`\${parts[1]} \${parts[2]}\`;
                            } else {
                                // Try DD-MM-YYYY vs YYYY-MM-DD
                                if (parts[0].length === 4) {
                                    const date = new Date(dStr);
                                    if (!isNaN(date.getTime())) monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                                } else {
                                    // DD-MM-YYYY
                                    const date = new Date(\`\${parts[2]}-\${parts[1]}-\${parts[0]}\`);
                                    if (!isNaN(date.getTime())) monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                                }
                            }
                        }
                    } else if (dStr.includes('/')) {
                        const parts = dStr.split('/');
                        if (parts.length === 3) {
                            if (parts[2].length === 4) {
                                // DD/MM/YYYY
                                const date = new Date(\`\${parts[2]}-\${parts[1]}-\${parts[0]}\`);
                                if (!isNaN(date.getTime())) {
                                    monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                                } else {
                                    const date2 = new Date(\`\${parts[2]}-\${parts[0]}-\${parts[1]}\`); // MM/DD/YYYY
                                    if (!isNaN(date2.getTime())) monthYear = date2.toLocaleString('default', { month: 'short', year: 'numeric' });
                                }
                            }
                        }
                    } else {
                        const date = new Date(dStr);
                        if (!isNaN(date.getTime())) {
                            monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                        }
                    }
                    if (monthYear) {
                        dateMap[monthYear] = (dateMap[monthYear] || 0) + 1;
                    }
                } catch (e) {}
            }
        });
        const timeSeriesData = Object.keys(dateMap).sort().map(k => ({ name: k, value: dateMap[k] }));
`;

code = code.replace(
    /\/\/ Time series for registration.*?const timeSeriesData = Object\.keys\(dateMap\)\.sort\(\)\.map\(k => \(\{ name: k, value: dateMap\[k\] \}\)\);/s,
    updatedDateLogic.trim()
);

fs.writeFileSync('components/ExecutiveDashboard.tsx', code);
