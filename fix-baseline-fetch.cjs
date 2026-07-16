const fs = require('fs');
let code = fs.readFileSync('components/BeneficiaryExplorer.tsx', 'utf8');

code = code.replace(
    /const \[masterRes, distRes, targetRes, contribRes, materialMapRes\] = await Promise\.all\(\[/,
    `const [masterRes, distRes, targetRes, contribRes, materialMapRes, baselineRes] = await Promise.all([`
);

code = code.replace(
    /safeFetch\(\`\$\{MATERIAL_CONTRIBUTION_URL\}&t=\$\{Date\.now\(\)\}\`\)\n                \]\);/,
    `safeFetch(\`\$\{MATERIAL_CONTRIBUTION_URL\}&t=\$\{Date.now()\}\`),
                    safeFetch(\`\$\{BASELINE_DATA_URL\}&t=\$\{Date.now()\}\`)
                ]);`
);

code = code.replace(
    /const materialMapText = materialMapRes\.ok \? await materialMapRes\.text\(\) : '';/,
    `const materialMapText = materialMapRes.ok ? await materialMapRes.text() : '';
                const baselineText = baselineRes.ok ? await baselineRes.text() : '';`
);

// Add baseline size
code = code.replace(
    /const distData = parseCSV\(distText, 'Distribution List'\);/,
    `const distData = parseCSV(distText, 'Distribution List');
                const baselineData = parseCSV(baselineText, 'Baseline List');`
);

code = code.replace(
    /setTargets\(parsedTargets\);/,
    `setTargets(parsedTargets);
                setBaselineSize(baselineData.length);`
);

fs.writeFileSync('components/BeneficiaryExplorer.tsx', code);
