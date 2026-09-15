const fs = require('fs');
const path = require('path');

const dir = 'components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Pattern 1: headers.forEach((h, i) => obj[h] = values[i] || '');
    if (content.includes("headers.forEach((h, i) => obj[h] = values[i] || '');")) {
        content = content.replace(
            "headers.forEach((h, i) => obj[h] = values[i] || '');",
            `headers.forEach((h, i) => { if (!obj.hasOwnProperty(h) && h !== '') obj[h] = values[i] || ''; });`
        );
        changed = true;
    }

    // Pattern 2: rawHeaders.forEach((h, i) => { const key = h.trim() || \`COL_\${i}\`; obj[key] = vals[i] || ''; });
    if (content.includes("obj[key] = vals[i] || '';")) {
        content = content.replace(
            /const key = h\.trim\(\) \|\| `COL_\$\{i\}`;[\s\S]*?obj\[key\] = vals\[i\] \|\| '';/g,
            `const key = h.trim() || \`COL_\${i}\`;\n                if (!obj.hasOwnProperty(key)) obj[key] = vals[i] || '';`
        );
        changed = true;
    }

    // Pattern 3: headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    if (content.includes("obj[h] = vals[i] || '';")) {
        content = content.replace(
            /headers\.forEach\(\(h, i\) => \{\s*obj\[h\] = vals\[i\] \|\| '';\s*\}\);/g,
            `headers.forEach((h, i) => { if (!obj.hasOwnProperty(h) && h !== '') obj[h] = vals[i] || ''; });`
        );
        changed = true;
    }

    // Pattern 4: headers.forEach((header, index) => { obj[header] = values[index] || ''; });
    if (content.includes("obj[header] = values[index] || '';")) {
        content = content.replace(
            /headers\.forEach\(\(header, index\) => \{\s*obj\[header\] = values\[index\] \|\| '';\s*\}\);/g,
            `headers.forEach((header, index) => { if (!obj.hasOwnProperty(header) && header !== '') obj[header] = values[index] || ''; });`
        );
        changed = true;
    }
    
    // Pattern 5: headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    if (content.includes("obj[h] = values[i] || '';")) {
        content = content.replace(
            /headers\.forEach\(\(h, i\) => \{\s*obj\[h\] = values\[i\] \|\| '';\s*\}\);/g,
            `headers.forEach((h, i) => { if (!obj.hasOwnProperty(h) && h !== '') obj[h] = values[i] || ''; });`
        );
        changed = true;
    }
    
    // Pattern 6: headers.forEach((h, i) => obj[h] = values[i]);
    if (content.includes("headers.forEach((h, i) => obj[h] = values[i]);")) {
        content = content.replace(
            "headers.forEach((h, i) => obj[h] = values[i]);",
            `headers.forEach((h, i) => { if (!obj.hasOwnProperty(h) && h !== '') obj[h] = values[i]; });`
        );
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(filePath, content);
        console.log("Patched", file);
    }
}
