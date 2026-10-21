import { Browserbase } from "@browserbasehq/sdk";
import { browserbase, Stagehand, type Page, type StagehandBrowser } from "@browserbasehq/stagehand";
import {
  CARD_AUTHORIZE_PATH,
  CARD_CHECKOUT_PATH,
  TEST_CARD_EXPIRY,
  type AppConfig,
} from "./config.js";
import { createCardBrowserTokens, type EncryptedCard } from "./evervault.js";
import type { RunContext } from "./run.js";
import { DemoError } from "./sanitize.js";

type Session = {
  id?: string;
  browser?: StagehandBrowser;
  stagehand?: Awaited<ReturnType<typeof Stagehand.create>>;
};
export type CardRuntime = {
  launch: typeof browserbase.launch;
  attach: typeof Stagehand.create;
  tokens: typeof createCardBrowserTokens;
  release(sessionId: string): Promise<unknown>;
  retrieve(sessionId: string): Promise<{ status: string }>;
};
export type CardRunOptions = { completionPollMs?: number; runtime?: CardRuntime };
const TARGET_NAVIGATION_MS = 15_000;
const RESULT_POLL_MS = 15_000;

// Wait for every in-flight operation before cleanup, including late resource acquisition.
async function together<T>(operations: Promise<T>[]): Promise<T[]> {
  const results = await Promise.allSettled(operations);
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  return results.map((result) => (result as PromiseFulfilledResult<T>).value);
}

function isExpectedUrl(value: string, hostname: string, pathname: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.origin === `https://${hostname}` && url.pathname === pathname && !url.search && !url.hash
    );
  } catch {
    return false;
  }
}

function isRecoverableGotoTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message === "RPC response timed out: page.goto" ||
    /^waitForMainLoadState\(domcontentloaded\) timed out after \d+ms$/.test(error.message)
  );
}

async function navigateToCheckout(page: Page, config: AppConfig): Promise<void> {
  let recovered = false;
  try {
    await page.goto(`https://${config.cardTargetHost}${CARD_CHECKOUT_PATH}`, {
      waitUntil: "domcontentloaded",
      timeout: TARGET_NAVIGATION_MS,
    });
  } catch (error) {
    if (!isRecoverableGotoTimeout(error)) throw error;
    recovered = true;
  }
  const ready = await page
    .waitForSelector("#mock-checkout", {
      state: "visible",
      timeout: TARGET_NAVIGATION_MS,
    })
    .catch(() => false);
  const finalUrl = await page.url().catch(() => "");
  if (!ready || !isExpectedUrl(finalUrl, config.cardTargetHost, CARD_CHECKOUT_PATH)) {
    throw new DemoError(
      recovered ? "CARD_TARGET_NAVIGATION_TIMEOUT" : "CARD_TARGET_UNAVAILABLE",
      "The synthetic merchant checkout did not become ready. Both sessions were released; try again.",
    );
  }
}

