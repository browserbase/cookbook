import { randomBytes, timingSafeEqual } from 'node:crypto';

export function createAccessToken() {
  return randomBytes(24).toString('base64url');
}

export function createAccessControl({ token, host, port, cookieName = 'browser_trace_owner' }) {
  if (!token) throw new Error('access token is required');
  const tokenMatches = (candidate) => {
    if (typeof candidate !== 'string') return false;
    const actual = Buffer.from(token);
    const supplied = Buffer.from(candidate);
    return actual.length === supplied.length && timingSafeEqual(actual, supplied);
  };
  const cookieValue = (req) => {
    const pair = String(req.headers.cookie || '').split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`));
    if (!pair) return null;
    try { return decodeURIComponent(pair.slice(cookieName.length + 1)); } catch { return null; }
  };
  return {
    tokenMatches,
    authorized: (req) => tokenMatches(cookieValue(req)),
    sameOrigin: (req) => req.headers.origin === `http://${host}:${port}`,
    ownerCookie: `${cookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/`,
  };
}
