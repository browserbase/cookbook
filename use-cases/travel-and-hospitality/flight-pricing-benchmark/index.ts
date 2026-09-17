import { departureDate, validateDepartureDate } from "./benchmark-date.js";
import { classifyTravelPortalAuth, readTravelPortalAuthEvidence } from "./travel-portal-auth.js";
import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
/**
 * TravelPortal flight pricing benchmark
 *
 * Shops TravelPortal and public airline/OTA sites at the same time, then compares
 * cheapest one-way nonstop fares for the same route and date.
 */

import {
  Stagehand,
  type Page,
  browserbase,
  localBrowser,
} from "@browserbasehq/stagehand";
import { Browserbase } from "@browserbasehq/sdk";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { z } from "zod";
import "dotenv/config";
import { runBrowserTask, resolveBrowserAgentModel } from "./browser-task.js";

interface Route {
  origin: string;
  dest: string;
  date: string;
  label: string;
}

interface Source {
  name: string;
  code: string;
  color: string;
  urlFor: (route: Route) => string;
  oneWaySetupHint: string;
  extractHint: string;
}

interface ShopResult {
  sourceName: string;
  sourceCode: string;
  cheapestNonstop: number | null;
  cheapestOverall: number | null;
  airline: string | null;
  flightTimes: string | null;
  notes: string;
  elapsedMs: number;
  startedAt?: string;
  observedAt?: string;
  sessionId?: string;
  error?: string;
}

interface RouteResult {
  route: Route;
  travel_portalShop: ShopResult | null;
  travel_portalPrice: number | null;
  externalShops: ShopResult[];
  bestExternal: { price: number; source: string } | null;
  diff: number | null;
  travel_portalWins: boolean;
}

const RESET = "\x1b[0m";
const DIM = "\x1b[90m";
const TRAVEL_PORTAL_APP_URL = "https://app.travel.example/app/user2/";
const TRAVEL_PORTAL_SIGNIN_URL = "https://travel.example/signin";
const PRICE_TEXT_RE = /\$\s?\d{2,5}(?:,\d{3})?/;
const HUMAN_GATE_RE = new RegExp(
  [
    "captcha",
    "magic link",
    "check your email",
    "email link",
    "verification code",
    "verify your email",
    "multi-factor",
    "two-factor",
    String.raw`\bmfa\b`,
    String.raw`enter (the )?(code|verification)`,
    "security check",
  ].join("|"),
  "i",
);

const ROUTES: Omit<Route, "date">[] = [
  {
    origin: "SFO",
    dest: "JFK",
    label: "San Francisco to New York",
  },
  {
    origin: "SFO",
    dest: "LAX",
    label: "San Francisco to Los Angeles",
  },
  {
    origin: "SFO",
    dest: "ORD",
    label: "San Francisco to Chicago",
  },
  {
    origin: "SEA",
    dest: "JFK",
    label: "Seattle to New York",
  },
  {
    origin: "LAX",
    dest: "DCA",
    label: "Los Angeles to Washington DC",
  },
];

const SOURCES: Source[] = [
  {
    name: "Google Flights",
    code: "GF",
    color: "\x1b[33m",
    urlFor: (route) => {
      const params = new URLSearchParams({
        q: `One-way flights from ${route.origin} to ${route.dest} on ${route.date} economy 1 adult`,
      });
      return `https://www.google.com/travel/flights?${params}`;
    },
    oneWaySetupHint:
      "Google Flights has a trip type dropdown near the top of the search controls. It must read One way or One-way before extracting prices.",
    extractHint:
      "Google Flights one-way results. Look at the Best departing flights and Departing flights lists, then choose the lowest visible nonstop fare.",
  },
  {
    name: "Kayak",
    code: "KY",
    color: "\x1b[35m",
    urlFor: (route) =>
      `https://www.kayak.com/flights/${route.origin}-${route.dest}/${route.date}?sort=price_a`,
    oneWaySetupHint:
      "Kayak one-way URLs contain only one date segment. If a trip type control is visible, it must read One-way before extracting prices.",
    extractHint:
      "Kayak one-way flight search results. Each result card shows airline, times, stops, and price.",
  },
];

const ONE_WAY_PRICE_EXTRACT_INSTRUCTIONS = [
  "Only return one-way prices for the outbound flight.",
  "Ignore round-trip totals, return-trip bundles, package prices, or any fare that requires a return date.",
  "A page counts as one-way if the search controls show One way/One-way, only one departure date with no return date, or a one-way URL/search query.",
  "Set price fields to null only when the visible page explicitly shows Round trip/Round-trip/Return mode or only shows round-trip totals.",
].join(" ");

const FlightExtractSchema = z.object({
  cheapestNonstopPrice: z
    .number()
    .nullable()
    .describe("Lowest visible one-way nonstop economy fare in USD, or null."),
  cheapestOverallPrice: z
    .number()
    .nullable()
    .describe(
      "Lowest visible one-way economy fare in USD, including connecting flights.",
    ),
  airlineForCheapestNonstop: z
    .string()
    .nullable()
    .describe("Airline for the cheapest one-way nonstop flight, or null."),
  flightTimes: z
    .string()
    .nullable()
    .describe(
      "Departure-arrival time string for the cheapest one-way nonstop flight, or null.",
    ),
  notes: z
    .string()
    .describe("Brief page state note, such as results loaded or CAPTCHA."),
});

function getArgValue(name: string): string | undefined {
  const prefix = `${name}=`;
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
}

function travel_portalContextId(): string | undefined {
  return getArgValue("--travel-portal-context-id") || process.env.TRAVEL_PORTAL_CONTEXT_ID;
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

function log(source: string, message: string) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${DIM}[${timestamp}]${RESET} ${source.padEnd(22)} ${message}`);
}

function divider(title: string) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(72)}`);
}

function formatPrice(price: number | null): string {
  return price === null ? "-" : `$${price}`;
}

function formatRouteDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function diffString(travel_portal: number, external: number): string {
  const diff = travel_portal - external;
  const pct = Math.abs((diff / external) * 100).toFixed(1);
  if (diff < 0) return `\x1b[32m-$${Math.abs(diff)} (${pct}% cheaper)${RESET}`;
  if (diff > 0) return `\x1b[31m+$${diff} (${pct}% pricier)${RESET}`;
  return `${DIM}match${RESET}`;
}

async function visibleText(page: Page, maxLength = 8_000): Promise<string> {
  try {
    const text = await page.locator("body").innerText();
    return text.replace(/\s+/g, " ").trim().slice(0, maxLength);
  } catch {
    return page
      .evaluate(() => document.body?.innerText ?? "")
      .then((text) => text.replace(/\s+/g, " ").trim().slice(0, maxLength))
      .catch(() => "");
  }
}

async function waitForText(
  page: Page,
  isReady: (text: string, urlAndText: string) => boolean | Promise<boolean>,
  timeoutMs: number,
  intervalMs = 750,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let text = "";

  while (Date.now() <= deadline) {
    text = await visibleText(page);
    if (await isReady(text, `${await page.url()} ${text}`)) return text;
    await page.waitForTimeout(
      Math.min(intervalMs, Math.max(0, deadline - Date.now())),
    );
  }

  return text;
}

function hasHumanGate(url: string, text: string): boolean {
  return HUMAN_GATE_RE.test(`${url} ${text}`);
}

