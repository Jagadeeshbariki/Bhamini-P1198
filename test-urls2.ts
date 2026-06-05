import { BASELINE_DATA_URL, CONTRIBUTION_DATA_URL, MASTER_TARGETS_URL, MATERIAL_CONTRIBUTION_URL, ASSET_DISTRIBUTION_URL } from "./config";

async function run() {
    const urls = [BASELINE_DATA_URL, CONTRIBUTION_DATA_URL, MASTER_TARGETS_URL, MATERIAL_CONTRIBUTION_URL, ASSET_DISTRIBUTION_URL];
    for (const url of urls) {
        try {
            const res = await fetch(`${url}&cb=${Date.now()}`);
            console.log(url.split("gid=")[1], res.status);
            if (!res.ok) {
                console.log("FAILED", await res.text());
            }
        } catch (e) {
            console.log(e);
        }
    }
}
run();
