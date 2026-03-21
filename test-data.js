const urls = {
  ASSETS_DATA: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRFh_YS7XbVtnjgN7RNYgyNDZtWrobCdLqrAuvXLFBREwGnBHrQA6M0oJMmGPE6tnGhcZR1I-8Uv7cs/pub?gid=0&single=true&output=csv',
  ASSET_DISTRIBUTION: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRnf96Py7icFx4_-yDw0a6xp9_pDOIfDJNHk5nUpBFDeJohuIq5RpbhShAlZlG7k4M8xTHarmZqmPX-/pub?gid=1409614466&single=true&output=csv',
  BENEFICIARY_DATA: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS0e9wD0FOCBjNgdCArE9EuVsm4-wJNZLJZEkzDldWq2nW3dwnOjqhy7tZ3t-gLnJOLXiRiWwF1I3Qe/pub?gid=0&single=true&output=csv'
};

async function run() {
  for (const [name, url] of Object.entries(urls)) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      console.log(`\n--- ${name} ---`);
      console.log(text.split('\n').slice(0, 3).join('\n'));
    } catch (e) {
      console.error(e);
    }
  }
}
run();
