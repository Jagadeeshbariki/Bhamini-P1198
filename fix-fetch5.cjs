const fs = require('fs');
let content = fs.readFileSync('components/FieldMISPage.tsx', 'utf8');

const oldFetch = `            const [misRes, assetsRes, distRes, benRes, contRes, budgetRes, regRes] = await Promise.all([
                fetch(getProxyUrl(\`\${MIS_TARGETS_URL}&t=\${Date.now()}\`)),
                fetch(getProxyUrl(\`\${ASSETS_DATA_URL}&t=\${Date.now()}\`)),
                fetch(getProxyUrl(\`\${ASSET_DISTRIBUTION_URL}&t=\${Date.now()}\`)),
                fetch(getProxyUrl(\`\${BENEFICIARY_DATA_URL}&t=\${Date.now()}\`)),
                fetch(getProxyUrl(\`\${CONTRIBUTION_DATA_URL}&t=\${Date.now()}\`)),
                fetch(getProxyUrl(\`\${BUDGET_CSV_URL}&t=\${Date.now()}\`)),
                fetch(getProxyUrl(\`\${MASTER_TARGETS_URL}&t=\${Date.now()}\`))
            ]);`;

const newFetch = `            const safeFetch = (url: string) => fetch(getProxyUrl(url)).catch(err => {
                console.warn("Fetch failed for " + url, err);
                return { ok: false, text: async () => '' } as any;
            });
            const [misRes, assetsRes, distRes, benRes, contRes, budgetRes, regRes] = await Promise.all([
                safeFetch(\`\${MIS_TARGETS_URL}&t=\${Date.now()}\`),
                safeFetch(\`\${ASSETS_DATA_URL}&t=\${Date.now()}\`),
                safeFetch(\`\${ASSET_DISTRIBUTION_URL}&t=\${Date.now()}\`),
                safeFetch(\`\${BENEFICIARY_DATA_URL}&t=\${Date.now()}\`),
                safeFetch(\`\${CONTRIBUTION_DATA_URL}&t=\${Date.now()}\`),
                safeFetch(\`\${BUDGET_CSV_URL}&t=\${Date.now()}\`),
                safeFetch(\`\${MASTER_TARGETS_URL}&t=\${Date.now()}\`)
            ]);`;

content = content.replace(oldFetch, newFetch);
fs.writeFileSync('components/FieldMISPage.tsx', content);
