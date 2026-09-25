import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import dotenv from "dotenv";

dotenv.config();

async function runWorkflow() {
  let browser: Awaited<ReturnType<typeof browserbase.launch>> | null = null;
  let stagehand: Stagehand | null = null;
  let success = false;

  try {
    const contextId = process.env.BROWSERBASE_CONTEXT_ID?.trim();
    const username = process.env.WORKDAY_USERNAME?.trim();
    const password = process.env.WORKDAY_PASSWORD;
    const accountSelector = process.env.WORKDAY_ACCOUNT_SELECTOR?.trim();
    const loginUrlValue = process.env.WORKDAY_LOGIN_URL?.trim();
    const authenticatedUrlValue = process.env.WORKDAY_AUTHENTICATED_URL?.trim();
    if (
      !username || !accountSelector || !loginUrlValue || !authenticatedUrlValue ||
      (!contextId && !password?.trim())
    ) {
      throw new Error("Missing required Workday configuration");
    }
    const loginUrl = new URL(loginUrlValue);
    const authenticatedUrl = new URL(authenticatedUrlValue);
    for (const url of [loginUrl, authenticatedUrl]) {
      if (
        !["https:", "http:"].includes(url.protocol) || url.username ||
        url.password || url.hash
      ) {
        throw new Error("Invalid Workday destination");
      }
    }
    if (
      authenticatedUrl.origin !== loginUrl.origin ||
      authenticatedUrl.pathname === loginUrl.pathname ||
      /(?:^|\/)(?:login|sign-?in|authgwy)(?:[/.]|$)/i.test(authenticatedUrl.pathname)
    ) {
      throw new Error("Configure a distinct authenticated Workday destination");
    }

    browser = await browserbase.launch({
      apiKey: process.env.BROWSERBASE_API_KEY!,
      browserSettings: {
        context: contextId ? { id: contextId, persist: true } : undefined,
      },
    });
    stagehand = await Stagehand.create({
      browser,
      model: {
        modelName: "google/gemini-2.5-flash",
        apiKey: process.env.GOOGLE_API_KEY,
      },
    });
    const page = (await browser.context.pages())[0];
    if (!page) throw new Error("Workday page unavailable");

    if (!contextId) {
      await page.goto(loginUrl.href, { timeout: 30_000 });
      // These selectors belong to the original native-login layout. Adapt them
      // to your configured tenant before running this example.
      const nativeLogin = await stagehand.act({
        description: "click the Workday Native Login option",
        method: "click",
        arguments: [],
        selector:
          "xpath=/html[1]/body[1]/div[1]/div[2]/div[1]/div[1]/div[2]/div[2]/div[1]/div[1]/div[1]/div[1]/div[2]/ul[1]/li[1]/div[1]",
      }, { page });
      if (nativeLogin.data.success !== true) {
        throw new Error("Native login action failed");
      }
      await page.locator(
        "xpath=/html[1]/body[1]/div[1]/div[2]/div[1]/div[1]/div[2]/div[2]/div[1]/div[1]/div[1]/div[1]/div[3]/div[1]/div[1]/input[1]",
      ).fill(username);
      await page.locator(
        "xpath=/html[1]/body[1]/div[1]/div[2]/div[1]/div[1]/div[2]/div[2]/div[1]/div[1]/div[1]/div[1]/div[3]/div[2]/div[1]/input[1]",
      ).fill(password!);
      const signIn = await stagehand.act({
        description: "click the Sign In button",
        method: "click",
        arguments: [],
        selector:
          "xpath=/html[1]/body[1]/div[1]/div[2]/div[1]/div[1]/div[2]/div[2]/div[1]/div[1]/div[1]/div[1]/div[3]/button[1]",
      }, { page });
      if (signIn.data.success !== true) throw new Error("Sign-in action failed");
    }

    const response = await page.goto(authenticatedUrl.href, { timeout: 30_000 });
    if (!response || !response.ok() || await page.url() !== authenticatedUrl.href) {
      throw new Error("Authenticated Workday destination unavailable");
    }
    if (!await page.waitForSelector(accountSelector, { state: "visible", timeout: 30_000 })) {
      throw new Error("Workday account witness did not appear");
    }
    const account = page.locator(accountSelector);
    if (
      await account.count() !== 1 || !await account.isVisible() ||
      (await account.innerText()).trim() !== username
    ) {
      throw new Error("Workday account witness did not match");
    }
    success = true;
  } catch {
    console.error("Workday workflow failed; verify configuration and account access.");
  } finally {
    if (stagehand) {
      try {
        await stagehand.close();
      } catch {
        success = false;
        console.error("Workday Stagehand cleanup failed.");
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch {
        success = false;
        console.error("Workday browser cleanup failed.");
      }
    }
  }
  if (success) console.log("Workday account verified and session closed.");
  return success ? { success: true } : { success: false, error: "Workday workflow failed" };
}

runWorkflow().then((result) => {
  console.log("Execution result:", result);
  process.exit(result.success ? 0 : 1);
});

export default runWorkflow;
