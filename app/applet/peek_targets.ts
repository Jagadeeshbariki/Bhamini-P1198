import { MASTER_TARGETS_URL } from './config';
import fetch from 'node-fetch';

fetch(MASTER_TARGETS_URL)
  .then(res => res.text())
  .then(text => console.log(text.split('\n')[0]))
  .catch(err => console.error(err));
