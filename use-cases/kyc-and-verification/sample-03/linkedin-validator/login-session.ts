import "dotenv/config";
import { chromium } from "playwright-core";

// ============================================================
// LinkedIn Login Session
// ============================================================
// Creates (or reuses) a Browserbase persistent context, opens
// a session with stealth + proxy, and navigates to LinkedIn
// so you can log in manually.
//
// After logging in, the cookies persist in the context. Then
// use --context <id> with the validator to access any profile.
//
// Usage:
//   npx tsx login-session.ts              # creates new context
//   npx tsx login-session.ts <contextId>  # reuses existing context
// ============================================================

const API_KEY = process.env.BROWSERBASE_API_KEY!;
const PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID!;

async function createContext(): Promise<string> {
  const res = await fetch("https://api.browserbase.com/v1/contexts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bb-api-key": API_KEY,
    },
    body: JSON.stringify({ projectId: PROJECT_ID }),
  });
  const data = (await res.json()) as { id: string };
  return data.id;
}

async function createSession(contextId: string): Promise<{ id: string }> {
  const res = await fetch("https://api.browserbase.com/v1/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bb-api-key": API_KEY,
    },
    body: JSON.stringify({
      projectId: PROJECT_ID,
      browserSettings: {
        context: { id: contextId, persist: true },
        advancedStealth: true,
        blockAds: true,
      },
      proxies: [
        {
          type: "browserbase",
          geolocation: { country: process.env.PROXY_COUNTRY || "US" },
        },
      ],
      keepAlive: true,
    }),
  });
  return (await res.json()) as { id: string };
}

async function main() {
  // Use provided context ID, or env var, or create a new one
  let contextId = process.argv[2] || process.env.BROWSERBASE_CONTEXT_ID || null;

  if (!contextId) {
    console.log("\n📦 Creating new Browserbase persistent context...");
    contextId = await createContext();
    console.log(`✅ Context created: ${contextId}`);
    console.log(
      `\n💡 Save this in your .env as BROWSERBASE_CONTEXT_ID=${contextId}\n`,
    );
  } else {
    console.log(`\n📦 Reusing context: ${contextId}`);
  }

  console.log("🚀 Creating session with stealth + proxy...");
  const session = await createSession(contextId);
  const sessionId = session.id;

  console.log(`📺 Session ID: ${sessionId}`);
  console.log(
    `🖥️  Watch live: https://www.browserbase.com/sessions/${sessionId}`,
  );

  // Connect and navigate to LinkedIn
  const connectUrl = `wss://connect.browserbase.com/?apiKey=${API_KEY}&sessionId=${sessionId}`;
  const browser = await chromium.connectOverCDP(connectUrl);
  const context = browser.contexts()[0];
  const pages = context.pages();
  const page = pages[0] || (await context.newPage());

  console.log("🌐 Navigating to LinkedIn login page...");
  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "networkidle",
    timeout: 30000,
  });

  console.log(`✅ Page loaded: ${page.url()}`);
  console.log(`📄 Title: ${await page.title()}`);
  console.log(
    "\n" +
      "=".repeat(60) +
      "\n" +
      "👉 Go to this URL to log in manually:\n" +
      `   https://www.browserbase.com/sessions/${sessionId}\n` +
      "=".repeat(60) +
      "\n",
  );
  console.log("⏳ Session is kept alive. Log in, then press Ctrl+C.");
  console.log("   Your cookies will be saved to the context automatically.\n");
  console.log("After logging in, use the validator with:");
  console.log(
    `   ./node_modules/.bin/tsx linkedin-validator.ts --context ${contextId}\n`,
  );

  // Keep alive
  await new Promise(() => {});
}

main().catch(console.error);
