import http from 'http';

http.get('http://0.0.0.0:3000/api/sheet-proxy?url=' + encodeURIComponent('https://docs.google.com/spreadsheets/d/e/2PACX-1vRChs5F_pm2wiyLm9ZWvacWEyp86OpEUORX8WxUvmeVhTlZ3Vs9YXNEbb7ZP2zew8DRjXRrrJRjHkZW/pub?gid=0&single=true&output=csv'), (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => console.log(res.statusCode, data.substring(0, 100)));
});
