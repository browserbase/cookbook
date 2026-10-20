import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const port = Number.parseInt(process.env.BROWSIE_PORT ?? "4318", 10);
const serverUrl = process.env.BROWSIE_MCP_SERVER_URL?.trim() || `http://127.0.0.1:${port}`;
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const serverRoot = path.resolve(
  process.env.BROWSIE_SERVER_ROOT?.trim() || path.join(packageRoot, ".."),
);
let serverProcess: ChildProcess | undefined;

config({
  path: process.env.BROWSIE_ENV_FILE?.trim() || path.join(serverRoot, ".env"),
  override: false,
  quiet: true,
});

try {
  if (!(await serverIsReady())) {
    serverProcess = spawn(
      process.execPath,
      [path.join(serverRoot, ".output", "server", "index.mjs")],
      {
        cwd: serverRoot,
        env: {
          ...process.env,
          EVE_DEV: "1",
          HOST: "127.0.0.1",
          NODE_ENV: "production",
          PORT: String(port),
        },
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    serverProcess.stderr?.on("data", (chunk) => process.stderr.write(chunk));
    serverProcess.once("exit", (code) => {
      serverProcess = undefined;
      if (code && code !== 0) process.stderr.write(`Browsie server exited with code ${code}.\n`);
    });
    await waitForServer(30_000);
  }

  process.env.BROWSIE_MCP_SERVER_URL = serverUrl;
  process.stdin.once("end", shutdown);
  process.once("SIGINT", shutdownAndExit);
  process.once("SIGTERM", shutdownAndExit);
  const mcpEntry = new URL("./server.mjs", import.meta.url).href;
  await import(mcpEntry);
} catch (error) {
  shutdown();
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Browsie MCP could not start: ${message}\n`);
  process.exitCode = 1;
}

async function serverIsReady() {
  try {
    const response = await fetch(`${serverUrl}/eve/v1/health`, {
      signal: AbortSignal.timeout(750),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await serverIsReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `The Browsie server did not start within ${Math.round(timeoutMs / 1000)} seconds.`,
  );
}

function shutdown() {
  if (serverProcess && !serverProcess.killed) serverProcess.kill("SIGTERM");
}

function shutdownAndExit() {
  shutdown();
  process.exit(0);
}
