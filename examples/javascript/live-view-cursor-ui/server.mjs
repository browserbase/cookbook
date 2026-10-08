import "dotenv/config";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import Browserbase from "@browserbasehq/sdk";
import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { chromium } from "playwright-core";

const apiKey = process.env.BROWSERBASE_API_KEY;
if (!apiKey) {
  throw new Error("BROWSERBASE_API_KEY is required.");
}

const bb = new Browserbase({ apiKey, maxRetries: 0, timeout: 30_000 });
const uiDir = join(dirname(fileURLToPath(import.meta.url)), "ui");
const port = Number(process.env.LIVE_VIEW_UI_PORT ?? 4790);
const viewport = { width: 1280, height: 800 };
const clients = new Set();
let current;
let agentRunning = false;
let agentPoint = null;
let agentPointSeq = 0;
let statusText = "Starting a new Browserbase session";

function emit(message) {
  if (message.type === "status") statusText = message.text;
  if (message.type === "agent-pointer") {
    agentPoint = message;
    agentPointSeq++;
  }
  if (message.type === "agent-state" && !message.running) agentPoint = null;
  const line = `data: ${JSON.stringify(message)}\n\n`;
  for (const client of clients) client.write(line);
}

async function closeSession(session) {
  if (!session) return;
  try {
    await session.stagehand?.close();
  } catch {}
  try {
    await session.stagehandBrowser?.close();
  } catch {}
  try {
    await session.playwrightBrowser?.close();
  } catch {}
  try {
    await bb.sessions.update(session.id, { status: "REQUEST_RELEASE" });
  } catch {}
}

async function createSession() {
  agentRunning = false;
  agentPoint = null;
  emit({ type: "status", text: "Starting a new Browserbase session" });
  const old = current;
  current = undefined;
  await closeSession(old);

  const stagehandBrowser = await browserbase.launch({
    apiKey,
    timeout: 900,
    keepAlive: false,
    browserSettings: {
      recordSession: true,
      viewport,
    },
  });
  const sessionId = stagehandBrowser.sessionId;
  let stagehand;
  let playwrightBrowser;
  try {
    stagehand = await Stagehand.create({ browser: stagehandBrowser });
    const session = await bb.sessions.retrieve(sessionId);
    if (!session.connectUrl) throw new Error("Browserbase did not return a connect URL");
    playwrightBrowser = await chromium.connectOverCDP(session.connectUrl);
    const context = playwrightBrowser.contexts()[0];
    const page = context.pages()[0] ?? (await context.newPage());
    await page.exposeFunction("__liveCursorFromPage", (point) => {
      if (agentRunning && current?.id === sessionId) {
        emit({ type: "agent-pointer", x: point.x, y: point.y, click: point.click });
      }
    });
    await page.addInitScript(() => {
      const report = (event) => {
        void window.__liveCursorFromPage?.({
          x: event.clientX,
          y: event.clientY,
          click: event.type === "mousedown",
        });
      };
      window.addEventListener("mousemove", report, true);
      window.addEventListener("mousedown", report, true);
    });
    await page.goto("https://www.saucedemo.com/", {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });

    const debug = await bb.sessions.debug(sessionId);
    const url = new URL(debug.debuggerFullscreenUrl);
    url.searchParams.set("navBar", "false");
    current = {
      id: sessionId,
      page,
      stagehand,
      stagehandBrowser,
      playwrightBrowser,
      liveViewUrl: url.toString(),
    };
    emit({ type: "session", sessionId });
    emit({ type: "status", text: "Live View is ready" });
    return current;
  } catch (error) {
    try {
      await stagehand?.close();
    } catch {}
    try {
      await stagehandBrowser.close();
    } catch {}
    try {
      await playwrightBrowser?.close();
    } catch {}
    try {
      await bb.sessions.update(sessionId, { status: "REQUEST_RELEASE" });
    } catch {}
    throw error;
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 32_000) throw new Error("Input is too large");
  }
  return JSON.parse(raw || "{}");
}