async function travel_portalAppAuthenticated(page: Page): Promise<boolean> {
  try {
    return classifyTravelPortalAuth(await page.evaluate(readTravelPortalAuthEvidence)) === "authenticated";
  } catch {
    return false;
  }
}

function travel_portalAppShellIsBlank(url: string, text: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === "https://app.travel.example" && !parsed.username && !parsed.password &&
      (parsed.pathname === "/app" || parsed.pathname.startsWith("/app/")) && text.trim().length < 20;
  } catch { return false; }
}

function hasFlightResults(text: string): boolean {
  return (
    PRICE_TEXT_RE.test(text) &&
    /(flight|airline|nonstop|stops?|duration|depart|arriv|results?)/i.test(text)
  );
}

function hasTravelPortalSearchProgress(text: string): boolean {
  return /(checking with|searching|loading|one-way flight|no hidden fees|shows the full price upfront)/i.test(
    text,
  );
}

function hasTravelPortalNoAvailability(text: string): boolean {
  return /(no flights|no results|no available|not available|could not find|couldn't find|change your search|try different dates)/i.test(
    text,
  );
}

function humanGateMessage(contextId?: string): string {
  return [
    "TravelPortal is asking for MFA, email verification, CAPTCHA, or another human security step.",
    contextId
      ? `Re-run npm run demo -- --setup-travel-portal-context for context ${contextId} and complete the step in Live View.`
      : "Run npm run demo -- --setup-travel-portal-context, complete the step in Live View, then rerun with TRAVEL_PORTAL_CONTEXT_ID.",
  ].join(" ");
}

async function dismissCommonConsentBanners(
  stagehand: Stagehand,
  page: Page,
): Promise<boolean> {
  const result = await stagehand
    .act(
      [
        "If a cookie, privacy, or consent banner is visible, click the obvious",
        "Accept all, Accept, Agree, I agree, Allow all, or Got it button.",
        "If no such banner is visible, do nothing.",
      ].join(" "),
      { page: page },
    )
    .then((result) => result.data)
    .catch(() => null);

  return result?.success === true;
}

