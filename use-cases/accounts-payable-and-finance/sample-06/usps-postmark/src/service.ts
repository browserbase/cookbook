/**
 * USPS postmark screenshot service — prototype for Payment Provider Atlas 83(b) filings.
 *
 * Given a filing id + USPS certified-mail tracking number:
 *   1. Creates a Browserbase stealth session (residential proxy, CAPTCHA solving).
 *   2. Navigates to the USPS tracking page for the tracking number.
 *   3. Expands "See All Tracking History".
 *   4. Validates the page shows a postmark/acceptance scan event.
 *   5. Captures the page as a PDF (print rendering, falls back to a
 *      full-page screenshot wrapped in a PDF).
 *   6. Saves the PDF (local ./out stub standing in for S3) and returns the
 *      event payload { filing_id, file_id } a consumer would receive.
 *
 * Deterministic by design: plain Playwright selectors, no LLM in the loop.
 */
import { chromium, type Page } from "playwright-core";
import { PDFDocument } from "pdf-lib";
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { findPostmarkEvidence, hasPostmarkPattern } from "./evidence.js";
import type { FailureCode } from "./retry-policy.js";

const BB_API = "https://api.browserbase.com/v1";
const TRACK_URL = (n: string) => `https://tools.usps.com/tracking/${n}`;

/**
 * Navigate directly to the tracking page. A homepage "type the number into
 * search" warm-up was tried and dropped: it added 30-60s of latency without
 * improving success. The real failure isn't that direct navigation looks like
 * a bot — it's that the timeline XHR fires before Akamai validates the
 * session (see the reload loop in takePostmarkScreenshot). Direct + reload
 * measured the same success as warm-up + reload, far faster.
 */
