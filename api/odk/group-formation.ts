
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const runtime = 'nodejs';

let odkSessionToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getOdkToken() {
  const email = (process.env.ODK_EMAIL || '').trim();
  const password = (process.env.ODK_PASSWORD || '').trim();
  if (!email || !password) throw new Error('ODK credentials not configured');
  if (odkSessionToken && Date.now() < tokenExpiresAt - 300000) return odkSessionToken;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch('https://central.wassan.org/v1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
    const data: any = await res.json();
    odkSessionToken = data.token;
    tokenExpiresAt = new Date(data.expiresAt).getTime();
    return odkSessionToken;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function fetchAllOdata(url: string, token: string, label: string) {
  let allData: any[] = [];
  let nextLink = url;
  let pages = 0;

  while (nextLink) {
    pages++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    
    try {
      console.log(`[ODK FETCH] ${label} - Page ${pages}: ${nextLink}`);
      const res = await fetch(nextLink, {
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Accept': 'application/json',
          'User-Agent': 'Bhamini-P1198/1.0'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`ODK ${label} fetch failed (${res.status}): ${errText.substring(0, 200)}`);
      }
      
      const data = await res.json();
      allData = [...allData, ...(data.value || [])];
      nextLink = data['@odata.nextLink'] || null;
      
      // Safety break to prevent infinite loops or excessive Vercel usage
      if (allData.length > 5000 || pages > 20) break; 
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
  return allData;
}

let groupCache: any = null;
let cacheTime: number = 0;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Simple 5-minute cache
  if (groupCache && Date.now() - cacheTime < 300000) {
    console.log("[GROUP FORMATION] Serving from cache");
    return res.status(200).json(groupCache);
  }

  try {
    const projectId = process.env.ODK_PROJECT_ID || '3';
    const formId = 'Group Formation';
    const token = await getOdkToken();
    const baseUrl = `https://central.wassan.org/v1/projects/${projectId}/forms/${encodeURIComponent(formId)}.svc`;

    console.log(`[GROUP FORMATION] Starting data refresh for form: ${formId}`);

    // Fetch Parent data
    const parents = await fetchAllOdata(`${baseUrl}/Submissions`, token, 'Parents');
    
    // Fetch Repeat data
    const members = await fetchAllOdata(`${baseUrl}/Submissions.grp_members_info`, token, 'Members');

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

    // Update Cache
    groupCache = result;
    cacheTime = Date.now();

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[GROUP FORMATION ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch group formation data", message: err.message });
  }
}
