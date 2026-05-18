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
      throw new Error(`Authentication failed: ${res.status}`);
    }

    const data: any = await res.json();
    odkSessionToken = data.token;
    tokenExpiresAt = new Date(data.expiresAt).getTime();
    return odkSessionToken;
  }

  app.get("/api/odk/image", async (req, res) => {
    const { submissionId, filename } = req.query;
    
    if (!submissionId || !filename || typeof submissionId !== 'string' || typeof filename !== 'string') {
      return res.status(400).send('Missing or invalid params');
    }

    // Clean submissionId if it has uuid: prefix
    const cleanSubmissionId = submissionId.startsWith('uuid:') ? submissionId.substring(5) : submissionId;

    try {
      const token = await getOdkToken();
      const url = `https://central.wassan.org/v1/projects/3/forms/Material_distribution/submissions/${cleanSubmissionId}/attachments/${filename}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        console.error(`ODK Fetch Failed: ${response.status} for ${url}`);
        return res.status(response.status).send('Failed to fetch image from ODK');
      }

      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } catch (error: any) {
      console.error('ODK Proxy Error:', error);
      res.status(500).send(error.message || 'Internal Server Error');
    }
  });

  // Generic Proxy Route (for Sheets CSVs, etc.)
  app.get("/api/sheet-proxy", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      console.error('Proxy Error: Missing or invalid url parameter');
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    console.log(`[Proxy] Fetching: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Proxy] Upstream error (${response.status}) for ${url}: ${errorText.substring(0, 100)}`);
        return res.status(response.status).json({ 
          error: `Upstream error ${response.status}`,
          details: errorText.substring(0, 500)
        });
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      } else {
        res.setHeader('Content-Type', 'text/plain');
      }
      
      // Handle different response types
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        res.json(data);
      } else {
        const text = await response.text();
        res.send(text);
      }
    } catch (error: any) {
      console.error(`[Proxy] Exception for ${url}:`, error.message);
      res.status(500).json({ error: 'Proxy Exception', message: error.message });
    }
  });

  // Google Drive Image Proxy
  app.get("/api/drive-proxy", async (req, res) => {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).send('Missing file id');
    }

    // Try thumbnail endpoint first as it is generally more reliable and faster
    const url = `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        // Fallback to uc endpoint if thumbnail fails
        const ucUrl = `https://docs.google.com/uc?export=view&id=${id}`;
        const ucResponse = await fetch(ucUrl);
        if (!ucResponse.ok) {
          return res.status(ucResponse.status).send('Failed to fetch from Drive');
        }
        const contentType = ucResponse.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        const arrayBuffer = await ucResponse.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      }

      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24h

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      console.error('Drive Proxy Error:', error);
      res.status(500).send(error.message);
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
