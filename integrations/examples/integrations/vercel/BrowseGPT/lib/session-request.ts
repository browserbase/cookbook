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
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!secret || !/^[a-fA-F0-9]{64}$/.test(secret) || !projectId ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(projectId) || !process.env.BROWSERBASE_API_KEY) {
    throw Response.json({ error: 'Browser session service is not configured' }, { status: 503 });
  }
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
