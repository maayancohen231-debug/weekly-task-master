import type { VercelRequest, VercelResponse } from '@vercel/node';

const GOOGLE_CLIENT_ID = '45693353250-orevcu10pnhfg4nlbidmp1nlj8nmtoto.apps.googleusercontent.com';

/**
 * Exchanges a stored refresh_token for a fresh access_token. Called
 * silently by the frontend (on load and periodically) instead of the old
 * Google Identity Services silent-reissue trick, which depended on
 * third-party-cookie-based iframe auth that mobile browsers routinely block.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { refresh_token } = req.body ?? {};
  if (!refresh_token) return res.status(400).json({ error: 'Missing refresh_token' });

  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) return res.status(500).json({ error: 'Server not configured: missing GOOGLE_CLIENT_SECRET' });

  const params = new URLSearchParams({
    refresh_token,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await tokenRes.json();

  if (!tokenRes.ok) {
    // Most common cause: the refresh token was revoked, or — while the
    // Google Cloud OAuth consent screen is in "Testing" publishing status —
    // it hit Google's forced 7-day expiry for unverified apps. Either way
    // the caller needs a full reconnect, there's no silent recovery here.
    return res.status(tokenRes.status).json({ error: data.error_description ?? data.error ?? 'Refresh failed' });
  }

  return res.status(200).json({ access_token: data.access_token as string, expires_in: data.expires_in as number });
}
