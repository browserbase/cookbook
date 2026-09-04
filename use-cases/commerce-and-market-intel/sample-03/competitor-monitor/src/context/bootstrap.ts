// One-time interactive login → persisted Browserbase Context.
//
// Shopee and Temu gate category browsing (Process 1) behind login. We create a
// Context, open a live view, let YOU log in by hand (handling any SMS OTP / email
// code / slider CAPTCHA), then close the persist:true session so the logged-in
// cookies are written back to the Context. Subsequent crawls (deepDive.ts) attach
// to that Context read-only and skip login.
//
//   npm run bootstrap-shopee                  # = bootstrap shopee BR
//   npm run bootstrap-temu                    # = bootstrap temu BR
//   npm run bootstrap -- <competitor> <country>
import readline from "node:readline";
import Browserbase from "@browserbasehq/sdk";
import { CONFIG, requireEnv, type Competitor, type Country } from "../config";
import { createSession } from "../session";
import { saveContext } from "./store";

// Login entry point per (competitor, country). The live view lands you here and you
// finish the login by hand. Shein/AliExpress browse logged-out → no bootstrap.
const LOGIN_URL: Record<Competitor, Partial<Record<Country, string>>> = {
  shopee: {
    BR: "https://shopee.com.br/buyer/login",
  },
  // Temu serves one host with a path-based locale (per SAMPLE_ORG's example: /br-es/).
  // The localized home exposes the Sign-in entry; complete it there (email + code).
  temu: {
    BR: "https://www.temu.com/br-es",
    MX: "https://www.temu.com/mx-es",
    CL: "https://www.temu.com/cl-es",
    CO: "https://www.temu.com/co-es",
    AR: "https://www.temu.com/ar-es",
  },
  shein: {},
  aliexpress: {},
};

// Cookies whose presence signals an authenticated session, per competitor. Shopee's
// set is confirmed. Temu's is BEST-EFFORT — the first real login dumps every cookie
// name (see below) so we can pin Temu's true auth cookies afterward.
const AUTH_COOKIES: Record<Competitor, string[]> = {
  shopee: ["SPC_ST", "SPC_EC", "SPC_U", "SPC_R_T_ID", "SPC_SI"],
  temu: ["user_uin", "verifyAuthToken", "AccessToken", "access_token"],
  shein: [],
  aliexpress: [],
};

async function waitForEnter(prompt: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

async function main(): Promise<void> {
  requireEnv();
  const competitor = (process.argv[2] as Competitor) ?? "shopee";
  const country = (process.argv[3] as Country) ?? "BR";
  const loginUrl =
    LOGIN_URL[competitor]?.[country] ?? LOGIN_URL[competitor]?.BR;
  if (!loginUrl) {
    throw new Error(
      `No login entry point for ${competitor}:${country}. ` +
        `Bootstrap is only for login-gated competitors (shopee, temu); Shein/AliExpress browse logged-out.`,
    );
  }
  const label = competitor[0].toUpperCase() + competitor.slice(1);

  const bb = new Browserbase({ apiKey: CONFIG.apiKey });
  const ctx = await bb.contexts.create({ projectId: CONFIG.projectId });
  console.log(`\ncreated Browserbase Context: ${ctx.id}`);

  // persist:true → cookies/storage are written back to the Context on close.
  // 10-min session timeout gives you time to log in + clear OTP/email code by hand.
  // The login runs through the COUNTRY's residential proxy, so the Context is bound
  // to that country's geo — reuse it only on the same country (see context/attach.ts).
  const s = await createSession(country, {
    contextId: ctx.id,
    persist: true,
    timeoutSec: 600,
  });
  console.log(
    `login proxy geo: ${country}  → this Context must be reused only on a ${country} IP`,
  );
  await s.pwPage
    .goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 90_000 })
    .catch(() => {});

  console.log(`\n📺 LOG IN HERE (open in your browser):\n${s.liveViewUrl}\n`);
  console.log("Steps:");
  console.log("  1) Open the live-view URL above");
  console.log(
    `  2) Log in to ${label} — OR create an account right here (email signup avoids needing a local phone)`,
  );
  console.log(
    "     (handle any SMS OTP / email code / slider CAPTCHA inside the live view)",
  );
  console.log(
    `  3) Wait until the ${label} home/account is shown, then come back here\n`,
  );

  await waitForEnter("Press Enter here once you are logged in… ");

  // Verify against this competitor's known auth-cookie set. If none match, dump all
  // cookie names so we can pin the real auth cookies on the first login (esp. Temu).
  const expected = AUTH_COOKIES[competitor] ?? [];
  let present: string[] = [];
  let allNames: string[] = [];
  try {
    const cookies = await s.pwPage.context().cookies();
    allNames = cookies.map((c) => c.name);
    present = cookies
      .filter((c) => expected.includes(c.name) && c.value && c.value !== "-")
      .map((c) => c.name);
  } catch {
    /* */
  }
  console.log(
    `\nauth cookies detected: ${present.length ? present.join(", ") : "NONE of the expected set"}`,
  );
  if (!present.length && allNames.length) {
    console.log(
      "(cookies present this session — pin the real auth ones in bootstrap.ts AUTH_COOKIES):",
    );
    console.log("  " + allNames.slice(0, 40).join(", "));
  }

  // Closing the persist:true session flushes cookies into the Context.
  await s.close();
  await saveContext(`${competitor}:${country}`, ctx.id);

  console.log(`\n✓ saved Context for ${competitor}:${country} → ${ctx.id}`);
  if (present.length) {
    console.log("✓ Auth cookies present — looks logged in.");
  } else {
    console.log(
      "⚠ Could not confirm login via the expected cookie set (Temu’s set is best-effort).",
    );
    console.log(
      "  The Context was still saved — verify it by running the crawl:",
    );
  }
  console.log(
    `  npm run deep-dive -- --competitor ${competitor} --country ${country}`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(`\n${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
