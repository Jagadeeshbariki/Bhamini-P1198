import { BENEFICIARY_DATA_URL } from './config';

fetch(BENEFICIARY_DATA_URL)
  .then(res => res.text())
  .then(text => console.log(text.split('\n')[0]))
  .catch(err => console.error(err));
