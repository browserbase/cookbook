import { Browserbase } from "@browserbasehq/sdk";
import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import {
  atStep,
  createCardBrowserTokens,
  loadConfig,
  RecipeError,
  safeMessage,
  type AppConfig,
  type EncryptedCard,
} from "./evervault.js";
import { startFixture } from "./local.js";
export type Runtime = {
  tokens: typeof createCardBrowserTokens;
  launch: typeof browserbase.launch;
  attach: typeof Stagehand.create;
  release(id: string): Promise<unknown>;
  retrieve(id: string): Promise<{ status: string }>;
};
export async function checkout(
  config: AppConfig,
  card: EncryptedCard,
  signal: AbortSignal,
  runtime?: Runtime,
  log = console.info,
  cleanupMs = 30_000,
  onSession?: (url: string) => void,
): Promise<void> {
  const bb = new Browserbase({ apiKey: config.browserbaseApiKey, timeout: 10_000, maxRetries: 0 });
  runtime ??= {
    tokens: createCardBrowserTokens,
    launch: (options) => browserbase.launch(options),
    attach: (options) => Stagehand.create(options),
    release: (id) => bb.sessions.update(id, { status: "REQUEST_RELEASE" }),
    retrieve: (id) => bb.sessions.retrieve(id),
  };
  let browser: Awaited<ReturnType<Runtime["launch"]>> | undefined;
  let stagehand: Awaited<ReturnType<Runtime["attach"]>> | undefined;
  let sessionId: string | undefined;
  let step = "TOKEN_CREATION";
  const progress = (next: string) => {
    signal.throwIfAborted();
    step = next;
    log(`Step: ${step}`);
  };
  try {
    progress("TOKEN_CREATION");
    const tokens = await runtime.tokens(config, card, config.cardTargetHost, { signal });
    card.number = card.cvc = "";
    const fresh = (minimum = 15_000) => {
      if (!Number.isFinite(tokens.expiresAt) || tokens.expiresAt - Date.now() < minimum)
        throw new RecipeError("Tokens expired or are too close to expiry. Restart the recipe.");
    };
    fresh(60_000);
    progress("SESSION_LAUNCH");
    browser = await runtime.launch({
      apiKey: config.browserbaseApiKey,
      api_timeout: 240,
      keepAlive: false,
      region: "us-east-1",
      browserSettings: {
        allowedDomains: [config.cardTargetHost],
        ignoreCertificateErrors: false,
        recordSession: config.recordSession,
        logSession: false,
        solveCaptchas: false,
        advancedStealth: false,
        verified: false,
        viewport: { width: 1280, height: 900 },
      },
      proxies: [
        {
          type: "external",
          server: `https://${tokens.proxy.hostname}:${tokens.proxy.port}`,
          username: tokens.proxy.username,
          password: tokens.proxy.password,
        },
      ],
      proxySettings: { caCertificates: [config.caCertificateId] },
    });
    sessionId = browser.sessionId;
    if (!sessionId) throw new RecipeError("Session ID unavailable; cleanup cannot be confirmed.");
    const sessionUrl = `https://www.browserbase.com/sessions/${encodeURIComponent(sessionId)}`;
    log(`Browserbase session: ${sessionUrl}`);
    onSession?.(sessionUrl);
    progress("STAGEHAND_ATTACH");
    stagehand = await runtime.attach({ browser, logging: { level: "off" } });
    progress("PAGE_ACCESS");
    const page = (await browser.context.activePage()) ?? (await browser.context.newPage());
    progress("NAVIGATION");
    const target = `https://${config.cardTargetHost}/mock-merchant/`;
    await page.goto(`${target}checkout`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForSelector("#mock-checkout", { state: "visible", timeout: 15_000 });
    if ((await page.url()) !== `${target}checkout`)
      throw new RecipeError("Unexpected checkout destination.");
    progress("TOKEN_FILL");
    fresh();
    for (const [selector, value] of [
      ["#card-number", tokens.numberToken],
      ["#card-expiry", "12/34"],
      ["#card-cvc", tokens.cvcToken],
    ]) {
      signal.throwIfAborted();
      await page.locator(selector!).fill(value!);
    }
    fresh();
    progress("SUBMISSION");
    await page.locator('button[type="submit"]').click();
    progress("APPROVAL");
    await page.waitForSelector('#authorization-result[data-outcome="approved"]', {
      state: "visible",
      timeout: 15_000,
    });
    signal.throwIfAborted();
    if ((await page.url()) !== `${target}authorize`)
      throw new RecipeError("Unexpected authorization destination.");
  } catch (error) {
    if (signal.aborted && !(error instanceof RecipeError)) throw error;
    throw atStep(step, error);
  } finally {
    card.number = card.cvc = "";
    log("Releasing acquired resources.");
    let failed = false;
    const attempt = async (operation: () => Promise<unknown>) => {
      try {
        await operation();
      } catch {
        failed = true;
      }
    };
    await attempt(async () => stagehand?.close());
    await attempt(async () => {
      if (browser && !browser.closed) await browser.close();
    });
    if (sessionId) {
      await attempt(() => runtime.release(sessionId!));
      await attempt(async () => {
        const deadline = Date.now() + cleanupMs;
        do {
          const { status } = await runtime.retrieve(sessionId!);
          if (status === "COMPLETED") return;
          if (["ERROR", "TIMED_OUT"].includes(status)) break;
          await delay(750);
        } while (Date.now() < deadline);
        throw new RecipeError("Session release was not confirmed.");
      });
    } else if (browser) failed = true;
    if (failed) throw new RecipeError("[CLEANUP/UNCONFIRMED] Check Browserbase before retrying.");
    log("Acquired resources released.");
  }
}
export async function main(config = loadConfig(), runtime?: Runtime, log = console.info) {
  const controller = new AbortController();
  const interrupt = () => controller.abort(130);
  const terminate = () => controller.abort(143);
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  let fixture: Awaited<ReturnType<typeof startFixture>> | undefined;
  let result = 1;
  try {
    fixture = await startFixture(config, controller.signal);
    log(`Open http://127.0.0.1:${config.port} and submit the public test card. Ctrl+C cancels.`);
    const card = await fixture.card;
    await checkout(config, card, controller.signal, runtime, log, 30_000, (sessionUrl) =>
      fixture?.respond({ sessionUrl }),
    );
    controller.signal.throwIfAborted();
    result = 0;
  } catch (error) {
    if (controller.signal.aborted && !(error instanceof RecipeError)) {
      log("Cancelled.");
      result = controller.signal.reason;
    } else {
      const message = safeMessage(error);
      fixture?.respond({ error: message });
      log(message);
    }
  } finally {
    try {
      await fixture?.close();
    } catch {
      log("Local server cleanup failed.");
      result = 1;
    }
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  }
  if (result === 0) log("Success: synthetic approval and cleanup confirmed.");
  return result;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = await main().catch(() => {
    console.error("Startup failed. Check your private .env; private details are suppressed.");
    return 1;
  });
}
