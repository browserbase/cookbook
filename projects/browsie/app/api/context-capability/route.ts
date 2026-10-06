import { issueContextCapability } from "../../../server/context-capability";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const capability = issueContextCapability(request);
    return Response.json(
      { token: capability.token },
      {
        headers: {
          "cache-control": "no-store",
          "set-cookie": capability.cookie,
        },
      },
    );
  } catch {
    return Response.json({ error: "Same-origin access required." }, { status: 403 });
  }
}
