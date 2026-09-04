import "dotenv/config";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  createContext,
  createLoginSession,
  liveViewUrl,
  makeBrowserbase,
  preNavigate,
  releaseSession,
  upsertEnv,
  waitUntilReleased,
} from "./lib/browserbase.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
// Defaults to Square, matching the demo repo. Override with START_URL in .env.
const START_URL = process.env.START_URL || "https://squareup.com/us/en";
const ENV_PATH = resolve(__dirname, ".env");

const sessions = new Map();
const app = express();
app.use((req, res, next) => {
  const allowedHosts = [`localhost:${PORT}`, `127.0.0.1:${PORT}`];
  if (!allowedHosts.includes(req.get("host"))) return res.status(403).json({ error: "Local host required" });
  const origin = req.get("origin");
  if (origin && !allowedHosts.some(host => origin === `http://${host}`)) return res.status(403).json({ error: "Local origin required" });
  next();
});
app.use(express.json());
app.use(express.static(resolve(__dirname, "public")));

/**
 * Start a login session.
 * 1. Create a fresh context (will hold the saved login).
 * 2. Start a session bound to it (persist + keepAlive).
 * 3. Open the login page so the Live View lands on it.
 * 4. Return the interactive Live View URL for the iframe.
 */
app.post("/api/session", async (_req, res) => {
  try {
    const bb = makeBrowserbase();
    const contextId = await createContext(bb);
    const { sessionId, connectUrl } = await createLoginSession(bb, contextId);
    await preNavigate(connectUrl, START_URL).catch((err) => {
      // Non-fatal: if pre-navigation fails the Live View just opens on a blank tab.
      console.warn("pre-navigation failed (continuing):", err.message);
    });
    const url = await liveViewUrl(bb, sessionId);
    const finishToken = randomBytes(32).toString("hex");
    sessions.set(sessionId, { contextId, finishToken, finishing: false });
    res.json({ contextId, sessionId, finishToken, liveViewUrl: url, startUrl: START_URL });
  } catch (err) {
    console.error("POST /api/session failed:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Finish a login session.
 * 1. Ask Browserbase to end the session (this flushes the login into the context).
 * 2. Wait until it is no longer running.
 * 3. Save the context id (demo: into .env; in production: your database).
 */
app.post("/api/finish", async (req, res) => {
  try {
    const { sessionId, contextId, finishToken } = req.body ?? {};
    if (![sessionId, contextId].every(value => typeof value === "string" && /^[A-Za-z0-9_-]+$/.test(value))) {
      return res
        .status(400)
        .json({ error: "sessionId and contextId must be plain identifiers" });
    }
    const owned = sessions.get(sessionId);
    if (!owned || owned.contextId !== contextId || typeof finishToken !== "string" || owned.finishToken !== finishToken) {
      return res.status(403).json({ error: "Session ownership could not be verified" });
    }
    if (owned.finishing) return res.status(409).json({ error: "Session finish already in progress" });
    owned.finishing = true;
    const bb = makeBrowserbase();
    await releaseSession(bb, sessionId);
    await waitUntilReleased(bb, sessionId);
    await upsertEnv(ENV_PATH, "CONTEXT_ID", contextId);
    sessions.delete(sessionId);
    res.json({ contextId, status: "saved" });
  } catch (err) {
    const owned = sessions.get(req.body?.sessionId);
    if (owned) owned.finishing = false;
    console.error("POST /api/finish failed:", err);
    res.status(500).json({ error: err.message });
  }
});

/** Open a URL in the default browser, best-effort. Set NO_OPEN=1 to skip (e.g. on a server). */
function openInBrowser(url) {
  if (process.env.NO_OPEN) return;
  const cmd =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  try {
    spawn(cmd[0], cmd[1], { detached: true, stdio: "ignore" }).unref();
  } catch {
    // Best-effort only — the URL is printed below as a fallback.
  }
}

app.listen(PORT, "127.0.0.1", () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  Live View starter running at ${url}`);
  console.log(`  Login page: ${START_URL}\n`);
  openInBrowser(url);
});
