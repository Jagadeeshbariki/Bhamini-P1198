import { BENEFICIARY_DATA_URL } from './config.js';
fetch(BENEFICIARY_DATA_URL).then(r=>r.text()).then(t => console.log(t.split('\n')[0]));
