import express from "express";
import path from "path";
import fs from "fs";
import { build } from "vite";


export async function createApp() {
  const app = express();

  // Set global JSON limit for large uploads - 20MB is safe for most Vercel functions
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ limit: '20mb', extended: true }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Check credentials early
  const odkEmail = (process.env.ODK_EMAIL || '').trim();
  const odkPassword = (process.env.ODK_PASSWORD || '').trim();
  
  // Determine if we are in production
  const isProduction = process.env.NODE_ENV === "production" || !!process.env.K_SERVICE || !!process.env.VERCEL;
  
  console.log(`[SERVER] Mode: ${isProduction ? 'production' : 'development'}`);
  console.log(`[SERVER] ODK Config: Email=${odkEmail ? 'SET' : 'MISSING'}, Pass=${odkPassword ? 'SET' : 'MISSING'}`);
  
  if (!odkEmail || !odkPassword) {
    console.warn('[SERVER] CRITICAL: ODK_EMAIL or ODK_PASSWORD environment variables are missing! Proxy will fail.');
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

    if (odkSessionToken && Date.now() < tokenExpiresAt - 300000) {
      return odkSessionToken;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for auth
      
      const res = await fetch('https://central.wassan.org/v1/sessions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'Wassan-App/1.0'
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

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
    return (process.env.ODK_PROJECT_ID || '3').trim();
  }

  app.get("/api/odk/entities", async (req, res) => {
    const { projectId: queryProjectId, datasetId } = req.query;
    
    if (!datasetId || typeof datasetId !== 'string') {
      return res.status(400).json({ error: 'Missing datasetId parameter' });
    }

    try {
      const token = await getOdkToken();
      const projectId = queryProjectId || await getProjectId();
      const odataUrl = `https://central.wassan.org/v1/projects/${projectId}/datasets/${encodeURIComponent(datasetId)}.svc/Entities`;
      const restUrl = `https://central.wassan.org/v1/projects/${projectId}/datasets/${encodeURIComponent(datasetId)}/entities`;
      
      console.log(`[ODK ENTITIES] Attempting OData: ${odataUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      try {
        let response = await fetch(odataUrl, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'User-Agent': 'Wassan-App/1.0'
          },
          signal: controller.signal
        });

        // Smart Fallback: If OData fails (404/405/501), try REST API
        if (!response.ok && [404, 405, 501].includes(response.status)) {
          console.log(`[ODK ENTITIES] OData not supported. Falling back to REST: ${restUrl}`);
          response = await fetch(restUrl, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'User-Agent': 'Wassan-App/1.0'
            },
            signal: controller.signal
          });
        }

        clearTimeout(timeoutId);
        const text = await response.text();
        
        if (!response.ok) {
          return res.status(response.status).json({ 
            error: "ODK Entities request failed",
            odkStatus: response.status,
            odkResponse: text.substring(0, 1000)
          });
        }

        res.json(JSON.parse(text));
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        throw fetchErr;
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return res.status(504).json({ error: "ODK Entities request timed out (12s)" });
      }
      res.status(500).json({ error: error.message });
    }
  });

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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      try {
        const response = await fetch(url, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'Wassan-App/1.0'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

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
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        throw fetchErr;
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return res.status(504).send('ODK Image request timed out (12s)');
      }
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      try {
        const response = await fetch(url, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'Wassan-App/1.0',
            'Accept': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const text = await response.text();
          return res.status(response.status).json({ error: 'ODK Submissions API Failed', details: text });
        }

        const data = await response.json();
        res.json(data);
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        throw fetchErr;
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return res.status(504).json({ error: 'ODK Submissions request timed out (12s)' });
      }
      const status = error.status || 500;
      res.status(status).json({ 
        error: error.message || 'Internal Proxy Error', 
        details: error.details || error.message,
        source: 'ODK_SUBMISSIONS'
      });
    }
  });

  // Group Formation Data Cache
  let groupCache: any = null;
  let groupCacheTime: number = 0;

  app.get("/api/odk/group-formation", async (req, res) => {
    // 5-minute cache
    if (groupCache && Date.now() - groupCacheTime < 300000) {
      console.log("[GROUP FORMATION] Serving from cache");
      return res.json(groupCache);
    }

    try {
      const projectId = await getProjectId();
      const formId = 'Group Formation';
      const token = await getOdkToken();
      const baseUrl = `https://central.wassan.org/v1/projects/${projectId}/forms/${encodeURIComponent(formId)}.svc`;

      console.log(`[GROUP FORMATION] Starting data refresh for form: ${formId}`);

      const fetchAllOdataSequential = async (url: string, label: string) => {
        let allData: any[] = [];
        let nextLink = url;
        let pages = 0;

        while (nextLink) {
          pages++;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);
          
          try {
            console.log(`[ODK FETCH] ${label} - Page ${pages}: ${nextLink}`);
            const resp = await fetch(nextLink, {
              headers: { 
                'Authorization': `Bearer ${token}`, 
                'Accept': 'application/json',
                'User-Agent': 'Bhamini-P1198/1.0'
              },
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!resp.ok) {
              const errText = await resp.text();
              throw new Error(`ODK ${label} fetch failed (${resp.status}): ${errText.substring(0, 200)}`);
            }
            
            const data = await resp.json();
            allData = [...allData, ...(data.value || [])];
            nextLink = data['@odata.nextLink'] || null;
            if (allData.length > 5000 || pages > 20) break; 
          } catch (err) {
            clearTimeout(timeoutId);
            throw err;
          }
        }
        return allData;
      };

      // Fetch Parent and Repeat data sequentially to avoid heavy load
      const parents = await fetchAllOdataSequential(`${baseUrl}/Submissions`, 'Parents');
      const members = await fetchAllOdataSequential(`${baseUrl}/Submissions.grp_members_info`, 'Members');

      console.log(`[GROUP FORMATION] Processing ${parents.length} groups and ${members.length} members`);

      // Group members by their parent ID
      const membersByParent: Record<string, any[]> = {};
      members.forEach(member => {
        const parentId = member['__Submissions-id'];
        if (!membersByParent[parentId]) membersByParent[parentId] = [];
        membersByParent[parentId].push({
          id: member['__id'],
          name: member.grp_members_all?.member_name || 'Unknown',
          age: parseInt(member.grp_members_all?.member_age) || null,
          gender: member.grp_members_all?.member_gender || 'Unknown',
          phone: member.grp_members_all?.member_phone || 'N/A',
          beneficiaryId: member.grp_members_all?.member_ben_id || 'N/A',
          hhId: member.grp_members_all?.member_HH_id || 'N/A'
        });
      });

      // Merge parent info with members
      const result = parents.map(p => ({
        submissionId: p.__id,
        cluster: p.location_info?.cluster || 'Unknown',
        gp: p.location_info?.gp || 'Unknown',
        village: p.location_info?.village || 'Unknown',
        groupName: p.group_info?.group_name || 'Unnamed Group',
        activity: p['bene_info-activity'] || p.bene_info?.activity || p.group_info?.activity || p.activity_info?.activity || 'General',
        formationDate: p.group_info?.group_formation_date || p.__system?.submissionDate,
        members: membersByParent[p.__id] || []
      }));

      groupCache = result;
      groupCacheTime = Date.now();
      res.json(result);
    } catch (err: any) {
      console.error("[GROUP FORMATION ERROR]", err.message);
      res.status(500).json({ error: "Failed to fetch group formation data", message: err.message });
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
       
       const controller = new AbortController();
       const timeoutId = setTimeout(() => controller.abort(), 12000);

       try {
         const formRes = await fetch(`https://central.wassan.org/v1/projects/${projectId}/forms`, {
           headers: { 
             'Authorization': `Bearer ${token}`,
             'User-Agent': 'Wassan-App/1.0',
             'Accept': 'application/json'
           },
           signal: controller.signal
         });
         const forms = await formRes.json();

         const appUsersRes = await fetch(`https://central.wassan.org/v1/projects/${projectId}/app-users`, {
           headers: { 
             'Authorization': `Bearer ${token}`,
             'User-Agent': 'Wassan-App/1.0',
             'Accept': 'application/json'
           },
           signal: controller.signal
         });
         const appUsers = await appUsersRes.json();
         const usersMap: Record<string, string> = {};
         appUsers.forEach((u: any) => usersMap[u.id] = u.displayName);

         const submissionsData = await Promise.all(forms.map(async (form: any) => {
             const subRes = await fetch(`https://central.wassan.org/v1/projects/${projectId}/forms/${encodeURIComponent(form.xmlFormId)}/submissions`, {
               headers: { 
                 'Authorization': `Bearer ${token}`,
                 'User-Agent': 'Wassan-App/1.0',
                 'Accept': 'application/json'
               },
               signal: controller.signal
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
         clearTimeout(timeoutId);
       } catch (innerErr: any) {
         clearTimeout(timeoutId);
         throw innerErr;
       }
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
      console.log(`[SHEET PROXY] Fetching: ${url}`);
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/csv,text/plain,application/vnd.ms-excel,*/*'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SHEET PROXY] Upstream Error (${response.status}):`, errorText.substring(0, 500));
        return res.status(response.status).send(`Upstream returned ${response.status}: ${errorText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      
      // Prevent any caching of the proxy response itself
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      
      const text = await response.text();
      res.send(text);
    } catch (error: any) {
      console.error(`[SHEET PROXY] Fatal Error:`, error.message);
      res.status(500).send(`Proxy Error: ${error.message}`);
    }
  });

  // NEW: Robust POST proxy for Google Apps Script
  app.post("/api/gas-proxy", async (req, res) => {
    const { url, payload } = req.body || {};
    if (!url) {
      console.error("[GAS PROXY] ERROR: Missing 'url' in request body");
      return res.status(400).json({ error: "Missing url parameter" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      console.warn(`[GAS PROXY] TIMEOUT reached for: ${payload?.action}`);
      controller.abort();
    }, 25000); // 25 second timeout - safer for Vercel Hobby (max 10s usually, but some deployments allow more)

    try {
      const bodyString = JSON.stringify(payload);
      console.log(`[GAS PROXY] Upstream POST to: ${url}`);
      console.log(`[GAS PROXY] Action: ${payload?.action}, Size: ${(bodyString.length / 1024).toFixed(2)} KB`);
      
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'follow',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: bodyString,
        signal: controller.signal
      });

      const text = await response.text();
      clearTimeout(timeout);
      
      console.log(`[GAS PROXY] Upstream Status: ${response.status}`);
      
      if (!response.ok) {
        console.error(`[GAS PROXY] Upstream error details: ${text.substring(0, 200)}`);
        return res.status(response.status).json({ 
          error: "Google Script Error", 
          details: text.substring(0, 500) 
        });
      }

      try {
        const json = JSON.parse(text);
        res.json(json);
      } catch (e) {
        console.warn(`[GAS PROXY] Response was not JSON. Returning raw text.`);
        if (text.includes('<!DOCTYPE html>')) {
          res.status(502).json({ error: "Google returned HTML (likely an error page). Check Script Quotas." });
        } else {
          res.json({ status: 'success', raw: text });
        }
      }
    } catch (error: any) {
      clearTimeout(timeout);
      const isTimeout = error.name === 'AbortError';
      console.error(`[GAS PROXY] FATAL ERROR:`, isTimeout ? 'Timed out' : error.message);
      res.status(500).json({ 
        error: isTimeout ? "Request to Google timed out." : "Internal Proxy Error",
        message: error.message 
      });
    }
  });

  // NEW: Robust GET proxy for Google Apps Script
  app.get("/api/gas-proxy", async (req, res) => {
    const { url, ...params } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: "Missing url" });

    try {
      const targetUrl = new URL(url);
      Object.entries(params).forEach(([key, val]) => {
        if (typeof val === 'string') targetUrl.searchParams.append(key, val);
      });

      console.log(`[GAS GET PROXY] Fetching: ${targetUrl.toString()}`);
      const response = await fetch(targetUrl.toString(), {
        redirect: 'follow',
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const text = await response.text();
      try {
        const json = JSON.parse(text);
        res.json(json);
      } catch (e) {
        res.send(text);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/odk/data", async (req, res) => {
    try {
      // 1. Read and Validate projectId/formId
      const projectId = (req.query.projectId as string) || await getProjectId() || '3';
      const formId = req.query.formId as string;
      const limit = req.query.limit as string;
      
      if (!formId) {
        return res.status(400).json({ error: 'Missing formId parameter' });
      }
      // 7. Log safe diagnostics (No secrets)
      console.log(`[ODK PROXY] Data Request - Project: ${projectId}, Form: ${formId}`);

      // 13. Check environment variables
      const email = (process.env.ODK_EMAIL || '').trim();
      if (!email || !(process.env.ODK_PASSWORD || '').trim()) {
        return res.status(500).json({ 
          error: "ODK data API failed", 
          message: "ODK credentials are not configured in environment variables." 
        });
      }

      // 4. Authenticate
      let token;
      try {
        token = await getOdkToken();
      } catch (authErr: any) {
        return res.status(401).json({ 
          error: "ODK data API failed", 
          message: `Authentication failed: ${authErr.message}` 
        });
      }

      // 3. Construct URL
      const baseUrl = `https://central.wassan.org/v1/projects/${projectId}/forms/${encodeURIComponent(formId)}.svc`;
      let url = `${baseUrl}/Submissions`;
      
      const queryParams = [];
      if (limit) queryParams.push(`$top=${limit}`);
      queryParams.push('$count=true');
      if (queryParams.length > 0) url += `?${queryParams.join('&')}`;
      
      // 5. Call ODK Central with timeout
      const controller = new AbortController();
      const timeoutMs = 12000; // Aligned with technical guide (12s limit)
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'User-Agent': 'Wassan-App/1.0'
          },
          cache: 'no-store',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // 6. Read ODK response using response.text() FIRST
        const contentType = response.headers.get("content-type") || "";
        const text = await response.text();

        // 7. Log safe diagnostics
        console.log(`[ODK PROXY] Response Status: ${response.status}, Content-Type: ${contentType}`);

        // 8. Handle non-2xx
        if (!response.ok) {
          return res.status(response.status).json({
            error: "ODK request failed",
            odkStatus: response.status,
            odkStatusText: response.statusText,
            details: text.substring(0, 1000)
          });
        }

        // 9. Parse JSON safely
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            return res.json({ value: data });
          }
          res.json(data);
        } catch (parseError: any) {
          return res.status(500).json({
            error: "ODK request failed",
            odkStatus: response.status,
            odkStatusText: "Invalid JSON response",
            details: text.substring(0, 1000)
          });
        }

      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          return res.status(504).json({ 
            error: "ODK data API failed", 
            message: `Request to ODK Central timed out after ${timeoutMs/1000}s` 
          });
        }
        throw fetchErr;
      }
    } catch (error: any) {
      // 11/12. Catch everything and return useful JSON
      console.error("[ODK PROXY] FATAL EXCEPTION:", error);
      res.status(500).json({
        error: "ODK data API failed",
        message: error.message
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
          'Accept': 'application/json',
          'User-Agent': 'Wassan-App/1.0'
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

  app.get("/api/odk/status", async (req, res) => {
    try {
      const email = (process.env.ODK_EMAIL || '').trim();
      if (!email) return res.status(200).json({ status: 'error', message: 'ODK_EMAIL not configured' });
      
      const token = await getOdkToken();
      const projectId = await getProjectId();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const projectRes = await fetch(`https://central.wassan.org/v1/projects/${projectId}`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'Wassan-App/1.0'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!projectRes.ok) {
          return res.status(200).json({ 
            status: 'error', 
            message: `ODK Central connection failed: ${projectRes.status}`,
            projectId 
          });
        }
        
        const projectData = await projectRes.json();
        res.json({ 
          status: 'ok', 
          project: projectData.name, 
          projectId: projectData.id,
          email: email.split('@')[0] + '@...' 
        });
      } catch (innerErr: any) {
        clearTimeout(timeoutId);
        throw innerErr;
      }
    } catch (e: any) {
      console.error("[STATUS API ERROR]", e);
      res.status(200).json({ 
        status: 'error', 
        message: e.name === 'AbortError' ? 'ODK status check timed out' : e.message 
      });
    }
  });

  
  // ============================================================================
  // SERVER-SIDE MATERIAL DISTRIBUTION INDEXER & API
  // ============================================================================
  const ASSET_DISTRIBUTION_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRnf96Py7icFx4_-yDw0a6xp9_pDOIfDJNHk5nUpBFDeJohuIq5RpbhShAlZlG7k4M8xTHarmZqmPX-/pub?gid=1409614466&single=true&output=csv";
  
  let cachedMaterialsMap = new Map<string, any[]>();
  let lastMaterialsFetch = 0;

  function parseCSVLine(line: string): string[] {
    const vals: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === "," && !inQuotes) {
        vals.push(cur.trim().replace(/^"|"$/g, ""));
        cur = "";
      } else {
        cur += char;
      }
    }
    vals.push(cur.trim().replace(/^"|"$/g, ""));
    return vals;
  }

  async function refreshMaterialsCache() {
    try {
      console.log("[MATERIALS] Refreshing material distribution cache...");
      const res = await fetch(ASSET_DISTRIBUTION_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/csv,text/plain,*/*"
        }
      });
      if (!res.ok) {
        console.error("[MATERIALS] Failed to fetch distribution sheet:", res.status);
        return;
      }
      const text = await res.text();
      const lines = text.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return;

      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
      const map = new Map<string, any[]>();

      lines.slice(1).forEach(l => {
        const row = parseCSVLine(l);
        const getCol = (keys: string[]) => {
          for (const k of keys) {
            const idx = headers.findIndex(h => h === k || h.includes(k));
            if (idx !== -1 && row[idx]) return row[idx].trim();
          }
          return "";
        };

        const bId = getCol(["ben_id", "beneficiary id", "adhaar"]).toLowerCase();
        const fId = getCol(["farmer id", "farmer_id", "hh id"]).toLowerCase();
        const bName = getCol(["beneficiary name", "name"]).toLowerCase();
        const vName = getCol(["village"]).toLowerCase();
        const label = getCol(["this_material_label", "material", "asset"]);
        const count = parseFloat(getCol(["materials_details-material_count"])) || 1;
        const unit = getCol(["materials_details-material_unit"]) || "Unit";
        const date = getCol(["materials_details-distributed_date"]);
        const materialId = getCol(["material_id"]);

        if (label) {
          const item = { label, count, unit, date, materialId };
          if (bId) {
            if (!map.has(bId)) map.set(bId, []);
            map.get(bId)!.push(item);
          }
          if (fId && fId !== bId) {
            if (!map.has(fId)) map.set(fId, []);
            map.get(fId)!.push(item);
          }
          if (bName && vName) {
            const combo = `${bName}_${vName}`;
            if (!map.has(combo)) map.set(combo, []);
            map.get(combo)!.push(item);
          }
          const cleanName = bName.replace(/[^a-z0-9]/g, "");
          const cleanVillage = vName.replace(/[^a-z0-9]/g, "");
          if (cleanName) {
            if (!map.has(cleanName)) map.set(cleanName, []);
            map.get(cleanName)!.push(item);
            if (cleanVillage) {
              const comboClean = `${cleanName}_${cleanVillage}`;
              if (!map.has(comboClean)) map.set(comboClean, []);
              map.get(comboClean)!.push(item);
            }
          }
        }
      });

      cachedMaterialsMap = map;
      lastMaterialsFetch = Date.now();
      console.log(`[MATERIALS] Cached ${map.size} unique keys from ${lines.length - 1} distribution rows.`);
    } catch (e: any) {
      console.error("[MATERIALS] Cache refresh error:", e.message);
    }
  }

  // Preload cache
  refreshMaterialsCache();
  setInterval(refreshMaterialsCache, 10 * 60 * 1000);

  app.get("/api/materials/all", async (req, res) => {
    try {
      if (Date.now() - lastMaterialsFetch > 10 * 60 * 1000 || cachedMaterialsMap.size === 0) {
        await refreshMaterialsCache();
      }
      const obj: Record<string, any[]> = {};
      cachedMaterialsMap.forEach((val, key) => {
        obj[key] = val;
      });
      res.json({ success: true, count: cachedMaterialsMap.size, map: obj });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message, map: {} });
    }
  });

  app.get("/api/materials/query", async (req, res) => {
    try {
      if (Date.now() - lastMaterialsFetch > 10 * 60 * 1000 || cachedMaterialsMap.size === 0) {
        await refreshMaterialsCache();
      }

      const candidates: string[] = [
        String(req.query.id || ""),
        String(req.query.beneficiaryId || ""),
        String(req.query.farmerId || ""),
        String(req.query.hhId || ""),
        String(req.query.adhaar || "")
      ].filter(Boolean).map(s => s.toLowerCase().trim());

      let matched: any[] = [];
      for (const cid of candidates) {
        if (cachedMaterialsMap.has(cid)) {
          matched = cachedMaterialsMap.get(cid)!;
          break;
        }
      }

      if (matched.length === 0) {
        const rawName = String(req.query.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const rawVillage = String(req.query.village || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (rawName && rawVillage && cachedMaterialsMap.has(`${rawName}_${rawVillage}`)) {
          matched = cachedMaterialsMap.get(`${rawName}_${rawVillage}`)!;
        } else if (rawName && cachedMaterialsMap.has(rawName)) {
          matched = cachedMaterialsMap.get(rawName)!;
        }
      }

      res.json({ success: true, count: matched.length, materials: matched });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message, materials: [] });
    }
  });

  // ============================================================================
  // BENEFICIARY ACKNOWLEDGEMENT & TRACKING API ROUTES
  // ============================================================================
  const memoryAcknowledgements: any[] = [];
  let ackCounter = 1001;

  // Dedicated Acknowledgement ID & UUID Mapping in-memory store
  const memoryAckMappings: any[] = [];
  const DEFAULT_ACK_MAPPING_URL = 'https://script.google.com/macros/s/AKfycbzRuivTRI8pD5VM6Jm1TrPS_HF_v7npP8t9Vpdiw-lv-gwYTpFrWAnMtbg1yZERPzwhpA/exec';

  const syncMappingToGoogleSheet = (records: any[]) => {
    const gasUrl = process.env.ACKNOWLEDGEMENT_MAPPING_SCRIPT_URL || process.env.UPLOAD_LETTERS_SCRIPT_URL || DEFAULT_ACK_MAPPING_URL;
    if (gasUrl && gasUrl.startsWith('http') && records && records.length > 0) {
      try {
        fetch(gasUrl, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: records })
        }).catch(e => console.warn('GAS mapping sync background notice:', e.message));
      } catch (err: any) {
        console.warn('Sync to GAS mapping error:', err.message);
      }
    }
  };

  async function ensureSheetSynced() {
    try {
      const gasUrl = process.env.ACKNOWLEDGEMENT_MAPPING_SCRIPT_URL || process.env.UPLOAD_LETTERS_SCRIPT_URL || DEFAULT_ACK_MAPPING_URL;
      if (gasUrl && gasUrl.startsWith('http')) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const gasRes = await fetch(gasUrl, { redirect: 'follow', signal: controller.signal });
        clearTimeout(timeoutId);
        const gasText = await gasRes.text();
        const gasData = JSON.parse(gasText);
        if (gasData.success && Array.isArray(gasData.records)) {
          for (const rec of gasData.records) {
            const uuid = String(rec.uuid || '').trim();
            const ackId = String(rec.acknowledgementId || rec.acknowledgement_number || '').trim();
            const benId = String(rec.beneficiaryId || '').trim();
            const benName = String(rec.beneficiaryName || 'Beneficiary').trim();
            const activity = String(rec.activity || rec.activityName || 'NS').trim();
            const cluster = String(rec.cluster || 'Cluster 1').trim();
            const gp = String(rec.gp || 'GP').trim();
            const village = String(rec.village || 'Village').trim();
            const rawGenBy = String(rec.generatedBy || '').trim();
            const generatedBy = rawGenBy && rawGenBy !== 'System' && rawGenBy !== 'user' ? rawGenBy : 'Admin';

            if (uuid || ackId) {
              const existingMap = memoryAckMappings.find(m => (uuid && m.uuid === uuid) || (ackId && m.acknowledgementId === ackId));
              if (!existingMap) {
                memoryAckMappings.push({
                  timestamp: rec.timestamp || new Date().toISOString(),
                  uuid,
                  acknowledgementId: ackId,
                  beneficiaryId: benId,
                  beneficiaryName: benName,
                  activityName: activity,
                  cluster,
                  gp,
                  village,
                  generatedBy,
                  remarks: rec.remarks || 'Synced from Sheet'
                });
              }

              const existingAck = memoryAcknowledgements.find(a => (uuid && a.activity_status_UUID === uuid) || (ackId && a.acknowledgement_number === ackId));
              if (!existingAck) {
                memoryAcknowledgements.unshift({
                  id: 'ack_' + Math.random().toString(36).substring(2, 11),
                  acknowledgement_number: ackId || `P1198-BHM-2026-${String(ackCounter++).padStart(6, '0')}`,
                  activity_status_UUID: uuid || benId,
                  beneficiary_id: benId || '-',
                  activity_name: activity,
                  beneficiary_name: benName,
                  cluster,
                  gp,
                  village,
                  generation_status: 'GENERATED',
                  pdf_storage_path: `/acknowledgements/${ackId}.pdf`,
                  pdf_version: 1,
                  hard_copy_status: 'PENDING',
                  received_date: null,
                  received_by: null,
                  photography_consent: 'NOT_RECORDED',
                  remarks: rec.remarks || 'Synced from Sheet',
                  created_at: rec.timestamp || new Date().toISOString(),
                  updated_at: rec.timestamp || new Date().toISOString()
                });
              }
            }
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn("Background sheet sync notice:", e.message || e);
      }
    }
  }

  app.get('/api/acknowledgements/list', (req, res) => {
      ensureSheetSynced().catch(e => console.warn('Background sync error:', e));
      res.json({ success: true, acknowledgements: memoryAcknowledgements });
  });

  app.post('/api/acknowledgements/generate', async (req, res) => {
      const { activityStatusUuid, beneficiaryId, activityName, beneficiaryName, cluster, gp, village, remarks, generatedBy } = req.body;
      if (!activityStatusUuid || !beneficiaryId) {
          return res.status(400).json({ error: 'Missing activityStatusUuid or beneficiaryId' });
      }
      const existing = memoryAcknowledgements.find(a => a.activity_status_UUID === activityStatusUuid && a.beneficiary_id === beneficiaryId);
      if (existing) {
          return res.json({ success: true, acknowledgement: existing, message: 'Acknowledgement already exists' });
      }

      const rawGenBy = String(generatedBy || req.body.username || req.body.user || 'Admin').trim();
      const finalGeneratedBy = rawGenBy && rawGenBy !== 'System' && rawGenBy !== 'user' ? rawGenBy : 'Admin';

      const ackNum = `P1198-BHM-2026-${String(ackCounter++).padStart(6, '0')}`;
      const newRecord = {
          id: 'ack_' + Math.random().toString(36).substring(2, 11),
          acknowledgement_number: ackNum,
          activity_status_UUID: activityStatusUuid,
          beneficiary_id: beneficiaryId,
          activity_name: activityName || 'NS',
          beneficiary_name: beneficiaryName || 'Beneficiary',
          cluster: cluster || 'Cluster 1',
          gp: gp || 'GP',
          village: village || 'Village',
          generation_status: 'GENERATED',
          pdf_storage_path: `/acknowledgements/${ackNum}.pdf`,
          pdf_version: 1,
          hard_copy_status: 'PENDING',
          received_date: null,
          received_by: null,
          photography_consent: 'NOT_RECORDED',
          remarks: remarks || 'Generated successfully',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
      };

      memoryAcknowledgements.unshift(newRecord);

      // Auto-record and sync Acknowledgement ID <-> UUID mapping
      const mappingItem = {
          timestamp: new Date().toISOString(),
          uuid: activityStatusUuid,
          acknowledgementId: ackNum,
          beneficiaryId: beneficiaryId,
          beneficiaryName: beneficiaryName || 'Beneficiary',
          activityName: activityName || 'NS',
          cluster: cluster || 'Cluster 1',
          gp: gp || 'GP',
          village: village || 'Village',
          generatedBy: finalGeneratedBy,
          remarks: 'Generated Letter'
      };
      const existingMapIdx = memoryAckMappings.findIndex(m => m.uuid === activityStatusUuid || m.acknowledgementId === ackNum);
      if (existingMapIdx >= 0) {
          memoryAckMappings[existingMapIdx] = { ...memoryAckMappings[existingMapIdx], ...mappingItem };
      } else {
          memoryAckMappings.unshift(mappingItem);
      }
      syncMappingToGoogleSheet([mappingItem]);

      res.json({ success: true, acknowledgement: newRecord });
  });

  app.post('/api/acknowledgements/hardcopy', (req, res) => {
      const { id, status, receivedBy, remarks } = req.body;
      const record = memoryAcknowledgements.find(a => a.id === id || a.acknowledgement_number === id);
      if (!record) {
          return res.status(404).json({ error: 'Acknowledgement record not found' });
      }
      record.hard_copy_status = status || 'RECEIVED';
      record.received_date = new Date().toISOString();
      record.received_by = receivedBy || 'Office Staff';
      if (remarks) record.remarks = remarks;
      record.updated_at = new Date().toISOString();
      res.json({ success: true, acknowledgement: record });
  });

  const memoryBeneficiaryDocuments: any[] = [];
  app.get('/api/beneficiary-documents/list', (req, res) => {
      res.json({ success: true, documents: memoryBeneficiaryDocuments });
  });
  app.post('/api/beneficiary-documents/upload', (req, res) => {
      const { beneficiaryId, beneficiaryName, block, cluster, gp, village, activity, fileBase64, fileName, fileSize, receivedBy, remarks } = req.body;
      if (!beneficiaryId || !fileBase64) {
          return res.status(400).json({ error: 'Missing beneficiaryId or fileData' });
      }
      if (fileSize && fileSize > 5 * 1024 * 1024) {
          return res.status(400).json({ error: 'File size exceeds 5MB limit' });
      }
      const record = {
          id: 'doc_' + Math.random().toString(36).substring(2, 11),
          beneficiaryId,
          beneficiaryName: beneficiaryName || 'Beneficiary',
          block: block || 'Block 1',
          cluster: cluster || 'Cluster 1',
          gp: gp || 'GP',
          village: village || 'Village',
          activity: activity || 'NS',
          fileName: fileName || 'document.pdf',
          fileSize: fileSize || 0,
          fileUrl: fileBase64,
          receivedBy: receivedBy || 'Data Assistant',
          remarks: remarks || 'Uploaded by DA',
          timestamp: new Date().toISOString()
      };
      memoryBeneficiaryDocuments.unshift(record);

      const existingAck = memoryAcknowledgements.find(a => a.beneficiary_id === beneficiaryId);
      if (existingAck) {
          existingAck.hard_copy_status = 'RECEIVED';
          existingAck.received_date = new Date().toISOString();
          existingAck.received_by = receivedBy || 'Data Assistant';
          existingAck.remarks = remarks || existingAck.remarks;
          existingAck.updated_at = new Date().toISOString();
      } else {
          const ackNum = `P1198-BHM-2026-${String(ackCounter++).padStart(6, '0')}`;
          memoryAcknowledgements.unshift({
              id: 'ack_' + Math.random().toString(36).substring(2, 11),
              acknowledgement_number: ackNum,
              activity_status_UUID: 'doc_upload_' + beneficiaryId,
              beneficiary_id: beneficiaryId,
              activity_name: activity || 'NS',
              beneficiary_name: beneficiaryName || 'Beneficiary',
              cluster: cluster || 'Cluster 1',
              gp: gp || 'GP',
              village: village || 'Village',
              generation_status: 'GENERATED',
              pdf_storage_path: fileBase64,
              pdf_version: 1,
              hard_copy_status: 'RECEIVED',
              received_date: new Date().toISOString(),
              received_by: receivedBy || 'Data Assistant',
              photography_consent: 'NOT_RECORDED',
              remarks: remarks || 'Uploaded via DA Document Portal',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
          });
      }

      res.json({ success: true, record });
  });

  app.post('/api/acknowledgements/consent', (req, res) => {
      const { id, consent } = req.body;
      const record = memoryAcknowledgements.find(a => a.id === id || a.acknowledgement_number === id);
      if (!record) {
          return res.status(404).json({ error: 'Acknowledgement record not found' });
      }
      record.photography_consent = consent || 'YES';
      record.updated_at = new Date().toISOString();
      res.json({ success: true, acknowledgement: record });
  });

  app.post('/api/acknowledgements/bulk', (req, res) => {
      const { items, generatedBy } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ error: 'Invalid items array for bulk generation' });
      }
      const rawGenBy = String(generatedBy || req.body.username || req.body.user || 'Admin').trim();
      const finalGeneratedBy = rawGenBy && rawGenBy !== 'System' && rawGenBy !== 'user' ? rawGenBy : 'Admin';

      const generated = [];
      for (const item of items) {
          let existing = memoryAcknowledgements.find(a => a.activity_status_UUID === item.activityStatusUuid && a.beneficiary_id === item.beneficiaryId);
          if (!existing) {
              const ackNum = `P1198-BHM-2026-${String(ackCounter++).padStart(6, '0')}`;
              existing = {
                  id: 'ack_' + Math.random().toString(36).substring(2, 11),
                  acknowledgement_number: ackNum,
                  activity_status_UUID: item.activityStatusUuid,
                  beneficiary_id: item.beneficiaryId,
                  activity_name: item.activityName || 'NS',
                  beneficiary_name: item.beneficiaryName || 'Beneficiary',
                  cluster: item.cluster || 'Cluster 1',
                  gp: item.gp || 'GP',
                  village: item.village || 'Village',
                  generation_status: 'GENERATED',
                  pdf_storage_path: `/acknowledgements/${ackNum}.pdf`,
                  pdf_version: 1,
                  hard_copy_status: 'PENDING',
                  received_date: null,
                  received_by: null,
                  photography_consent: 'NOT_RECORDED',
                  remarks: 'Bulk generated successfully',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
              };
              memoryAcknowledgements.unshift(existing);

              // Auto-record mapping
              const mappingItem = {
                  timestamp: new Date().toISOString(),
                  uuid: item.activityStatusUuid,
                  acknowledgementId: ackNum,
                  beneficiaryId: item.beneficiaryId,
                  beneficiaryName: item.beneficiaryName || 'Beneficiary',
                  activityName: item.activityName || 'NS',
                  cluster: item.cluster || 'Cluster 1',
                  gp: item.gp || 'GP',
                  village: item.village || 'Village',
                  generatedBy: finalGeneratedBy,
                  remarks: 'Bulk Generated Letter'
              };
              memoryAckMappings.unshift(mappingItem);
          }
          generated.push(existing);
      }

      if (generated.length > 0) {
          syncMappingToGoogleSheet(generated.map(g => ({
              timestamp: g.created_at,
              uuid: g.activity_status_UUID,
              acknowledgementId: g.acknowledgement_number,
              beneficiaryId: g.beneficiary_id,
              beneficiaryName: g.beneficiary_name,
              activityName: g.activity_name,
              cluster: g.cluster,
              gp: g.gp,
              village: g.village,
              generatedBy: finalGeneratedBy,
              remarks: 'Bulk Generated Letter'
          })));
      }

      res.json({ success: true, count: generated.length, acknowledgements: generated });
  });

  // ============================================================================
  // ACKNOWLEDGEMENT ID & UUID MAPPING SERVICE (Google Spreadsheet Tab: Ack_UUID_Mapping)
  // ============================================================================
  app.post('/api/acknowledgement-mapping', async (req, res) => {
    try {
      const items = Array.isArray(req.body.items) ? req.body.items : [req.body];
      const saved = [];

      for (const item of items) {
        const uuid = String(item.uuid || item.activityStatusUuid || item.submissionId || item.id || '').trim();
        const ackId = String(item.acknowledgementId || item.acknowledgement_number || item.ackId || '').trim();

        if (!uuid && !ackId) continue;

        const record = {
          timestamp: new Date().toISOString(),
          uuid,
          acknowledgementId: ackId,
          beneficiaryId: item.beneficiaryId || item.beneficiary_id || item.farmerId || item.hhId || '-',
          beneficiaryName: item.beneficiaryName || item.beneficiary_name || item.name || 'Beneficiary',
          activityName: item.activityName || item.activity_name || item.activity || '-',
          cluster: item.cluster || '-',
          gp: item.gp || '-',
          village: item.village || '-',
          generatedBy: item.generatedBy || item.uploadedBy || 'System',
          remarks: item.remarks || 'Generated'
        };

        const existingIdx = memoryAckMappings.findIndex(m => 
          (uuid && m.uuid === uuid) || (ackId && m.acknowledgementId === ackId)
        );

        if (existingIdx >= 0) {
          memoryAckMappings[existingIdx] = { ...memoryAckMappings[existingIdx], ...record };
          saved.push(memoryAckMappings[existingIdx]);
        } else {
          memoryAckMappings.unshift(record);
          saved.push(record);
        }
      }

      // Forward to Google Apps Script
      syncMappingToGoogleSheet(saved);

      res.json({
        success: true,
        count: saved.length,
        message: 'UUID and Acknowledgement ID mapping saved',
        mappings: saved
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/acknowledgement-mapping/list', async (req, res) => {
    try {
      const gasUrl = process.env.ACKNOWLEDGEMENT_MAPPING_SCRIPT_URL || process.env.UPLOAD_LETTERS_SCRIPT_URL || DEFAULT_ACK_MAPPING_URL;
      if (gasUrl && gasUrl.startsWith('http')) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);
          const gasRes = await fetch(gasUrl, { redirect: 'follow', signal: controller.signal });
          clearTimeout(timeoutId);
          const gasText = await gasRes.text();
          const gasData = JSON.parse(gasText);
          if (gasData.success && Array.isArray(gasData.records)) {
            for (const rec of gasData.records) {
              const uuid = String(rec.uuid || '').trim();
              const ackId = String(rec.acknowledgementId || rec.acknowledgement_number || '').trim();
              if (uuid || ackId) {
                const exists = memoryAckMappings.find(m => (uuid && m.uuid === uuid) || (ackId && m.acknowledgementId === ackId));
                if (!exists) {
                  memoryAckMappings.push({
                    timestamp: rec.timestamp || new Date().toISOString(),
                    uuid: uuid,
                    acknowledgementId: ackId,
                    beneficiaryId: rec.beneficiaryId || '-',
                    beneficiaryName: rec.beneficiaryName || 'Beneficiary',
                    activityName: rec.activity || rec.activityName || '-',
                    cluster: rec.cluster || '-',
                    gp: rec.gp || '-',
                    village: rec.village || '-',
                    generatedBy: rec.generatedBy || 'System',
                    remarks: rec.remarks || 'Synced from Sheet'
                  });
                }
              }
            }
          }
        } catch (fetchErr: any) {
          if (fetchErr.name !== 'AbortError') {
            console.warn("Could not fetch Ack_UUID_Mapping from GAS:", fetchErr.message || fetchErr);
          }
        }
      }
    } catch (e) {
      console.warn("Error in acknowledgement-mapping/list sync:", e);
    }
    res.json({ success: true, count: memoryAckMappings.length, records: memoryAckMappings });
  });

  app.get('/api/acknowledgement-mapping/search', (req, res) => {
    const q = String(req.query.q || req.query.query || '').toLowerCase().trim();
    if (!q) {
      return res.json({ success: true, count: memoryAckMappings.length, records: memoryAckMappings });
    }
    const filtered = memoryAckMappings.filter(m => 
      (m.acknowledgementId && m.acknowledgementId.toLowerCase().includes(q)) ||
      (m.uuid && m.uuid.toLowerCase().includes(q)) ||
      (m.beneficiaryId && m.beneficiaryId.toLowerCase().includes(q)) ||
      (m.beneficiaryName && m.beneficiaryName.toLowerCase().includes(q)) ||
      (m.village && m.village.toLowerCase().includes(q)) ||
      (m.activityName && m.activityName.toLowerCase().includes(q))
    );
    res.json({ success: true, count: filtered.length, records: filtered });
  });

  // API 404 Handler (prevent falling through to HTML)
  app.all(/^\/api\/.*/, (req, res) => {
    res.status(404).json({ 
      error: "API route not found", 
      path: req.path, 
      method: req.method 
    });
  });

  // Serve static files and SPA fallback
  const distPath = path.join(process.cwd(), 'dist');
  const indexPath = path.join(distPath, 'index.html');
  const rootIndexPath = path.join(process.cwd(), 'index.html');

  if (!fs.existsSync(indexPath)) {
    console.log('[SERVER] index.html not found in dist/. Triggering automatic build...');
    try {
      await build();
      console.log('[SERVER] Automatic build completed successfully.');
    } catch (buildErr: any) {
      console.error('[SERVER] Automatic build failed:', buildErr);
    }
  }
  
  if (!isProduction) {
    console.log("[SERVER] Initializing Vite for development...");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("[SERVER] Vite initialized");
    } catch (e: any) {
      console.warn("[SERVER] Vite import failed, falling back to static serving:", e.message);
      app.use(express.static(distPath));
      app.get(/^((?!\/api\/).)*$/, (req, res) => {
        const fileToSend = fs.existsSync(indexPath) ? indexPath : rootIndexPath;
        res.sendFile(fileToSend, (err) => {
          if (err && !res.headersSent) {
            if (fs.existsSync(rootIndexPath)) {
              res.sendFile(rootIndexPath);
            } else {
              res.status(503).send("Server starting up or compiling assets. Please refresh.");
            }
          }
        });
      });
    }
  } else {
    console.log(`[SERVER] Production mode: Serving static files from ${distPath}`);
    
    // Log if dist exists
    import('fs').then(fs => {
      if (fs.existsSync(distPath)) {
        console.log(`[SERVER] SUCCESS: 'dist' directory found at ${distPath}`);
        if (fs.existsSync(indexPath)) {
          console.log(`[SERVER] SUCCESS: 'index.html' found at ${indexPath}`);
        } else {
          console.error(`[SERVER] ERROR: 'index.html' NOT found at ${indexPath}`);
        }
      } else {
        console.error(`[SERVER] ERROR: 'dist' directory NOT found at ${distPath}`);
      }
    }).catch(() => {});

    app.use(express.static(distPath));
    app.get(/^((?!\/api\/).)*$/, (req, res) => {
      const fileToSend = fs.existsSync(indexPath) ? indexPath : rootIndexPath;
      res.sendFile(fileToSend, (err) => {
        if (err && !res.headersSent) {
          if (fs.existsSync(rootIndexPath)) {
            res.sendFile(rootIndexPath);
          } else {
            res.status(503).send("Server compiling assets. Please refresh.");
          }
        }
      });
    });
  }


  

  return app;
}


// Start server
const PORT = process.env.PORT || 3000;
createApp().then(app => {
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`[SERVER] Listening on port ${PORT}`);
  });
}).catch(err => {
  console.error("[SERVER] Fatal Error during startup:", err);
  process.exit(1);
});
