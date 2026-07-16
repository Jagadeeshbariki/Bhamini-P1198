const fs = require('fs');
let content = fs.readFileSync('components/HomePage.tsx', 'utf8');

const oldFetch = `            const [photosRes, villagesRes] = await Promise.all([
                fetch(getProxyUrl(\`\${GOOGLE_SHEET_PHOTOS_URL}&t=\${Date.now()}\`)),
                fetch(getProxyUrl(\`\${VILLAGES_DATA_URL}&t=\${Date.now()}\`))
            ]);`;

const newFetch = `            const safeFetch = (url: string) => fetch(getProxyUrl(url)).catch(err => {
                console.warn("Fetch failed for " + url, err);
                return { ok: false, text: async () => '' } as any;
            });
            const [photosRes, villagesRes] = await Promise.all([
                safeFetch(\`\${GOOGLE_SHEET_PHOTOS_URL}&t=\${Date.now()}\`),
                safeFetch(\`\${VILLAGES_DATA_URL}&t=\${Date.now()}\`)
            ]);`;

content = content.replace(oldFetch, newFetch);
fs.writeFileSync('components/HomePage.tsx', content);
