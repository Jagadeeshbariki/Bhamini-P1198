import https from 'https';

const BASELINE_DATA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRChs5F_pm2wiyLm9ZWvacWEyp86OpEUORX8WxUvmeVhTlZ3Vs9YXNEbb7ZP2zew8DRjXRrrJRjHkZW/pub?gid=0&single=true&output=csv';

https.get(BASELINE_DATA_URL, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        const lines = data.split('\n');
        lines.filter(l => l.toLowerCase().includes('1170222023141')).forEach((l, idx) => {
            console.log("Match in Baseline:", l);
        });
    });
});
