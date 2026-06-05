import { BASELINE_DATA_URL, CONTRIBUTION_DATA_URL, MASTER_TARGETS_URL, MATERIAL_CONTRIBUTION_URL, ASSET_DISTRIBUTION_URL } from "./config";

async function run() {
    const baselineRes = await fetch(`${BASELINE_DATA_URL}&cb=${Date.now()}`);
    console.log("baselineRes", baselineRes.status);
    const contribRes = await fetch(`${CONTRIBUTION_DATA_URL}&cb=${Date.now()}`);
    console.log("contribRes", contribRes.status);    
}

run();
