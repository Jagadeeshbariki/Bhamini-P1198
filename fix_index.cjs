const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

content = content.replace('<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">', '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" crossorigin="anonymous">');

fs.writeFileSync('index.html', content);
