import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const command =
  process.env.BROWSIE_MCP_COMMAND ?? path.join(packageRoot, "node_modules", ".bin", "electron");
const args = process.env.BROWSIE_MCP_ARGS_JSON
  ? JSON.parse(process.env.BROWSIE_MCP_ARGS_JSON)
  : process.env.BROWSIE_MCP_COMMAND
    ? ["--mcp"]
    : [path.join(packageRoot, "electron", "main.cjs"), "--mcp"];
const transport = new StdioClientTransport({
  command,
  args,
  cwd: packageRoot,
  stderr: "pipe",
});
transport.stderr?.on("data", (chunk) => process.stderr.write(chunk));

const client = new Client({ name: "browsie-desktop-smoke", version: "0.1.0" });
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(({ name }) => name).sort(), [
    "browse",
    "browsie_session",
    "stop_browsing",
  ]);
  process.stdout.write("Browsie MCP exposed all expected tools.\n");
  const liveInstruction = process.env.BROWSIE_MCP_LIVE_INSTRUCTION?.trim();
  if (liveInstruction) {
    const result = await client.callTool({
      name: "browse",
      arguments: { instruction: liveInstruction },
    });
    if (result.isError) {
      throw new Error(
        result.content
          .filter((item) => item.type === "text")
          .map((item) => item.text)
          .join("\n") || "Browsie MCP returned an unknown error.",
      );
    }
    assert.ok(result.structuredContent?.sessionId);
    const message = String(result.structuredContent?.message ?? "");
    const expectedText = process.env.BROWSIE_MCP_EXPECT_TEXT?.trim();
    if (expectedText) assert.match(message.toLowerCase(), new RegExp(expectedText.toLowerCase()));
    process.stdout.write(
      `Browsie MCP completed live session ${result.structuredContent.sessionId}: ${message}\n`,
    );
  }
} finally {
  await client.close();
}
