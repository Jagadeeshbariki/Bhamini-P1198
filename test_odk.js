const email = process.env.ODK_EMAIL;
const password = process.env.ODK_PASSWORD;

async function test() {
  const res = await fetch('https://central.wassan.org/v1/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  const token = data.token;
  
  const formRes = await fetch('https://central.wassan.org/v1/projects/3/forms', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const formData = await formRes.json();
  console.log(JSON.stringify(formData.slice(0, 2), null, 2));
}
test();
