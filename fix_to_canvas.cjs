const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

content = content.replace(/fontEmbedCSS: ''/g, "skipFonts: false");

fs.writeFileSync('components/ODKDashboardSection.tsx', content);
