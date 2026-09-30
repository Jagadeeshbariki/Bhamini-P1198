
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
    const projectId = (req.query.projectId as string) || process.env.ODK_PROJECT_ID || '3';
    const formId = req.query.formId as string;
    const limit = req.query.limit as string;

    if (!formId) return res.status(400).json({ error: 'Missing formId' });

    console.log(`[ODK DATA] Request for Project: ${projectId}, Form: ${formId}, Limit: ${limit || 'None'}`);

    const token = await getOdkToken();
    // OData Submissions URL
    const baseUrl = `https://central.wassan.org/v1/projects/${projectId}/forms/${encodeURIComponent(formId)}.svc`;
    let url = `${baseUrl}/Submissions`;
    
    const params = new URLSearchParams();
    if (limit) params.append('$top', limit);
    params.append('$count', 'true');
    url += `?${params.toString()}`;

    console.log(`[ODK DATA] Fetching: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s for data

    try {
      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Accept': 'application/json',
          'User-Agent': 'Bhamini-P1198/1.0'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const text = await response.text();

      console.log(`[ODK DATA] Status: ${response.status}, Length: ${text.length}`);

      if (!response.ok) {
        return res.status(response.status).json({ 
          error: "ODK request failed", 
          odkStatus: response.status,
          details: text.substring(0, 500) 
        });
      }

      const data = JSON.parse(text);
      return res.json(data);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("[ODK DATA] Fetch Error:", err.message);
      throw err;
    }
  } catch (fatalErr: any) {
    console.error("[ODK DATA] Fatal Error:", fatalErr.message);
    res.status(500).json({ error: "ODK data API failed", message: fatalErr.message });
  }
}
