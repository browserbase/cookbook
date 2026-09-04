// Outer orchestrator: creates AgentMail inbox + Browserbase session, builds a
// temp workspace with substituted task.md, spawns autobrowse, parses output,
// hands off to email-pickup, then re-spawns autobrowse for post-verify.
//
// Stage 2 (smoke): set SMOKE=1 to just open EDD landing and screenshot.
// Stage 4+ : default mode — run autobrowse phase 1 → email → phase 2.

import "dotenv/config";
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createBrowserbaseSession,
  releaseBrowserbaseSession,
  connect,
  type BbSession,
} from "./browserbase.js";
import { createInbox, waitForMessage } from "./inbox/agentmail.js";
import { extractConfirmationLink, extractOtpCode } from "./inbox/extractors.js";
import { preflightInputs } from "./setup.js";
import { substituteFile } from "./substitute.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const TASK_NAME = "ca-edd-enroll";
const EVALUATE_ADAPTER = path.join(REPO_ROOT, "scripts", "evaluate-cdp.mjs");
const EVALUATE_MJS = process.env.CA_EDD_EVALUATOR_PATH
  ? path.resolve(process.env.CA_EDD_EVALUATOR_PATH)
  : path.join(
  homedir(),
  ".claude/skills/autobrowse/scripts/evaluate.mjs",
);

const EDD_LANDING_URL =
  "https://eddservices.mfa.edd.ca.gov/authsvc/mtfim/sps/authsvc?PolicyId=urn:ibm:security:authentication:asf:onpremldap&identity_source_id=627ea49f-d5e8-4997-9e4d-e403f9aa07b8&themeId=default&Target=https%3A%2F%2Feddservices.mfa.edd.ca.gov%2Foidc%2Fendpoint%2Fdefault%2Fauthorize%3Fclient_id%3D4386e72b-3e64-467d-be4b-e47e3013f4a3%26stateId%3Da2af3e43-2932-4abe-8585-7a74f6d82f99%26themeId%3Ddefault";

interface AgentOutput {
  success: boolean;
  phase?: string | number;
  reason?: string;
  stopped_at_step?: string;
  stopped_at_url?: string;
  agent_email?: string;
  notes?: string;
  [k: string]: unknown;
}

