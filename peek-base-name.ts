import https from 'https';

const BASELINE_DATA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS0e9wD0FOCBjNgdCArE9EuVsm4-wJNZLJZEkzDldWq2nW3dwnOjqhy7tZ3t-gLnJOLXiRiWwF1I3Qe/pub?gid=0&single=true&output=csv';

https.get(BASELINE_DATA_URL, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        const lines = data.split('\n');
        lines.filter(l => l.toLowerCase().includes('banti')).forEach((l, idx) => {
            console.log("Match:", l.substring(0, 100));
        });
    });
});
