import { onePasswordVault } from "../../../../server/vault/index";
import { safeError } from "../../../../server/vault/types";

export const runtime = "nodejs";
export async function GET() {
  const headers = { "cache-control": "no-store" };
  try {
    const items = await onePasswordVault.list();
    const status = await onePasswordVault.status();
    return Response.json({ status, items }, { headers });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: 500, headers });
  }
}
