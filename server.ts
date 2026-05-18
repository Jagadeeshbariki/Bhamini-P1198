import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
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

  // API Router
  const apiRouter = express.Router();

  apiRouter.get("/health", (req, res) => {
    res.json({ 
      status: "ok", 
      mode: process.env.NODE_ENV,
      time: new Date().toISOString(),
      diagnostics: {
        cwd: process.cwd(),
        dirname: __dirname,
        nodeVersion: process.version,
        env: Object.keys(process.env).filter(k => !k.includes('KEY') && !k.includes('PASSWORD') && !k.includes('SECRET'))
      }
    });
  });

  apiRouter.get("/debug-proxy", async (req, res) => {
    const testUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2T6skNnpDlaFl8n93i0eO7zlF0bK-sdndW1-AIRRpWf-YJkYzXjiC8B1e5hFdZ2KqMsNTKN9NCmPG/pub?gid=0&single=true&output=csv";
    try {
      const response = await fetch(testUrl, { redirect: 'follow' });
      const text = await response.text();
      res.json({
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get('content-type'),
        preview: text.substring(0, 100)
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  apiRouter.get("/odk/image", async (req, res) => {
    const { submissionId, filename } = req.query;
    if (!submissionId || !filename || typeof submissionId !== 'string' || typeof filename !== 'string') {
      return res.status(400).send('Missing or invalid params');
    }
    const cleanSubmissionId = submissionId.startsWith('uuid:') ? submissionId.substring(5) : submissionId;
    try {
      const token = await getOdkToken();
      const url = `https://central.wassan.org/v1/projects/3/forms/Material_distribution/submissions/${cleanSubmissionId}/attachments/${filename}`;
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) return res.status(response.status).send('Failed to fetch image from ODK');
      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  apiRouter.get("/sheet-proxy", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing url' });
    
    try {
      console.log(`[SheetProxy] Fetching: ${url.substring(0, 100)}...`);
      const response = await fetch(url, {
        headers: {
          'Accept': 'text/csv,text/plain,application/json,*/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        redirect: 'follow',
        // Set a reasonable timeout
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) {
        console.error(`[SheetProxy] Upstream error: ${response.status} for ${url.substring(0, 50)}`);
        return res.status(response.status).json({ error: `Upstream error ${response.status}`, url: url.substring(0, 50) });
      }
      
      const contentType = (response.headers.get('content-type') || 'text/plain').toLowerCase();
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`[SheetProxy] Received ${buffer.length} bytes, type: ${contentType}`);

      // Basic sanity check: tiny responses or HTML responses for CSV requests are suspicious
      if (buffer.length < 10 && !url.includes('scripts')) {
        console.warn(`[SheetProxy] Very small response received (${buffer.length} bytes)`);
      }

      if (contentType.includes('text/html')) {
        const text = buffer.toString().toLowerCase();
        if (text.includes('google') && (text.includes('sign in') || text.includes('login') || text.includes('account'))) {
          console.error(`[SheetProxy] Access Denied: Google requested login for ${url.substring(0, 50)}`);
          return res.status(401).json({ error: 'Spreadsheet is not public. Please "Publish to Web" and set as "Anyone with link can view".' });
        }
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(buffer);
    } catch (error: any) {
      console.error(`[SheetProxy] Exception for ${url.substring(0, 50)}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  apiRouter.get("/drive-proxy", async (req, res) => {
    const { id } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).send('Missing id');
    const url = `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (!response.ok) {
        const fallback = `https://docs.google.com/uc?export=view&id=${id}`;
        const fbRes = await fetch(fallback);
        if (!fbRes.ok) return res.status(fbRes.status).send('Drive fetch failed');
        const contentType = fbRes.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        const arrayBuffer = await fbRes.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      }
      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.use("/api", apiRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("[Server] Starting in DEVELOPMENT mode with Vite middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Starting in PRODUCTION mode");
    // Since this file is bundled to dist/server.cjs, __dirname is the dist folder itself
    const distPath = __dirname;
    console.log(`[Server] Serving static assets from: ${distPath}`);
    
    app.use(express.static(distPath, { index: false }));

    // Specific route for index.html at root - with NO CACHE headers
    app.get('/', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });

    app.get('*all', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
