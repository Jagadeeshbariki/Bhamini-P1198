const fs = require('fs');
let path = 'components/ODKDashboardSection.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix the backticks
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');

fs.writeFileSync(path, content);
console.log("Fixed quotes");
