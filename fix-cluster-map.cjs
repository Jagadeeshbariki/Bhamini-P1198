const fs = require('fs');
let content = fs.readFileSync('components/BeneficiaryExplorer.tsx', 'utf8');

content = content.replace(
    /const activityTargetCountMap: Record<string, number> = \{\};/,
    'const activityTargetCountMap: Record<string, number> = {};\n        const clusterTargetCountMap: Record<string, number> = {};'
);

content = content.replace(
    /if \(!activityTargetCountMap\[t\.activity\]\) activityTargetCountMap\[t\.activity\] = 0;\s*activityTargetCountMap\[t\.activity\] \+= t\.target;/,
    `if (!activityTargetCountMap[t.activity]) activityTargetCountMap[t.activity] = 0;
                activityTargetCountMap[t.activity] += t.target;
                if (!clusterTargetCountMap[t.cluster]) clusterTargetCountMap[t.cluster] = 0;
                clusterTargetCountMap[t.cluster] += t.target;`
);

fs.writeFileSync('components/BeneficiaryExplorer.tsx', content);
