
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

let odkSessionToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getOdkToken() {
  const email = (process.env.ODK_EMAIL || '').trim();
  const password = (process.env.ODK_PASSWORD || '').trim();
  if (!email || !password) throw new Error('ODK credentials not configured');
  if (odkSessionToken && Date.now() < tokenExpiresAt - 300000) return odkSessionToken;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch('https://central.wassan.org/v1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
    const data: any = await res.json();
    odkSessionToken = data.token;
    tokenExpiresAt = new Date(data.expiresAt).getTime();
    return odkSessionToken;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const email = (process.env.ODK_EMAIL || '').trim();
    if (!email) return res.status(200).json({ success: false, error: "ODK_EMAIL missing" });

    const token = await getOdkToken();
    const projectId = process.env.ODK_PROJECT_ID || '3';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const projectRes = await fetch(`https://central.wassan.org/v1/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!projectRes.ok) throw new Error(`Project fetch failed: ${projectRes.status}`);
      const projectData = await projectRes.json();

      return res.status(200).json({
        success: true,
        authenticated: true,
        project: projectData.name,
        projectId: projectData.id
      });
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: "ODK Auth Failed", details: err.message });
  }
}
