const { app, BrowserWindow, dialog, shell } = require("electron");
const { randomBytes } = require("node:crypto");
const { spawn } = require("node:child_process");
const { cp, mkdir, readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_PORT = 4318;
const DEFAULT_EVE_PORT = 4274;
const DEFAULT_MCP_HTTP_PORT = 4320;
const isMcpMode = process.argv.includes("--mcp");
let serverProcess;
let eveProcess;
let httpMcpProcess;
let quitting = false;

app.setName("Browsie");

app.whenReady().then(async () => {
  try {
    const serverUrl = await ensureBrowsieServer();
    process.env.BROWSIE_MCP_SERVER_URL = serverUrl;
    if (isMcpMode) {
      await import(resolveMcpEntry());
      return;
    }
    await ensureHttpMcpServer(serverUrl);
    createWindow(serverUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMcpMode) {
      process.stderr.write(`Browsie could not start: ${message}\n`);
      app.exit(1);
      return;
    }
    await dialog.showErrorBox("Browsie could not start", message);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" || isMcpMode) app.quit();
});

app.on("activate", () => {
  if (!isMcpMode && BrowserWindow.getAllWindows().length === 0) {
    createWindow(process.env.BROWSIE_MCP_SERVER_URL ?? localServerUrl());
  }
});

app.on("before-quit", () => {
  quitting = true;
  stopServer();
});

function createWindow(serverUrl) {
  const window = new BrowserWindow({
    backgroundColor: "#f7f5f2",
    height: 920,
    minHeight: 680,
    minWidth: 960,
    show: false,
    title: "Browsie",
    width: 1440,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(serverUrl)) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });
  void window.loadURL(serverUrl);
}

async function ensureBrowsieServer() {
  const configuredUrl = process.env.BROWSIE_DESKTOP_SERVER_URL?.trim();
  const serverUrl = configuredUrl || localServerUrl();
  const runtimeRoot = await prepareRuntime();
  await loadEnvironment(runtimeRoot);
  if (await serverIsReady(serverUrl)) return serverUrl;
  if (configuredUrl) {
    throw new Error(`No Browsie server is available at ${configuredUrl}.`);
  }

  const standaloneRoot = app.isPackaged
    ? runtimeRoot
    : path.join(runtimeRoot, ".next", "standalone");
  const eveEntry = path.join(runtimeRoot, ".output", "server", "index.mjs");
  eveProcess = spawn(process.execPath, [eveEntry], {
    cwd: standaloneRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      EVE_DEV: "1",
      HOST: "127.0.0.1",
      NODE_ENV: "production",
      PORT: String(DEFAULT_EVE_PORT),
    },
    stdio: isMcpMode ? ["ignore", "ignore", "pipe"] : "ignore",
  });
  eveProcess.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  eveProcess.once("exit", (code) => {
    eveProcess = undefined;
    if (!quitting && code !== 0) {
      process.stderr.write(`Browsie Eve server exited with code ${code ?? "unknown"}.\n`);
    }
  });
  await waitForEveServer(30_000);

  const serverEntry = path.join(standaloneRoot, "server.js");
  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: standaloneRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      EVE_DEV: "1",
      EVE_NEXT_PRODUCTION_PORT: String(DEFAULT_EVE_PORT),
      HOST: "127.0.0.1",
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      PORT: String(DEFAULT_PORT),
    },
    stdio: isMcpMode ? ["ignore", "ignore", "pipe"] : "ignore",
  });
  serverProcess.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  serverProcess.once("exit", (code) => {
    serverProcess = undefined;
    if (!quitting && code !== 0) {
      process.stderr.write(`Browsie server exited with code ${code ?? "unknown"}.\n`);
    }
  });
  await waitForServer(serverUrl, 30_000);
  return serverUrl;
}

