const fs = require('fs');
let content = fs.readFileSync('components/ActivityDashboards.tsx', 'utf8');

const oldFetch = `            const [benRes, contribRes, cropsRes, assetRes, bioRes, harvRes, targetsRes] = await Promise.all([
                fetch(getProxyUrl(\`\${BENEFICIARY_DATA_URL}&cb=\${Date.now()}\`)),
                fetch(getProxyUrl(\`\${CONTRIBUTION_DATA_URL}&cb=\${Date.now()}\`)),
                fetchSafe(CROPS_DATA_URL),
                fetch(getProxyUrl(\`\${ASSET_DISTRIBUTION_URL}&cb=\${Date.now()}\`)),
                fetchSafe(BIO_INPUTS_DATA_URL),
                fetchSafe(HARVEST_DATA_URL),
                fetchSafe(CROPS_MATERIAL_TARGETS_URL)
            ]);`;

const newFetch = `            const [benRes, contribRes, cropsRes, assetRes, bioRes, harvRes, targetsRes] = await Promise.all([
                fetchSafe(BENEFICIARY_DATA_URL),
                fetchSafe(CONTRIBUTION_DATA_URL),
                fetchSafe(CROPS_DATA_URL),
                fetchSafe(ASSET_DISTRIBUTION_URL),
                fetchSafe(BIO_INPUTS_DATA_URL),
                fetchSafe(HARVEST_DATA_URL),
                fetchSafe(CROPS_MATERIAL_TARGETS_URL)
            ]);`;

content = content.replace(oldFetch, newFetch);
fs.writeFileSync('components/ActivityDashboards.tsx', content);
