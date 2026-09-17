import { createHash } from 'node:crypto';
import { InvalidSessionCapability, verifySessionCapability } from './session-capability';

export function requireSessionRequest(req: Request) {
  if (req.headers.get('origin') !== new URL(req.url).origin ||
      req.headers.get('x-browsegpt-client') !== '1' ||
      req.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    throw Response.json({ error: 'Same-origin JSON request required' }, { status: 403 });
  }
}

export function sessionConfiguration() {
  const secret = process.env.BROWSEGPT_SESSION_SECRET;
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!secret || !/^[a-fA-F0-9]{64}$/.test(secret) || !apiKey) {
    throw Response.json({ error: 'Browser session service is not configured' }, { status: 503 });
  }
  const projectId = createHash('sha256').update(apiKey).digest('hex');
  return { secret, projectId };
}

export function requireBrowserSession(req: Request, purpose: 'operate' | 'release') {
  requireSessionRequest(req);
  const { secret, projectId } = sessionConfiguration();
  try {
    return verifySessionCapability(req.headers.get('x-browsegpt-session'), secret, projectId, purpose);
  } catch (error) {
    if (error instanceof InvalidSessionCapability) {
      throw Response.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }
}
