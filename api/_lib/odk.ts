
/**
 * Shared ODK Central Helper for Bhamini-P1198
 * Implementation for Vercel Serverless Functions
 */

let odkSessionToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function getOdkToken() {
  const email = (process.env.ODK_EMAIL || '').trim();
  const password = (process.env.ODK_PASSWORD || '').trim();

  if (!email || !password) {
    throw new Error('ODK credentials not configured (ODK_EMAIL or ODK_PASSWORD missing)');
  }

  // Reuse token if valid (with 5-minute buffer)
  if (odkSessionToken && Date.now() < tokenExpiresAt - 300000) {
    return odkSessionToken;
  }

  const authUrl = 'https://central.wassan.org/v1/sessions';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for auth

  try {
    const res = await fetch(authUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Bhamini-P1198/1.0'
      },
      body: JSON.stringify({ email, password }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text();
      const status = res.status;
      let message = `ODK Auth Failed (${status})`;
      
      if (status === 401) message = "Invalid ODK Central credentials.";
      else if (status === 403) message = "Access forbidden to ODK Central.";
      
      const error: any = new Error(message);
      error.status = status;
      error.details = errorText.substring(0, 500);
      throw error;
    }

    const data: any = await res.json();
    odkSessionToken = data.token;
    // ODK Central returns expiresAt as a string
    tokenExpiresAt = new Date(data.expiresAt).getTime();
    return odkSessionToken;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('ODK Authentication timed out');
    }
    throw err;
  }
}

export async function odkFetch(url: string, options: RequestInit = {}) {
  const token = await getOdkToken();
  
  const controller = new AbortController();
  const timeoutMs = 9000; // 9-second timeout (safer for Vercel Hobby)
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'Bhamini-P1198/1.0'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    if (!response.ok) {
      const error: any = new Error(`ODK request failed with status ${response.status}`);
      error.status = response.status;
      error.statusText = response.statusText;
      error.details = text.substring(0, 1000);
      throw error;
    }

    // Attempt to parse JSON if content-type suggests it
    if (contentType.includes("application/json")) {
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        const error: any = new Error("Failed to parse ODK response as JSON");
        error.details = text.substring(0, 1000);
        throw error;
      }
    }

    return text;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutErr: any = new Error(`ODK request timed out after ${timeoutMs/1000}s`);
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw err;
  }
}
