import express from "express";
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
  
  console.log(`[SERVER] Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[SERVER] ODK Config: Email=${odkEmail ? 'SET' : 'MISSING'}, Pass=${odkPassword ? 'SET' : 'MISSING'}`);
  
  if (!odkEmail || !odkPassword) {
    console.warn('[SERVER] CRITICAL: ODK_EMAIL or ODK_PASSWORD environment variables are missing! Proxy will fail.');
  }

  // ODK Image Proxy
  let odkSessionToken: string | null = null;
  let tokenExpiresAt: number = 0;
  let resolvedProjectId: string | null = null;

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
        const status = res.status;
        
        let message = `ODK Auth Failed (${status})`;
        if (status === 401) {
          message = "Invalid ODK Central credentials. Please check your ODK_EMAIL and ODK_PASSWORD.";
        } else if (status === 403) {
          message = "Access forbidden. Your ODK user might not have sufficient permissions.";
        }
        
        const err = new Error(message) as any;
        err.status = status;
        err.details = errorText;
        throw err;
      }

      const data: any = await res.json();
      odkSessionToken = data.token;
      tokenExpiresAt = new Date(data.expiresAt).getTime();
      return odkSessionToken;
    } catch (e: any) {
      console.error('[ODK AUTH] Error:', e.message);
      throw e;
    }
  }

  async function getProjectId() {
    if (process.env.ODK_PROJECT_ID) return process.env.ODK_PROJECT_ID;
    if (resolvedProjectId) return resolvedProjectId;

    try {
      const token = await getOdkToken();
      const res = await fetch('https://central.wassan.org/v1/projects', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Failed to list projects: ${res.status}`);
      const projects = await res.json();
      
      if (Array.isArray(projects) && projects.length > 0) {
        console.log(`[ODK CONFIG] Found ${projects.length} projects. Probing for correct project...`);
        
        // Try to find the project that actually contains our target forms
        for (const p of projects) {
          try {
            const pid = String(p.id);
            const formsRes = await fetch(`https://central.wassan.org/v1/projects/${pid}/forms`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (formsRes.ok) {
              const forms = await formsRes.json();
              const hasTargetForm = forms.some((f: any) => 
                f.xmlFormId === 'Capacity_building' || 
                f.xmlFormId === 'Material_distribution' ||
                f.name.toLowerCase().includes('capacity building') ||
                f.name.toLowerCase().includes('activities')
              );
              if (hasTargetForm) {
                resolvedProjectId = pid;
                console.log(`[ODK CONFIG] Auto-resolved Project ID to: ${resolvedProjectId} (Target forms found)`);
                return resolvedProjectId;
              }
            }
          } catch (e) {
            continue;
          }
        }

        // If no match found via probing, find project with id '3' if it exists, otherwise use the first one
        const project3 = projects.find(p => String(p.id) === '3');
        resolvedProjectId = project3 ? '3' : String(projects[0].id);
        console.log(`[ODK CONFIG] No form match, defaulting to Project: ${resolvedProjectId}`);
        return resolvedProjectId;
      }
      
      resolvedProjectId = '3'; // Last resort fallback
      return resolvedProjectId;
    } catch (e) {
      console.warn('[ODK CONFIG] Project resolution failed, defaulting to 3:', e);
      return '3';
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
      const projectId = await getProjectId();
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
      const projectId = await getProjectId();
      const url = `https://central.wassan.org/v1/projects/${projectId}/forms/${encodeURIComponent(formId as string)}/submissions`;
      
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
      const status = error.status || 500;
      res.status(status).json({ 
        error: error.message || 'Internal Proxy Error', 
        details: error.details || error.message,
        source: 'ODK_SUBMISSIONS'
      });
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
       const projectId = await getProjectId();
       
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
       const status = e.status || 500;
       res.status(status).json({ 
         error: e.message || "Error fetching ODK dashboard data", 
         details: e.details || e.message,
         source: 'ODK_DASHBOARD'
       });
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
      // Use query param if provided, otherwise resolve
      const projectId = queryProjectId || await getProjectId();
      
      // Default to OData Submissions if not specified otherwise
      const url = `https://central.wassan.org/v1/projects/${projectId}/forms/${encodeURIComponent(formId as string)}.svc/Submissions`;
      
      console.log(`[ODK DATA] Resolved Project: ${projectId}, Form: ${formId}`);
      console.log(`[ODK DATA] URL: ${url}`);
      res.setHeader('X-ODK-Target-URL', url);
      
      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });

      const text = await response.text();
      console.log(`[ODK DATA] Status: ${response.status}`);
      
      if (!response.ok) {
        console.error(`[ODK DATA] Error Body: ${text.substring(0, 500)}`);
        return res.status(response.status).json({ 
          error: `ODK Central Error (${response.status})`, 
          details: text.substring(0, 1000),
          url: url // Helping debug which URL failed
        });
      }

      try {
        const data = JSON.parse(text);
        res.json(data);
      } catch (e: any) {
        console.error(`[ODK DATA] JSON Parse Error: ${e.message}`);
        console.error(`[ODK DATA] Raw Response Start: ${text.substring(0, 200)}`);
        
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
            return res.status(500).json({ 
              error: 'ODK Central returned HTML instead of JSON. Check your permissions.', 
              details: 'The account might not have Project Viewer permissions for this project.',
              htmlSnippet: text.substring(0, 500)
            });
        }
        
        res.status(500).json({ 
          error: 'Failed to parse ODK response as JSON',
          details: e.message,
          rawResponse: text.substring(0, 500)
        });
      }
    } catch (error: any) {
      const status = error.status || 500;
      res.status(status).json({ 
        error: error.message || 'Internal Proxy Error', 
        details: error.details || error.message,
        source: 'ODK_DATA'
      });
    }
  });

  app.get("/api/odk/odata", async (req, res) => {
    const { formId, query } = req.query;
    
    if (!formId || typeof formId !== 'string') {
      return res.status(400).json({ error: 'Missing formId parameter' });
    }

    try {
      const token = await getOdkToken();
      // Use query param if provided, otherwise resolve
      const projectId = (req.query.projectId as string) || await getProjectId();
      
      // ODK Central OData normally exposes root submissions through {formId}.svc/Submissions
      const baseUrl = `https://central.wassan.org/v1/projects/${projectId}/forms/${encodeURIComponent(formId as string)}.svc`;
      const url = `${baseUrl}/Submissions${query ? `?${query}` : ''}`;
      
      console.log(`[ODK ODATA] Resolved Project: ${projectId}, Form: ${formId}`);
      console.log(`[ODK ODATA] URL: ${url}`);

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
      const status = error.status || 500;
      res.status(status).json({ 
        error: error.message || 'Internal Proxy Error', 
        details: error.details || error.message,
        source: 'ODK_ODATA'
      });
    }
  });

  app.get("/api/odk-status", async (req, res) => {
    const email = (process.env.ODK_EMAIL || '').trim();
    const password = (process.env.ODK_PASSWORD || '').trim();
    const projectId = await getProjectId();
    
    res.json({
      status: "online",
      email_configured: !!email,
      password_configured: !!password,
      odk_configured: !!(email && password),
      project_id: projectId,
      env_project_id: process.env.ODK_PROJECT_ID || "Not Set",
      google_configured: false, 
      env: process.env.NODE_ENV || "development",
      is_vercel: !!process.env.VERCEL,
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/odk/debug", async (req, res) => {
    try {
      const email = (process.env.ODK_EMAIL || '').trim();
      const hasEmail = !!email;
      const hasPass = !!(process.env.ODK_PASSWORD || '').trim();
      const projectId = await getProjectId();
      
      if (!hasEmail || !hasPass) {
        return res.json({ 
          status: 'error', 
          message: 'Missing ODK credentials in environment',
          env: { hasEmail, hasPass, projectId: process.env.ODK_PROJECT_ID } 
        });
      }

      const token = await getOdkToken();
      
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
    console.log("[SERVER] Initializing Vite...");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("[SERVER] Vite initialized");
    } catch (e: any) {
      console.error("[SERVER] Failed to initialize Vite:", e.message);
      // In production environment where devDeps might be missing but NODE_ENV is not set
      console.warn("[SERVER] Falling back to static mode despite non-production NODE_ENV");
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  } else {
    console.log("[SERVER] Production mode: Serving static files from /dist");
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
