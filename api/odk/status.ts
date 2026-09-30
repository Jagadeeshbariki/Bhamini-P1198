
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOdkToken } from '../_lib/odk';

export const runtime = 'nodejs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Use try/catch to prevent opaque FUNCTION_INVOCATION_FAILED
  try {
    const email = (process.env.ODK_EMAIL || '').trim();
    const password = (process.env.ODK_PASSWORD || '').trim();

    if (!email || !password) {
      return res.status(500).json({
        success: false,
        authenticated: false,
        error: "ODK credentials missing in Vercel environment variables (ODK_EMAIL or ODK_PASSWORD)"
      });
    }

    // Attempt authentication via shared helper
    try {
      await getOdkToken();
      
      return res.status(200).json({
        success: true,
        authenticated: true,
        odk: "https://central.wassan.org",
        project_id: process.env.ODK_PROJECT_ID || '3 (default)'
      });
    } catch (authErr: any) {
      console.error("[ODK STATUS] Auth Error:", authErr.message);
      return res.status(500).json({
        success: false,
        authenticated: false,
        error: "ODK authentication failed",
        details: authErr.message
      });
    }
  } catch (fatalErr: any) {
    console.error("[ODK STATUS] Fatal Error:", fatalErr);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error in status handler",
      message: fatalErr.message
    });
  }
}
