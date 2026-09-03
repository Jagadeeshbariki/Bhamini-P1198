const fs = require('fs');
let content = fs.readFileSync('components/ODKAssetDistribution.tsx', 'utf8');

content = content.replace(
    "onChange={e => setFilterMaterial(Array.from(e.target.selectedOptions, option => option.value))}",
    "onChange={e => setFilterMaterial(Array.from(e.target.selectedOptions, (option: any) => option.value))}"
);

fs.writeFileSync('components/ODKAssetDistribution.tsx', content);
