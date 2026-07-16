const fs = require('fs');
let content = fs.readFileSync('components/BeneficiaryExplorer.tsx', 'utf8');

const oldFetch = `                const [masterRes, distRes, targetRes, contribRes, materialMapRes] = await Promise.all([
                    fetch(getProxyUrl(\`\${BENEFICIARY_DATA_URL}&t=\${Date.now()}\`)),
                    fetch(getProxyUrl(\`\${ASSET_DISTRIBUTION_URL}&t=\${Date.now()}\`)),
                    fetch(getProxyUrl(\`\${MASTER_TARGETS_URL}&t=\${Date.now()}\`)),
                    fetch(getProxyUrl(\`\${CONTRIBUTION_DATA_URL}&t=\${Date.now()}\`)),
                    fetch(getProxyUrl(\`\${MATERIAL_CONTRIBUTION_URL}&t=\${Date.now()}\`))
                ]);`;

const newFetch = `                const safeFetch = (url: string) => fetch(getProxyUrl(url)).catch(err => {
                    console.warn("Fetch failed for " + url, err);
                    return { ok: false, text: async () => '' } as any;
                });
                
                const [masterRes, distRes, targetRes, contribRes, materialMapRes] = await Promise.all([
                    safeFetch(\`\${BENEFICIARY_DATA_URL}&t=\${Date.now()}\`),
                    safeFetch(\`\${ASSET_DISTRIBUTION_URL}&t=\${Date.now()}\`),
                    safeFetch(\`\${MASTER_TARGETS_URL}&t=\${Date.now()}\`),
                    safeFetch(\`\${CONTRIBUTION_DATA_URL}&t=\${Date.now()}\`),
                    safeFetch(\`\${MATERIAL_CONTRIBUTION_URL}&t=\${Date.now()}\`)
                ]);`;

content = content.replace(oldFetch, newFetch);
fs.writeFileSync('components/BeneficiaryExplorer.tsx', content);
