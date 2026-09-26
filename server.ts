import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ODK Image Proxy
  let odkSessionToken: string | null = null;
  let tokenExpiresAt: number = 0;

  async function getOdkToken() {
    const email = process.env.ODK_EMAIL?.trim();
    const password = process.env.ODK_PASSWORD?.trim();

    if (!email || !password) {
      throw new Error('ODK credentials not configured');
    }

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

    const data: any = await res.json();
    odkSessionToken = data.token;
    tokenExpiresAt = new Date(data.expiresAt).getTime();
    return odkSessionToken;
  }

  app.get("/api/odk/image", async (req, res) => {
    const { submissionId, filename, form } = req.query;
    
    if (!submissionId || !filename || typeof submissionId !== 'string' || typeof filename !== 'string') {
      return res.status(400).send('Missing or invalid params');
    }

    // Ensure submissionId has uuid: prefix
    const fullSubmissionId = submissionId.startsWith('uuid:') ? submissionId : `uuid:${submissionId}`;
    const formId = form && typeof form === 'string' ? form : 'Material_distribution';

    try {
      const token = await getOdkToken();
      // ODK central API correctly handles URL encoded forms if the path segment is suitably encoded.
      // E.g., encodeURIComponent('NF- Activities') -> 'NF-%20Activities'
      const url = `https://central.wassan.org/v1/projects/3/forms/${encodeURIComponent(formId)}/submissions/${encodeURIComponent(fullSubmissionId)}/attachments/${encodeURIComponent(filename)}`;

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

  
  let dashboardCache = null;
  let dashboardCacheTime = 0;

  app.get("/api/odk/dashboard", async (req, res) => {
    if (dashboardCache && Date.now() - dashboardCacheTime < 300000) {
       return res.json(dashboardCache);
    }

    try {
       const token = await getOdkToken();
       
       const formRes = await fetch('https://central.wassan.org/v1/projects/3/forms', {
         headers: { 'Authorization': `Bearer ${token}` }
       });
       const forms = await formRes.json();

       const appUsersRes = await fetch('https://central.wassan.org/v1/projects/3/app-users', {
         headers: { 'Authorization': `Bearer ${token}` }
       });
       const appUsers = await appUsersRes.json();
       const usersMap = {};
       appUsers.forEach(u => usersMap[u.id] = u.displayName);

       const submissionsData = await Promise.all(forms.map(async (form) => {
           const subRes = await fetch(`https://central.wassan.org/v1/projects/3/forms/${encodeURIComponent(form.xmlFormId)}/submissions`, {
             headers: { 'Authorization': `Bearer ${token}` }
           });
           const subs = await subRes.json();
           return { formId: form.xmlFormId, formName: form.name, submissions: subs };
       }));

       const rawSubmissions = [];
       const formsList = [];

       submissionsData.forEach(formItem => {
           const formSubs = Array.isArray(formItem.submissions) ? formItem.submissions : [];
           formsList.push({ id: formItem.formId, name: formItem.formName });
           
           formSubs.forEach(sub => {
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

  // Generic Proxy Route (for Sheets CSVs, etc.)
  app.get("/api/sheet-proxy", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      console.error('Proxy Error: Missing or invalid url parameter');
      return res.status(400).send('Missing url');
    }

    console.log(`Proxying request to: ${url}`);

    try {
      // Ensure we have a fetch function (Node 18+ has it globally)
      if (typeof fetch === 'undefined') {
        throw new Error('Global fetch is not available in this Node version');
      }

      const response = await fetch(url);
      console.log(`Upstream response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Upstream error (${response.status}): ${errorText.substring(0, 200)}`);
        return res.status(response.status).send(`Upstream returned ${response.status}: ${errorText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      
      const text = await response.text();
      res.send(text);
    } catch (error: any) {
      console.error(`Proxy Exception for ${url}:`, error.message);
      res.status(500).send(`Proxy Error: ${error.message}`);
    }
  });

  app.get("/api/odk/odata", async (req, res) => {
    const { formId, query } = req.query;
    
    if (!formId || typeof formId !== 'string') {
      return res.status(400).send('Missing formId');
    }

    try {
      const token = await getOdkToken();
      let url = `https://central.wassan.org/v1/projects/3/forms/${encodeURIComponent(formId)}.svc/Submissions`;
      
      if (query && typeof query === 'string') {
        url += `?${query}`;
      }

      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`ODK OData Fetch Failed: ${response.status} for ${url}`);
        return res.status(response.status).json({ error: 'Failed to fetch OData from ODK', status: response.status });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('ODK OData Proxy Error:', error);
      res.status(500).send(error.message || 'Internal Server Error');
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
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
