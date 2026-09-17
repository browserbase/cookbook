import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import "dotenv/config";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";

// ============================================================================
// CONFIG — tweak in one place
// ============================================================================

const TARGET_URL = "https://www.saucedemo.com";
const FALLBACK_URL = "https://demo.applitools.com";
// Configured model identifier; provider access and the full flow are unverified.
const MODEL = "openai/gpt-4o";

// ============================================================================
// MOCK NAVIGATION SIGNALS — fixed example data; description becomes act() text
// ============================================================================

type InstrumentationSignal = {
  elementId: string;
  selector: string;
  description: string;
  clickFrequency: number;
  typicalOrder: number;
  partOfFunnels: string[];
};
type InstrumentationContext = {
  pageUrl: string;
  signals: InstrumentationSignal[];
  recommendedSequence: string[];
  avgSessionDuration: string;
  source: "mock";
};

async function getMockInstrumentationSignals(pageUrl: string): Promise<InstrumentationContext> {
  console.log(`[Mock navigation] loading fixed example signals for ${pageUrl}`);
  console.log("[Mock navigation] No MCP discovery, connection, or tool call is implemented in this demo.");
  return {
    pageUrl,
    avgSessionDuration: "78s",
    signals: [
      {
        elementId: "login-username",
        selector: "[data-test='username']",
        description: "type 'standard_user' into the Username input field",
        clickFrequency: 0.99,
        typicalOrder: 1,
        partOfFunnels: ["auth", "checkout"],
      },
      {
        elementId: "login-password",
        selector: "[data-test='password']",
        description: "type 'secret_sauce' into the Password input field",
        clickFrequency: 0.99,
        typicalOrder: 2,
        partOfFunnels: ["auth", "checkout"],
      },
      {
        elementId: "login-submit",
        selector: "[data-test='login-button']",
        description: "click the Login button",
        clickFrequency: 0.95,
        typicalOrder: 3,
        partOfFunnels: ["auth", "checkout"],
      },
      {
        elementId: "add-backpack",
        selector: "[data-test='add-to-cart-sauce-labs-backpack']",
        description:
          "click the Add to Cart button on the Sauce Labs Backpack item",
        clickFrequency: 0.78,
        typicalOrder: 4,
        partOfFunnels: ["checkout"],
      },
      {
        elementId: "cart-icon",
        selector: ".shopping_cart_link",
        description: "click the shopping cart icon in the top-right header",
        clickFrequency: 0.72,
        typicalOrder: 5,
        partOfFunnels: ["checkout"],
      },
      {
        elementId: "checkout-btn",
        selector: "[data-test='checkout']",
        description: "click the Checkout button",
        clickFrequency: 0.68,
        typicalOrder: 6,
        partOfFunnels: ["checkout"],
      },
      {
        elementId: "first-name",
        selector: "[data-test='firstName']",
        description: "type 'instrumentation client' into the First Name field",
        clickFrequency: 0.66,
        typicalOrder: 7,
        partOfFunnels: ["checkout"],
      },
      {
        elementId: "last-name",
        selector: "[data-test='lastName']",
        description: "type 'Demo' into the Last Name field",
        clickFrequency: 0.66,
        typicalOrder: 8,
        partOfFunnels: ["checkout"],
      },
      {
        elementId: "postal-code",
        selector: "[data-test='postalCode']",
        description: "type '94103' into the Zip/Postal Code field",
        clickFrequency: 0.66,
        typicalOrder: 9,
        partOfFunnels: ["checkout"],
      },
      {
        elementId: "continue-btn",
        selector: "[data-test='continue']",
        description: "click the Continue button",
        clickFrequency: 0.64,
        typicalOrder: 10,
        partOfFunnels: ["checkout"],
      },
      {
        elementId: "finish-btn",
        selector: "[data-test='finish']",
        description: "click the Finish button to complete the order",
        clickFrequency: 0.62,
        typicalOrder: 11,
        partOfFunnels: ["checkout"],
      },
    ],
    recommendedSequence: [
      "login-username",
      "login-password",
      "login-submit",
      "add-backpack",
      "cart-icon",
      "checkout-btn",
      "first-name",
      "last-name",
      "postal-code",
      "continue-btn",
      "finish-btn",
    ],
    source: "mock",
  };
}

