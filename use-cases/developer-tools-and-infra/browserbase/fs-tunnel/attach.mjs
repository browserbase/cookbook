#!/usr/bin/env node
/**
 * bb-fs-tunnel attach
 *
 * Connects to the Browserbase session created by launch-fs.mjs, injects the
 * tunnel auth header only on matching-origin requests (via CDP), and prints the live-view URL.
 *
 * Keep this running while you use the session — it holds the "key". Without
 * it, the session's requests hit the tunnel without the secret and get 401.
 *
 * Usage: node attach.mjs   (after launch-fs.mjs prints ---READY---)
 */

import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { installTunnelAuth } from "./tunnel-auth.mjs";

const cfgPath = path.join(tmpdir(), "bb-fs-tunnel-last-run.json");
let cfg;
try {
  cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
} catch {
  console.error(`ERROR: could not read ${cfgPath} — is launch-fs.mjs running?`);
  process.exit(2);
}

// Fetch the live-view (fullscreen debugger) URL
const dbg = await fetch(
  `https://api.browserbase.com/v1/sessions/${cfg.sessionId}/debug`,
  {
    headers: { "x-bb-api-key": process.env.BROWSERBASE_API_KEY },
  },
).then((r) => r.json());

const browser = await chromium.connectOverCDP(cfg.connectUrl);
const context = browser.contexts()[0];
const page = context.pages()[0];

// Scope authentication to this tunnel origin, including every redirect hop.
const cdp = await context.newCDPSession(page);
const removeTunnelAuth = await installTunnelAuth(cdp, cfg, () => {
  console.error("Tunnel authentication interception failed; request blocked.");
});

// Land on the directory listing so the demo starts somewhere visual.
// The quick tunnel's edge can lag behind the printed URL — retry briefly.
for (let attempt = 1; ; attempt++) {
  try {
    await page.goto(cfg.tunnelUrl + "/");
    break;
  } catch (e) {
    if (attempt >= 6) throw e;
    console.log(
      `  tunnel not ready yet (attempt ${attempt}), retrying in 3s...`,
    );
    await new Promise((r) => setTimeout(r, 3000));
  }
}

console.log("");
console.log("  LIVE VIEW (open this in your browser):");
console.log("  " + dbg.debuggerFullscreenUrl);
console.log("");
console.log("  Tunnel URL:  " + cfg.tunnelUrl);
console.log("  Shared dir:  " + cfg.sharedDir);
console.log("");
console.log("  Keep this process running — it injects the auth header.");
console.log("  Ctrl-C to detach.");

let detaching = false;
async function detach() {
  if (detaching) return;
  detaching = true;
  const deadline = setTimeout(() => process.exit(1), 5000);
  try {
    await removeTunnelAuth();
    await cdp.detach();
    clearTimeout(deadline);
    process.exit(0);
  } catch {
    console.error("Could not finish detaching tunnel authentication.");
    process.exit(1);
  }
}
process.once("SIGINT", detach);
process.once("SIGTERM", detach);

// Keep request interception active while the attachment is in use.
await new Promise(() => {});
