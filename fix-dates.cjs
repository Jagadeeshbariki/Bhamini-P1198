const fs = require('fs');
let code = fs.readFileSync('components/ExecutiveDashboard.tsx', 'utf8');

const newDateLogic = `
        // Time series for registration (if date available)
        const dateMap: Record<string, number> = {};
        filteredData.forEach((d: any) => {
            if (d.registrationDate) {
                try {
                    let dStr = d.registrationDate;
                    let monthYear = '';
                    if (dStr.includes('-')) {
                        // Assume DD-MMM-YYYY or YYYY-MM-DD
                        const parts = dStr.split('-');
                        if (parts.length === 3) {
                            if (isNaN(parts[1])) {
                                // DD-MMM-YYYY
                                monthYear = \`\${parts[1]} \${parts[2]}\`;
                            } else {
                                // YYYY-MM-DD
                                const date = new Date(dStr);
                                if (!isNaN(date.getTime())) {
                                    monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                                }
                            }
                        }
                    } else if (dStr.includes('/')) {
                        // Assume MM/DD/YYYY or DD/MM/YYYY
                        const parts = dStr.split('/');
                        if (parts.length === 3) {
                            // Let's just create a Date object and hope it parses correctly
                            const date = new Date(dStr);
                            if (!isNaN(date.getTime())) {
                                monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                            } else {
                                monthYear = \`\${parts[1]}/\${parts[2]}\`; 
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
    newDateLogic.trim()
);

fs.writeFileSync('components/ExecutiveDashboard.tsx', code);
