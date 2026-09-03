const fs = require('fs');
let content = fs.readFileSync('components/DashboardsPortal.tsx', 'utf8');

content = content.replace("        {\n                    {\n            id: 'odk-dashboard' as const,", "        {\n            id: 'odk-dashboard' as const,");

fs.writeFileSync('components/DashboardsPortal.tsx', content);
