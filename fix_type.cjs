const fs = require('fs');
let path = 'components/ODKDashboardSection.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    /name: usersMap\.get\(sub\.userId\) \|\| `User \$\{sub\.userId\}`/g,
    "name: (usersMap.get(sub.userId) as string) || `User ${sub.userId}`"
);

fs.writeFileSync(path, content);
console.log("Fixed type");
