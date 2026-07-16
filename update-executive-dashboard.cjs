const fs = require('fs');
let code = fs.readFileSync('components/ExecutiveDashboard.tsx', 'utf8');

const hhLogic = `
        const uniqueClusters = new Set(filteredData.map((d: any) => d.cluster)).size;
        const uniqueHHs = new Set(filteredData.map((d: any) => d.hhId || d.beneficiaryId)).size;
        const baselineTotal = stats.baselineTotal || 0;
        const hhCoverageAch = baselineTotal > 0 ? (uniqueHHs / baselineTotal) * 100 : 0;
`;

code = code.replace(/const uniqueClusters = new Set\(filteredData\.map\(\(d: any\) => d\.cluster\)\)\.size;/, hhLogic.trim());

code = code.replace(
    /uniqueClusters,/,
    `uniqueClusters,
            uniqueHHs,
            baselineTotal,
            hhCoverageAch,`
);

code = code.replace(
    /<KPICard title="Avg. Age".*?\/>/,
    `<KPICard title="HH Covered" value={dashboardData.uniqueHHs.toLocaleString()} subtitle={dashboardData.baselineTotal > 0 ? \`\${dashboardData.hhCoverageAch.toFixed(1)}% of Baseline (\${dashboardData.baselineTotal})\` : "Total Unique HHs"} icon={<Users />} color="orange" progress={dashboardData.hhCoverageAch} />`
);

fs.writeFileSync('components/ExecutiveDashboard.tsx', code);
