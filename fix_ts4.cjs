const fs = require('fs');
const path = 'components/ContributionPage.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    /const topContributorsMap = new Map<string, \{ name: string, cluster: string, amount: number, activities: Set<string> \}>\(\);/g,
    "const topContributorsMap = new Map<string, { name: string, cluster: string, amount: number, target: number, activities: Set<string> }>();"
);

fs.writeFileSync(path, content);
console.log("Fixed ts4");
