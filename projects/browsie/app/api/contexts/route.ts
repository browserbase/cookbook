import { requireContextCapability } from "../../../server/context-capability";
import { ContextConflictError, getContextStudio } from "../../../server/context-studio";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requireContextCapability(request);
    return noStore({ contexts: await getContextStudio().listContexts() });
  } catch {
    return failure("Context access is unavailable.", 403);
  }
}

export async function POST(request: Request) {
  try {
    requireContextCapability(request);
    const body = (await request.json()) as { name?: unknown };
    if (typeof body.name !== "string") return failure("A Context name is required.", 400);
    return noStore({ context: await getContextStudio().createContext(body.name) }, 201);
  } catch (error) {
    return failure(safeMessage(error, "Could not create the Context."), statusFor(error));
  }
}

export async function PATCH(request: Request) {
  try {
    requireContextCapability(request);
    const body = (await request.json()) as { id?: unknown };
    if (typeof body.id !== "string") return failure("A Context ID is required.", 400);
    await getContextStudio().selectContext(body.id);
    return noStore({ ok: true });
  } catch (error) {
    return failure(safeMessage(error, "Could not select the Context."), statusFor(error));
  }
}

export async function DELETE(request: Request) {
  try {
    requireContextCapability(request);
    const id = new URL(request.url).searchParams.get("id");
    const confirmation = request.headers.get("x-browsie-delete-confirmation");
    if (!id || confirmation !== id)
      return failure("Explicit Context deletion confirmation is required.", 400);
    await getContextStudio().deleteContext(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(safeMessage(error, "Could not delete the Context."), statusFor(error));
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
function statusFor(error: unknown): number {
  return error instanceof ContextConflictError ? 409 : 400;
}
function safeMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  return /Context name|Invalid|Unknown|active|Finish|confirmation/.test(error.message)
    ? error.message
    : fallback;
}
