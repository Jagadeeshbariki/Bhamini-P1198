const fs = require('fs');
let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

content = content.replace(
    '<div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#10B981] rounded-sm"></div>Collected</div>',
    '<div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#F59E0B] rounded-sm"></div>Target</div><div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#10B981] rounded-sm"></div>Collected</div>'
);

fs.writeFileSync('components/ContributionPage.tsx', content);
console.log('Fixed legend');
