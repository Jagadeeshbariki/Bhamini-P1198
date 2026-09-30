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
      app.use(express.static(distPath));
      app.get(/^((?!\/api\/).)*$/, (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  } else {
    console.log(`[SERVER] Production mode: Serving from ${distPath}`);
    app.use(express.static(distPath));
    app.get(/^((?!\/api\/).)*$/, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

// Start server
const PORT = Number(process.env.PORT) || 3000;
createApp().then(app => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Listening on port ${PORT} (Mode: ${process.env.NODE_ENV || 'production'})`);
  });
}).catch(err => {
  console.error("[SERVER] Fatal Error during startup:", err);
  process.exit(1);
});
