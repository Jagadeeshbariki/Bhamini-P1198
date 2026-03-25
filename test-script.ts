const url = 'https://script.google.com/macros/s/AKfycby_zBsEc4CD3YjhipaAw1ngO19fTnLH3glszHJOlLVx2xahJ40B-pRNbXJhuwzhepe2/exec';
const data = {
    name: 'test',
    date: '25/03/2026',
    workingStatus: 'Working',
    reasonNotWorking: '',
    placeOfVisit: 'test',
    purposeOfVisit: 'test',
    workingHours: '8',
    outcome: 'test'
};

fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(data)
})
.then(r => r.text())
.then(console.log)
.catch(console.error);
