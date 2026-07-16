const fs = require('fs');
let content = fs.readFileSync('components/ContributionPage.tsx', 'utf8');

const oldFetch = `        const [baselineRes, beneficiaryRes, contribRes, targetsRes, materialRes, distRes] = await Promise.all([
          fetch(getProxyUrl(\`\${BASELINE_DATA_URL}&cb=\${Date.now()}\`)),
          fetch(getProxyUrl(\`\${BENEFICIARY_DATA_URL}&cb=\${Date.now()}\`)),
          fetch(getProxyUrl(\`\${CONTRIBUTION_DATA_URL}&cb=\${Date.now()}\`)),
          fetch(getProxyUrl(\`\${MASTER_TARGETS_URL}&cb=\${Date.now()}\`)),
          fetch(getProxyUrl(\`\${MATERIAL_CONTRIBUTION_URL}&cb=\${Date.now()}\`)),
          fetch(getProxyUrl(\`\${ASSET_DISTRIBUTION_URL}&cb=\${Date.now()}\`)),
        ]);`;

const newFetch = `        const safeFetch = (url: string) => fetch(getProxyUrl(url)).catch(err => {
          console.warn("Fetch failed for " + url, err);
          return { ok: false, text: async () => '' } as any;
        });
        
        const [baselineRes, beneficiaryRes, contribRes, targetsRes, materialRes, distRes] = await Promise.all([
          safeFetch(\`\${BASELINE_DATA_URL}&cb=\${Date.now()}\`),
          safeFetch(\`\${BENEFICIARY_DATA_URL}&cb=\${Date.now()}\`),
          safeFetch(\`\${CONTRIBUTION_DATA_URL}&cb=\${Date.now()}\`),
          safeFetch(\`\${MASTER_TARGETS_URL}&cb=\${Date.now()}\`),
          safeFetch(\`\${MATERIAL_CONTRIBUTION_URL}&cb=\${Date.now()}\`),
          safeFetch(\`\${ASSET_DISTRIBUTION_URL}&cb=\${Date.now()}\`),
        ]);`;

content = content.replace(oldFetch, newFetch);
fs.writeFileSync('components/ContributionPage.tsx', content);
