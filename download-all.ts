import {
    BASELINE_DATA_URL,
    CONTRIBUTION_DATA_URL,
    MASTER_TARGETS_URL,
    MATERIAL_CONTRIBUTION_URL,
    ASSET_DISTRIBUTION_URL,
    BENEFICIARY_DATA_URL
} from './config';
import fs from 'fs';
import https from 'https';

const download = (url, path) => {
    https.get(url, (res) => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
            fs.writeFileSync(path, data);
            console.log("Saved", path);
        });
    });
};

download(BASELINE_DATA_URL, 'baseline.csv');
download(CONTRIBUTION_DATA_URL, 'contrib.csv');
download(MASTER_TARGETS_URL, 'targets.csv');
download(MATERIAL_CONTRIBUTION_URL, 'material.csv');
download(ASSET_DISTRIBUTION_URL, 'dist.csv');
download(BENEFICIARY_DATA_URL, 'beneficiary.csv');

