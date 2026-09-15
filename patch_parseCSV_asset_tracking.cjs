const fs = require('fs');
let content = fs.readFileSync('components/AssetTrackingDashboard.tsx', 'utf8');

const oldParse = `            headers.forEach((h, i) => {
                obj[cleanHeaders[i]] = row[i] || '';
            });`;

const newParse = `            headers.forEach((h, i) => {
                if (!obj.hasOwnProperty(cleanHeaders[i]) && cleanHeaders[i] !== "") {
                    obj[cleanHeaders[i]] = row[i] || '';
                }
            });`;

if (content.includes(oldParse)) {
    content = content.replace(oldParse, newParse);
    fs.writeFileSync('components/AssetTrackingDashboard.tsx', content);
    console.log("Patched AssetTrackingDashboard.tsx");
} else {
    console.log("Could not find old parseCSV loop in AssetTrackingDashboard.tsx");
}
