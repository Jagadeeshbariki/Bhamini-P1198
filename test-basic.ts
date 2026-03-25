async function testBasicAuth() {
    const email = process.env.ODK_EMAIL;
    const password = process.env.ODK_PASSWORD;
    
    const url = 'https://central.wassan.org/v1/projects/3/forms/Material_distribution/submissions/uuid:34ba25c8-9cc3-4f65-accc-57530a7dd7d0/attachments/1772579126307.jpg';
    
    const authHeader = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');
    
    const res = await fetch(url, {
        headers: { 'Authorization': authHeader }
    });
    
    console.log('Basic Auth status:', res.status);
    if (!res.ok) {
        console.log('Error:', await res.text());
    } else {
        console.log('Success! Content-Type:', res.headers.get('content-type'));
    }
}
testBasicAuth();