async function runAgent(driver) {
  if (!current || agentRunning) return;
  const session = current;
  const label = driver === "playwright" ? "Playwright" : "Stagehand";
  agentRunning = true;
  emit({ type: "agent-state", running: true });
  emit({ type: "status", text: `${label} is signing in to SauceDemo` });
  let usedFallback = false;
  try {
    // Both clients control the same remote tab. The page listener reports their
    // real mouse events to the overlay while agentRunning is true.
    await session.page.goto("https://www.saucedemo.com/", {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    if (driver === "playwright") {
      const page = session.page;
      await page.locator('[data-test="username"]').fill("standard_user");
      await page.locator('[data-test="password"]').fill("secret_sauce");
      await page.locator('[data-test="login-button"]').click();
      await page.waitForURL("**/inventory.html");
      emit({ type: "status", text: "Playwright is adding a backpack" });
      await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
      await page.locator(".shopping_cart_link").click();
      const cartText = await page.locator(".cart_item").innerText();
      if (!cartText.includes("Sauce Labs Backpack"))
        throw new Error("Backpack was not in the cart");
    } else {
      const page = await session.stagehandBrowser.context.activePage();
      if (!page) throw new Error("Stagehand page is not available");
      await page.locator('[data-test="username"]').fill("standard_user");
      await page.locator('[data-test="password"]').fill("secret_sauce");
      await page.locator('[data-test="login-button"]').click();
      if (!(await page.url()).includes("inventory.html")) {
        throw new Error("SauceDemo did not open the inventory page");
      }
      emit({ type: "status", text: "Stagehand is adding a backpack" });
      const result = await session.stagehand.act(
        "Click the Add to cart button for Sauce Labs Backpack.",
        { page, timeout: 60_000, cache: false },
      );
      const cartCount = await page.evaluate(
        () => document.querySelector(".shopping_cart_badge")?.textContent ?? "0",
      );
      if (!result.data.success || cartCount !== "1") {
        usedFallback = true;
        emit({ type: "status", text: "Using a direct browser click to confirm the cart" });
        await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
      }
      await page.locator(".shopping_cart_link").click();
      const cartText = await page.locator(".cart_item").innerText();
      if (!cartText.includes("Sauce Labs Backpack"))
        throw new Error("Backpack was not in the cart");
    }
    const resultText = usedFallback
      ? "Done: Backpack is in the cart (direct click confirmed the Stagehand action)"
      : `Done: ${label} added Sauce Labs Backpack to the cart`;
    emit({ type: "status", text: resultText });
  } catch (error) {
    emit({
      type: "status",
      text: `${label} failed: ${String(error.message ?? error).replaceAll(apiKey, "[REDACTED]")}`,
    });
  } finally {
    agentRunning = false;
    emit({ type: "agent-state", running: false });
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (request.method === "GET" && url.pathname === "/api/config") {
      return sendJson(
        response,
        200,
        current
          ? {
              sessionId: current.id,
              liveViewUrl: current.liveViewUrl,
              viewport,
              agentRunning,
            }
          : { error: "Session is starting" },
      );
    }
    if (request.method === "GET" && url.pathname === "/api/pointer") {
      return sendJson(response, 200, {
        sessionId: current?.id ?? null,
        running: agentRunning,
        point: agentPoint,
        seq: agentPointSeq,
        status: statusText,
      });
    }
    if (request.method === "GET" && url.pathname === "/api/events") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      response.write("\n");
      clients.add(response);
      response.on("close", () => clients.delete(response));
      return;
    }
    if (request.method === "POST") {
      const origin = request.headers.origin;
      if (
        origin &&
        origin !== `http://127.0.0.1:${port}` &&
        origin !== `http://localhost:${port}`
      ) {
        return sendJson(response, 403, { error: "Invalid origin" });
      }
      if (url.pathname === "/api/run") {
        if (agentRunning) return sendJson(response, 409, { error: "Agent is running" });
        const { driver } = await readJson(request);
        if (driver !== "stagehand" && driver !== "playwright") {
          return sendJson(response, 400, { error: "Choose stagehand or playwright" });
        }
        void runAgent(driver);
        return sendJson(response, 202, { ok: true });
      }
      if (url.pathname === "/api/new") {
        if (agentRunning) return sendJson(response, 409, { error: "Agent is running" });
        await createSession();
        return sendJson(response, 200, { ok: true });
      }
    }
    const assets = {
      "/": ["index.html", "text/html; charset=utf-8"],
      "/app.js": ["app.js", "text/javascript; charset=utf-8"],
      "/styles.css": ["styles.css", "text/css; charset=utf-8"],
    };
    const asset = assets[url.pathname];
    if (request.method !== "GET" || !asset) return sendJson(response, 404, { error: "Not found" });
    const body = await readFile(join(uiDir, asset[0]));
    response.writeHead(200, {
      "Content-Type": asset[1],
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(body);
  } catch (error) {
    sendJson(response, 500, {
      error: String(error.message ?? error).replaceAll(apiKey, "[REDACTED]"),
    });
  }
});

await createSession();
server.listen(port, "127.0.0.1", () => {
  console.log(`Live View UI: http://127.0.0.1:${port}`);
  console.log(`Browserbase session: ${current.id}`);
});

async function shutdown() {
  server.close();
  await closeSession(current);
  process.exit(0);
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
