const fs = require('fs');
let code = fs.readFileSync('components/ExecutiveDashboard.tsx', 'utf8');

const sortLogic = `
        const sortedMonths = Object.keys(dateMap).sort((a, b) => {
            const dateA = new Date('01 ' + a);
            const dateB = new Date('01 ' + b);
            return dateA.getTime() - dateB.getTime();
        });
        const timeSeriesData = sortedMonths.map(k => ({ name: k, value: dateMap[k] }));
`;

code = code.replace(
    /const timeSeriesData = Object\.keys\(dateMap\)\.sort\(\)\.map\(k => \(\{ name: k, value: dateMap\[k\] \}\)\);/,
    sortLogic.trim()
);

fs.writeFileSync('components/ExecutiveDashboard.tsx', code);
