import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

export async function createApp() {
  const app = express();

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Check credentials early
  const odkEmail = (process.env.ODK_EMAIL || '').trim();
  const odkPassword = (process.env.ODK_PASSWORD || '').trim();
  if (!odkEmail || !odkPassword) {
    console.warn('[SERVER] ODK_EMAIL or ODK_PASSWORD environment variables are missing!');
  }

  // ODK Image Proxy
  let odkSessionToken: string | null = null;
  let tokenExpiresAt: number = 0;

  async function getOdkToken() {
    const email = (process.env.ODK_EMAIL || '').trim();
    const password = (process.env.ODK_PASSWORD || '').trim();

    if (!email || !password) {
      throw new Error('ODK credentials not configured (ODK_EMAIL/ODK_PASSWORD missing)');
    }

    console.log(`[ODK AUTH] Attempting login for: ${email.substring(0, 3)}...${email.split('@')[1] || ''}`);

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

  app.get("/api/odk/data", async (req, res) => {
    const { projectId: queryProjectId, formId } = req.query;
    
    if (!formId || typeof formId !== 'string') {
      return res.status(400).json({ error: 'Missing formId parameter' });
    }

    try {
      const token = await getOdkToken();
      const projectId = queryProjectId || process.env.ODK_PROJECT_ID || '3';
      
      // Default to OData Submissions if not specified otherwise
      const url = `https://central.wassan.org/v1/projects/${projectId}/forms/${encodeURIComponent(formId)}.svc/Submissions`;
      
      console.log(`[ODK DATA] Attempting: ${url}`);
      res.setHeader('X-ODK-Target-URL', url);
      
      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });

      const text = await response.text();
      
      if (!response.ok) {
        return res.status(response.status).json({ 
          error: `ODK Central Error (${response.status})`, 
          details: text.substring(0, 1000)
        });
      }

      try {
        const data = JSON.parse(text);
        res.json(data);
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse ODK response as JSON' });
      }
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Proxy Error', details: error.message });
    }
  });

  app.get("/api/odk/odata", async (req, res) => {
    const { formId, query } = req.query;
    
    if (!formId || typeof formId !== 'string') {
      return res.status(400).json({ error: 'Missing formId parameter' });
    }

    try {
      const token = await getOdkToken();
      const projectId = (req.query.projectId as string) || process.env.ODK_PROJECT_ID || '3';
      
      // ODK Central OData normally exposes root submissions through {formId}.svc/Submissions
      const baseUrl = `https://central.wassan.org/v1/projects/${projectId}/forms/${encodeURIComponent(formId)}.svc`;
      const url = `${baseUrl}/Submissions${query ? `?${query}` : ''}`;
      
      console.log(`[ODK PROXY] Project: ${projectId}, Form: ${formId}`);
      console.log(`[ODK PROXY] Attempting OData URL: ${url}`);

      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });

      const contentType = response.headers.get('content-type') || '';
      const status = response.status;
      const text = await response.text();

      console.log(`[ODK PROXY] Status: ${status}`);
      console.log(`[ODK PROXY] Content-Type: ${contentType}`);
      
      if (!response.ok) {
        console.error(`[ODK PROXY] Fetch failed with status ${status}`);
        console.error(`[ODK PROXY] Error Body: ${text.substring(0, 1000)}`);
        
        // If 404, maybe "Submissions" is not the right EntitySet?
        if (status === 404) {
          return res.status(404).json({
            error: `OData endpoint not found (404).`,
            details: `The URL '${url}' returned a 404. This might mean the Form ID '${formId}' is incorrect or the OData service does not have a 'Submissions' entity set.`,
            odkResponse: text.substring(0, 500),
            suggestedUrl: baseUrl
          });
        }

        return res.status(status).json({ 
          error: `ODK Central Error (${status})`, 
          details: text.substring(0, 1000),
          url: url
        });
      }

      if (!contentType || !contentType.includes('application/json')) {
        console.error(`[ODK PROXY] Response is not JSON. Content-Type: ${contentType}`);
        
        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
          return res.status(500).json({
            error: 'ODK Central returned an HTML page instead of JSON data.',
            details: 'This usually happens if there is a redirection, a login requirement, or a server-side error that returned an HTML page.',
            htmlSnippet: text.substring(0, 500)
          });
        }

        return res.status(500).json({
          error: `ODK response is not JSON. Content-Type: ${contentType}`,
          details: text.substring(0, 500)
        });
      }

      try {
        const data = JSON.parse(text);
        res.json(data);
      } catch (parseError: any) {
        console.error(`[ODK PROXY] JSON Parse Error: ${parseError.message}`);
        res.status(500).json({ 
          error: 'Failed to parse ODK response as JSON', 
          details: text.substring(0, 1000),
          parseErrorMessage: parseError.message
        });
      }
    } catch (error: any) {
      console.error('[ODK PROXY] Exception:', error.message);
      res.status(500).json({ error: 'Internal Proxy Error', details: error.message });
    }
  });

  app.get("/api/odk/debug", async (req, res) => {
    try {
      const email = (process.env.ODK_EMAIL || '').trim();
      const hasEmail = !!email;
      const hasPass = !!(process.env.ODK_PASSWORD || '').trim();
      
      if (!hasEmail || !hasPass) {
        return res.json({ 
          status: 'error', 
          message: 'Missing ODK credentials in environment',
          env: { hasEmail, hasPass, projectId: process.env.ODK_PROJECT_ID } 
        });
      }

      const token = await getOdkToken();
      const projectId = process.env.ODK_PROJECT_ID || '3';
      
      const projectsRes = await fetch(`https://central.wassan.org/v1/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const projects = await projectsRes.json();
      
      res.json({
        status: 'ok',
        message: 'Successfully connected to ODK Central',
        projectId,
        availableProjects: Array.isArray(projects) ? projects.map((p: any) => ({ id: p.id, name: p.name })) : 'failed to list',
        auth: 'verified'
      });
    } catch (error: any) {
      res.status(500).json({ 
        status: 'error', 
        message: error.message,
        details: 'Failed to verify ODK connectivity'
      });
    }
  });

  // API 404 Handler (prevent falling through to HTML)
  app.all(/^\/api\/.*/, (req, res) => {
    res.status(404).json({ 
      error: "API route not found", 
      path: req.path,
      method: req.method 
    });
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

// Start server
const isDev = process.env.NODE_ENV !== "production";

createApp().then(app => {
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Ready on http://0.0.0.0:${PORT} (Mode: ${process.env.NODE_ENV || 'development'})`);
  });
}).catch(err => {
  console.error("[SERVER] Fatal Error during startup:", err);
  process.exit(1);
});
