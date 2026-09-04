import type { Page } from "playwright-core";

export type Outcome = "ok" | "blocked" | "empty";

// Substrings that, in the absence of a captured payload, indicate an anti-bot
// challenge/interstitial rather than a normal product page.
const CHALLENGE_SIGNS = [
  "verify you are a human",
  "are you a robot",
  "unusual traffic",
  "access denied",
  "access to this page has been denied",
  "px-captcha",
  "captcha-delivery",
  "geo.captcha-delivery",
  "cf-challenge",
  "checking your browser",
  "hold on while we check",
  "please verify",
  "request blocked",
  "forbidden",
];

export interface CaptchaTelemetry {
  encountered: number; // browserbase-solving-started events
  solved: number; // browserbase-solving-finished events
  detach: () => void;
}

/** Count Browserbase CAPTCHA-solve console events on the raw Playwright page. */
export function attachCaptchaTelemetry(page: Page): CaptchaTelemetry {
  const t: CaptchaTelemetry = { encountered: 0, solved: 0, detach: () => {} };
  const onConsole = (msg: { text(): string }) => {
    const text = msg.text();
    if (text.includes("browserbase-solving-started")) t.encountered++;
    else if (text.includes("browserbase-solving-finished")) t.solved++;
  };
  page.on("console", onConsole as any);
  t.detach = () => page.off("console", onConsole as any);
  return t;
}

export interface ClassifyInput {
  navStatus: number | null; // main navigation response status
  captureOk: boolean; // did the adapter return a payload?
  bodyText: string; // page HTML/text (any case)
  bodyBytes: number; // wire bytes transferred
}

/**
 * Classify a fetch as ok / blocked / empty. `blocked` is worth retrying with a
 * fresh session (new IP); `empty` (payload missing but page rendered fine) is
 * more likely site/DOM drift, so retrying won't help.
 */
export function classify(i: ClassifyInput): {
  outcome: Outcome;
  reason: string;
} {
  if (i.captureOk) return { outcome: "ok", reason: "payload captured" };

  if (i.navStatus === 403 || i.navStatus === 429 || i.navStatus === 503) {
    return { outcome: "blocked", reason: `HTTP ${i.navStatus}` };
  }

  const sample = i.bodyText.slice(0, 20_000).toLowerCase();
  const sign = CHALLENGE_SIGNS.find((s) => sample.includes(s));
  if (sign)
    return { outcome: "blocked", reason: `challenge marker: "${sign}"` };

  if (i.bodyBytes < 1500) {
    return { outcome: "blocked", reason: "empty/near-empty body, no payload" };
  }
  return { outcome: "empty", reason: "no payload (possible site/DOM drift)" };
}
