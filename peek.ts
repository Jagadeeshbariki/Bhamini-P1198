import fs from 'fs';
import https from 'https';

const ASSET_DISTRIBUTION_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRnf96Py7icFx4_-yDw0a6xp9_pDOIfDJNHk5nUpBFDeJohuIq5RpbhShAlZlG7k4M8xTHarmZqmPX-/pub?gid=1409614466&single=true&output=csv';

https.get(ASSET_DISTRIBUTION_URL, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        const lines = data.split('\n');
        const count = lines.filter(l => l.includes('1170222023141')).length;
        console.log("Found 1170222023141 in Dist:", count, "times");
        
        lines.filter(l => l.includes('1170222023141')).forEach(l => {
            const arr = l.split(',');
            console.log("Match:", l.substring(0, 150));
        });
    });
});
