const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

content = content.replace("                    </div\n                    <div className=\"w-full\">", "                    </div>\n                    <div className=\"w-full\">");
content = content.replace("                    </div>>\n                    <div className=\"w-full\">", "                    </div>\n                    <div className=\"w-full\">");

fs.writeFileSync('components/ODKDashboardSection.tsx', content);
console.log("fixed2");
