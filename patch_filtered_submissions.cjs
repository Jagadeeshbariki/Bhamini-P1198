const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

// Update useMemo destructuring
content = content.replace(
    "const { filteredForms, filteredUsers, filteredTimeline, aggregatedForms, topUsers, pivotData, frpColumns, frpTotals } = useMemo(() => {",
    "const { filteredSubmissions, filteredForms, filteredUsers, filteredTimeline, aggregatedForms, topUsers, pivotData, frpColumns, frpTotals } = useMemo(() => {"
);
content = content.replace(
    "if (!data) return { filteredForms: [], filteredUsers: [], filteredTimeline: [], aggregatedForms: [], topUsers: [], pivotData: [], frpColumns: [], frpTotals: {} };",
    "if (!data) return { filteredSubmissions: [], filteredForms: [], filteredUsers: [], filteredTimeline: [], aggregatedForms: [], topUsers: [], pivotData: [], frpColumns: [], frpTotals: {} };"
);

// Update useMemo return
const returnBlock = `            filteredUsers: users,
            filteredTimeline: timelineArr,
            aggregatedForms: aggregatedFormsArr,
            topUsers: topUsersArr,
            pivotData,
            frpColumns,
            frpTotals
        };`;
const newReturnBlock = `            filteredSubmissions: filtered,
            filteredUsers: users,
            filteredTimeline: timelineArr,
            aggregatedForms: aggregatedFormsArr,
            topUsers: topUsersArr,
            pivotData,
            frpColumns,
            frpTotals
        };`;
content = content.replace(returnBlock, newReturnBlock);

fs.writeFileSync('components/ODKDashboardSection.tsx', content);
