import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOdkToken } from '../_lib/odk';

export const runtime = 'nodejs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { submissionId, filename, form } = req.query;
    
    if (!submissionId || !filename || typeof submissionId !== 'string' || typeof filename !== 'string') {
        return res.status(400).send('Missing or invalid params');
    }

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
