import * as braintrust from "braintrust";
import { z } from "zod";
import { chromium } from "playwright-core";
import { withBrowserSession } from "./browser-lifecycle";

// Create a session with Browserbase
async function createSession() {
  const response = await fetch(`https://api.browserbase.com/v1/sessions`, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      "x-bb-api-key": `${process.env.BROWSERBASE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      proxies: true,
      keepAlive: true,
      timeout: 300,
    }),
  });
  if (!response.ok) throw new Error(`Browserbase session creation failed (HTTP ${response.status})`);
  const json: unknown = await response.json().catch(() => { throw new Error("Browserbase returned invalid JSON"); });
  const parsed = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) }).safeParse(json);
  if (!parsed.success) throw new Error("Browserbase returned an invalid session ID");
  return parsed.data;
}

async function releaseSession(id: string) {
  const response = await fetch(`https://api.browserbase.com/v1/sessions/${encodeURIComponent(id)}`, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: { "x-bb-api-key": process.env.BROWSERBASE_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "REQUEST_RELEASE" }),
  });
  if (!response.ok) throw new Error(`Browserbase session release failed (HTTP ${response.status})`);
}

// Load page from the internet
async function loadPage({ url }: { url: string }) {
  const { id } = await createSession();
  return withBrowserSession(
    () => chromium.connectOverCDP(
      `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}&sessionId=${id}`,
      { timeout: 10000 },
    ),
    () => releaseSession(id),
    async browser => {
      const defaultContext = browser.contexts()[0];
      const page = defaultContext.pages()[0];
      await page.goto(url);
      const readable: { title?: string; textContent?: string } = await page.evaluate(`
        import('https://cdn.skypack.dev/@mozilla/readability').then(readability => {
          return new readability.Readability(document).parse()
        })`);
      return { page: `${readable.title}\n${readable.textContent}` };
    },
  );
}

// Create a new project and tool in Braintrust
const project = braintrust.projects.create({ name: "Browserbase API Tool" });

project.tools.create({
  handler: loadPage,
  parameters: z.object({
    url: z.string(),
  }),
  returns: z.object({
    page: z.string(),
  }),
  name: "Load page",
  slug: "load-page",
  description: "Load a page from the internet",
  ifExists: "replace",
});