async function ensureExternalOneWayPricing(
  stagehand: Stagehand,
  page: Page,
  source: Source,
  route: Route,
  tag: string,
): Promise<void> {
  log(tag, "Ensuring one-way pricing is selected...");

  const result = await stagehand
    .act(
      [
        `${source.name} should show one-way flight results from ${route.origin} to ${route.dest}`,
        `departing ${formatRouteDate(route.date)} (${route.date}) for 1 adult in economy.`,
        source.oneWaySetupHint,
        "If a trip type control is visible and says Round trip, Round-trip, Return, or similar, open it and choose One-way or One way.",
        "If the page already shows One-way, One way, or a search with only a single departure date, leave it unchanged.",
        "Do not add a return date.",
        "Do not change the origin, destination, departure date, passenger count, cabin, or filters.",
        "If results refresh after selecting One-way, wait until flight prices or search results are visible again.",
        "Before finishing, make sure any open trip type dropdown or menu is closed and the flight results list is visible.",
      ].join(" "),
      { page: page },
    )
    .then((result) => result.data)
    .catch((error) => {
      log(
        tag,
        `One-way setup action was inconclusive: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    });

  if (result?.success) {
    log(tag, "One-way pricing confirmed or selected.");
  } else if (result) {
    log(tag, `One-way setup action was inconclusive: ${result.message}`);
  }

  await page.keyPress("Escape").catch(() => undefined);
  await page.waitForTimeout(750);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function clickVisibleTextControl(
  page: Page,
  tag: string,
  labels: string[],
  description: string,
): Promise<boolean> {
  for (const label of labels) {
    const locator = page.locator("button, [role=button]");
    const count = await locator.count().catch(() => 0);

    for (let index = count - 1; index >= 0; index -= 1) {
      const candidate = locator.nth(index);
      if (
        (await candidate.innerText()).trim().toLowerCase() !==
        label.toLowerCase()
      )
        continue;
      if (!(await candidate.isVisible().catch(() => false))) continue;

      const clicked = await candidate
        .click()
        .then(() => true)
        .catch(() => false);
      if (!clicked) continue;

      await page.waitForTimeout(500);
      log(tag, `Clicked ${description} via role button "${label}".`);
      return true;
    }
  }

  const clickedLabel = await page
    .evaluate((targetLabels) => {
      const normalize = (value: string | null | undefined) =>
        (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
      const wanted = targetLabels.map((label) => normalize(label));
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button,[role="button"],a,input[type="button"],input[type="submit"],div,span',
        ),
      );

      const isVisible = (element: HTMLElement) => {
        const style = window.getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          style.pointerEvents !== "none" &&
          box.width > 0 &&
          box.height > 0
        );
      };

      const candidates = elements.filter((element) => {
        if (!isVisible(element)) return false;
        const text = normalize(
          element.innerText ||
            element.textContent ||
            element.getAttribute("aria-label") ||
            element.getAttribute("value"),
        );
        return wanted.includes(text);
      });

      const target = candidates.at(-1);
      target?.click();
      return target
        ? normalize(
            target.innerText ||
              target.textContent ||
              target.getAttribute("aria-label") ||
              target.getAttribute("value"),
          )
        : null;
    }, labels)
    .catch(() => null);

  if (clickedLabel) {
    await page.waitForTimeout(500);
    log(tag, `Clicked ${description} via visible text "${clickedLabel}".`);
    return true;
  }

  return false;
}

async function submitTravelPortalFlightSearchFallback(
  page: Page,
  tag: string,
): Promise<boolean> {
  let text = await visibleText(page, 6_000);
  if (hasFlightResults(text) || hasTravelPortalSearchProgress(text)) return true;
  if (hasHumanGate(await page.url(), text)) return false;

  const datePickerLikelyOpen = /\b(done|reset|same day|anytime)\b/i.test(text);
  if (datePickerLikelyOpen) {
    const clickedDone = await clickVisibleTextControl(
      page,
      tag,
      ["Done"],
      "date picker Done button",
    );
    if (!clickedDone) {
      log(
        tag,
        "Date picker appears open, but Done was not clickable; pressing Escape before submit fallback.",
      );
      await page.keyPress("Escape").catch(() => undefined);
      await page.waitForTimeout(750);
    }
  }

  text = await visibleText(page, 6_000);
  if (/\b(done|reset|same day|anytime)\b/i.test(text)) {
    log(
      tag,
      "Date picker still appears open after Done; pressing Escape before submit fallback.",
    );
    await page.keyPress("Escape").catch(() => undefined);
    await page.waitForTimeout(750);
    text = await visibleText(page, 6_000);
  }

  if (hasFlightResults(text) || hasTravelPortalSearchProgress(text)) return true;
  if (hasHumanGate(await page.url(), text)) return false;

  const searchClicked = await clickVisibleTextControl(
    page,
    tag,
    ["Search"],
    "flight form Search button",
  );
  if (!searchClicked) return false;

  log(tag, "Submitted TravelPortal flight search with deterministic fallback.");
  return true;
}

async function submitTravelPortalPasswordForm(
  stagehand: Stagehand,
  page: Page,
  tag: string,
): Promise<boolean> {
  log(tag, "Submitting TravelPortal password form...");

  const submitStep = await stagehand
    .act(
      [
        "The TravelPortal password field is already populated with masked characters.",
        "Click the primary submit button for this exact password form.",
        "The button may be labeled Continue, Sign In, Log In, Next, or Submit,",
        "and is usually directly below or next to the password field.",
        "Do not stop after focusing the password field.",
        "Do not type anything. Do not navigate away from the current TravelPortal login flow.",
        "After clicking, wait until the page starts changing or the password form begins submitting.",
      ].join(" "),
      { page: page },
    )
    .then((result) => result.data)
    .catch(() => null);

  if (submitStep?.success) return true;
  if (submitStep)
    log(tag, `Password submit click did not complete: ${submitStep.message}`);

  const enterStep = await stagehand
    .act(
      [
        "The TravelPortal password field is already populated.",
        "Submit the current TravelPortal password form by activating the form submit control",
        "or pressing Enter from the password field.",
        "Do not type anything. Do not navigate away from the current TravelPortal login flow.",
        "After submitting, wait until the page starts changing.",
      ].join(" "),
      { page: page },
    )
    .then((result) => result.data)
    .catch(() => null);

  if (enterStep && !enterStep.success)
    log(tag, `Password Enter submit did not complete: ${enterStep.message}`);
  return enterStep?.success === true;
}

const browserAgentModels = new WeakMap<Stagehand, ReturnType<typeof resolveBrowserAgentModel>>();

function resolvePrimitiveModel(env: Record<string, string | undefined> = process.env) {
  const modelName = env.MODEL_NAME ?? "anthropic/claude-sonnet-4-20250514";
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\/\S+$/.test(modelName)) throw new Error("MODEL_NAME must use a nonblank provider/model ID.");
  const provider = modelName.split("/")[0];
  const providerKey = provider === "anthropic" ? "ANTHROPIC_API_KEY" : provider === "google" ? "GOOGLE_API_KEY" : provider === "openai" ? "OPENAI_API_KEY" : undefined;
  const apiKey = env.MODEL_API_KEY ?? (providerKey ? env[providerKey] : undefined);
  if (typeof apiKey !== "string" || !apiKey.trim()) throw new Error(providerKey ? `Set MODEL_API_KEY or ${providerKey} for the Stagehand primitive model.` : "Set MODEL_API_KEY for this Stagehand model provider.");
  return { modelName, apiKey: apiKey.trim() };
}

function preflightBrowserModels() {
  const agentModel = resolveBrowserAgentModel();
  const primitiveModel = resolvePrimitiveModel();
  return { agentModel, primitiveModel };
}

function browserAgentModelFor(stagehand: Stagehand) {
  const model = browserAgentModels.get(stagehand);
  if (!model) throw new Error("Browser agent model was not configured before browser allocation.");
  return model;
}

async function createStagehand({
  useBrowserbase,
  contextId,
  persistContext = false,
  timeout = 300,
  demo,
}: {
  useBrowserbase: boolean;
  contextId?: string;
  persistContext?: boolean;
  timeout?: number;
  demo: string;
}) {
  const { agentModel, primitiveModel } = preflightBrowserModels();
  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await ((useBrowserbase ? "BROWSERBASE" : "LOCAL") === "LOCAL"
        ? localBrowser.launch(useBrowserbase ? undefined : { headless: true })
        : browserbase.launch({
            apiKey: process.env.BROWSERBASE_API_KEY!,
            ...(useBrowserbase
              ? {
                  browserSettings: {
                    verified: true,
                    blockAds: true,
                    viewport: { width: 1440, height: 900 },
                    ...(contextId
                      ? { context: { id: contextId, persist: persistContext } }
                      : {}),
                  },
                  proxies: true,
                  api_timeout: timeout,
                  userMetadata: {
                    demo,
                    travel_portalContextId: contextId ?? "none",
                    persistContext: String(persistContext),
                  },
                }
              : undefined),
          })),
      model: primitiveModel,
      cache: false,
    }),
  );
  browserAgentModels.set(stagehand, agentModel);
  return stagehand;
}

function failedShop(
  sourceName: string,
  sourceCode: string,
  t0: number,
  notes: string,
  error?: unknown,
  sessionId?: string,
): ShopResult {
  return {
    sourceName,
    sourceCode,
    cheapestNonstop: null,
    cheapestOverall: null,
    airline: null,
    flightTimes: null,
    notes,
    elapsedMs: Date.now() - t0,
    startedAt: new Date(t0).toISOString(),
    sessionId,
    error:
      error instanceof Error
        ? error.message
        : error
          ? String(error)
          : undefined,
  };
}

async function ensureTravelPortalLogin({
  stagehand,
  page,
  tag,
  email,
  password,
  contextId,
  allowManualCompletion = false,
  manualOnly = false,
}: {
  stagehand: Stagehand;
  page: Page;
  tag: string;
  email?: string;
  password?: string;
  contextId?: string;
  allowManualCompletion?: boolean;
  manualOnly?: boolean;
}): Promise<boolean> {
  log(
    tag,
    contextId
      ? "Opening TravelPortal with saved Browserbase context..."
      : "Opening TravelPortal sign-in...",
  );
  await page.goto(contextId ? TRAVEL_PORTAL_APP_URL : TRAVEL_PORTAL_SIGNIN_URL, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  let text = await waitForText(
    page,
    async (body) =>
      (await travel_portalAppAuthenticated(page)) ||
      hasHumanGate(await page.url(), body) ||
      /\b(sign in|log in|email|username)\b/i.test(`${await page.url()} ${body}`),
    envNumber("TRAVEL_PORTAL_INITIAL_READY_TIMEOUT_MS", contextId ? 30_000 : 20_000),
    1_000,
  );

  if (await travel_portalAppAuthenticated(page)) return true;
  if (travel_portalAppShellIsBlank(await page.url(), text)) {
    const appReadyTimeoutMs = envNumber("TRAVEL_PORTAL_APP_READY_TIMEOUT_MS", 120_000);
    log(
      tag,
      `TravelPortal app shell is blank; waiting up to ${Math.round(appReadyTimeoutMs / 1000)}s for client app content...`,
    );
    await page.waitForLoadState("networkidle", 15_000).catch(() => undefined);
    text = await waitForText(
      page,
      async (body) =>
        (await travel_portalAppAuthenticated(page)) ||
        hasHumanGate(await page.url(), body) ||
        /\b(sign in|log in|email|username|password)\b/i.test(
          `${await page.url()} ${body}`,
        ),
      appReadyTimeoutMs,
      2_000,
    );
  }

  if (travel_portalAppShellIsBlank(await page.url(), text)) {
    const reloadReadyTimeoutMs = envNumber(
      "TRAVEL_PORTAL_APP_RELOAD_READY_TIMEOUT_MS",
      90_000,
    );
    log(
      tag,
      `TravelPortal app shell is still blank; reloading once and waiting up to ${Math.round(
        reloadReadyTimeoutMs / 1000,
      )}s...`,
    );
    await page
      .reload({ waitUntil: "domcontentloaded", timeout: 60_000 })
      .catch(() => undefined);
    text = await waitForText(
      page,
      async (body) =>
        (await travel_portalAppAuthenticated(page)) ||
        hasHumanGate(await page.url(), body) ||
        /\b(sign in|log in|email|username|password)\b/i.test(
          `${await page.url()} ${body}`,
        ),
      reloadReadyTimeoutMs,
      2_000,
    );
  }

  if (await travel_portalAppAuthenticated(page)) return true;
  if (travel_portalAppShellIsBlank(await page.url(), text)) {
    if (allowManualCompletion) return false;
    throw new Error(
      "TravelPortal app shell loaded blank before login could continue.",
    );
  }
  if (hasHumanGate(await page.url(), text)) {
    if (allowManualCompletion) return false;
    throw new Error(humanGateMessage(contextId));
  }
  if (manualOnly) return false;
  if (!email) {
    throw new Error(
      contextId
        ? `TRAVEL_PORTAL_CONTEXT_ID ${contextId} did not open an authenticated TravelPortal app, and TRAVEL_PORTAL_EMAIL is missing.`
        : "TRAVEL_PORTAL_EMAIL is required when no authenticated Browserbase context is available.",
    );
  }

  log(tag, "Resolving TravelPortal email checkpoint with agent()...");
  const checkpointAgent = (task: Parameters<typeof runBrowserTask>[1]) =>
    runBrowserTask(stagehand!, task, {
      model: browserAgentModelFor(stagehand!),
      instructions: [
        "You are preparing TravelPortal for a flight pricing benchmark.",
        "Use only the visible TravelPortal UI.",
        "Do not navigate away from the current TravelPortal URL.",
        "You may type the provided account email into a first-step email or username field.",
        "Do not enter a password, MFA code, verification code, magic link, CAPTCHA,",
        "or attempt to bypass any security check.",
      ].join(" "),
    });

  const checkpointResult = await checkpointAgent({
    instruction: [
      "From the current TravelPortal page, get to the authenticated TravelPortal app or travel home page.",
      "Do not navigate to another URL, the public marketing site, or a different TravelPortal page.",
      "If the page shows a one-field sign-in checkpoint asking for email, username,",
      `or work email, type this account email exactly: ${email}.`,
      "Then click Continue, Next, Sign In, or the primary submit button.",
      "After submitting the email, wait for the next page.",
      "If the TravelPortal app or travel home page loads, stop successfully.",
      "If a password field appears after Continue, stop and report that password is required.",
      "If MFA, email verification, magic-link confirmation, CAPTCHA, or a security",
      "prompt appears, stop and report the blocker.",
      "If an optional passkey, notification, mobile app, onboarding, or tips prompt",
      "appears, dismiss it with Skip, Not now, Maybe later, or Continue without it.",
    ].join(" "),
    maxSteps: 8,

    waitBetweenActions: envNumber("TRAVEL_PORTAL_AGENT_WAIT_MS", 1_500),
    context: [
      contextId
        ? `Browserbase context ${contextId} is attached, but TravelPortal may still ask for the account email before restoring the session.`
        : "No saved Browserbase context is attached, so this may proceed to the password step.",
      "The goal of this checkpoint is only to submit the email and let the existing",
      "session continue if TravelPortal recognizes it.",
    ].join(" "),
  });
  log(
    tag,
    `Email checkpoint agent: ${
      checkpointResult.completed || checkpointResult.success
        ? "completed"
        : "incomplete"
    } - ${checkpointResult.message}`,
  );

  const emailTransitionTimeoutMs = envNumber(
    "TRAVEL_PORTAL_EMAIL_TRANSITION_TIMEOUT_MS",
    90_000,
  );
  log(
    tag,
    `Waiting up to ${Math.round(emailTransitionTimeoutMs / 1000)}s for TravelPortal after email submit...`,
  );
  text = await waitForText(
    page,
    async (body) =>
      (await travel_portalAppAuthenticated(page)) ||
      hasHumanGate(await page.url(), body) ||
      /password/i.test(`${await page.url()} ${body}`),
    emailTransitionTimeoutMs,
    2_000,
  );

  if (await travel_portalAppAuthenticated(page)) return true;
  if (hasHumanGate(await page.url(), text) && !/password/i.test(text)) {
    if (allowManualCompletion) return false;
    throw new Error(humanGateMessage(contextId));
  }
  if (!/password/i.test(`${await page.url()} ${text}`)) {
    if (allowManualCompletion) return false;
    throw new Error(
      "TravelPortal email checkpoint did not reach the app or a password step.",
    );
  }
  if (!password) {
    if (allowManualCompletion) return false;
    throw new Error(
      "TRAVEL_PORTAL_PASSWORD is required unless the saved context is already authenticated.",
    );
  }

  log(tag, "Typing password with Stagehand variables...");
  const passwordStep = await stagehand
    .act(
      [
        "Click into the visible TravelPortal password field.",
        "Clear any existing password text if the field has content.",
        "Type %password% into the password field.",
        "Stop after the password field contains masked password characters.",
        "Do not click Continue, Sign In, Log In, Next, or Submit in this step.",
        "If TravelPortal asks for MFA, magic-link verification, or CAPTCHA, do nothing.",
      ].join(" "),
      { page: page, variables: { password } },
    )
    .then((result) => result.data);
  if (!passwordStep.success)
    log(tag, `Password step did not complete: ${passwordStep.message}`);

  await page.waitForTimeout(500);
  text = await visibleText(page);
  if (
    !(await travel_portalAppAuthenticated(page)) &&
    !hasHumanGate(await page.url(), text) &&
    /password/i.test(`${await page.url()} ${text}`)
  ) {
    const submitted = await submitTravelPortalPasswordForm(stagehand, page, tag);
    if (!submitted) log(tag, "Stagehand could not submit the password form.");
  }

  const passwordTransitionTimeoutMs = envNumber(
    "TRAVEL_PORTAL_PASSWORD_TRANSITION_TIMEOUT_MS",
    120_000,
  );
  log(
    tag,
    `Waiting up to ${Math.round(passwordTransitionTimeoutMs / 1000)}s for TravelPortal after password submit...`,
  );
  text = await waitForText(
    page,
    async (body) =>
      (await travel_portalAppAuthenticated(page)) ||
      hasHumanGate(await page.url(), body),
    passwordTransitionTimeoutMs,
    2_000,
  );

  if (await travel_portalAppAuthenticated(page)) return true;
  text = await visibleText(page);
  if (hasHumanGate(await page.url(), text)) {
    if (allowManualCompletion) return false;
    throw new Error(humanGateMessage(contextId));
  }
  if (/password/i.test(`${await page.url()} ${text}`)) {
    if (allowManualCompletion) return false;
    throw new Error(
      "TravelPortal password form was filled, but the submit action did not leave the password page.",
    );
  }
  if (allowManualCompletion) return false;
  throw new Error(
    "TravelPortal login did not reach the app after password submission.",
  );
}

async function dismissOptionalTravelPortalPrompts(
  stagehand: Stagehand,
  page: Page,
  tag: string,
) {
  const text = await visibleText(page, 4_000);
  if (
    !/(passkey|notifications?|mobile app|setup|set up|onboarding|tips|skip|not now|maybe later)/i.test(
      text,
    )
  ) {
    return;
  }

  log(tag, "Dismissing optional TravelPortal prompts...");
  await stagehand
    .act(
      [
        "If TravelPortal is showing an optional setup prompt for passkeys, notifications,",
        "mobile app install, onboarding, or tips, choose Skip, Not now,",
        "Maybe later, or Continue without it.",
        "Do not interact with MFA, verification, CAPTCHA, password, or security prompts.",
      ].join(" "),
      { page: page },
    )
    .then((result) => result.data)
    .catch(() => undefined);
}

async function verifyTravelPortalContextReady(
  stagehand: Stagehand,
  page: Page,
  tag: string,
): Promise<boolean> {
  await page.waitForTimeout(3_000);
  await dismissOptionalTravelPortalPrompts(stagehand, page, tag);

  let text = await waitForText(
    page,
    async (body) =>
      (await travel_portalAppAuthenticated(page)) ||
      hasHumanGate(await page.url(), body) ||
      /\b(sign in|log in|email|username|password)\b/i.test(body),
    30_000,
    1_000,
  );
  if (await travel_portalAppAuthenticated(page)) return true;

  log(tag, "Opening TravelPortal app URL to verify saved context...");
  try {
    await page.goto(TRAVEL_PORTAL_APP_URL, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
  } catch (error) {
    if (new URL(await page.url()).origin !== "https://app.travel.example") throw error;
    log(
      tag,
      "TravelPortal app navigation timed out after reaching app.travel.example; continuing verification.",
    );
  }

  await page.waitForLoadState("networkidle", 10_000).catch(() => undefined);
  text = await waitForText(
    page,
    async (body) =>
      (await travel_portalAppAuthenticated(page)) ||
      hasHumanGate(await page.url(), body) ||
      /\b(sign in|log in|email|username|password)\b/i.test(body),
    60_000,
    1_000,
  );
  if (await travel_portalAppAuthenticated(page)) return true;

  const snippet = (await visibleText(page, 500)) || "(blank page)";
  log(tag, `Context verification inconclusive at ${await page.url()}: ${snippet}`);
  return false;
}

async function searchTravelPortalFlights(
  stagehand: Stagehand,
  page: Page,
  route: Route,
  tag: string,
  email?: string,
) {
  let text = await visibleText(page);
  if (hasHumanGate(await page.url(), text)) throw new Error(humanGateMessage());

  log(
    tag,
    `Searching TravelPortal with agent(): ${route.origin} to ${route.dest} on ${route.date}...`,
  );
  const agent = (task: Parameters<typeof runBrowserTask>[1]) =>
    runBrowserTask(stagehand, task, {
      model: browserAgentModelFor(stagehand),
      instructions: [
        "You are operating inside TravelPortal for a pricing benchmark.",
        "Your job is to get from the current visible state to flight search results.",
        "Use only the visible TravelPortal UI.",
        "Use visual actions when TravelPortal custom controls are easier to operate by sight.",
        "Do not buy, reserve, hold, select a fare, enter a password,",
        "enter MFA or verification codes, solve CAPTCHA, or bypass security checks.",
      ].join(" "),
    });

  const result = await agent({
    instruction: [
      "Complete this TravelPortal flight search from whatever page is currently visible.",
      email
        ? [
            "If TravelPortal shows a sign-in page with only an email or username field,",
            `type this account email exactly: ${email}.`,
            "Submit it with Continue, Next, or Sign In.",
            "Then wait for the TravelPortal app or travel home page to load.",
            "This is only the saved-context email checkpoint; do not enter a password.",
          ].join(" ")
        : [
            "If TravelPortal shows an email or username sign-in field, stop and report",
            "that TRAVEL_PORTAL_EMAIL is required for the saved-context email checkpoint.",
          ].join(" "),
      "If TravelPortal shows MFA, email verification, magic-link confirmation, CAPTCHA,",
      "a password field, or any other security prompt, stop and report the blocker.",
      "Dismiss optional passkey, notification, mobile app, onboarding, or tips prompts",
      "only by choosing Skip, Not now, Maybe later, or Continue without it.",
      "Once the TravelPortal home or travel page is visible, click the collapsed Search Flights bar.",
      "The collapsed search launcher may be labeled Search Flights, Search flights,",
      "Book a flight, Where to?, Location, or similar.",
      "After clicking it, wait for the flight search panel to expand and show fields",
      "such as From, To, Depart, Return, trip type, and Search.",
      "In the expanded form, use the Flights tab.",
      "Change the trip type to One-way.",
      "Before searching, confirm the form shows One-way or One way, not Round trip, Round-trip, or Return.",
      `Set From to ${route.origin} and To to ${route.dest}.`,
      `Choose airport autocomplete options with codes ${route.origin} and ${route.dest}.`,
      `Set Depart date to ${formatRouteDate(route.date)} (${route.date}).`,
      "Leave Return date empty.",
      "Enable Nonstop flights only if that option is available.",
      "Click the flight form Search button.",
      "After clicking Search, stop as soon as either flight results, prices,",
      "or TravelPortal's search-progress modal is visible.",
      "The search-progress modal may say Checking with an airline, One-way flight,",
      "No hidden fees, or that TravelPortal shows the full price upfront.",
      "Do not call done while still on the email checkpoint, while the Search Flights",
      "bar is still collapsed, or while the expanded flight form has not been submitted.",
    ].join(" "),
    maxSteps: 28,

    waitBetweenActions: envNumber("TRAVEL_PORTAL_AGENT_WAIT_MS", 1_500),
    context: [
      "The goal is only to reach flight search results.",
      "After submitting the search, the visible loading/progress modal is enough",
      "for you to stop; the script will wait for the final results separately.",
      "A saved Browserbase context can still show a one-field email checkpoint",
      "before opening the app.",
      "The TravelPortal flight form starts collapsed behind the Search Flights bar,",
      "so click that launcher before trying to fill From, To, date, or trip type.",
      "The benchmark compares one-way fares only; do not submit a round-trip search.",
      "Stop if blocked by authentication, MFA, email verification, CAPTCHA,",
      "password entry, or any other security prompt.",
    ].join(" "),
  });

  log(
    tag,
    `Flight search agent: ${result.completed || result.success ? "completed" : "incomplete"} - ${result.message}`,
  );

  text = await visibleText(page);
  if (
    !hasFlightResults(text) &&
    !hasTravelPortalSearchProgress(text) &&
    !hasHumanGate(await page.url(), text)
  ) {
    log(tag, "Checking whether TravelPortal search still needs a final submit...");
    const submitted = await submitTravelPortalFlightSearchFallback(page, tag);
    if (!submitted)
      log(
        tag,
        "Could not confirm a deterministic TravelPortal search submit; waiting for page state.",
      );
  }

  const searchSubmitTimeoutMs = envNumber(
    "TRAVEL_PORTAL_SEARCH_SUBMIT_TIMEOUT_MS",
    90_000,
  );
  text = await waitForText(
    page,
    async (body) =>
      hasFlightResults(body) ||
      hasTravelPortalSearchProgress(body) ||
      hasHumanGate(await page.url(), body),
    searchSubmitTimeoutMs,
    1_000,
  );
  if (hasHumanGate(await page.url(), text)) throw new Error(humanGateMessage());
  if (hasTravelPortalSearchProgress(text) && !hasFlightResults(text)) {
    log(tag, "TravelPortal search submitted; waiting for fare results...");
    text = await waitForText(
      page,
      async (body) =>
        hasFlightResults(body) ||
        hasTravelPortalNoAvailability(body) ||
        hasHumanGate(await page.url(), body),
      envNumber("TRAVEL_PORTAL_RESULTS_TIMEOUT_MS", 180_000),
      2_000,
    );
  }

  if (hasHumanGate(await page.url(), text)) throw new Error(humanGateMessage());
  if (!hasFlightResults(text) && !hasTravelPortalNoAvailability(text)) {
    throw new Error(
      "TravelPortal search did not finish loading visible flight prices.",
    );
  }
}

async function shopTravelPortal(
  route: Route,
  useBrowserbase: boolean,
): Promise<ShopResult> {
  const tag = `\x1b[36mTravelPortal${RESET}`;
  const t0 = Date.now();
  const contextId = useBrowserbase ? travel_portalContextId() : undefined;
  const email = process.env.TRAVEL_PORTAL_EMAIL;
  const password = process.env.TRAVEL_PORTAL_PASSWORD;

  if (!contextId && (!email || !password)) {
    return failedShop(
      "TravelPortal",
      "NV",
      t0,
      "Missing TRAVEL_PORTAL_CONTEXT_ID or TRAVEL_PORTAL_EMAIL/TRAVEL_PORTAL_PASSWORD",
      "missing credentials",
    );
  }

  log(
    tag,
    contextId
      ? `Launching with saved Browserbase context ${contextId}...`
      : "Launching without a saved Browserbase context; login credentials are required...",
  );
  let stagehand: Stagehand | undefined;

  let sessionId: string | undefined;
  try {
    stagehand = await createStagehand({
      useBrowserbase,
      contextId,
      persistContext: Boolean(contextId),
      timeout: envNumber("TRAVEL_PORTAL_SESSION_TIMEOUT_SECONDS", 900),
      demo: contextId ? "travel-portal-reuse-context" : "travel-portal-login",
    });
    sessionId = stagehand.browser.sessionId;
    if (sessionId) log(tag, `Session: ${sessionId}`);

    const page = (await stagehand.browser.context.activePage())!;
    await ensureTravelPortalLogin({
      stagehand,
      page,
      tag,
      email,
      password,
      contextId,
    });
    await dismissOptionalTravelPortalPrompts(stagehand, page, tag);
    await searchTravelPortalFlights(stagehand, page, route, tag, email);

    log(tag, "Extracting cheapest TravelPortal fare...");
    const extracted = (
      await stagehand.extract(
        [
          "Look at the TravelPortal flight results page.",
          "Confirm these are one-way flight results, not round-trip results.",
          ONE_WAY_PRICE_EXTRACT_INSTRUCTIONS,
          "Find the cheapest one-way NONSTOP economy flight visible.",
          "Return its price as a number with no currency symbol,",
          "the airline name, and the departure/arrival times.",
          "If no nonstop is shown, return null for nonstop fields.",
          "Also return the cheapest one-way overall economy price.",
        ].join(" "),
        FlightExtractSchema,
        { page: page },
      )
    ).data;

    const elapsedMs = Date.now() - t0;
    log(
      tag,
      `Cheapest one-way nonstop: ${formatPrice(extracted.cheapestNonstopPrice)} ` +
        `(${extracted.airlineForCheapestNonstop ?? "-"}, ${(elapsedMs / 1000).toFixed(1)}s)`,
    );

    return {
      sourceName: "TravelPortal",
      sourceCode: "NV",
      cheapestNonstop: extracted.cheapestNonstopPrice,
      cheapestOverall: extracted.cheapestOverallPrice,
      airline: extracted.airlineForCheapestNonstop,
      flightTimes: extracted.flightTimes,
      notes: extracted.notes,
      elapsedMs,
      startedAt: new Date(t0).toISOString(),
      observedAt: new Date().toISOString(),
      sessionId,
    };
  } catch (error) {
    log(
      tag,
      `\x1b[31mError: ${error instanceof Error ? error.message : String(error)}${RESET}`,
    );
    return failedShop(
      "TravelPortal",
      "NV",
      t0,
      "error during shopping",
      error,
      sessionId,
    );
  } finally {
    await stagehand?.close().catch(() => undefined);
  }
}

async function shopSource(
  source: Source,
  route: Route,
  useBrowserbase: boolean,
): Promise<ShopResult> {
  const tag = `${source.color}${source.name}${RESET}`;
  const t0 = Date.now();
  let stagehand: Stagehand | undefined;

  let sessionId: string | undefined;
  try {
    stagehand = await createStagehand({
      useBrowserbase,
      demo: `external-${source.code}`,
    });
    log(tag, "Launching browser...");

    sessionId = stagehand.browser.sessionId;
    if (sessionId) log(tag, `Session: ${sessionId}`);

    const page = (await stagehand.browser.context.activePage())!;
    log(tag, `Opening ${source.name} results...`);
    await page.goto(source.urlFor(route), {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });

    if (await dismissCommonConsentBanners(stagehand, page))
      log(tag, "Dismissed consent banner.");
    await ensureExternalOneWayPricing(stagehand, page, source, route, tag);

    log(tag, "Waiting for fare text...");
    const text = await waitForText(
      page,
      async (body) => PRICE_TEXT_RE.test(body),
      12_000,
      1_000,
    );
    if (!PRICE_TEXT_RE.test(text))
      log(
        tag,
        "No fare text before extraction; extracting visible page state.",
      );

    log(tag, "Extracting cheapest fare...");
    let extracted = (
      await stagehand.extract(
        `${source.extractHint}

Return the cheapest one-way NONSTOP economy flight price as a number with no currency symbol.
${ONE_WAY_PRICE_EXTRACT_INSTRUCTIONS}
Also return the airline name and departure/arrival times for that nonstop.
If no nonstop is available, set cheapestNonstopPrice to null.
Also return cheapestOverallPrice for the cheapest one-way economy fare of any kind.
In notes, briefly describe the page state.`,
        FlightExtractSchema,
        { page: page },
      )
    ).data;

    if (
      source.code === "GF" &&
      extracted.cheapestNonstopPrice === null &&
      PRICE_TEXT_RE.test(await visibleText(page))
    ) {
      log(
        tag,
        "Retrying Google Flights extraction with result-card-specific instructions...",
      );
      extracted = (
        await stagehand.extract(
          [
            "Look at the visible Google Flights result cards.",
            "Use the Best departing flights and Departing flights lists.",
            "The page was opened for a one-way search and the script already attempted to select or confirm one-way mode.",
            "Do not require the literal One way label to be visible if the results list and a single departure date are visible.",
            "Return the lowest visible nonstop economy fare as cheapestNonstopPrice.",
            "Return the lowest visible economy fare of any kind as cheapestOverallPrice.",
            "Ignore prices from ads, hotels, packages, baggage fee notes, fare calendars, or filters.",
            "Set price fields to null only if the visible page explicitly shows Round trip/Round-trip/Return mode, asks for a return flight, or has no flight result prices.",
            "Also return the airline name, departure/arrival times for the nonstop, and a brief note.",
          ].join(" "),
          FlightExtractSchema,
          { page: page },
        )
      ).data;
    }

    const elapsedMs = Date.now() - t0;
    log(
      tag,
      `Cheapest one-way nonstop: ${formatPrice(extracted.cheapestNonstopPrice)} ` +
        `(${extracted.airlineForCheapestNonstop ?? "-"}, ${(elapsedMs / 1000).toFixed(1)}s)`,
    );

    return {
      sourceName: source.name,
      sourceCode: source.code,
      cheapestNonstop: extracted.cheapestNonstopPrice,
      cheapestOverall: extracted.cheapestOverallPrice,
      airline: extracted.airlineForCheapestNonstop,
      flightTimes: extracted.flightTimes,
      notes: extracted.notes,
      elapsedMs,
      startedAt: new Date(t0).toISOString(),
      observedAt: new Date().toISOString(),
      sessionId,
    };
  } catch (error) {
    log(
      tag,
      `\x1b[31mError: ${error instanceof Error ? error.message : String(error)}${RESET}`,
    );
    return failedShop(
      source.name,
      source.code,
      t0,
      "error during shopping",
      error,
      sessionId,
    );
  } finally {
    await stagehand?.close().catch(() => undefined);
  }
}

function hasUsableFare(shop: ShopResult | null | undefined): shop is ShopResult & { cheapestNonstop: number } {
  return !!shop && !shop.error && typeof shop.cheapestNonstop === "number" &&
    Number.isFinite(shop.cheapestNonstop) && shop.cheapestNonstop > 0 &&
    typeof shop.observedAt === "string" && Number.isFinite(Date.parse(shop.observedAt)) &&
    new Date(shop.observedAt).toISOString() === shop.observedAt;
}

function compareShops(travel_portalShop: ShopResult | null, externalShops: ShopResult[]) {
  const bestShop = externalShops.filter(hasUsableFare).sort((a, b) => a.cheapestNonstop - b.cheapestNonstop)[0];
  const bestExternal = bestShop ? { price: bestShop.cheapestNonstop, source: bestShop.sourceName } : null;
  const travel_portalPrice = hasUsableFare(travel_portalShop) ? travel_portalShop.cheapestNonstop : null;
  const diff = travel_portalPrice !== null && bestExternal ? travel_portalPrice - bestExternal.price : null;
  return { bestExternal, travel_portalPrice, diff, travel_portalWins: diff !== null && diff <= 5 };
}

async function benchmarkRoute(
  route: Route,
  sources: Source[],
  useBrowserbase: boolean,
  includeTravelPortal: boolean,
): Promise<RouteResult> {
  validateDepartureDate(route.date);
  divider(
    `ROUTE: ${route.label} (${route.origin} to ${route.dest}, ${route.date})`,
  );

  const sourceNames = sources.map((source) => source.name);
  if (includeTravelPortal) sourceNames.push("TravelPortal");
  log(
    "Concurrent",
    `Launching ${sourceNames.length} browsers: ${sourceNames.join(", ")}`,
  );

  const t0 = Date.now();
  const [externalShops, travel_portalShop] = await Promise.all([
    Promise.all(
      sources.map((source) => shopSource(source, route, useBrowserbase)),
    ),
    includeTravelPortal ? shopTravelPortal(route, useBrowserbase) : Promise.resolve(null),
  ]);
  log(
    "Timing",
    `All sources finished in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );

  const { bestExternal, travel_portalPrice, diff, travel_portalWins } = compareShops(travel_portalShop, externalShops);

  return {
    route,
    travel_portalShop,
    travel_portalPrice,
    externalShops,
    bestExternal,
    diff,
    travel_portalWins,
  };
}

async function setupTravelPortalContext() {
  preflightBrowserModels();
  divider("TRAVEL_PORTAL BROWSERBASE CONTEXT SETUP");

  const apiKey = requireEnv("BROWSERBASE_API_KEY");
  const email = process.env.TRAVEL_PORTAL_EMAIL;
  const password = process.env.TRAVEL_PORTAL_PASSWORD;
  const bb = new Browserbase({ apiKey });

  let contextId = travel_portalContextId();
  if (!contextId) {
    console.log("\n  Creating a new Browserbase context for TravelPortal...");
    const context = await bb.contexts.create();
    contextId = context.id;
    console.log(`  Created context: ${contextId}`);
    console.log(`  Add this to travel_portal/.env: TRAVEL_PORTAL_CONTEXT_ID=${contextId}\n`);
  } else {
    console.log(`\n  Using existing context: ${contextId}\n`);
  }

  const tag = `\x1b[36mTravelPortal setup${RESET}`;
  const stagehand = await createStagehand({
    useBrowserbase: true,
    contextId,
    persistContext: true,
    timeout: 900,
    demo: "travel-portal-context-setup",
  });

  try {
    const sessionId = stagehand.browser.sessionId;
    if (!sessionId) throw new Error("Browserbase session ID was not returned.");

    log(tag, `Session: ${sessionId}`);
    const liveUrls = await bb.sessions.debug(sessionId).catch(() => null);
    if (liveUrls) {
      console.log(
        `\n  Browserbase Live View: ${liveUrls.debuggerFullscreenUrl}`,
      );
      console.log(
        `  Browserbase Session:   https://www.browserbase.com/sessions/${sessionId}\n`,
      );
    }

    let loggedIn = await ensureTravelPortalLogin({
      stagehand,
      page: (await stagehand.browser.context.activePage())!,
      tag,
      email,
      password,
      contextId,
      allowManualCompletion: true,
      manualOnly: true,
    });

    if (!loggedIn) {
      console.log(
        "  Complete TravelPortal MFA, email verification, or magic-link login in Live View.",
      );
      console.log("  Then come back here and press Enter.\n");

      const rl = createInterface({ input, output });
      await rl.question(
        "  Press Enter after TravelPortal is logged in inside Browserbase Live View...",
      );
      rl.close();
    }

    loggedIn = await verifyTravelPortalContextReady(
      stagehand,
      (await stagehand.browser.context.activePage())!,
      tag,
    );
    if (!loggedIn) {
      throw new Error("Context authentication was not verified. Session state may persist, but app URL or a saved context alone does not prove login. Complete sign-in and verify the workspace before benchmarking.");
    }

    console.log(`\n  Verified authenticated workspace in Browserbase context: ${contextId}`);
    console.log("  Next run: npm run demo -- --single --only-travel_portal\n");
  } finally {
    await stagehand.close().catch(() => undefined);
  }
}

function selectSources() {
  if (process.argv.includes("--only-travel_portal")) return [];

  const only = getArgValue("--only");
  if (!only) return SOURCES;

  const codes = only.split(",").map((code) => code.trim());
  return SOURCES.filter((source) => codes.includes(source.code));
}

function printReport(
  results: RouteResult[],
  sources: Source[],
  includeTravelPortal: boolean,
  useBrowserbase: boolean,
  sessionsPerRoute: number,
  startedAt: number,
) {
  divider("PRICING BENCHMARK REPORT");

  console.log(`\n  Generated:  ${new Date().toLocaleString()}`);
  console.log(`  Total time: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  console.log(`  Execution mode: ${useBrowserbase ? "Browserbase Cloud" : "Local Browser"}`);
  console.log(`  Planned source attempts: ${results.length * sessionsPerRoute}\n`);
  // Derive report values from usable observations, not cached comparison fields.
  results = results.map(result => ({ ...result, ...compareShops(includeTravelPortal ? result.travel_portalShop : null, result.externalShops) }));

  console.log(
    "  Route                         TravelPortal     Best External           Diff",
  );
  console.log("  " + "-".repeat(74));

  let travel_portalWins = 0;
  let totalDiff = 0;
  let validRoutes = 0;
  let flags = 0;

  for (const result of results) {
    const travelPortal = formatPrice(result.travel_portalPrice);
    const external = result.bestExternal
      ? `${formatPrice(result.bestExternal.price)} (${result.bestExternal.source})`
      : "-";
    const diff =
      result.bestExternal && result.travel_portalPrice !== null
        ? diffString(result.travel_portalPrice, result.bestExternal.price)
        : `${DIM}-${RESET}`;

    console.log(
      `  ${result.route.label.padEnd(29)} ${travelPortal.padEnd(9)} ${external.padEnd(24)} ${diff}`,
    );

    if (result.travel_portalWins) travel_portalWins++;
    if (result.diff !== null) {
      totalDiff += result.diff;
      validRoutes++;
      if (result.diff > 5) flags++;
    }
  }

  const columns = [
    ...(includeTravelPortal ? [{ name: "TravelPortal", code: "NV" }] : []),
    ...sources.map((source) => ({ name: source.name, code: source.code })),
  ];
  console.log(`\n  ${"-".repeat(74)}`);
  console.log("  Per-source one-way nonstop prices:\n");
  console.log(
    `  Route                         ${columns.map((col) => col.name.padEnd(16)).join("")}`,
  );
  console.log("  " + "-".repeat(29 + columns.length * 16));

  for (const result of results) {
    const cells = columns.map((col) => {
      if (col.code === "NV")
        return formatPrice(hasUsableFare(result.travel_portalShop) ? result.travel_portalShop.cheapestNonstop : null).padEnd(
          16,
        );
      const shop = result.externalShops.find(
        (candidate) => candidate.sourceCode === col.code,
      );
      return formatPrice(hasUsableFare(shop) ? shop.cheapestNonstop : null).padEnd(16);
    });
    console.log(`  ${result.route.label.padEnd(29)}${cells.join("")}`);
  }

  if (useBrowserbase) {
    console.log(`\n  ${DIM}Browserbase sessions:${RESET}`);
    for (const result of results) {
      for (const shop of [
        ...(result.travel_portalShop ? [result.travel_portalShop] : []),
        ...result.externalShops,
      ]) {
        if (shop.sessionId) {
          console.log(
            `    ${shop.sourceName.padEnd(18)} ${result.route.origin}-${result.route.dest}  ` +
              `https://www.browserbase.com/sessions/${shop.sessionId}`,
          );
        }
      }
    }
  }

  const observations = results.flatMap(result => [
    ...(includeTravelPortal && result.travel_portalShop ? [result.travel_portalShop] : []), ...result.externalShops,
  ]);
  const successfulShops = observations.filter(hasUsableFare).length;
  const capturedSessions = new Set(observations.map(shop => shop.sessionId).filter(Boolean)).size;
  console.log(`\n  Successful fare observations: ${successfulShops} / ${results.length * sessionsPerRoute}`);
  console.log(`  Paired TravelPortal/external routes: ${validRoutes}`);
  if (useBrowserbase) console.log(`  Recorded Browserbase session IDs: ${capturedSessions}`);
  if (validRoutes) {
    console.log(`  TravelPortal within $5 of best external: ${travel_portalWins} / ${validRoutes}`);
    console.log(`  Average TravelPortal minus external: $${(totalDiff / validRoutes).toFixed(2)}`);
    console.log(`  Price flags: ${flags} routes where TravelPortal is >$5 pricier`);
  }
  console.log(successfulShops === 0
    ? "  Run unsuccessful: no usable fare observations."
    : validRoutes === 0
      ? "  Fare observations collected; no paired TravelPortal/external comparison available."
      : "  Paired fare observations collected for the routes above.");
  console.log("  Observation times (extraction completion in UTC):");
  for (const result of results) {
    for (const shop of [...(includeTravelPortal && result.travel_portalShop ? [result.travel_portalShop] : []), ...result.externalShops]) {
      console.log(`    ${result.route.origin}-${result.route.dest} ${shop.sourceName}: ${hasUsableFare(shop) ? shop.observedAt : "unavailable"}`);
    }
  }
  console.log("  Observation timestamps record extraction completion, not synchronized fare snapshots. Fare equivalence and authentication reuse are not established by this report.");
  return successfulShops;

}

async function main() {
  preflightBrowserModels();
  if (process.argv.includes("--setup-travel-portal-context")) {
    await setupTravelPortalContext();
    return;
  }

  divider("TRAVEL_PORTAL FLIGHT PRICING BENCHMARK");
  console.log(
    "\n  Concurrently shopping real one-way airline and OTA fares to benchmark TravelPortal pricing",
  );
  console.log("  Powered by Browserbase + Stagehand\n");

  const forceLocal = process.argv.includes("--local");
  const useBrowserbase =
    !forceLocal &&
    !!process.env.BROWSERBASE_API_KEY;
  const sources = selectSources();
  const hasContext = !!travel_portalContextId() && useBrowserbase;
  const hasCredentials =
    !!process.env.TRAVEL_PORTAL_EMAIL && !!process.env.TRAVEL_PORTAL_PASSWORD;
  const includeTravelPortal =
    !process.argv.includes("--no-travel_portal") && (hasContext || hasCredentials);

  if (process.argv.includes("--only-travel_portal") && !includeTravelPortal) {
    throw new Error(
      "Missing TRAVEL_PORTAL_CONTEXT_ID or TRAVEL_PORTAL_EMAIL/TRAVEL_PORTAL_PASSWORD for --only-travel_portal.",
    );
  }

  const date = departureDate(process.env.BENCHMARK_DEPARTURE_DATE);
  const routes: Route[] = (process.argv.includes("--single") ? [ROUTES[0]] : ROUTES).map(route => ({ ...route, date }));
  for (const route of routes) validateDepartureDate(route.date);
  const sessionsPerRoute = sources.length + (includeTravelPortal ? 1 : 0);
  if (!sessionsPerRoute) throw new Error("Select at least one source before starting a benchmark.");

  console.log(
    `  Mode:       ${useBrowserbase ? "Browserbase Cloud" : "Local Browser"}`,
  );
  console.log(
    `  External:   ${sources.length ? sources.map((source) => source.name).join(", ") : "skipped"}`,
  );
  console.log(
    `  TravelPortal:      ${includeTravelPortal ? (hasContext ? "saved Browserbase context" : "credentials") : "skipped"}`,
  );
  console.log(
    `  Model:      ${process.env.MODEL_NAME || "anthropic/claude-sonnet-4-20250514"}`,
  );
  console.log(`  Routes:     ${routes.length}`);
  console.log(`  Sessions:   ${routes.length * sessionsPerRoute}\n`);

  const startedAt = Date.now();
  const results: RouteResult[] = [];
  for (const route of routes) {
    results.push(
      await benchmarkRoute(route, sources, useBrowserbase, includeTravelPortal),
    );
  }

  const successfulShops = printReport(
    results,
    sources,
    includeTravelPortal,
    useBrowserbase,
    sessionsPerRoute,
    startedAt,
  );
  if (successfulShops === 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("\nFatal error:", error);
  process.exit(1);
});
