import express from "express";
import path from "path";
import fs from "fs";

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
      throw new Error(`Authentication failed: ${res.status}`);
    }

    const data: any = await res.json();
    odkSessionToken = data.token;
    tokenExpiresAt = new Date(data.expiresAt).getTime();
    return odkSessionToken;
  }

  app.get("/api/odk/image", async (req, res) => {
    const { submissionId, filename, formId } = req.query;
    
    if (!submissionId || !filename || typeof submissionId !== 'string' || typeof filename !== 'string') {
      return res.status(400).send('Missing or invalid params');
    }

    const targetFormId = (typeof formId === 'string' && formId) ? formId : 'Material_distribution';

    // Handle path-like IDs from repeat groups (common in ODK CSV exports)
    // We preserve the 'uuid:' prefix if it exists, as ODK Central often requires it.
    const instanceId = submissionId.split('/')[0];

    try {
      const token = await getOdkToken();
      // Prioritize Project 3, then try others if needed
      const projectIds = [3, 1, 2, 4, 5];
      let successfulResponse: Response | null = null;
      let lastUrlTried = '';

      for (const projectId of projectIds) {
        const url = `https://central.wassan.org/v1/projects/${projectId}/forms/${targetFormId}/submissions/${encodeURIComponent(instanceId)}/attachments/${filename}`;
        lastUrlTried = url;
        
        try {
          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (response.ok) {
            successfulResponse = response;
            break;
          }
        } catch (err) {
          console.error(`Fetch error for project ${projectId}:`, err);
        }
      }

      if (!successfulResponse) {
        console.error(`ODK Fetch Failed: Exhausted projects for ${filename}. ID: ${instanceId}. Form: ${targetFormId}. Last URL: ${lastUrlTried}`);
        return res.status(404).send(`Photo not found in ODK Central projects.`);
      }

      const contentType = successfulResponse.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');

      const arrayBuffer = await successfulResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } catch (error: any) {
      console.error('ODK Proxy Error:', error);
      res.status(500).send(error.message || 'Internal Server Error');
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "custom", // Switch to custom to handle index.html manually if needed
    });
    app.use(vite.middlewares);

    app.get('*all', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
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
