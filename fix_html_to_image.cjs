const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');
content = content.replace(
  "const canvas = await toCanvas(pivotRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });",
  "const canvas = await toCanvas(pivotRef.current, { backgroundColor: '#ffffff', pixelRatio: 2, fontEmbedCSS: '' });"
);
content = content.replace(
  "const canvas = await toCanvas(pivotRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });",
  "const canvas = await toCanvas(pivotRef.current, { backgroundColor: '#ffffff', pixelRatio: 2, fontEmbedCSS: '' });"
);
fs.writeFileSync('components/ODKDashboardSection.tsx', content);
