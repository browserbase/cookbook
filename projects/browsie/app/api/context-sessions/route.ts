import { requireContextCapability } from "../../../server/context-capability";
import { ContextConflictError, getContextStudio } from "../../../server/context-studio";
import type { ContextSessionPurpose } from "../../../src/context-studio";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requireContextCapability(request);
    const sessionId = new URL(request.url).searchParams.get("sessionId");
    if (!sessionId) return failure("A session ID is required.", 400);
    const session = getContextStudio().getSession(sessionId);
    return session ? noStore({ session }) : failure("Session not found.", 404);
  } catch {
    return failure("Session access denied.", 403);
  }
}

export async function POST(request: Request) {
  try {
    requireContextCapability(request);
    const body = (await request.json()) as {
      contextId?: unknown;
      purpose?: unknown;
      startUrl?: unknown;
    };
    if (typeof body.contextId !== "string") return failure("A Context ID is required.", 400);
    if (typeof body.startUrl !== "string") return failure("A website URL is required.", 400);
    const purpose: ContextSessionPurpose = body.purpose === "test" ? "test" : "login";
    return noStore(
      {
        session: await getContextStudio().startSession(body.contextId, purpose, body.startUrl),
      },
      201,
    );
  } catch (error) {
    return failure(
      error instanceof ContextConflictError
        ? error.message
        : "Could not start the Context session.",
      error instanceof ContextConflictError ? 409 : 400,
    );
  }
}

export async function PATCH(request: Request) {
  try {
    requireContextCapability(request);
    const body = (await request.json()) as {
      sessionId?: unknown;
      action?: unknown;
    };
    if (typeof body.sessionId !== "string") return failure("A session ID is required.", 400);
    const studio = getContextStudio();
    const session =
      body.action === "finish"
        ? studio.finishSession(body.sessionId)
        : body.action === "disconnected"
          ? studio.markDisconnected(body.sessionId)
          : body.action === "reconnected"
            ? studio.markReconnected(body.sessionId)
            : undefined;
    return session ? noStore({ session }) : failure("Session or action not found.", 404);
  } catch {
    return failure("Could not update the Context session.", 400);
  }
}

function noStore(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
function failure(message: string, status: number) {
  return noStore({ error: message }, status);
}
