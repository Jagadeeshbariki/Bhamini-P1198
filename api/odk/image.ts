import type { VercelRequest, VercelResponse } from '@vercel/node';

let odkSessionToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getOdkToken() {
    const email = process.env.ODK_EMAIL?.trim();
    const password = process.env.ODK_PASSWORD?.trim();

    if (!email || !password) {
        throw new Error('ODK credentials not configured in Vercel Environment Variables');
    }

    // Check if we have a valid cached token (with 5 min buffer)
    if (odkSessionToken && Date.now() < tokenExpiresAt - 300000) {
        return odkSessionToken;
    }

    const res = await fetch('https://central.wassan.org/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
        throw new Error(`401`);
    }

    const data = await res.json();
    odkSessionToken = data.token;
    tokenExpiresAt = new Date(data.expiresAt).getTime();
    return odkSessionToken;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { submissionId, filename, form } = req.query;
    
    if (!submissionId || !filename || typeof submissionId !== 'string' || typeof filename !== 'string') {
        return res.status(400).send('Missing or invalid params');
    }

    const fullSubmissionId = submissionId.startsWith('uuid:') ? submissionId : `uuid:${submissionId}`;
    const formId = form && typeof form === 'string' ? form : 'Material_distribution';

    try {
        const token = await getOdkToken();
        const url = `https://central.wassan.org/v1/projects/3/forms/${encodeURIComponent(formId)}/submissions/${encodeURIComponent(fullSubmissionId)}/attachments/${encodeURIComponent(filename)}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            return res.status(response.status).send('Failed to fetch image from ODK');
        }

        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);

        // Cache the image on Vercel's Edge Network for 1 day (86400 seconds) to speed up loading
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return res.send(buffer);
    } catch (error: any) {
        if (error.message === '401') {
             return res.status(401).send('ODK Authentication Failed');
        }
        return res.status(500).send(error.message || 'Internal Server Error');
    }
}
