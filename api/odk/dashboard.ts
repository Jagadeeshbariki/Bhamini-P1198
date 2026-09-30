import type { VercelRequest, VercelResponse } from '@vercel/node';
import { odkFetch } from '../_lib/odk';

export const runtime = 'nodejs';

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

       // Cache on Edge for 5 minutes
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
