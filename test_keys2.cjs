const fs = require('fs');
const content = fs.readFileSync('components/ODKAssetDistribution.tsx', 'utf8');
if (content.includes('const codeToNameMap')) {
    console.log("Success: Map is in place.");
}
