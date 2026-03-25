async function testSessionTrim() {
    const email = process.env.ODK_EMAIL?.trim();
    const password = process.env.ODK_PASSWORD?.trim();
    
    console.log('Email:', email);
    
    const res = await fetch('https://central.wassan.org/v1/sessions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    });
    
    console.log('Session status:', res.status);
    if (!res.ok) {
        console.log('Error:', await res.text());
    } else {
        const data = await res.json();
        console.log('Success! Token:', data.token.substring(0, 10) + '...');
    }
}
testSessionTrim();
