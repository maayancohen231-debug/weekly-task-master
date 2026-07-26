import type { VercelRequest, VercelResponse } from '@vercel/node';

// Same public Client ID already embedded in src/services/googleCalendar.ts —
// Google client IDs are not secret. GOOGLE_CLIENT_SECRET, by contrast, must
// only ever live in Vercel's server-side environment variables.
const GOOGLE_CLIENT_ID = '45693353250-orevcu10pnhfg4nlbidmp1nlj8nmtoto.apps.googleusercontent.com';

/**
 * Exchanges a Google OAuth authorization code (from google.accounts.oauth2.
 * initCodeClient) for an access token + refresh token. Must run server-side
 * because it requires the client secret. The frontend calls this once, right
 * after the user completes the Google consent popup, then stores the
 * returned refresh_token locally and uses /api/google/refresh from then on
 * to mint new access tokens without ever showing the popup again.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Lets the frontend check once, up front, whether the persistent flow can
  // even work — instead of finding out only after opening a consent popup,
  // which is what forced a second (often browser-blocked) popup on failure.
  if (req.method === 'GET') {
    return res.status(200).json({ configured: Boolean(process.env.GOOGLE_CLIENT_SECRET) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code, origin } = req.body ?? {};
  if (!code || !origin) return res.status(400).json({ error: 'Missing code or origin' });

  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) return res.status(500).json({ error: 'Server not configured: missing GOOGLE_CLIENT_SECRET' });

  const params = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: clientSecret,
    // For initCodeClient's popup ux_mode, Google requires redirect_uri to
    // exactly match the origin of the page that opened the consent popup.
    redirect_uri: origin,
    grant_type: 'authorization_code',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await tokenRes.json();

  if (!tokenRes.ok) {
    return res.status(tokenRes.status).json({ error: data.error_description ?? data.error ?? 'Token exchange failed' });
  }

  return res.status(200).json({
    access_token: data.access_token as string,
    expires_in: data.expires_in as number,
    // Google only includes this on first consent for this (user, client,
    // scope) combination — null on later re-authorizations that don't grant
    // anything new.
    refresh_token: (data.refresh_token as string | undefined) ?? null,
  });
}
