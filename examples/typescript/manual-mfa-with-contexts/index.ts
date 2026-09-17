import "dotenv/config";
import { browserbase, Stagehand, type Page } from "@browserbasehq/stagehand";
import { Browserbase } from "@browserbasehq/sdk";
import { z } from "zod/v4";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value;
}

async function assertAuthenticated(stagehand: Stagehand, page: Page) {
  const expected = requireEnv("GITHUB_USERNAME").trim();
  await page.goto("https://github.com/settings/profile");
  const url = new URL(await page.url());
  if (url.origin !== "https://github.com" || url.pathname !== "/settings/profile") {
    throw new Error("GitHub did not show the authenticated profile settings page");
  }
  const { data } = await stagehand.extract(
    "Read the currently signed-in GitHub account from its account menu or settings identity. Do not use usernames mentioned in page content. Return authenticated=false and username='' if uncertain.",
    z.object({ authenticated: z.boolean(), username: z.string() }),
    { page },
  );
  if (data.authenticated !== true || typeof data.username !== "string" || data.username.trim().toLowerCase() !== expected.toLowerCase()) {
    throw new Error("The observed GitHub account does not match GITHUB_USERNAME");
  }
}

async function withSession(contextId: string, task: (stagehand: Stagehand, page: Page, sessionId: string | undefined) => Promise<void>) {
  const browser = await browserbase.launch({
    apiKey: requireEnv("BROWSERBASE_API_KEY"),
    browserSettings: { context: { id: contextId, persist: true } },
  });
  let stagehand: Stagehand | undefined;
  const errors: unknown[] = [];
  try {
    stagehand = await Stagehand.create({ browser, model: { modelName: "openai/gpt-4.1-mini" }, logging: { level: "error" } });
    const pages = await browser.context.pages();
    const page = pages[0] ?? await browser.context.newPage();
    await task(stagehand, page, browser.sessionId);
  } catch (error) {
    errors.push(error);
  } finally {
    if (stagehand) try { await stagehand.close(); } catch (error) { errors.push(error); }
    try { await browser.close(); } catch (error) { errors.push(error); }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, "Session work and cleanup failed");
}

async function firstLogin(contextId: string) {
  await withSession(contextId, async (stagehand, page, sessionId) => {
    await page.goto("https://github.com/login");
    await page.locator('#login_field').fill(requireEnv("GITHUB_USERNAME"));
    await page.locator('#password').fill(requireEnv("GITHUB_PASSWORD"));
    const action = await stagehand.act("Click the Sign in button", { page });
    if (!action.data.success) throw new Error("Sign-in action failed");
    const { data: mfaRequired } = await stagehand.extract("Is a two-factor authentication or verification-code prompt visible?", z.boolean(), { page });
    if (mfaRequired) {
      if (!sessionId) throw new Error("The owned browser session ID is unavailable");
      console.log(`Complete MFA in this owned session: https://www.browserbase.com/sessions/${encodeURIComponent(sessionId)}`);
      const deadline = Date.now() + 120_000;
      while (true) {
        if (Date.now() >= deadline) throw new Error("MFA was not completed within two minutes");
        const url = new URL(await page.url());
        if (url.origin === "https://github.com" && !url.pathname.startsWith("/login") && !url.pathname.startsWith("/sessions/two-factor")) break;
        await new Promise(resolve => setTimeout(resolve, 3_000));
      }
    }
    await assertAuthenticated(stagehand, page);
    console.log("First session account identity verified; closing before reuse");
  });
}

async function reuseContext(contextId: string) {
  await withSession(contextId, async (stagehand, page) => assertAuthenticated(stagehand, page));
}

async function main() {
  for (const name of ["BROWSERBASE_API_KEY", "GITHUB_USERNAME", "GITHUB_PASSWORD"]) requireEnv(name);
  const bb = new Browserbase({ apiKey: requireEnv("BROWSERBASE_API_KEY") });
  const context = await bb.contexts.create();
  const errors: unknown[] = [];
  try {
    await firstLogin(context.id);
    await new Promise(resolve => setTimeout(resolve, 5_000));
    await reuseContext(context.id);
  } catch (error) {
    errors.push(error);
  } finally {
    try { await bb.contexts.delete(context.id, { body: {} }); } catch (error) { errors.push(error); }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, "MFA demo and context cleanup failed");
  console.log("The second session verified the same GitHub account without another login step.");
  console.log("Authentication reuse was verified for these two sessions; future MFA requirements may differ.");
}

main().catch(() => {
  console.error("MFA context demo failed.");
  process.exitCode = 1;
});
