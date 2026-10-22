import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { createBrowsieMcpServer } from "./tools.js";

const host = process.env.BROWSIE_MCP_HTTP_HOST?.trim() || "127.0.0.1";
const port = Number.parseInt(process.env.BROWSIE_MCP_HTTP_PORT ?? "4320", 10);
const token = process.env.BROWSIE_MCP_TOKEN?.trim();

if (!token) {
  throw new Error("BROWSIE_MCP_TOKEN is required for the HTTP MCP bridge.");
}

const httpServer = createServer(async (request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end('{"status":"ok"}');
    return;
  }

  if (request.url !== "/mcp") {
    response.writeHead(404).end();
    return;
  }

  if (!hasValidToken(request.headers.authorization, token)) {
    response.writeHead(401, { "www-authenticate": "Bearer" });
    response.end("Unauthorized");
    return;
  }

  const server = createBrowsieMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  response.once("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(request, response);
  } catch (error) {
    if (!response.headersSent) response.writeHead(500).end("MCP request failed");
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Browsie HTTP MCP request failed: ${message}\n`);
  }
});

httpServer.listen(port, host, () => {
  process.stderr.write(`Browsie HTTP MCP listening on http://${host}:${port}/mcp\n`);
});

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

function shutdown() {
  httpServer.close(() => process.exit(0));
}

function hasValidToken(authorization: string | undefined, expected: string) {
  const provided = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return (
    providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes)
  );
}