async function navigateToTracking(
  page: Page,
  trackingNumber: string,
): Promise<void> {
  await page.goto(TRACK_URL(trackingNumber), {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
}

/**
 * Patterns that count as a postmark: a physical scan proving USPS possession.
 * Deliberately excludes "Pre-Shipment" / "Package Acceptance Pending" — those
 * mean USPS does NOT yet have the mailpiece.
 */
const BLOCK_PATTERNS = [
  /access denied/i,
  /reference #\d/i,
  /request unsuccessful/i,
  /pardon our interruption/i,
  /verify you are a human/i,
];

export interface ScreenshotRequest {
  filingId: string;
  trackingNumber: string;
  advancedStealth?: boolean;
  outDir?: string;
}

export interface ScreenshotResult {
  ok: boolean;
  filingId: string;
  fileId?: string;
  pdfPath?: string;
  postmarkEvent?: string;
  latestStatus?: string;
  sessionReplayUrl: string;
  failureReason?: string;
  failureCode?: FailureCode;
  durationMs: number;
}

interface BBSession {
  id: string;
  connectUrl: string;
}

/**
 * Route through a custom external proxy instead of Browserbase's shared pool.
 * Set EXTERNAL_PROXY="host:port:username:password". Returns undefined (→ falls
 * back to `proxies: true`) if the env var is absent.
 */
function externalProxy(): unknown | undefined {
  const raw = process.env.EXTERNAL_PROXY;
  if (!raw) return undefined;
  const [host, port, username, password] = raw.split(":");
  if (!host || !port) return undefined;
  return [
    {
      type: "external",
      server: `http://${host}:${port}`,
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
    },
  ];
}

async function createSession(advancedStealth: boolean): Promise<BBSession> {
  const res = await fetch(`${BB_API}/sessions`, {
    method: "POST",
    headers: {
      "x-bb-api-key": process.env.BROWSERBASE_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      proxies: externalProxy() ?? true,
      browserSettings: {
        verified: true, // Browserbase Verified mode — the anti-bot layer
        blockAds: true,
        solveCaptchas: true,
        // No custom viewport / advancedStealth: verified mode manages the
        // fingerprint itself; only layer advancedStealth on explicit request.
        ...(advancedStealth ? { advancedStealth: true } : {}),
      },
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Browserbase session create failed: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as BBSession;
}

async function pageText(page: Page): Promise<string> {
  return page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
}

function isBlocked(text: string, title: string): boolean {
  return BLOCK_PATTERNS.some((p) => p.test(text) || p.test(title));
}

/**
 * Click "See All Tracking History" and wait for the expanded state.
 * The toggle is `a.expand-collapse-history`; its label flips to
 * "Hide Tracking History" once the full event list is shown.
 */
async function expandTrackingHistory(page: Page): Promise<boolean> {
  const toggle = page
    .locator("a.expand-collapse-history")
    .locator("visible=true")
    .first();
  const expanded = () =>
    page
      .locator('a.expand-collapse-history:has-text("Hide Tracking History")')
      .first()
      .waitFor({ state: "attached", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

  try {
    const label = (await toggle.textContent({ timeout: 5_000 }))?.trim() ?? "";
    if (/hide tracking history/i.test(label)) return true; // already expanded
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click({ timeout: 5_000 });
    if (await expanded()) return true;
  } catch {
    // fall through to text-based fallback
  }
  // Fallback: any visible element with the exact link text.
  try {
    await page
      .locator("a, span, div", { hasText: /^See All Tracking History$/i })
      .locator("visible=true")
      .last()
      .click({ timeout: 5_000 });
    return await expanded();
  } catch {
    return expanded();
  }
}

/** Render the page to PDF; fall back to full-page PNG wrapped in a PDF. */
async function capturePdf(page: Page): Promise<Buffer> {
  try {
    return await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0.4in", bottom: "0.4in", left: "0.4in", right: "0.4in" },
    });
  } catch {
    const png = await page.screenshot({ fullPage: true, type: "png" });
    const doc = await PDFDocument.create();
    const img = await doc.embedPng(png);
    // Paginate the long screenshot onto Letter-proportioned pages.
    const pageWidth = 612;
    const scale = pageWidth / img.width;
    const pdfPage = doc.addPage([pageWidth, img.height * scale]);
    pdfPage.drawImage(img, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: img.height * scale,
    });
    return Buffer.from(await doc.save());
  }
}

export function filingDirectory(outDir: string, filingId: string): string {
  if (typeof filingId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(filingId)) {
    throw new TypeError("filingId must be a plain identifier (1-128 characters)");
  }
  const root = path.resolve(outDir);
  const directory = path.resolve(root, filingId);
  if (path.dirname(directory) !== root) throw new Error("Filing path escapes output directory");
  return directory;
}

export async function takePostmarkScreenshot(
  req: ScreenshotRequest,
): Promise<ScreenshotResult> {
  const start = Date.now();
  const outDir = req.outDir ?? path.resolve("out");
  const filingDir = filingDirectory(outDir, req.filingId);
  if (typeof req.trackingNumber !== "string" || !/^[A-Za-z0-9-]{1,128}$/.test(req.trackingNumber)) {
    throw new TypeError("trackingNumber must contain only letters, digits, and hyphens");
  }
  const session = await createSession(req.advancedStealth ?? false);
  const replayUrl = `https://www.browserbase.com/sessions/${session.id}`;

  // Print the live view immediately so a human can watch the run in a browser.
  try {
    const dbg = await fetch(`${BB_API}/sessions/${session.id}/debug`, {
      headers: { "x-bb-api-key": process.env.BROWSERBASE_API_KEY! },
    }).then((r) => r.json() as Promise<{ debuggerFullscreenUrl?: string }>);
    if (dbg.debuggerFullscreenUrl)
      console.log(`  live view: ${dbg.debuggerFullscreenUrl}`);
  } catch {
    // live view is a nicety; never fail the run over it
  }

  const browser = await chromium.connectOverCDP(session.connectUrl);

  const fail = (failureCode: FailureCode, reason: string): ScreenshotResult => ({
    ok: false,
    filingId: req.filingId,
    sessionReplayUrl: replayUrl,
    failureReason: reason,
    failureCode,
    durationMs: Date.now() - start,
  });

  try {
    const page =
      browser.contexts()[0]?.pages()[0] ??
      (await browser.contexts()[0].newPage());
    page.setDefaultTimeout(30_000);

    await navigateToTracking(page, req.trackingNumber);

    // Wait for the tracking widget to hydrate: the history toggle, an event
    // step, or a "no data" message.
    //
    // USPS runs Akamai. The page shell always loads, but the widget's XHR for
    // the timeline often fires BEFORE Akamai validates the session and gets
    // 302'd to an empty body → blank page. The sensor keeps scoring in the
    // background, so reloading a few seconds later re-fires that XHR with a
    // now-validated cookie and succeeds. Measured: ~1/4 single-shot vs ~3/5
    // with in-session reloads. Exhausting reloads → escalate to a fresh
    // session (new IP/fingerprint), which the CLI does automatically.
    const widgetSel =
      "a.expand-collapse-history, .tb-step, .banner-content, .red-banner";
    let widget = await page
      .waitForSelector(widgetSel, { timeout: 25_000 })
      .catch(() => null);
    for (let reload = 0; !widget && reload < 3; reload++) {
      await page.waitForTimeout(4_000); // let the Akamai sensor validate
      await page
        .reload({ waitUntil: "domcontentloaded", timeout: 60_000 })
        .catch(() => {});
      widget = await page
        .waitForSelector(widgetSel, { timeout: 25_000 })
        .catch(() => null);
    }

    let text = await pageText(page);
    const title = await page.title().catch(() => "");
    if (isBlocked(text, title))
      return fail("anti_bot_blocked", `blocked by anti-bot (title: "${title}")`);
    if (
      /status not available|could not locate the tracking information/i.test(
        text,
      )
    ) {
      return fail(
        "tracking_not_found",
        "USPS has no tracking data for this number (expired or not yet in system)",
      );
    }
    if (!widget)
      return fail(
        "tracking_widget_timeout",
        "tracking widget never rendered after reloads (Akamai sensor hold)",
      );

    const expanded = await expandTrackingHistory(page);
    if (!expanded)
      return fail("history_unavailable", "could not expand tracking history");
    await page.waitForTimeout(1_000);

    text = await pageText(page);
    const timelineEvents = await page
      .locator(".tb-step")
      .allInnerTexts()
      .catch(() => []);
    const evidence = findPostmarkEvidence(
      timelineEvents,
      text,
      req.trackingNumber,
    );
    if (
      !text
        .replace(/[^A-Za-z0-9]/g, "")
        .toLowerCase()
        .includes(
          req.trackingNumber.replace(/[^A-Za-z0-9]/g, "").toLowerCase(),
        )
    )
      return fail(
        "tracking_identity_mismatch",
        "displayed tracking record does not match the requested tracking number",
      );
    if (!evidence) {
      const matchingEvents = timelineEvents.filter((event) =>
        hasPostmarkPattern(event),
      );
      return fail(
        matchingEvents.length > 1 ? "ambiguous_tracking_evidence" : "postmark_not_found",
        matchingEvents.length > 1
          ? "tracking timeline contains multiple ambiguous acceptance events"
          : "tracking timeline shows no acceptance/postmark event yet",
      );
    }
    const { postmarkEvent, latestStatus } = evidence;

    const pdf = await capturePdf(page);
    const fileId = `file_usps_${req.trackingNumber.slice(-8)}_${Date.now()}`;
    const pdfPath = path.join(filingDir, `${fileId}.pdf`);
    await mkdir(path.dirname(pdfPath), { recursive: true });
    await writeFile(pdfPath, pdf); // S3 stub: swap for s3.putObject in prod

    // Event a downstream Atlas consumer would receive.
    const event = {
      type: "postmark_screenshot.captured",
      filing_id: req.filingId,
      file_id: fileId,
      tracking_number: req.trackingNumber,
      postmark_event: postmarkEvent,
      latest_status: latestStatus,
      session_replay: replayUrl,
      captured_at: new Date().toISOString(),
    };
    await appendFile(
      path.join(outDir, "events.jsonl"),
      JSON.stringify(event) + "\n",
    );

    return {
      ok: true,
      filingId: req.filingId,
      fileId,
      pdfPath,
      postmarkEvent,
      latestStatus,
      sessionReplayUrl: replayUrl,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return fail(
      "capture_failed",
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    await browser.close().catch(() => {});
  }
}
