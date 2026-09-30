
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
    const { submissionId, filename, form } = req.query;
    
    if (!submissionId || !filename || typeof submissionId !== 'string' || typeof filename !== 'string') {
        return res.status(400).send('Missing or invalid params');
    }

    // Ensure UUID format
    const fullSubmissionId = submissionId.startsWith('uuid:') ? submissionId : `uuid:${submissionId}`;
    const formId = form && typeof form === 'string' ? form : 'Material_distribution';

    try {
        const token = await getOdkToken();
        const projectId = process.env.ODK_PROJECT_ID || '3';
        const url = `https://central.wassan.org/v1/projects/${projectId}/forms/${encodeURIComponent(formId)}/submissions/${encodeURIComponent(fullSubmissionId)}/attachments/${encodeURIComponent(filename)}`;

        console.log(`[ODK IMAGE] Fetching: ${url}`);

        const response = await fetch(url, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Bhamini-P1198/1.0'
            }
        });

        if (!response.ok) {
            console.error(`[ODK IMAGE] Failed to fetch image: ${response.status}`);
            return res.status(response.status).send('Failed to fetch image from ODK');
        }

        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);

        // Cache the image on Vercel's Edge Network for 1 day
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return res.send(buffer);
    } catch (error: any) {
        console.error("[ODK IMAGE] Fatal error:", error.message);
        return res.status(500).send(error.message || 'Internal Server Error');
    }
}
