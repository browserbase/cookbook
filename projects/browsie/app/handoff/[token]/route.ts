import { BrowserHandoffError, verifyBrowserHandoffToken } from "../../../server/handoff";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  try {
    verifyBrowserHandoffToken(token);
  } catch (error) {
    return handoffError(error);
  }

  const livePath = `/handoff/${encodeURIComponent(token)}/live`;
  return new Response(null, {
    status: 307,
    headers: {
      "cache-control": "no-store, private, max-age=0",
      location: new URL(livePath, request.url).toString(),
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

function handoffError(error: unknown): Response {
  const status =
    error instanceof BrowserHandoffError && error.code === "expired"
      ? 410
      : error instanceof BrowserHandoffError && error.code === "configuration"
        ? 503
        : 404;
  const message =
    status === 410 ? "This handoff link expired." : "This handoff link is not available.";
  return new Response(message, {
    status,
    headers: handoffHeaders("text/plain; charset=utf-8"),
  });
}

function handoffHeaders(contentType: string): HeadersInit {
  return {
    "cache-control": "no-store, private, max-age=0",
    "content-security-policy":
      "default-src 'none'; frame-src 'self' https://browserbase.com https://*.browserbase.com; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "content-type": contentType,
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
}
