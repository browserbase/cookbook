import "dotenv/config";
import { defineFn } from "@browserbasehq/sdk-functions";
import { browserbase, Stagehand, type Page } from "@browserbasehq/stagehand";
import { z } from "zod/v4";

const origin = "https://www.browserbase.com";
// Upload node_modules/@browserbasehq/stagehand/dist/assets/stagehand-extension.zip
// with `browse cloud extensions upload`, then paste its ID here before publishing.
const extensionId = "REPLACE_WITH_UPLOADED_STAGEHAND_EXTENSION_ID";

type LoginStage = "connect" | "email" | "password" | "verification";
type LoginResult =
  | { status: "authenticated"; sessionId: string }
  | { status: "not_authenticated"; stage: LoginStage; sessionId: string };

async function submitCredential(
  stagehand: Stagehand,
  page: Page,
  field: "email" | "password",
  value: string,
) {
  const visible = await page.waitForSelector(`input[type="${field}"]`, {
    state: "visible",
    timeout: 20_000,
  });
  if (!visible) throw new Error("Expected credential field is not visible");
  const { data: actions } = await stagehand.observe(
    `Find only the button that submits the ${field} sign-in form. Do not select Google, SSO, sign-up, or password-reset links.`,
    { page },
  );
  const [submit] = actions;
  if (actions.length !== 1 || !submit?.selector) {
    throw new Error("Could not identify a unique sign-in submit button");
  }
  if (new URL(await page.url()).origin !== origin) {
    throw new Error("Login left the expected Browserbase origin");
  }
  // Discover controls before filling; never interpolate credentials into an AI prompt.
  await page.locator(`input[type="${field}"]`).fill(value);
  await page.locator(submit.selector).click();
}

export default defineFn(
  "browserbase-login",
  async (context): Promise<LoginResult> => {
    // Provision Secrets once with the Browserbase CLI (`npm install -g browse`):
    // browse cloud secrets create BROWSERBASE_API_KEY
    // browse cloud secrets create BROWSERBASE_LOGIN_EMAIL
    // browse cloud secrets create BROWSERBASE_LOGIN_PASSWORD
    // Enter values at the CLI prompts; never put them in this source or invocation params.
    // After publishing, attach each returned Secret ID to the Function ID:
    // browse functions secrets attach <function-id> <secret-id>
    // Verify all three attachments: browse functions secrets list <function-id>
    // Attached values arrive in context.secrets; .env is the local-dev fallback.
    const secret = (name: string) => {
      const value = context.secrets?.[name] ?? process.env[name];
      if (!value) throw new Error(`Missing secret: ${name}`);
      return value;
    };
    const apiKey = secret("BROWSERBASE_API_KEY");
    const email = secret("BROWSERBASE_LOGIN_EMAIL");
    const password = secret("BROWSERBASE_LOGIN_PASSWORD");
    let stage: LoginStage = "connect";
    let browser: Awaited<ReturnType<typeof browserbase.connect>> | undefined;
    let stagehand: Stagehand | undefined;
    try {
      browser = await browserbase.connect({ apiKey, sessionId: context.session.id });
      stagehand = await Stagehand.create({ browser });
      const page = (await browser.context.activePage()) ?? (await browser.context.newPage());
      await page.goto(`${origin}/sign-in`);

      stage = "email";
      await submitCredential(stagehand, page, "email", email);
      stage = "password";
      await submitCredential(stagehand, page, "password", password);

      stage = "verification";
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const url = new URL(await page.url());
        if (url.origin !== origin) break;
        if (!url.pathname.startsWith("/sign-in")) {
          const { data } = await stagehand.extract(
            "Is the authenticated Browserbase application dashboard visible, with project navigation and session or usage controls? Return false for marketing pages, login forms, verification/MFA challenges, onboarding, and uncertain states. Do not extract account information or credentials.",
            z.object({ authenticated: z.boolean() }),
            { page },
          );
          if (data.authenticated) {
            return { status: "authenticated", sessionId: context.session.id };
          }
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      return { status: "not_authenticated", stage, sessionId: context.session.id };
    } catch {
      // SDK errors can contain page or request data; return only the failed step.
      return { status: "not_authenticated", stage, sessionId: context.session.id };
    } finally {
      let cleanupFailed = false;
      try {
        await stagehand?.close();
      } catch {
        cleanupFailed = true;
      }
      try {
        await browser?.close();
      } catch {
        cleanupFailed = true;
      }
      if (cleanupFailed) throw new Error("Login session cleanup failed");
    }
  },
  { sessionConfig: { extensionId, browserSettings: { recordSession: true, logSession: false } } },
);
