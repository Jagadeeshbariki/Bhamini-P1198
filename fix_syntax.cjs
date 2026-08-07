const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

content = content.replace("</div                    <div", "</div>\n                    <div");
content = content.replace("                    </div>>                    <div", "                    </div>\n                    <div");

fs.writeFileSync('components/ODKDashboardSection.tsx', content);
console.log("fixed");
