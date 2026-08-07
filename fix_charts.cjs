const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

// replace the timeline and top users wrappers
content = content.replace(
    'className="flex-1 w-full min-h-[250px] lg:min-h-0"',
    'className="w-full h-[250px] lg:flex-1 lg:h-auto lg:min-h-0"'
);
content = content.replace(
    'className="flex-1 w-full min-h-[250px] lg:min-h-0"',
    'className="w-full h-[250px] lg:flex-1 lg:h-auto lg:min-h-0"'
);

fs.writeFileSync('components/ODKDashboardSection.tsx', content);
console.log("fixed charts height");
