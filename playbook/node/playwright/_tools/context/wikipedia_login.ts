import { config } from "dotenv";
import { chromium, BrowserContext } from "playwright-core";
import { Browserbase } from "@browserbasehq/sdk";

config(); // Load environment variables from .env

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });

async function createContext(): Promise<string> {
  /**
   * Creates a new context using the Browserbase SDK and returns the context ID.
   */
  const context = await bb.contexts.create({
  });
  console.log("Context ID:", context.id);
  return context.id;
}

async function createSession(contextId: string) {
  /**
   * Creates a new session using the Browserbase SDK and returns the session object.
   */
  const session = await bb.sessions.create({
    browserSettings: {
      context: {
        id: contextId,
        persist: true,
      },
    },
  });
  return session;
}

async function createDebugUrl(sessionId: string) {
  const data = await bb.sessions.debug(sessionId);
  console.log("Debugger URL:", data.debuggerFullscreenUrl);
}

(async () => {
  // Create a context ID to use in the session
  const contextId = await createContext();

  // Connect to the session
  const session = await createSession(contextId);
  const browser = await chromium.connectOverCDP(session.connectUrl);

  // Create a debug URL to view and interact with the session while it is running
  await createDebugUrl(session.id);

  // Get the context and page from the browser
  const context: BrowserContext = browser.contexts()[0];
  const page = context.pages()[0] || (await context.newPage());

  // Navigate to the Wikipedia page
  await page.goto("https://en.wikipedia.org/w/index.php");

  // wait for user to press enter after logging in
  console.log("Press enter to continue after logging in...");
  await new Promise((resolve) =>
    process.stdin.once("data", () => resolve(void 0)),
  );

  await browser.close();

  /////////////////////////////////////////////////////////////////////////////
  // Create a new session using the same context
  /////////////////////////////////////////////////////////////////////////////

  // wait 10 seconds for the context to be ready
  console.log("Waiting for context to be ready...");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Create a new session
  const session2 = await createSession(contextId);
  const browser2 = await chromium.connectOverCDP(session2.connectUrl);

  const context2: BrowserContext = browser2.contexts()[0];
  const page2 = context2.pages()[0] || (await context2.newPage());

  await createDebugUrl(session2.id);

  // Navigate to the Wikipedia page
  await page2.goto("https://en.wikipedia.org/w/index.php");

  // wait for 10 seconds
  await new Promise((resolve) => setTimeout(resolve, 10000));

  await browser2.close();
})();
