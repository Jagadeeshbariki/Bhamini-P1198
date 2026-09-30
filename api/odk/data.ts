
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { odkFetch } from '../_lib/odk';

export const runtime = 'nodejs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const projectId = (req.query.projectId as string) || process.env.ODK_PROJECT_ID || '3';
    const formId = req.query.formId as string;
    const limit = req.query.limit as string;

    if (!formId) {
      return res.status(400).json({ error: 'Missing formId parameter' });
    }

    // Construct ODK OData URL
    // Pattern: projects/{id}/forms/{xmlFormId}.svc/Submissions
    const baseUrl = `https://central.wassan.org/v1/projects/${projectId}/forms/${encodeURIComponent(formId)}.svc`;
    let url = `${baseUrl}/Submissions`;

    // Handle OData query parameters
    const params = new URLSearchParams();
    if (limit) {
      params.append('$top', limit);
    }
    params.append('$count', 'true');
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    console.log(`[ODK DATA] Fetching: ${url}`);

    try {
      const data = await odkFetch(url);
      
      // The frontend expects { value: [...] }
      // If odkFetch already parsed it (and it's an array), wrap it if needed
      // but OData /Submissions usually returns { value: [...] } already
      
      if (Array.isArray(data)) {
        return res.json({ value: data });
      }
      
      return res.json(data);
    } catch (err: any) {
      console.error("[ODK DATA] Request failed:", err.message);
      return res.status(err.status || 500).json({
        error: "ODK request failed",
        odkStatus: err.status,
        odkStatusText: err.statusText,
        details: err.details || err.message
      });
    }
  } catch (fatalErr: any) {
    console.error("[ODK DATA] Fatal Error:", fatalErr);
    return res.status(500).json({
      error: "ODK data API failed",
      message: fatalErr.message
    });
  }
}
