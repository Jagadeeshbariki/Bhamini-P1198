
async function getOdkToken() {
  const email = (process.env.ODK_EMAIL || '').trim();
  const password = (process.env.ODK_PASSWORD || '').trim();
  if (!email || !password) throw new Error('ODK credentials not configured');
  
  const res = await fetch('https://central.wassan.org/v1/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data: any = await res.json();
  return data.token;
}

async function inspect() {
  try {
    const token = await getOdkToken();
    const projectId = 3;
    const formId = 'Group Formation';
    const baseUrl = `https://central.wassan.org/v1/projects/${projectId}/forms/${encodeURIComponent(formId)}.svc`;

    console.log('--- Service Document ---');
    const serviceRes = await fetch(baseUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    const serviceDoc = await serviceRes.json();
    console.log(JSON.stringify(serviceDoc, null, 2));

    console.log('\n--- Metadata (First 2000 chars) ---');
    const metaRes = await fetch(`${baseUrl}/$metadata`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const metaText = await metaRes.text();
    console.log(metaText.substring(0, 2000));
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

inspect();
