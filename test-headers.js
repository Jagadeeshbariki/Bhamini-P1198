const urls = {
  MIS_TARGETS: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2T6skNnpDlaFl8n93i0eO7zlF0bK-sdndW1-AIRRpWf-YJkYzXjiC8B1e5hFdZ2KqMsNTKN9NCmPG/pub?gid=2011622883&single=true&output=csv',
};

async function run() {
  for (const [name, url] of Object.entries(urls)) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      console.log(`${name}: ${text.split('\n')[0]}`);
      console.log(text.split('\n').slice(0, 5).join('\n'));
    } catch (e) {
      console.error(e);
    }
  }
}
run();
