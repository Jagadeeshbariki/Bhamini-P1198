const fs = require('fs');
let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

const replacement = `
        setTargets(Array.from(targetMap.values()));
        console.log("FINAL TARGETS:", Array.from(targetMap.values()));
`;

content = content.replace(/setTargets\(Array\.from\(targetMap\.values\(\)\)\);/g, replacement);
fs.writeFileSync('components/ContributionPage.tsx', content);
console.log('Added log');
