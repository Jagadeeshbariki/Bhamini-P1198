import { getProxyUrl, CROPS_DATA_URL, BIO_INPUTS_DATA_URL, HARVEST_DATA_URL } from './config.ts';

async function main() {
    for (const url of [CROPS_DATA_URL, BIO_INPUTS_DATA_URL, HARVEST_DATA_URL]) {
        console.log("Fetching", url);
        const res = await fetch(url);
        const text = await res.text();
        console.log(text.slice(0, 500));
        console.log("-------------------");
    }
}

main();
