const fs = require('fs');
let content = fs.readFileSync('components/DashboardsPortal.tsx', 'utf8');

const newDash = `        {
            id: 'odk-dashboard' as const,
            title: 'Data Submissions',
            description: 'ODK Form submissions, FRP-wise reports, and timeline analytics.',
            icon: Activity,
            color: 'bg-purple-600',
            lightColor: 'bg-purple-50',
            textColor: 'text-purple-600',
            borderColor: 'border-purple-100',
            allowed: isProjectRole
        },
`;

content = content.replace("id: 'odk-asset-distribution' as const,", newDash + "        {\n            id: 'odk-asset-distribution' as const,");

fs.writeFileSync('components/DashboardsPortal.tsx', content);
