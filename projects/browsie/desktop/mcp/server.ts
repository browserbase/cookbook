import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createBrowsieMcpServer } from "./tools.js";

const server = createBrowsieMcpServer();
await server.connect(new StdioServerTransport());