async function bounded<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Page state read timed out")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function waitForCardOutcome(
  page: Pick<Page, "evaluate">,
  hostname: string,
  expected: "approved" | "declined",
  timeoutMs = RESULT_POLL_MS,
  signal?: AbortSignal,
): Promise<{ finalUrl: string; outcome: string }> {
  const deadline = Date.now() + timeoutMs;
  do {
    signal?.throwIfAborted();
    try {
      const snapshot = await bounded(
        page.evaluate(() => ({
          url: window.location.href,
          outcome:
            document.querySelector("#authorization-result")?.getAttribute("data-outcome") ?? "",
        })),
        Math.min(3_000, Math.max(1, deadline - Date.now())),
      );
      if (
        isExpectedUrl(snapshot.url, hostname, CARD_AUTHORIZE_PATH) &&
        snapshot.outcome === expected
      ) {
        return { finalUrl: snapshot.url, outcome: snapshot.outcome };
      }
    } catch {
      // A navigation can briefly invalidate the execution context; retry inside the bounded window.
    }
    if (Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() < deadline);
  throw new DemoError(
    expected === "approved" ? "CARD_APPROVAL_TIMEOUT" : "CARD_CONTROL_TIMEOUT",
    expected === "approved"
      ? "The synthetic merchant did not confirm approval in time. Both sessions were released; try again."
      : "The direct control did not reject the unchanged tokens in time. Both sessions were released; try again.",
  );
}

async function pollCompleted(
  runtime: CardRuntime,
  sessionId: string,
  timeoutMs: number,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const session = await runtime.retrieve(sessionId);
    if (session.status === "COMPLETED") return;
    if (session.status === "ERROR" || session.status === "TIMED_OUT") {
      throw new DemoError(
        "BROWSERBASE_CLEANUP_FAILED",
        `Browserbase ended with status ${session.status}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new DemoError(
    "BROWSERBASE_CLEANUP_TIMEOUT",
    "Browserbase did not report COMPLETED in time",
  );
}

async function showCardTokens(page: Page, numberToken: string, cvcToken: string): Promise<void> {
  await page.locator("#card-number").fill(numberToken);
  await page.locator("#card-expiry").fill(`${TEST_CARD_EXPIRY.month}/${TEST_CARD_EXPIRY.year}`);
  await page.locator("#card-cvc").fill(cvcToken);
}

async function submitCard(page: Page, numberToken: string, cvcToken: string): Promise<boolean> {
  return page.evaluate(
    ({ expectedNumber, expectedCvc, expectedExpiry }) => {
      const number = document.querySelector("#card-number");
      const cvc = document.querySelector("#card-cvc");
      const expiry = document.querySelector("#card-expiry");
      const form = document.querySelector("#mock-checkout");
      if (
        !(number instanceof HTMLInputElement) ||
        !(cvc instanceof HTMLInputElement) ||
        !(expiry instanceof HTMLInputElement) ||
        !(form instanceof HTMLFormElement) ||
        number.value !== expectedNumber ||
        cvc.value !== expectedCvc ||
        expiry.value !== expectedExpiry
      )
        return false;
      window.setTimeout(() => form.requestSubmit(), 0);
      return true;
    },
    {
      expectedNumber: numberToken,
      expectedCvc: cvcToken,
      expectedExpiry: `${TEST_CARD_EXPIRY.month}/${TEST_CARD_EXPIRY.year}`,
    },
  );
}

export async function executeCardRun(
  config: AppConfig,
  encryptedCard: EncryptedCard,
  context: RunContext,
  options: CardRunOptions = {},
): Promise<void> {
  const client = new Browserbase({
    apiKey: config.browserbaseApiKey,
    timeout: 10_000,
    maxRetries: 0,
  });
  const runtime: CardRuntime = options.runtime ?? {
    launch: (options) => browserbase.launch(options),
    attach: (options) => Stagehand.create(options),
    tokens: createCardBrowserTokens,
    release: (id) => client.sessions.update(id, { status: "REQUEST_RELEASE" }),
    retrieve: (id) => client.sessions.retrieve(id),
  };
  const sessions: Session[] = [{}, {}];
  const checkCancelled = () => context.signal.throwIfAborted();
  try {
    checkCancelled();
    // 1. Tokenize ciphertext with a five-minute TTL and one exact reveal destination.
    const tokens = await runtime.tokens(config, encryptedCard, config.cardTargetHost, {
      signal: context.signal,
    });
    encryptedCard.number = encryptedCard.cvc = "";
    const assertFresh = (minimumMs = 15_000) => {
      if (
        !Number.isFinite(Date.parse(tokens.expiresAt)) ||
        Date.parse(tokens.expiresAt) - Date.now() < minimumMs
      )
        throw new DemoError(
          "BROWSER_TOKEN_EXPIRED",
          "Card tokens expired or are too close to expiry. Start a new comparison.",
        );
    };
    assertFresh(60_000);
    checkCancelled();
    context.update({
      displayCardTokens: { number: tokens.numberToken, cvc: tokens.cvcToken },
      progress: "Launching matched sessions",
    });

    // 2. Launch the same browser settings; only the first path uses Evervault's proxy and CA.
    const shared = {
      apiKey: config.browserbaseApiKey,
      api_timeout: 240,
      keepAlive: false,
      region: "us-east-1" as const,
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
    };
    await together(
      [
        {
          ...shared,
          proxies: [
            {
              type: "external" as const,
              server: `https://${tokens.proxy.hostname}:${tokens.proxy.port}`,
              username: tokens.proxy.username,
              password: tokens.proxy.password,
            },
          ],
          proxySettings: { caCertificates: [config.caCertificateId] },
        },
        shared,
      ].map(async (settings, index) => {
        sessions[index]!.browser = await runtime.launch(settings);
        sessions[index]!.id = sessions[index]!.browser!.sessionId;
        if (!sessions[index]!.id)
          throw new DemoError("SESSION_ID_MISSING", "A comparison session ID is unavailable");
      }),
    );
    checkCancelled();
    await together(
      sessions.map(async (session) => {
        session.stagehand = await runtime.attach({
          browser: session.browser!,
          logging: { level: "off" },
        });
      }),
    );
    checkCancelled();
    const pages = await together(
      sessions.map(
        async (session) =>
          (await session.browser!.context.activePage()) ??
          (await session.browser!.context.newPage()),
      ),
    );

    // 3. Navigate, fill identical tokens, and submit each synthetic checkout once.
    checkCancelled();
    context.update({ progress: "Opening synthetic checkouts" });
    await together(pages.map((page) => navigateToCheckout(page, config)));
    checkCancelled();
    assertFresh();
    context.update({ progress: "Entering matching tokens" });
    await together(pages.map((page) => showCardTokens(page, tokens.numberToken, tokens.cvcToken)));
    checkCancelled();
    assertFresh();
    context.update({ progress: "Submitting synthetic checkouts" });
    const submitted = await together(
      pages.map((page) => submitCard(page, tokens.numberToken, tokens.cvcToken)),
    );
    if (submitted.some((value) => !value))
      throw new DemoError(
        "TOKEN_DOM_ASSERTION_FAILED",
        "A checkout did not contain the expected tokens",
      );

    // 4. Assert the exact destination and outcomes, never just a successful click.
    checkCancelled();
    context.update({ progress: "Verifying comparison results" });
    await together([
      waitForCardOutcome(
        pages[0]!,
        config.cardTargetHost,
        "approved",
        RESULT_POLL_MS,
        context.signal,
      ),
      waitForCardOutcome(
        pages[1]!,
        config.cardTargetHost,
        "declined",
        RESULT_POLL_MS,
        context.signal,
      ),
    ]);
    context.update({ proxiedOutcome: "approved", controlOutcome: "rejected_as_expected" });
  } finally {
    encryptedCard.number = encryptedCard.cvc = "";
    context.update({ progress: "Releasing sessions", cleanupStatus: "releasing" });
    // Close automation before browsers. Try every resource even if an earlier close fails.
    const failures: unknown[] = [];
    const attempt = async (operation: () => Promise<unknown>) => {
      try {
        await operation();
      } catch (error) {
        failures.push(error);
      }
    };
    await Promise.all(
      sessions.map((session) =>
        attempt(async () => {
          await session.stagehand?.close();
        }),
      ),
    );
    await Promise.all(
      sessions.map((session) =>
        attempt(async () => {
          if (session.browser && !session.browser.closed) await session.browser.close();
        }),
      ),
    );
    await Promise.all(
      sessions.map((session) =>
        attempt(async () => {
          if (session.id) await runtime.release(session.id);
        }),
      ),
    );
    await Promise.all(
      sessions.map((session) =>
        attempt(async () => {
          if (session.id)
            await pollCompleted(runtime, session.id, options.completionPollMs ?? 30_000);
        }),
      ),
    );
    context.update({
      cleanupStatus: failures.length ? "failed" : "completed",
      displayCardTokens: undefined,
    });
    if (failures.length)
      throw new DemoError(
        "BROWSERBASE_CLEANUP_FAILED",
        "Session cleanup could not be confirmed. Check Browserbase before starting another comparison.",
      );
  }
}
