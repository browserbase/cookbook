import { z } from 'zod';
import { SESSION_LIFETIME_SECONDS } from './session-capability';

const bb_api_key = process.env.BROWSERBASE_API_KEY!
const bb_project_id = process.env.BROWSERBASE_PROJECT_ID!

async function getDebugUrl(id: string) {
  const response = await fetch(`https://api.browserbase.com/v1/sessions/${id}/debug`, {
    method: "GET",
    signal: AbortSignal.timeout(10000),
    headers: {
      "x-bb-api-key": bb_api_key,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) throw new Error(`Browserbase debug request failed (HTTP ${response.status})`);
  const data: unknown = await response.json().catch(() => { throw new Error('Browserbase returned invalid JSON'); });
  const parsed = z.object({
    debuggerFullscreenUrl: z.url().refine(url => new URL(url).protocol === 'https:'),
  }).safeParse(data);
  if (!parsed.success) throw new Error('Browserbase debug response is missing a valid HTTPS debugger URL');
  return parsed.data;
}

async function createSession() {
  const response = await fetch(`https://api.browserbase.com/v1/sessions`, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      "x-bb-api-key": bb_api_key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: bb_project_id,
      keepAlive: true,
      timeout: SESSION_LIFETIME_SECONDS
     }),
  });
  if (!response.ok) throw new Error(`Browserbase session creation failed (HTTP ${response.status})`);
  const data: unknown = await response.json().catch(() => { throw new Error('Browserbase returned invalid JSON'); });
  const parsed = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) }).safeParse(data);
  if (!parsed.success) throw new Error('Browserbase session response is missing a valid session ID');
  return parsed.data;
}

export async function releaseSession(id: string) {
  const response = await fetch(`https://api.browserbase.com/v1/sessions/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'x-bb-api-key': bb_api_key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'REQUEST_RELEASE' }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Browserbase session release failed (HTTP ${response.status})`);
}

export async function createBrowserSession() {
  const session = await createSession();
  try {
    const debug = await getDebugUrl(session.id);
    return { sessionId: session.id, debuggerUrl: debug.debuggerFullscreenUrl };
  } catch (error) {
    try { await releaseSession(session.id); }
    catch (releaseError) {
      throw new AggregateError([error, releaseError], 'Browserbase debugger setup failed and session release failed');
    }
    throw error;
  }
}
