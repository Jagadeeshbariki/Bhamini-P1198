async function run() {
    const res = await fetch('http://localhost:3000/api/sheet-proxy?url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2Fe%2F2PACX-1vRChs5F_pm2wiyLm9ZWvacWEyp86OpEUORX8WxUvmeVhTlZ3Vs9YXNEbb7ZP2zew8DRjXRrrJRjHkZW%2Fpub%3Fgid%3D0%26single%3Dtrue%26output%3Dcsv%26cb%3D1231231231');
    console.log(res.status, res.headers.get("content-type"));
}
run();
