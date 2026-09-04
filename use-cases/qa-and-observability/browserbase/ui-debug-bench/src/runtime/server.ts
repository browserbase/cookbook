import { spawn, type ChildProcess } from "node:child_process";
import { waitForHttp } from "./process.js";

export interface DevServer {
  url: string;
  stop(): Promise<void>;
}

/** Start the target's dev server. `command` is the target.config serve string with "{port}" substituted. */
export async function startDevServer(workspace: string, command: string, port: number): Promise<DevServer> {
  const rendered = command.replaceAll("{port}", String(port));
  const [bin, ...args] = rendered.split(/\s+/);
  if (!bin) throw new Error(`Empty serve command for workspace ${workspace}`);
  const child = spawn(bin, args, {
    cwd: workspace,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk;
  });
  const url = `http://127.0.0.1:${port}`;
  const timeoutMs = Number(process.env.SERVER_START_TIMEOUT_MS ?? 60000);
  try {
    await Promise.race([
      waitForHttp(url, timeoutMs),
      new Promise<never>((_, reject) => {
        child.once("exit", (code, signal) => {
          reject(new Error(`Dev server exited before ${url} became reachable (code=${code}, signal=${signal}).`));
        });
      })
    ]);
  } catch (error) {
    await stopProcess(child);
    throw new Error([
      `Failed to start dev server (${rendered}) at ${url} from ${workspace}: ${error instanceof Error ? error.message : String(error)}`,
      stdout.trim() ? `stdout:\n${stdout.trim().slice(-4000)}` : "",
      stderr.trim() ? `stderr:\n${stderr.trim().slice(-4000)}` : ""
    ].filter(Boolean).join("\n\n"));
  }
  return {
    url,
    stop: () => stopProcess(child)
  };
}

function stopProcess(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once("close", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    }, 2000).unref();
  });
}
