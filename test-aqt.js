const url = "https://script.google.com/macros/s/AKfycby2s0HDWZdwIqvT7UtsCm491PZ3Gqs6aZkRczItIdNsnAUOTPoFAEB0Ylxps-02YAfYbw/exec";
const payload = {
    action: 'updateAcquittance',
    rowKey: 'uuid:5beb072c-efc5-4753-ae5a-d39a09228991/distribution_details[1]',
    acquittanceReceived: 'Yes',
    updatedBy: 'Jagadeesh'
};
fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain' }
}).then(r => r.text()).then(t => console.log("Response:", t)).catch(e => console.error(e));
