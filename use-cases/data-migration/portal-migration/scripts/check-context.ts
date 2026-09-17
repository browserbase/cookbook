/**
 * Check whether a saved platform context still has a valid login.
 *
 *   npm run check-context            # checks platform-a (default)
 *   npm run check-context platform-b
 *
 * Opens a read-only session on the saved context, navigates to the platform's authed area, and
 * checks a POSITIVE signal: did we stay inside that authed area, or get bounced out (to a login page
 * or marketing homepage)? Validity = the final URL is still under the authed URL's origin + first
 * path segment. This works for any platform — add one line to AUTHED_URL for a new site. Releases
 * the session when done.
 */
import { platformByKey, resolveContextId } from "../src/platforms.js";
import { makeWorkflowStagehand } from "../src/stagehand-session.js";

// Per-platform authed landing page. A logged-out session won't stay under its origin+first-segment.
const AUTHED_URL: Record<string, string> = {
  "platform-a": "https://platform-a.example.invalid/dashboard/",
  "platform-b": "https://platform-b.example.invalid/merchants/home",
};

const AUTHED_SIGNAL: Record<string, string> = {
  "platform-a": 'a[href*="/dashboard/account"]',
  "platform-b": 'a[href*="/merchants/settings"]',
};

/** The "authed area" prefix: origin + first path segment (e.g. https://platform-a.example.invalid/dashboard). */
export function authedPrefix(url: string): string {
  const u = new URL(url);
  const seg = u.pathname.split("/").filter(Boolean)[0] ?? "";
  return u.origin + (seg ? "/" + seg : "");
}

export function isWithinAuthedArea(target: string, actual: string): boolean {
  const expected = new URL(authedPrefix(target));
  const landed = new URL(actual);
  return landed.origin === expected.origin &&
    (landed.pathname === expected.pathname || landed.pathname.startsWith(`${expected.pathname}/`));
}

async function main() {
  const key = (process.argv[2] || "platform-a").toLowerCase();
  const platform = platformByKey(key);

  const target = AUTHED_URL[key];
  if (!target) {
    console.error(
      `No authed URL configured for "${key}" in check-context.ts — add one to AUTHED_URL to check this platform.`,
    );
    process.exit(2);
  }

  const contextId = resolveContextId(platform);
  if (!contextId) {
    console.error(
      `No ${platform.label} context set (${platform.contextEnv}). Run \`npm run portal-login:${key}\`.`,
    );
    process.exit(2);
  }

  const prefix = authedPrefix(target);
  console.log(
    `Checking ${platform.label} context ${contextId.slice(0, 8)}… (read-only)`,
  );
  const sh = await makeWorkflowStagehand({
    contextId,
    model: "anthropic/claude-haiku-4-5-20251001",
  });
  let valid = false;
  let finalUrl = "";
  try {
    const page = (await sh.browser.context.pages())[0];
    await page.goto(target, { timeout: 45_000 });
    await new Promise((r) => setTimeout(r, 3_000)); // let any auth redirect settle
    finalUrl = await page.url();
    const signal = AUTHED_SIGNAL[key];
    const hasAuthenticatedUi = signal
      ? await page.locator(signal).first().isVisible().catch(() => false)
      : false;
    valid = isWithinAuthedArea(target, finalUrl) && hasAuthenticatedUi;
  } finally {
    await Promise.race([
      sh.close().catch(() => {}),
      new Promise((r) => setTimeout(r, 10_000)),
    ]);
  }

  console.log(`landed on: ${finalUrl}`);
  console.log(`authed area: ${prefix}`);
  if (valid) {
    console.log(`✓ ${platform.label} context is VALID — still logged in.`);
  } else {
    console.log(
      `✗ ${platform.label} context is INVALID/EXPIRED — bounced outside the authed area. ` +
        `Re-run \`npm run portal-login:${key}\`.`,
    );
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("check failed:", e instanceof Error ? e.message : e);
  process.exit(3);
});
