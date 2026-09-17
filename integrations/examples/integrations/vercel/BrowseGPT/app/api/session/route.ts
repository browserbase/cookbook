import { randomUUID } from 'node:crypto';
import { createBrowserSession, releaseSession } from '@/lib/browser-session';
import { issueSessionCapability } from '@/lib/session-capability';
import { requireBrowserSession, requireSessionRequest, sessionConfiguration } from '@/lib/session-request';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    requireSessionRequest(req);
    const { secret, projectId } = sessionConfiguration();
    const conversationId = randomUUID();
    const issuedAt = Math.floor(Date.now() / 1000);
    const session = await createBrowserSession();
    const credential = issueSessionCapability({ sessionId: session.sessionId, conversationId, projectId }, secret, issuedAt);
    return Response.json({ ...credential, debuggerUrl: session.debuggerUrl }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: 'Could not start browser session. Please try again.' }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { sessionId } = requireBrowserSession(req, 'release');
    await releaseSession(sessionId);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: 'Could not release browser session. Please retry.' }, { status: 502 });
  }
}
