import { spawn, type ChildProcess } from "node:child_process";
import { access, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { waitForHttp } from "../runtime/process.js";

export interface LaunchedCdpBrowser {
  endpoint: string;
  executable: string;
  userDataDir: string;
  stop(): Promise<void>;
}

export async function launchCdpBrowser(): Promise<LaunchedCdpBrowser> {
  const executable = await findChromeExecutable();
  const port = Number(process.env.BROWSE_CDP_PORT ?? (9300 + Math.floor(Math.random() * 500)));
  const userDataDir = join(tmpdir(), `ui-debug-bench-cdp-${randomUUID()}`);
  const child = spawn(executable, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "about:blank"
  ], {
    stdio: ["ignore", "ignore", "pipe"]
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  try {
    await waitForHttp(`http://127.0.0.1:${port}/json/version`, Number(process.env.BROWSE_CDP_LAUNCH_TIMEOUT_MS ?? 15000));
  } catch (error) {
    await stopProcess(child, userDataDir);
    throw new Error(`Timed out launching CDP browser at port ${port}: ${error instanceof Error ? error.message : String(error)}${stderr ? `\n${stderr.slice(-1000)}` : ""}`);
  }
  return {
    endpoint: String(port),
    executable,
    userDataDir,
    stop: () => stopProcess(child, userDataDir)
  };
}

async function findChromeExecutable(): Promise<string> {
  // Prefer real browser installs; playwright's cached Chromium can be a stale
  // version that exists on disk but fails to serve CDP.
  const candidates = [
    process.env.BROWSE_CHROME,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    await playwrightChromiumExecutable()
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error("No Chrome/Chromium executable found. Set BROWSE_CHROME to enable BROWSE_TARGET=cdp-launch.");
}

async function playwrightChromiumExecutable(): Promise<string | undefined> {
  try {
    const require = createRequire(import.meta.url);
    const playwright = require("playwright") as { chromium?: { executablePath(): string } };
    return playwright.chromium?.executablePath();
  } catch {
    return undefined;
  }
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

function stopProcess(child: ChildProcess, userDataDir: string): Promise<void> {
  return new Promise((resolve) => {
    const cleanup = async () => {
      await rm(userDataDir, { recursive: true, force: true });
      resolve();
    };
    if (child.exitCode !== null) {
      void cleanup();
      return;
    }
    child.once("close", () => {
      void cleanup();
    });
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    }, 2000).unref();
  });
}
