const fs = require('fs');
let content = fs.readFileSync('components/ODKAssetDistribution.tsx', 'utf8');

const oldParse = `    const headers = parseLine(lines[0]).map(h => h.trim().toUpperCase());
    return lines.slice(1).map(line => {
        const values = parseLine(line);
        const obj: any = {};
        headers.forEach((h, i) => obj[h] = values[i] || '');
        return obj;
    });`;

const newParse = `    const headers = parseLine(lines[0]).map(h => h.trim().toUpperCase());
    return lines.slice(1).map(line => {
        const values = parseLine(line);
        const obj: any = {};
        headers.forEach((h, i) => {
            if (!obj.hasOwnProperty(h) && h !== "") {
                obj[h] = values[i] || '';
            }
        });
        return obj;
    });`;

if (content.includes(oldParse)) {
    content = content.replace(oldParse, newParse);
    fs.writeFileSync('components/ODKAssetDistribution.tsx', content);
    console.log("Patched parseCSV");
} else {
    console.log("Could not find old parseCSV");
}