// ============================================================================
// NARRATION HELPERS
// ============================================================================

function divider(label: string) {
  console.log(`\n=== ${label} ${"=".repeat(Math.max(0, 70 - label.length))}`);
}

function banner() {
  console.log("");
  console.log(
    "╔══════════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║  Browserbase × instrumentation client — Navigation Context Demo                       ║",
  );
  console.log(
    "╠══════════════════════════════════════════════════════════════════════╣",
  );
  console.log(
    "║  What Browserbase delivers to instrumentation client:                                 ║",
  );
  console.log(
    "║   • Runtime — cloud Chrome at enterprise scale (no infra to build)   ║",
  );
  console.log(
    "║   • SDK     — Stagehand turns Nav Context signals into act() calls   ║",
  );
  console.log(
    "║   • Replay  — every agent run audited & replayable                   ║",
  );
  console.log(
    "║   • Input   — fixed mock signals; no MCP connector implemented       ║",
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════════════╝",
  );
}

function panel(title: string, lines: string[]) {
  const inner = Math.max(title.length + 4, ...lines.map((l) => l.length));
  const width = inner + 4;
  const titlePart = ` ${title} `;
  const top =
    "┌─" +
    titlePart +
    "─".repeat(Math.max(0, width - 3 - titlePart.length)) +
    "┐";
  const bot = "└" + "─".repeat(width - 2) + "┘";
  console.log(top);
  for (const l of lines) console.log("│ " + l.padEnd(inner) + " │");
  console.log(bot);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  banner();

  divider("1) INIT  Browserbase + Stagehand");
  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY!,
        ...{
          browserSettings: {
            recordSession: true,
            logSession: true,
          },
        },
      }),
      model: MODEL,
    }),
  );

  const sessionId = stagehand.browser.sessionId;
  const liveURL = `https://www.browserbase.com/sessions/${stagehand.browser.sessionId}`;
  const tag = `[Browserbase ${(sessionId ?? "?").slice(0, 8)}]`;
  console.log(`${tag} session ${sessionId}`);
  console.log(`${tag} live view → ${liveURL}`);
  console.log(
    `${tag} model: ${MODEL}  (cloud Chrome — instrumentation client doesn't have to build this)`,
  );

  divider("2) NAVIGATE  enterprise SaaS proxy");
  const page = (await stagehand.browser.context.pages())[0];
  let usedURL = TARGET_URL;
  try {
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
  } catch {
    console.log(`${tag} ${TARGET_URL} unreachable, trying ${FALLBACK_URL}`);
    await page.goto(FALLBACK_URL, { waitUntil: "domcontentloaded" });
    usedURL = FALLBACK_URL;
  }
  console.log(`${tag} loaded ${usedURL}`);
  console.log(
    `${tag} (the local test page stands in for an instrumented ERP page)`,
  );

  divider("3) LOAD  mock navigation context");
  const ctx = await getMockInstrumentationSignals(usedURL);
  console.log(
    `[instrumentation client] source: ${ctx.source} · ${ctx.signals.length} signals · avg session ${ctx.avgSessionDuration}`,
  );

  divider("4) INPUT  fixed mock signals");
  console.log(
    "These fixed fixture records illustrate a navigation-context shape. The code maps descriptions to Stagehand actions; it has not retrieved instrumentation client data.",
  );
  console.table(
    ctx.signals.map((s) => ({
      elementId: s.elementId,
      selector: s.selector,
      clickFrequency: s.clickFrequency,
      typicalOrder: s.typicalOrder,
    })),
  );

  divider("5) EXECUTE  Browserbase + Stagehand consume each signal");
  const byId = new Map(ctx.signals.map((s) => [s.elementId, s]));
  let attemptedActCalls = 0;
  let successfulActCalls = 0;
  let totalActMs = 0;

  for (const elementId of ctx.recommendedSequence) {
    const sig = byId.get(elementId);
    if (!sig) continue;
    const instruction = sig.description ?? sig.selector;
    console.log(
      `${tag} consuming mock signal: ${sig.elementId} (freq ${sig.clickFrequency}, order ${sig.typicalOrder})`,
    );
    console.log(`         Stagehand act(): "${instruction}"`);
    const t0 = performance.now();
    attemptedActCalls += 1;
    const result = await stagehand.act(instruction);
    const ms = performance.now() - t0;
    if (result?.data?.success !== true) {
      const detail = result?.data?.message?.trim();
      throw new Error(
        `Stagehand did not confirm action ${sig.elementId}${detail ? `: ${detail}` : ""}`,
      );
    }
    successfulActCalls += 1;
    totalActMs += ms;
    console.log(
      `         ✓ executed in ${ms.toFixed(0)}ms by Browserbase Chrome`,
    );
  }

  divider("6) EXTRACT  confirm end state");
  const endState = (
    await stagehand.extract(
      "Determine whether the checkout completed. Only set checkoutComplete true when a visible order-confirmation message proves completion. Quote that visible evidence.",
      z.object({
        checkoutComplete: z.boolean(),
        evidence: z.string(),
      }),
    )
  ).data;
  if (!endState.checkoutComplete || !endState.evidence.trim()) {
    throw new Error("Checkout completion was not confirmed from the visible page.");
  }
  console.log(`Confirmed checkout: ${endState.evidence}`);

  divider("7) SUMMARY  what Browserbase delivered to instrumentation client");
  const metrics = await stagehand.metrics();
  const totalSec = (totalActMs / 1000).toFixed(1);
  const perStepSec = successfulActCalls
    ? (totalActMs / successfulActCalls / 1000).toFixed(2)
    : "—";
  const totalInfMs = metrics.totalInferenceTimeMs ?? 0;
  const totalTokens =
    (metrics.totalPromptTokens ?? 0) + (metrics.totalCompletionTokens ?? 0);

  console.log("");
  console.log(`Input from fixture: ${ctx.recommendedSequence.length} mock navigation signals`);
  console.log(
    `Stagehand confirmed ${successfulActCalls}/${attemptedActCalls} SDK action invocations and the visible checkout end state.\n`,
  );
  panel("What Browserbase delivered to instrumentation client (this run)", [
    `─ Instrumented result (this run only) ─`,
    `  Stagehand act() invocations:           ${attemptedActCalls}`,
    `  Confirmed successful invocations:      ${successfulActCalls}`,
    `  Mean successful act() duration:        ${perStepSec}s`,
    `  Total successful act() duration:       ${totalSec}s`,
    `  Visible completion evidence:           ${endState.evidence}`,
    ``,
    `─ Runtime (what instrumentation client doesn't build) ─`,
    `  Cloud Chrome session:  ${sessionId ?? "—"}`,
    `  Recording (audit):     rrweb video + session logs`,
    `  Isolation:             per-session, enterprise tier`,
    `  SDK:                   Stagehand v4 — custom fixture-to-act mapping; no MCP connector`,
    `  LLM inference cost:    ${(totalInfMs / 1000).toFixed(2)}s · ${totalTokens} tokens`,
    `  Replay URL:            ${liveURL ?? "—"}`,
  ]);

  divider("8) CLOSE  this URL is the audit artifact you ship to your customer");
  console.log(`${tag} replay → ${liveURL}`);
  console.log(
    "Use the replay to inspect this run's recorded browser behavior.",
  );
  await stagehand.close();
  await stagehand.browser.close();
}

main().catch((err) => {
  console.error("\nDemo failed:", err);
  process.exit(1);
});
