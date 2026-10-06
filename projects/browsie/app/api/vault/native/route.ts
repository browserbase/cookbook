import { nativeVault } from "../../../../server/vault/index";
import { safeError, type LoginInput } from "../../../../server/vault/types";

export const runtime = "nodejs";
const noStore = { "cache-control": "no-store" };
export async function GET() {
  try {
    return Response.json(
      { status: await nativeVault.status(), items: await nativeVault.list() },
      { headers: noStore },
    );
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: 500, headers: noStore });
  }
}
export async function POST(request: Request) {
  try {
    const input = (await request.json()) as LoginInput;
    return Response.json(
      { item: await nativeVault.create(input) },
      { status: 201, headers: noStore },
    );
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: 400, headers: noStore });
  }
}
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { itemId?: unknown } & LoginInput;
    if (typeof body.itemId !== "string") throw new Error("Vault item not found.");
    return Response.json(
      { item: await nativeVault.update(body.itemId, body) },
      { headers: noStore },
    );
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: 400, headers: noStore });
  }
}
export async function DELETE(request: Request) {
  try {
    const itemId = new URL(request.url).searchParams.get("itemId");
    if (!itemId) throw new Error("Vault item not found.");
    await nativeVault.delete(itemId);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: 400, headers: noStore });
  }
}
