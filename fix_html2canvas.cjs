const fs = require('fs');
let content = fs.readFileSync('components/ODKDashboardSection.tsx', 'utf8');

content = content.replace("import html2canvas from 'html2canvas';", "import { toCanvas } from 'html-to-image';");
content = content.replace("const canvas = await html2canvas(pivotRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });", "const canvas = await toCanvas(pivotRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });");
content = content.replace("const canvas = await html2canvas(pivotRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });", "const canvas = await toCanvas(pivotRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });");

fs.writeFileSync('components/ODKDashboardSection.tsx', content);
