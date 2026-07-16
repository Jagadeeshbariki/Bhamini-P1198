const fs = require('fs');

function fixMap(file) {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/Map, Heart, Star/, 'Map as MapIcon, Heart, Star');
    code = code.replace(/<Map \/>/g, '<MapIcon />');
    fs.writeFileSync(file, code);
}

fixMap('components/BeneficiaryExplorer.tsx');
fixMap('components/ExecutiveDashboard.tsx');
console.log('Fixed Map imports');
