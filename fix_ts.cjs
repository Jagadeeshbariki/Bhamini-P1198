const fs = require('fs');

// Fix ODKDashboardSection
let path = 'components/ODKDashboardSection.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(
    "RechartsTooltip, Bar",
    "Tooltip as RechartsTooltip, Bar"
);
fs.writeFileSync(path, content);

// Fix server.ts
path = 'server.ts';
content = fs.readFileSync(path, 'utf8');
content = content.replace(
    "const usersArray = Object.values(userStats).sort((a, b) => b.total - a.total);",
    "const usersArray = (Object.values(userStats) as any[]).sort((a, b) => b.total - a.total);"
);
fs.writeFileSync(path, content);

console.log("Fixed ts errors");
