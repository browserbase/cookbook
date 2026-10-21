import { Browserbase } from "@browserbasehq/sdk";
import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import {
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
): Promise<void> {
  const client = new Browserbase({
    apiKey: config.browserbaseApiKey,
    timeout: 10_000,
    maxRetries: 0,
  });
  runtime ??= {
    tokens: createCardBrowserTokens,
    launch: (options) => browserbase.launch(options),
    attach: (options) => Stagehand.create(options),
    release: (id) => client.sessions.update(id, { status: "REQUEST_RELEASE" }),
    retrieve: (id) => client.sessions.retrieve(id),
  };
  let browser: Awaited<ReturnType<Runtime["launch"]>> | undefined;
  let stagehand: Awaited<ReturnType<Runtime["attach"]>> | undefined;
  let sessionId: string | undefined;
  try {
    signal.throwIfAborted();
    log("Creating five-minute Browser Tokens.");
    const tokens = await runtime.tokens(config, card, config.cardTargetHost, { signal });
    card.number = card.cvc = "";
    const fresh = (minimum = 15_000) => {
      signal.throwIfAborted();
      if (
        !Number.isFinite(Date.parse(tokens.expiresAt)) ||
        Date.parse(tokens.expiresAt) - Date.now() < minimum
      )
        throw new RecipeError("Tokens expired or are too close to expiry. Restart the recipe.");
    };
    fresh(60_000);
    log("Launching one proxied Browserbase session.");
    browser = await runtime.launch({
      apiKey: config.browserbaseApiKey,
      api_timeout: 240,
      keepAlive: false,
      region: "us-east-1",
      browserSettings: {
        allowedDomains: [config.cardTargetHost],
        ignoreCertificateErrors: false,
        recordSession: false,
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
    signal.throwIfAborted();
    stagehand = await runtime.attach({ browser, logging: { level: "off" } });
    signal.throwIfAborted();
    const page = (await browser.context.activePage()) ?? (await browser.context.newPage());
    signal.throwIfAborted();
    const target = `https://${config.cardTargetHost}/mock-merchant/`;
    await page.goto(`${target}checkout`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForSelector("#mock-checkout", { state: "visible", timeout: 15_000 });
    if ((await page.url()) !== `${target}checkout`)
      throw new RecipeError("Unexpected checkout destination.");
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
    log("Submitting the synthetic checkout once.");
    await page.locator('button[type="submit"]').click();
    signal.throwIfAborted();
    await page.waitForSelector('#authorization-result[data-outcome="approved"]', {
      state: "visible",
      timeout: 15_000,
    });
    signal.throwIfAborted();
    if ((await page.url()) !== `${target}authorize`)
      throw new RecipeError("Unexpected authorization destination.");
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
    if (failed)
      throw new RecipeError("Cleanup could not be confirmed. Check Browserbase before retrying.");
    log("Acquired resources released.");
  }
}
export async function main(
  config = loadConfig(process.env, true),
  runtime?: Runtime,
  log = console.info,
): Promise<number> {
  const controller = new AbortController();
  let cancelled = 0;
  const stop = (signal: NodeJS.Signals) => {
    cancelled = signal === "SIGINT" ? 130 : 143;
    controller.abort();
  };
  const interrupt = () => stop("SIGINT"),
    terminate = () => stop("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  let fixture: Awaited<ReturnType<typeof startFixture>> | undefined;
  let result = 1;
  try {
    fixture = await startFixture(config, controller.signal);
    log(`Open http://127.0.0.1:${config.port} and submit the public test card. Ctrl+C cancels.`);
    const card = await fixture.card;
    await checkout(config, card, controller.signal, runtime, log);
    controller.signal.throwIfAborted();
    result = 0;
  } catch (error) {
    if (cancelled && !(error instanceof RecipeError)) {
      log("Cancelled.");
      result = cancelled;
    } else log(safeMessage(error));
  } finally {
    try {
      await fixture?.close();
      if (fixture) log("Local server closed.");
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
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch {
    console.error("Startup failed. Check your private .env; private details are suppressed.");
    process.exitCode = 1;
  }
}
