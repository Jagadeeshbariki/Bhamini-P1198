const url = "https://script.google.com/macros/s/AKfycbwp9LTcw2mEBJs2JQWq6NxexdbGtkFO_IrDFXz_8XItnD2VoQHOA79TysWeuSwxbY3wdw/exec";
const payload = {
    action: 'updateAcquittance',
    rowKey: 'uuid:b4067253-abcb-4467-bc18-283188565b93',
    acquittanceReceived: 'Yes'
};
fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain' }
}).then(r => r.text()).then(t => console.log("Response:", t)).catch(e => console.error(e));
