const fs = require('fs');
let content = fs.readFileSync('components/AssetTrackingDashboard.tsx', 'utf8');

const oldFetch = `                const [assetRes, distRes] = await Promise.all([
                    fetch(getProxyUrl(\`\${ASSETS_DATA_URL}&t=\${Date.now()}\`)),
                    fetch(getProxyUrl(\`\${ASSET_DISTRIBUTION_URL}&t=\${Date.now()}\`))
                ]);`;

const newFetch = `                const safeFetch = (url: string) => fetch(getProxyUrl(url)).catch(err => {
                    console.warn("Fetch failed for " + url, err);
                    return { ok: false, text: async () => '' } as any;
                });
                const [assetRes, distRes] = await Promise.all([
                    safeFetch(\`\${ASSETS_DATA_URL}&t=\${Date.now()}\`),
                    safeFetch(\`\${ASSET_DISTRIBUTION_URL}&t=\${Date.now()}\`)
                ]);`;

content = content.replace(oldFetch, newFetch);
fs.writeFileSync('components/AssetTrackingDashboard.tsx', content);
