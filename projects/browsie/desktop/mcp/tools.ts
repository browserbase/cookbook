import { Client } from "eve/client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function createBrowsieMcpServer() {
  const serverUrl = process.env.BROWSIE_MCP_SERVER_URL?.trim() || "http://127.0.0.1:4318";
  const client = new Client({ host: serverUrl, redirect: "error" });
  const server = new McpServer({ name: "browsie", version: "0.1.2" });

  server.registerTool(
    "browse",
    {
      description:
        "Use the Browsie consumer browser agent for a web task. Browsie keeps one verified, proxied Browserbase browser and one draft Context for the durable session. Reuse sessionId for follow-up work.",
      inputSchema: {
        instruction: z.string().min(1),
        sessionId: z.string().min(1).optional(),
      },
    },
    async ({ instruction, sessionId }) => {
      const response = sessionId
        ? await client.sessions.attach(sessionId).send(instruction)
        : (await client.sessions.create({ message: instruction })).response;
      const result = await response.result();
      const workbenchUrl = `${serverUrl}/s/${encodeURIComponent(result.sessionId)}`;
      return {
        content: [
          {
            type: "text" as const,
            text: [
              result.message ?? "Browsie finished without a text response.",
              "",
              `Session: ${result.sessionId}`,
              `Workbench: ${workbenchUrl}`,
            ].join("\n"),
          },
        ],
        structuredContent: {
          message: result.message ?? null,
          sessionId: result.sessionId,
          status: result.status,
          workbenchUrl,
        },
      };
    },
  );

  server.registerTool(
    "stop_browsing",
    {
      description:
        "Stop the active Browsie turn and its active browser operation for a durable Browsie session.",
      inputSchema: { sessionId: z.string().min(1) },
    },
    async ({ sessionId }) => {
      const result = await client.sessions.attach(sessionId).cancel();
      return {
        content: [
          {
            type: "text" as const,
            text: `Browsie stop status: ${result.status}`,
          },
        ],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "browsie_session",
    {
      description: "Get the durable event count and Workbench URL for an existing Browsie session.",
      inputSchema: { sessionId: z.string().min(1) },
    },
    async ({ sessionId }) => {
      const snapshot = await client.sessions.attach(sessionId).snapshot();
      const workbenchUrl = `${serverUrl}/s/${encodeURIComponent(sessionId)}`;
      return {
        content: [
          {
            type: "text" as const,
            text: `Browsie session ${sessionId} has ${snapshot.events.length} durable events.\nWorkbench: ${workbenchUrl}`,
          },
        ],
        structuredContent: {
          eventCount: snapshot.events.length,
          sessionId,
          workbenchUrl,
        },
      };
    },
  );

  return server;
}
