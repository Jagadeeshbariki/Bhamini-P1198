fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2T6skNnpDlaFl8n93i0eO7zlF0bK-sdndW1-AIRRpWf-YJkYzXjiC8B1e5hFdZ2KqMsNTKN9NCmPG/pub?gid=0&single=true&output=csv')
.then(r => r.text())
.then(t => console.log(t.split('\n')[0]))
.catch(console.error);
