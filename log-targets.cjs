const fs = require('fs');
let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

const replacement = `
  const stats = useMemo(() => {
    console.log("CALCULATING STATS. Targets length:", targets.length);
    if (targets.length > 0) {
        console.log("Sample target:", targets[0]);
    }
`;

content = content.replace(/const stats = useMemo\(\(\) => \{/, replacement);
fs.writeFileSync('components/ContributionPage.tsx', content);
