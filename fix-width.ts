import * as fs from 'fs';
import * as path from 'path';

const componentsDir = path.join(process.cwd(), 'components');

fs.readdirSync(componentsDir).forEach(file => {
    if (file.endsWith('.tsx')) {
        const filePath = path.join(componentsDir, file);
        let content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes('max-w-7xl mx-auto')) {
            content = content.replace(/max-w-7xl mx-auto/g, 'w-full');
            fs.writeFileSync(filePath, content, 'utf-8');
            console.log(`Updated ${file}`);
        }
    }
});