async function main(): Promise<void> {
  if (process.env.SMOKE === "1") return smokeMode();
  const profile = preflightInputs(REPO_ROOT, TASK_NAME, process.env);
  execFileSync(process.execPath, [EVALUATE_ADAPTER, "--check", "--evaluate-entry", EVALUATE_MJS], { stdio: "inherit" });
  if (process.argv.includes("--check")) return;
  requireAccountCreationOptIn();
  const orchestratorStartMs = Date.now();

  // ─── 1. AgentMail inbox ──────────────────────────────────────────
  const inbox = await createInbox({ clientId: `ca-edd-${Date.now()}` });
  console.log(`[inbox] ${inbox.inboxId}`);

  // ─── 2. Browserbase session (held for the whole orchestrator) ────
  const bb = createBrowserbaseSession();
  if (!bb)
    throw new Error("BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID required");
  console.log(`[browserbase] session ${bb.sessionId}`);
  console.log(
    `[browserbase] live view: https://www.browserbase.com/sessions/${bb.sessionId}`,
  );

  try {
    // ─── 3. Build temp workspace with substituted task.md ────────────
    //     (Skipping any Playwright pre-flight — connectOverCDP + close()
    //     kills the Browserbase session, which caused autobrowse to silently
    //     fall back to a fresh non-verified session. Let autobrowse navigate
    //     to the start URL itself; task.md already specifies it.)
    const ws = mkdtempSync(path.join(tmpdir(), "ca-edd-ws-"));
    const wsTaskDir = path.join(ws, "tasks", TASK_NAME);
    mkdirSync(wsTaskDir, { recursive: true });

    // Randomize username per run so each run creates a distinct EDD record
    // (avoids "username already in use" when AgentMail recycles addresses).
    const testUsername = `bbDemo${Math.floor(1000 + Math.random() * 9000)}`;
    console.log(`[creds] username: ${testUsername}`);

    const repoTaskDir = path.join(REPO_ROOT, "autobrowse", "tasks", TASK_NAME);
    const vars: Record<string, string> = {
      AGENT_EMAIL: inbox.inboxId,
      TEST_USERNAME: testUsername,
      ...profile,
    };

    // Phase 1 task.md (will be overwritten with Phase 2 template before run #2).
    substituteFile(
      path.join(repoTaskDir, "task-phase1.md.template"),
      path.join(wsTaskDir, "task.md"),
      vars,
    );
    copyFileSync(
      path.join(repoTaskDir, "strategy.md"),
      path.join(wsTaskDir, "strategy.md"),
    );

    console.log(`[workspace] ${ws}`);

    // ─── 4. Spawn autobrowse #1 ──────────────────────────────────────
    console.log(`[autobrowse] phase 1 — exploring enrollment form`);
    const phase1 = await runAutobrowse(ws, bb.sessionId, bb.wssUrl, 1);

    console.log(`[autobrowse] phase 1 reason: ${phase1.reason ?? "(none)"}`);
    console.log(
      `[autobrowse] phase 1 stopped at: ${phase1.stopped_at_url ?? "(unknown)"}`,
    );

    writeFileSync(path.join(REPO_ROOT, ".last-inbox.txt"), inbox.inboxId);

    // ─── 5. Email pickup ─────────────────────────────────────────────
    console.log(`[inbox] polling AgentMail for EDD activation email...`);
    const msg = await waitForMessage({
      inboxId: inbox.inboxId,
      timeoutMs: 180_000,
      pollMs: 5_000,
      sinceMs: orchestratorStartMs - 5_000,
      matchFn: (candidate) =>
        !!extractConfirmationLink(candidate, {
          allowedHosts: ["edd.ca.gov"],
        }),
    });
    console.log(
      `[inbox] received: "${msg.subject ?? "(no subject)"}" from ${msg.from ?? "(unknown)"}`,
    );

    const link = extractConfirmationLink(msg, {
      allowedHosts: ["edd.ca.gov"],
    });
    if (!link) {
      console.error(
        `[orchestrator] No EDD activation link found in message ${msg.messageId}.`,
      );
      console.error(`[orchestrator] Subject: ${msg.subject}`);
      console.log(`[inbox] kept ${inbox.inboxId} — workspace ${ws}`);
      throw new Error("Enrollment workflow did not reach its required boundary");
    }
    console.log(`[link] ${link}`);

    // Connect Playwright to the same Browserbase session and navigate.
    // Do NOT call browser.close() — empirically it kills the Browserbase
    // session, which would force autobrowse #2 onto a fresh non-verified one.
    // Just let the connection dangle; it'll close when the process exits.
    const { page } = await connect(bb);
    await page.goto(link, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("load");
    await page.waitForTimeout(3_000);
    await page.screenshot({ path: "post-activation.png", fullPage: true });
    console.log(`[link] post-activation url: ${page.url()}`);
    console.log(
      `[link] post-activation title: ${JSON.stringify(await page.title())}`,
    );
    console.log("[link] screenshot saved to post-activation.png");

    // ─── 6. Autobrowse #2 — post-verification phase ──────────────────
    // Verify the SAME Browserbase session is still alive (with --keep-alive +
    // proxies) before spawning Phase 2. Confirms Phase 2 will run on the
    // already-verified session, not a fresh non-verified fallback.
    try {
      const out = execFileSync(
        "browse",
        ["cloud", "sessions", "get", bb.sessionId],
        { encoding: "utf-8" },
      );
      const json = out.slice(out.indexOf("{"));
      const sess = JSON.parse(json) as {
        status?: string;
        keepAlive?: boolean;
        proxyBytes?: number;
        region?: string;
      };
      console.log(
        `[browserbase] pre-phase-2 check: status=${sess.status} keepAlive=${sess.keepAlive} proxyBytes=${sess.proxyBytes} region=${sess.region}`,
      );
      if (sess.status !== "RUNNING") {
        console.error(
          `[browserbase] session is ${sess.status} — Phase 2 cannot run on it. Aborting.`,
        );
        throw new Error("Enrollment workflow did not reach its required boundary");
      }
    } catch (err) {
      throw new Error("Browserbase session state could not be verified");
    }

    // Swap task.md to the Phase-2 template (post-activation login flow).
    substituteFile(
      path.join(repoTaskDir, "task-phase2.md.template"),
      path.join(wsTaskDir, "task.md"),
      vars,
    );
    console.log(`[autobrowse] phase 2 — post-activation login → dashboard`);
    const phase2EndedMs = Date.now();
    const phase2 = await runAutobrowse(ws, bb.sessionId, bb.wssUrl, 2);
    console.log(`[autobrowse] phase 2 reason: ${phase2.reason ?? "(none)"}`);
    console.log(
      `[autobrowse] phase 2 stopped at: ${phase2.stopped_at_url ?? "(unknown)"}`,
    );

    // ─── 7. Email-OTP pickup + Phase 3 ──────────────────────────────
    // EDD's IBM Security Verify auto-sends an email OTP to the registered
    // address after a successful login (it's the only registered factor for
    // a freshly-activated account). Pick it up and continue.
    if (phase2.reason === "awaiting_email_otp") {
      console.log(`[inbox] polling AgentMail for EDD login OTP...`);
      const otpMsg = await waitForMessage({
        inboxId: inbox.inboxId,
        timeoutMs: 120_000,
        pollMs: 4_000,
        sinceMs: phase2EndedMs - 5_000,
        matchFn: (candidate) =>
          extractOtpCode(candidate, { length: 6 }) !== null,
      });
      console.log(
        `[inbox] OTP message: "${otpMsg.subject ?? "(no subject)"}" from ${otpMsg.from ?? "(unknown)"}`,
      );

      const otpCode = extractOtpCode(otpMsg, { length: 6 });
      if (!otpCode) {
        console.error(
          `[orchestrator] No OTP code found in message ${otpMsg.messageId}.`,
        );
        console.log(`[inbox] kept ${inbox.inboxId} — workspace ${ws}`);
        throw new Error("Enrollment workflow did not reach its required boundary");
      }
      console.log(`[otp] code: ${otpCode}`);

      // Verify session is still alive before spawning Phase 3.
      try {
        const out = execFileSync(
          "browse",
          ["cloud", "sessions", "get", bb.sessionId],
          { encoding: "utf-8" },
        );
        const json = out.slice(out.indexOf("{"));
        const sess = JSON.parse(json) as {
          status?: string;
          keepAlive?: boolean;
          proxyBytes?: number;
          region?: string;
        };
        console.log(
          `[browserbase] pre-phase-3 check: status=${sess.status} keepAlive=${sess.keepAlive} proxyBytes=${sess.proxyBytes} region=${sess.region}`,
        );
        if (sess.status !== "RUNNING") {
          console.error(
            `[browserbase] session is ${sess.status} — Phase 3 cannot run. Aborting.`,
          );
          throw new Error("Enrollment workflow did not reach its required boundary");
        }
      } catch (err) {
        throw new Error("Browserbase session state could not be verified");
      }

      const phase3Vars = { ...vars, OTP_CODE: otpCode };
      substituteFile(
        path.join(repoTaskDir, "task-phase3.md.template"),
        path.join(wsTaskDir, "task.md"),
        phase3Vars,
      );
      console.log(`[autobrowse] phase 3 — submit OTP → dashboard`);
      const phase3 = await runAutobrowse(ws, bb.sessionId, bb.wssUrl, 3);
      console.log(
        `[autobrowse] phase 3 reason: ${phase3.reason ?? "(none)"}`,
      );
      console.log(
        `[autobrowse] phase 3 stopped at: ${phase3.stopped_at_url ?? "(unknown)"}`,
      );
    }

    console.log(`[inbox] kept ${inbox.inboxId} — workspace ${ws}`);
  } finally {
    releaseBrowserbaseSession(bb);
  }
}

async function runAutobrowse(
  workspace: string,
  sessionId: string,
  wssUrl: string,
  phase: 1 | 2 | 3,
): Promise<AgentOutput> {
  const invocation = createInvocationWorkspace(workspace, phase);
  // Clear any stale local browse-CLI state before the agent attaches via --cdp.
  // Without this, a leftover "default" session from a prior process can refuse
  // the new attach with "Session 'default' is already running" and the agent
  // burns turns failing to open any page.
  try {
    execFileSync("browse", ["stop"], { stdio: "ignore" });
  } catch {
    /* fine if there was nothing to stop */
  }

  return new Promise((resolve, reject) => {
    const args = [
      EVALUATE_ADAPTER,
      "--evaluate-entry",
      EVALUATE_MJS,
      "--task",
      TASK_NAME,
      "--workspace",
      invocation,
      "--session",
      sessionId,
    ];
    console.log(`[autobrowse] starting evaluator for task ${TASK_NAME} (connection details omitted)`);
    const child = spawn(process.execPath, args, {
      cwd: invocation,
      stdio: ["ignore", "inherit", "inherit"],
      env: { ...process.env, CA_EDD_CDP_URL: wssUrl },
    });

    child.on("error", () => reject(new Error("Autobrowse child process could not start")));
    child.on("exit", (code) => {
      console.log(`[autobrowse] exited with code ${code}`);
      if (code !== 0) {
        reject(new Error("Autobrowse evaluator did not complete successfully"));
        return;
      }
      try {
        const out = parseInvocationSummary(path.join(invocation, "traces", TASK_NAME, "run-001", "summary.md"), phase);
        resolve(out);
      } catch {
        reject(new Error("Autobrowse evaluator output could not be read"));
      }
    });
  });
}

function createInvocationWorkspace(workspace: string, phase: 1 | 2 | 3): string {
  const invocation = mkdtempSync(path.join(workspace, `phase-${phase}-`));
  const taskDir = path.join(invocation, "tasks", TASK_NAME);
  mkdirSync(taskDir, { recursive: true });
  for (const name of ["task.md", "strategy.md"]) {
    copyFileSync(path.join(workspace, "tasks", TASK_NAME, name), path.join(taskDir, name));
  }
  return invocation;
}

function parseInvocationSummary(summaryPath: string, phase: 1 | 2 | 3): AgentOutput {
  const text = readFileSync(summaryPath, "utf-8");
  if (!text.startsWith(`# ${TASK_NAME} — Run run-001 Summary\n\n**Status:** completed (end_turn)\n`)) {
    throw new Error("Evaluator did not produce a completed current run");
  }
  const finalIndex = text.indexOf("\n## Agent Final Output\n");
  if (finalIndex < 0) throw new Error("Evaluator final output is missing");
  const matches = [...text.slice(finalIndex).matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
  if (matches.length !== 1) throw new Error("Expected one final result object");
  const output: unknown = JSON.parse(matches[0][1]);
  if (!output || typeof output !== "object" || Array.isArray(output)) throw new Error("Invalid evaluator result");
  const result = output as Record<string, unknown>;
  const reasons: Record<number, string[]> = {
    1: ["awaiting_email_verification"],
    2: ["awaiting_email_otp", "dashboard_reached"],
    3: ["dashboard_reached"],
  };
  if (result.success !== true || (result.phase !== phase && result.phase !== String(phase))
    || typeof result.reason !== "string" || !reasons[phase].includes(result.reason)
    || typeof result.stopped_at_url !== "string" || !result.stopped_at_url.trim()
    || typeof result.stopped_at_step !== "string" || !result.stopped_at_step.trim()) {
    throw new Error("Evaluator result did not reach the expected phase boundary");
  }
  return result as unknown as AgentOutput;
}

function requireAccountCreationOptIn(): void {
  if (process.env.CA_EDD_ALLOW_ACCOUNT_CREATION !== "true") {
    throw new Error(
      "CA_EDD_ALLOW_ACCOUNT_CREATION must be set to true before the orchestrator submits the EDD enrollment form and creates an account record.",
    );
  }
}

// ─── Smoke mode — just open the EDD landing in Browserbase ─────────────

async function smokeMode(): Promise<void> {
  const bb = createBrowserbaseSession();
  if (!bb)
    throw new Error("BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID required");
  console.log(`[smoke] session ${bb.sessionId}`);
  const { browser, page } = await connect(bb);
  try {
    await page.goto(EDD_LANDING_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    if (process.env.DUMP_FORM === "1") {
      console.log("[smoke] clicking Enroll to reach the form...");
      await page.locator("#enroll-button").click();
      await page.waitForLoadState("load", { timeout: 30_000 });
      await page.waitForTimeout(3_000);
      const inputs = await page.$$eval("input, button, select", (els) =>
        els
          .map((e) => ({
            tag: e.tagName.toLowerCase(),
            type: (e as HTMLInputElement).type ?? null,
            id: e.id || null,
            name: (e as HTMLInputElement).name || null,
            ariaLabel: e.getAttribute("aria-label"),
            placeholder: (e as HTMLInputElement).placeholder ?? null,
            maxLength: (e as HTMLInputElement).maxLength ?? null,
            textContent: (e.textContent || "").trim().slice(0, 40) || null,
          }))
          .filter(
            (x) =>
              x.id ||
              x.name ||
              x.ariaLabel ||
              (x.tag === "button" && x.textContent),
          ),
      );
      console.log("[form-dump]");
      console.log(JSON.stringify(inputs, null, 2));
      console.log(`[smoke] post-enroll url=${page.url()}`);
      await page.screenshot({ path: "post-enroll.png", fullPage: true });
    } else {
      await page.screenshot({ path: "landing.png", fullPage: true });
      console.log(
        `[smoke] title=${JSON.stringify(await page.title())} url=${page.url()}`,
      );
      console.log("[smoke] saved landing.png");
    }
  } finally {
    await browser.close().catch(() => {});
    releaseBrowserbaseSession(bb);
  }
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