async function ensureHttpMcpServer(serverUrl) {
  const httpServerUrl = `http://127.0.0.1:${DEFAULT_MCP_HTTP_PORT}`;
  if (await httpMcpServerIsReady(httpServerUrl)) return;

  const token = await loadOrCreateMcpToken();
  httpMcpProcess = spawn(process.execPath, [resolveHttpMcpEntry()], {
    env: {
      ...process.env,
      BROWSIE_MCP_HTTP_HOST: "127.0.0.1",
      BROWSIE_MCP_HTTP_PORT: String(DEFAULT_MCP_HTTP_PORT),
      BROWSIE_MCP_SERVER_URL: serverUrl,
      BROWSIE_MCP_TOKEN: token,
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: "ignore",
  });
  httpMcpProcess.once("exit", (code) => {
    httpMcpProcess = undefined;
    if (!quitting && code !== 0) {
      process.stderr.write(`Browsie HTTP MCP server exited with code ${code ?? "unknown"}.\n`);
    }
  });
  await waitForHttpMcpServer(httpServerUrl, 10_000);
}

async function loadOrCreateMcpToken() {
  const configuredToken = process.env.BROWSIE_MCP_TOKEN?.trim();
  if (configuredToken) return configuredToken;

  const tokenPath = path.join(app.getPath("userData"), "mcp-token");
  try {
    const savedToken = (await readFile(tokenPath, "utf8")).trim();
    if (savedToken) return savedToken;
  } catch {}

  const token = randomBytes(32).toString("base64url");
  await writeFile(tokenPath, `${token}\n`, { mode: 0o600 });
  return token;
}

async function prepareRuntime() {
  if (!app.isPackaged) return path.resolve(__dirname, "../..");
  const runtimeRoot = path.join(app.getPath("userData"), "runtime");
  const sourceRuntime = path.join(process.resourcesPath, "browsie-server");
  const markerPath = path.join(runtimeRoot, ".browsie-desktop-version");
  let installedVersion = "";
  try {
    installedVersion = (await readFile(markerPath, "utf8")).trim();
  } catch {}
  if (installedVersion !== app.getVersion()) {
    await mkdir(runtimeRoot, { recursive: true });
    await cp(sourceRuntime, runtimeRoot, { force: true, recursive: true });
    await writeFile(markerPath, `${app.getVersion()}\n`, { mode: 0o600 });
  }
  return runtimeRoot;
}

async function loadEnvironment(runtimeRoot) {
  const userData = app.getPath("userData");
  const environmentPath = path.join(userData, "browsie.env");
  const examplePath = path.join(userData, "browsie.env.example");
  await mkdir(userData, { recursive: true });
  try {
    await readFile(examplePath, "utf8");
  } catch {
    await writeFile(
      examplePath,
      [
        "# Copy this file to browsie.env and add your own values.",
        "STAGEHAND_BROWSER=browserbase",
        "BROWSERBASE_API_KEY=",
        "OPENAI_API_KEY=",
        "OP_SERVICE_ACCOUNT_TOKEN=",
        "",
      ].join("\n"),
      { mode: 0o600 },
    );
  }
  const { config } = require("dotenv");
  config({ path: environmentPath, override: false, quiet: true });
  process.env.BROWSIE_ARTIFACT_ROOT ??= path.join(userData, "run-artifacts");
  process.env.BROWSIE_CONTEXT_METADATA_PATH ??= path.join(userData, "contexts.json");
  process.env.BROWSIE_VAULT_FILE ??= path.join(userData, "vault.enc.json");
  process.env.BROWSIE_PUBLIC_URL ??= localServerUrl();

  if (!app.isPackaged) {
    const sourceEnvironment = path.join(runtimeRoot, ".env");
    config({ path: sourceEnvironment, override: false, quiet: true });
  }
}

function resolveMcpEntry() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "app.asar", "dist", "mcp", "server.mjs")
    : path.resolve(__dirname, "../dist/mcp/server.mjs");
}

function resolveHttpMcpEntry() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "app.asar", "dist", "mcp", "http-server.mjs")
    : path.resolve(__dirname, "../dist/mcp/http-server.mjs");
}

function localServerUrl() {
  return `http://127.0.0.1:${DEFAULT_PORT}`;
}

async function serverIsReady(serverUrl) {
  try {
    const response = await fetch(`${serverUrl}/eve/v1/health`, {
      signal: AbortSignal.timeout(750),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(serverUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await serverIsReady(serverUrl)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  stopServer();
  throw new Error(`Browsie did not start within ${Math.round(timeoutMs / 1000)} seconds.`);
}

async function waitForEveServer(timeoutMs) {
  const healthUrl = `http://127.0.0.1:${DEFAULT_EVE_PORT}/eve/v1/health`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, {
        signal: AbortSignal.timeout(750),
      });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  stopServer();
  throw new Error("The Browsie Eve server did not start.");
}

async function httpMcpServerIsReady(serverUrl) {
  try {
    const response = await fetch(`${serverUrl}/health`, {
      signal: AbortSignal.timeout(750),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHttpMcpServer(serverUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await httpMcpServerIsReady(serverUrl)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  stopServer();
  throw new Error("The local MCP bridge did not start.");
}

function stopServer() {
  if (httpMcpProcess && !httpMcpProcess.killed) {
    httpMcpProcess.kill("SIGTERM");
  }
  if (serverProcess && !serverProcess.killed) serverProcess.kill("SIGTERM");
  if (eveProcess && !eveProcess.killed) eveProcess.kill("SIGTERM");
}
