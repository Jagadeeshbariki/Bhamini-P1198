import { CROPS_DATA_URL } from './config';

async function fetchCrops() {
    const res = await fetch(CROPS_DATA_URL);
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    const headers = lines[0].split(',');
    console.log(headers);
}

fetchCrops();
