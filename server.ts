import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

export async function createApp() {
  const app = express();

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ODK Image Proxy
  let odkSessionToken: string | null = null;
  let tokenExpiresAt: number = 0;

  async function getOdkToken() {
    const email = (process.env.ODK_EMAIL || '').trim();
    const password = (process.env.ODK_PASSWORD || '').trim();

    if (!email || !password) {
      throw new Error('ODK credentials not configured (ODK_EMAIL/ODK_PASSWORD missing)');
    }

    if (odkSessionToken && Date.now() < tokenExpiresAt - 300000) {
      return odkSessionToken;
    }

    try {
      const res = await fetch('https://central.wassan.org/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`ODK Auth Failed (${res.status}): ${errorText}`);
      }

      const data: any = await res.json();
      odkSessionToken = data.token;
      tokenExpiresAt = new Date(data.expiresAt).getTime();
      return odkSessionToken;
    } catch (e: any) {
      console.error('ODK Token Exception:', e.message);
      throw e;
    }
  }

  app.get("/api/odk/image", async (req, res) => {
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

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        console.error(`ODK Fetch Failed: ${response.status} for ${url}`);
        return res.status(response.status).json({ error: 'Failed to fetch image from ODK', status: response.status });
      }

      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } catch (error: any) {
      if (error.message === '401') {
         return res.status(401).send('ODK Authentication Failed');
      }
      console.error('ODK Proxy Error:', error);
      res.status(500).send(error.message || 'Internal Server Error');
    }
  });

  app.get("/api/odk/submissions", async (req, res) => {
    const { formId } = req.query;
    if (!formId || typeof formId !== 'string') {
      return res.status(400).json({ error: 'Missing formId parameter' });
    }

    try {
      const token = await getOdkToken();
      const projectId = process.env.ODK_PROJECT_ID || '3';
      const url = `https://central.wassan.org/v1/projects/${projectId}/forms/${encodeURIComponent(formId)}/submissions`;
      
      console.log(`[ODK PROXY] Fetching Standard Submissions: ${url}`);

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: 'ODK Submissions API Failed', details: text });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Proxy Error', details: error.message });
    }
  });

  let dashboardCache: any = null;
  let dashboardCacheTime = 0;

  app.get("/api/odk/dashboard", async (req, res) => {
    if (dashboardCache && Date.now() - dashboardCacheTime < 300000) {
       return res.json(dashboardCache);
    }

    try {
       const token = await getOdkToken();
       const projectId = process.env.ODK_PROJECT_ID || '3';
       
       const formRes = await fetch(`https://central.wassan.org/v1/projects/${projectId}/forms`, {
         headers: { 'Authorization': `Bearer ${token}` }
       });
       const forms = await formRes.json();

       const appUsersRes = await fetch(`https://central.wassan.org/v1/projects/${projectId}/app-users`, {
         headers: { 'Authorization': `Bearer ${token}` }
       });
       const appUsers = await appUsersRes.json();
       const usersMap: Record<string, string> = {};
       appUsers.forEach((u: any) => usersMap[u.id] = u.displayName);

       const submissionsData = await Promise.all(forms.map(async (form: any) => {
           const subRes = await fetch(`https://central.wassan.org/v1/projects/${projectId}/forms/${encodeURIComponent(form.xmlFormId)}/submissions`, {
             headers: { 'Authorization': `Bearer ${token}` }
           });
           const subs = await subRes.json();
           return { formId: form.xmlFormId, formName: form.name, submissions: subs };
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

       res.json(dashboardCache);
    } catch(e: any) {
       console.error("Error fetching ODK dashboard:", e);
       res.status(500).json({ error: "Error fetching ODK dashboard data", details: e.message });
    }
  });

  app.get("/api/sheet-proxy", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).send('Missing url');
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).send(`Upstream returned ${response.status}: ${errorText}`);
      }
      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      const text = await response.text();
      res.send(text);
    } catch (error: any) {
      res.status(500).send(`Proxy Error: ${error.message}`);
    }
  });

  app.get("/api/odk/odata", async (req, res) => {
    const { formId } = req.query;
    
    if (!formId || typeof formId !== 'string') {
      return res.status(400).json({ error: 'Missing formId parameter' });
    }

    try {
      const token = await getOdkToken();
      const projectId = process.env.ODK_PROJECT_ID || '3';
      const url = `https://central.wassan.org/v1/projects/${projectId}/forms/${encodeURIComponent(formId)}.svc/Submissions`;
      
      console.log(`[ODK PROXY] Project: ${projectId}, Form: ${formId}, Calling: ${url}`);

      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      if (!response.ok) {
        return res.status(response.status).json({ 
          error: `ODK Central Error (${response.status})`, 
          details: text.substring(0, 500)
        });
      }

      if (contentType.includes('text/html') || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        return res.status(500).json({
          error: 'ODK Central returned an HTML page instead of data.',
          details: 'This usually means the Form ID is incorrect or OData is not enabled for this form.',
          formId: formId
        });
      }

      try {
        const data = JSON.parse(text);
        res.json(data);
      } catch (parseError) {
        res.status(500).json({ error: 'Invalid JSON from ODK', details: text.substring(0, 200) });
      }
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Proxy Error', details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

// Start server if this file is run directly
if (process.argv[1]?.includes('server.ts') || process.argv[1]?.includes('server.cjs')) {
  createApp().then(app => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}
