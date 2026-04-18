
import fetch from 'node-fetch';

async function test() {
    const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRnf96Py7icFx4_-yDw0a6xp9_pDOIfDJNHk5nUpBFDeJohuIq5RpbhShAlZlG7k4M8xTHarmZqmPX-/pub?gid=1409614466&single=true&output=csv';
    const res = await fetch(url);
    const text = await res.text();
    console.log(text.split('\n')[0]);
}

test();
