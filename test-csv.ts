import { readFileSync } from 'fs';
const parseGenericCSV = (csvText: string) => {
    const lines = csvText.split('\n');
    if (lines.length < 2) return [];
    
    // We assume the first line contains headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    return lines.slice(1).map(lineText => {
        const line = lineText.trim();
        if (!line) return null;
        
        let values: string[] = [];
        let inQuotes = false;
        let cur = '';
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') {
                inQuotes = !inQuotes;
            } else if (line[i] === ',' && !inQuotes) {
                values.push(cur.trim());
                cur = '';
            } else cur += line[i];
        }
        values.push(cur.trim());
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index] ? values[index].replace(/^"|"$/g, '') : '';
            return obj;
        }, {} as any);
    }).filter(x => x);
};

const run = async () => {
    const text = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vRFh_YS7XbVtnjgN7RNYgyNDZtWrobCdLqrAuvXLFBREwGnBHrQA6M0oJMmGPE6tnGhcZR1I-8Uv7cs/pub?gid=2092417444&single=true&output=csv').then(r=>r.text());
    const parsed = parseGenericCSV(text);
    console.log(parsed.slice(135,145));
}
run();
