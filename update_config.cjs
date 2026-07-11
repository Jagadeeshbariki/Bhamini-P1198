const fs = require('fs');

let content = fs.readFileSync('config.ts', 'utf8');

content = content.replace(
  "export const CONTRIBUTION_DATA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRDbPYgtli_sy1l6FFZPG1-FHxb1Xc0GXrK2Sc6RnQQ3SjtXZmQpUl3q2wQjMWDgP8VyORvNmBo_CPi/pub?gid=978234209&single=true&output=csv';",
  "export const CONTRIBUTION_DATA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRDbPYgtli_sy1l6FFZPG1-FHxb1Xc0GXrK2Sc6RnQQ3SjtXZmQpUl3q2wQjMWDgP8VyORvNmBo_CPi/pub?gid=1382021703&single=true&output=csv';"
);

fs.writeFileSync('config.ts', content);
console.log('Config updated');
