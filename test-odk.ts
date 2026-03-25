async function testODK() {
    const email = process.env.ODK_EMAIL;
    const password = process.env.ODK_PASSWORD;
    
    console.log('Email set:', !!email);
    console.log('Password set:', !!password);

    // Try to get a session token
    const res = await fetch('https://central.wassan.org/v1/sessions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    });
    
    console.log('Session status:', res.status);
    if (!res.ok) {
        console.log('Session error:', await res.text());
        return;
    }
    
    const data = await res.json();
    console.log('Got token:', !!data.token);
    
    // Try to fetch image with token
    const imgUrl = 'https://central.wassan.org/v1/projects/3/forms/Material_distribution/submissions/uuid:34ba25c8-9cc3-4f65-accc-57530a7dd7d0/attachments/1772579126307.jpg';
    const imgRes = await fetch(imgUrl, {
        headers: {
            'Authorization': `Bearer ${data.token}`
        }
    });
    
    console.log('Image fetch status:', imgRes.status);
}

testODK();
