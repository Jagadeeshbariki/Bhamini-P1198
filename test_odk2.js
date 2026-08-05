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
  
  // Try fetching submissions for the first form
  const subRes = await fetch(`https://central.wassan.org/v1/projects/3/forms/${encodeURIComponent(formData[0].xmlFormId)}/submissions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const submissions = await subRes.json();
  console.log('Submissions count:', submissions.length);
  console.log(JSON.stringify(submissions[0], null, 2));
}
test();
