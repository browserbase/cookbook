import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const token = "browsie-http-smoke-token";
const port = 14320;
const endpoint = new URL(`http://127.0.0.1:${port}/mcp`);
const server = spawn(process.execPath, [path.join(packageRoot, "dist", "mcp", "http-server.mjs")], {
  cwd: packageRoot,
  env: {
    ...process.env,
    BROWSIE_MCP_HTTP_PORT: String(port),
    BROWSIE_MCP_SERVER_URL: process.env.BROWSIE_MCP_SERVER_URL ?? "http://127.0.0.1:4318",
    BROWSIE_MCP_TOKEN: token,
  },
  stdio: ["ignore", "ignore", "pipe"],
});
server.stderr.on("data", (chunk) => process.stderr.write(chunk));

const client = new Client({ name: "browsie-http-smoke", version: "0.1.0" });

try {
  await waitForHealth();
  const unauthorized = await fetch(endpoint);
  assert.equal(unauthorized.status, 401);

  const transport = new StreamableHTTPClientTransport(endpoint, {
    requestInit: { headers: { authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(({ name }) => name).sort(), [
    "browse",
    "browsie_session",
    "stop_browsing",
  ]);
  process.stdout.write(
    "Browsie HTTP MCP rejected an unauthenticated request and exposed all expected tools.\n",
  );
} finally {
  await client.close().catch(() => undefined);
  server.kill("SIGTERM");
}

async function waitForHealth() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("The Browsie HTTP MCP server did not become ready.");
}
