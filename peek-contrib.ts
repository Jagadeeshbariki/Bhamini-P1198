import https from 'https';

const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRDbPYgtli_sy1l6FFZPG1-FHxb1Xc0GXrK2Sc6RnQQ3SjtXZmQpUl3q2wQjMWDgP8VyORvNmBo_CPi/pub?gid=978234209&single=true&output=csv';

https.get(url, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        const lines = data.split('\n');
        
        lines.filter(l => l.includes('1170222023141')).forEach(l => {
            console.log("Contrib match:", l);
        });
    });
});
