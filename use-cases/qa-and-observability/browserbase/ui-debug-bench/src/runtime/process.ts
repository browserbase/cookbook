import { spawn } from "node:child_process";

export interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  code: number | null;
  wallClockMs: number;
  timedOut: boolean;
}

export function runCommand(command: string, args: string[], opts: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}): Promise<CommandResult> {
  const start = Date.now();
  const rendered = [command, ...args.map((arg) => JSON.stringify(arg))].join(" ");
  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    const finish = (code: number | null, extraStderr = "") => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      const timeoutMessage = timedOut ? `\nTimed out after ${opts.timeoutMs}ms` : "";
      resolve({
        command: rendered,
        stdout,
        stderr: `${stderr}${extraStderr}${timeoutMessage}`.trim(),
        code,
        wallClockMs: Date.now() - start,
        timedOut
      });
    };
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let killTimer: NodeJS.Timeout | undefined;
    const timeout = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
          killTimer = setTimeout(() => {
            if (!settled) child.kill("SIGKILL");
            setTimeout(() => finish(null, "\nProcess did not close after SIGKILL."), 500);
          }, 2000);
        }, opts.timeoutMs)
      : undefined;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      finish(code);
    });
    child.on("error", (error) => {
      finish(127, `\n${error.message}`);
    });
  });
}

export async function waitForHttp(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  let lastError = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastError = `${res.status} ${res.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}
