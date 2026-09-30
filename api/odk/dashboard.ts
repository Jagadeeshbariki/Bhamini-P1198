
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

/**
 * SELF-CONTAINED ODK CORE LOGIC
 * Avoids relative import issues on Vercel
 */

let odkSessionToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getOdkToken() {
  const email = (process.env.ODK_EMAIL || '').trim();
  const password = (process.env.ODK_PASSWORD || '').trim();

  if (!email || !password) {
    throw new Error('ODK credentials not configured (ODK_EMAIL or ODK_PASSWORD missing)');
  }

  if (odkSessionToken && Date.now() < tokenExpiresAt - 300000) {
    return odkSessionToken;
  }

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

async function odkFetch(url: string) {
  const token = await getOdkToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

let dashboardCache: any = null;
let dashboardCacheTime: number = 0;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (dashboardCache && Date.now() - dashboardCacheTime < 300000) {
       return res.json(dashboardCache);
    }

    try {
       const projectId = process.env.ODK_PROJECT_ID || '3';
       
       // 1. Fetch Forms
       const forms = await odkFetch(`https://central.wassan.org/v1/projects/${projectId}/forms`);

       // 2. Fetch App Users
       const appUsers = await odkFetch(`https://central.wassan.org/v1/projects/${projectId}/app-users`);
       
       const usersMap: Record<string, string> = {};
       if (Array.isArray(appUsers)) {
         appUsers.forEach((u: any) => usersMap[u.id] = u.displayName);
       }

       // 3. Fetch Submissions for all forms
       const submissionsData = await Promise.all(forms.map(async (form: any) => {
           try {
             const subs = await odkFetch(`https://central.wassan.org/v1/projects/${projectId}/forms/${encodeURIComponent(form.xmlFormId)}/submissions`);
             return { formId: form.xmlFormId, formName: form.name, submissions: subs };
           } catch (err) {
             console.error(`Failed to fetch submissions for form ${form.xmlFormId}:`, err);
             return { formId: form.xmlFormId, formName: form.name, submissions: [] };
           }
       }));

       const rawSubmissions: any[] = [];
       const formsList: any[] = [];

       submissionsData.forEach(formItem => {
           const formSubs = Array.isArray(formItem.submissions) ? formItem.submissions : [];
           formsList.push({ id: formItem.formId, name: formItem.formName });
           
           formSubs.forEach((sub: any) => {
               rawSubmissions.push({
                   formId: formItem.formId,
                   userId: sub.submitterId,
                   date: sub.createdAt
               });
           });
       });

       const usersList = Object.keys(usersMap).map(id => ({ id: Number(id), name: usersMap[id] }));

       dashboardCache = {
           rawSubmissions,
           forms: formsList,
           users: usersList
       };
       dashboardCacheTime = Date.now();

       res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
       res.json(dashboardCache);
    } catch(e: any) {
       console.error("Error fetching ODK dashboard:", e);
       res.status(500).json({
         error: "Error fetching ODK dashboard data",
         message: e.message
       });
    }
}
