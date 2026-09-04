import Browserbase from "@browserbasehq/sdk";
import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
// Sample Organization x Browserbase — UC1: CA LLC Formation
//
// Drives the California Secretary of State's 11-step Articles of Organization
// (Form LLC-1) wizard through Step 9 ("Review and Signature") using a customer
// payload. It stops on Step 9 ("Review and Signature") by saving a draft for a
// human handoff. The script never signs, reaches Step 10 (Processing Fees), or
// reaches Step 11 (File Document), which is what would actually file the LLC
// and charge a card.

import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";

// Force the Browserbase model gateway to use its server-managed provider key.
// Stagehand otherwise auto-loads any local model API keys from env and forwards
// them via x-model-api-key — deleting them keeps the demo on the "no LLM key
// needed locally" story.
for (const k of [
  "GOOGLE_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
]) {
  delete process.env[k];
}

const MODEL = "google/gemini-3-flash-preview";
const __dirname = dirname(fileURLToPath(import.meta.url));

// Each wizard step is its own SPA route. Give the page time to rebind after
// clicking Next Step before issuing the next act.
const POST_ADVANCE_WAIT_MS = 12_000;

// Retry only transient gateway errors from Stagehand's managed model gateway
// (occasional 5xx / "temporarily unavailable"). Hard failures bubble up.
const TRANSIENT_RE = /Gateway|temporarily unavailable|5\d\d/i;
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (i === attempts || !TRANSIENT_RE.test(msg)) throw e;
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw new Error("unreachable");
}

type LlcPayload = {
  llc: { name: string };
  addresses: {
    principal: {
      street: string;
      suite?: string;
      city: string;
      state: string;
      zip: string;
    };
    mailing:
      | { sameAsPrincipal: true }
      | {
          sameAsPrincipal: false;
          street: string;
          suite?: string;
          city: string;
          state: string;
          zip: string;
        };
  };
  agentForServiceOfProcess: {
    individual: {
      fullName: string;
      street: string;
      suite?: string;
      city: string;
      state: string;
      zip: string;
    };
  };
  management: {
    structure: "one_manager" | "more_than_one_manager" | "all_members";
  };
  organizer: { signature: string };
  billing: { filerName: string; filerEmail: string; filerPhone: string };
};

function loadPayload(): LlcPayload {
  return JSON.parse(
    readFileSync(resolve(__dirname, "data/sample-llc-payload.json"), "utf8"),
  ) as LlcPayload;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function validateSavedDraft(
  evidence: {
    saved: boolean;
    confirmationText: string;
    draftReference: string;
    llcName: string;
  },
  before: string,
  after: string,
  expectedName: string,
) {
  const normalize = (value: string) =>
    value.normalize("NFC").replace(/\s+/g, " ").trim();
  const confirmation = normalize(evidence.confirmationText);
  const reference = normalize(evidence.draftReference);
  const name = normalize(evidence.llcName);
  const current = normalize(after);
  if (
    evidence.saved !== true ||
    !confirmation ||
    !reference ||
    !name ||
    name.toLowerCase() !== normalize(expectedName).toLowerCase() ||
    !current.includes(confirmation) ||
    normalize(before).includes(confirmation) ||
    !current.includes(reference) ||
    !current.includes(name)
  ) {
    throw new Error(
      "Draft save could not be confirmed; inspect the portal before retrying",
    );
  }
  return {
    reference,
    llcName: name,
    confirmationText: confirmation,
    portalUrl: "https://bizfileonline.sos.ca.gov/",
  };
}

export async function runUc1() {
  const p = loadPayload();
  const username = requireEnv("BIZFILE_USERNAME");
  const password = requireEnv("BIZFILE_PASSWORD");

  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY!,
        projectId: process.env.BROWSERBASE_PROJECT_ID,
        ...({
          proxies: true,
          browserSettings: {
            verified: true,
            solveCaptchas: true,
          },
        } as any),
      }),
      model: MODEL,
    }),
  );

  const sessionId = stagehand.browser.sessionId as string;
  const liveViewUrl = (
    await new Browserbase({
      apiKey: process.env.BROWSERBASE_API_KEY,
    }).sessions.debug(stagehand.browser.sessionId!)
  ).debuggerFullscreenUrl;
  console.log(`[UC1] live view: ${liveViewUrl}`);

  // Local helpers — same Stagehand methods, retried once or twice on transient
  // gateway 5xx so a single hiccup doesn't end a 5-minute demo run.
  const act = async (
    instruction: string,
    options?: { variables?: Record<string, string> },
    retry = true,
  ) => {
    const perform = async () => {
      const result = await stagehand.act(instruction, options as any);
      if (result.data?.success !== true)
        throw new Error("Browser action did not succeed");
      return result;
    };
    return retry ? withRetry(perform) : perform();
  };
  const extract = <T extends z.ZodTypeAny>(instruction: string, schema: T) =>
    withRetry(() =>
      stagehand.extract(instruction, schema).then((result) => result.data),
    );
  const nextStep = async () => {
    await act(
      'click the "Next Step" button at the bottom of the form to advance to the next wizard step',
    );
    await new Promise((r) => setTimeout(r, POST_ADVANCE_WAIT_MS));
  };

  const t0 = Date.now();

  try {
    const page = (await stagehand.browser.context.pages())[0];

    // ── Navigation: homepage → Okta login → Forms → tile → FILE ONLINE ──
    await page.goto("https://bizfileonline.sos.ca.gov/", {
      waitUntil: "domcontentloaded",
    });
    await new Promise((r) => setTimeout(r, 4000));

    await act("click the Login button in the top navigation");
    await new Promise((r) => setTimeout(r, 5000));
    await act("type %email% into the Username field", {
      variables: { email: username },
    });
    await act("type %pw% into the Password field", {
      variables: { pw: password },
    });
    await act("click the Sign in button to submit credentials");
    await new Promise((r) => setTimeout(r, 7000));

    await act("click the Forms link in the left sidebar navigation");
    await new Promise((r) => setTimeout(r, 5000));
    await act(
      'click the form tile labeled "Articles of Organization - CA LLC"',
    );
    await new Promise((r) => setTimeout(r, 4000));
    await act(
      'click the blue "FILE ONLINE" button in the panel for Articles of Organization - CA LLC',
    );
    await new Promise((r) => setTimeout(r, POST_ADVANCE_WAIT_MS));

    // ── Step 1 — Privacy Warning / Terms and Conditions of Use ──
    console.log("[UC1] step 1 — Privacy Warning");
    await act(
      'check the checkbox labeled "I have read and agree to the provided Privacy Warning and the Terms and Conditions of Use"',
    );
    await nextStep();

    // ── Step 2 — Submitter ──
    console.log("[UC1] step 2 — Submitter");
    await act("type %name% into the Submitter Name field", {
      variables: { name: p.billing.filerName },
    });
    await act("type %email% into the Submitter Email Address field", {
      variables: { email: p.billing.filerEmail },
    });
    await act("type %phone% into the Submitter Phone Number field", {
      variables: { phone: p.billing.filerPhone },
    });
    await nextStep();

    // ── Step 3 — No Professional Services ──
    // Informational attestation. Vermillion Tide is a coffee roaster, not a
    // professional services LLC, so there's nothing to check — just advance.
    console.log("[UC1] step 3 — No Professional Services");
    await nextStep();

    // ── Step 4 — Limited Liability Company Name ──
    // Three fields: a No/Yes radio for "a previously reserved name will be used
    // for this filing" (we're not using a reserved name → No), the LLC name,
    // and a Confirm field that must match.
    console.log("[UC1] step 4 — LLC Name");
    await act(
      'click the "No" radio button for "A previously reserved name will be used for this filing"',
    );
    await act("type %name% into the Limited Liability Company Name field", {
      variables: { name: p.llc.name },
    });
    await act(
      "type %name% into the Confirm Limited Liability Company Name field",
      { variables: { name: p.llc.name } },
    );
    await nextStep();

    // ── Step 5 — Business Addresses ──
    // Two stacked address forms: "Initial Street Address of Principal Office of
    // LLC" on top, "Initial Mailing Address of LLC" below the fold. We fill the
    // principal section first, then scroll into view before filling the mailing
    // section so Stagehand's observation includes those fields.
    console.log("[UC1] step 5 — Business Addresses");
    const a = p.addresses.principal;
    await act("type %v% into the principal office Address field", {
      variables: { v: a.street },
    });
    if (a.suite) {
      await act("type %v% into the principal office STE/APT/FL field", {
        variables: { v: a.suite },
      });
    }
    await act("type %v% into the principal office City field", {
      variables: { v: a.city },
    });
    await act('select "California" from the principal office State dropdown');
    await act("type %v% into the principal office ZIP Code field", {
      variables: { v: a.zip },
    });

    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise((r) => setTimeout(r, 1000));
    const mailing = p.addresses.mailing.sameAsPrincipal
      ? a
      : p.addresses.mailing;
    await act("type %v% into the mailing Address field", {
      variables: { v: mailing.street },
    });
    if (mailing.suite) {
      await act("type %v% into the mailing STE/APT/FL field", {
        variables: { v: mailing.suite },
      });
    }
    await act("type %v% into the mailing City field", {
      variables: { v: mailing.city },
    });
    await act(`select %state% from the mailing State dropdown`, {
      variables: { state: mailing.state },
    });
    await act("type %v% into the mailing ZIP Code field", {
      variables: { v: mailing.zip },
    });
    await nextStep();

    // ── Step 6 — Agent for Service of Process ──
    // Individual agent path. The name field is split into First Name / Last
    // Name on the page, so we split the payload's fullName on whitespace.
    console.log("[UC1] step 6 — Agent for Service of Process");
    const ag = p.agentForServiceOfProcess.individual;
    const [firstName, ...rest] = ag.fullName.split(/\s+/);
    const lastName = rest.join(" ");
    await act(
      'click the "Individual" radio button under "Select an Agent Type"',
    );
    await act("type %v% into the agent First Name field", {
      variables: { v: firstName },
    });
    await act("type %v% into the agent Last Name field", {
      variables: { v: lastName },
    });
    await act("type %v% into the agent Address field", {
      variables: { v: ag.street },
    });
    if (ag.suite) {
      await act("type %v% into the agent STE/APT/FL field", {
        variables: { v: ag.suite },
      });
    }
    await act("type %v% into the agent City field", {
      variables: { v: ag.city },
    });
    await act('select "California" from the agent State dropdown');
    await act("type %v% into the agent ZIP Code field", {
      variables: { v: ag.zip },
    });
    await nextStep();

    // ── Step 7 — Purpose, Management and File Date ──
    // Purpose textarea is pre-populated with the statutory default — left
    // alone. Management structure radio and the file date both need explicit
    // selections.
    console.log("[UC1] step 7 — Management Structure + File Date");
    const mgmtLabel = {
      one_manager: "one manager",
      more_than_one_manager: "more than one manager",
      all_members: "all limited liability company members",
    }[p.management.structure];
    await act(
      `click the radio button labeled "${mgmtLabel}" for the LLC's management structure`,
    );
    await act('click the "Current Date" radio button for the file date');
    await nextStep();

    // ── Step 8 — Attachments ──
    // Optional. No attachments are required for a vanilla CA LLC formation.
    console.log("[UC1] step 8 — Attachments (none)");
    await nextStep();

    // ── Step 9 — Review and Signature ──
    // Stop here for human review/signature. Saving a draft preserves the work
    // without applying an electronic signature, reaching fees, filing, or charging a card.
    console.log(
      "[UC1] step 9 — Review and Signature (save draft for human handoff)",
    );
    const beforeSave = await page.evaluate(() => document.body.innerText);
    if (!/review\s+and\s+signature/i.test(beforeSave)) {
      throw new Error(
        "Review and Signature step was not observed; draft handoff is incomplete",
      );
    }
    await act(
      'click the "Save Draft" button and do not sign or advance to the next step',
      undefined,
      false,
    );
    await new Promise((r) => setTimeout(r, 4000));

    const evidence = await extract(
      "Read explicit confirmation that this LLC draft was saved. A Save Draft button or wizard step is not confirmation. Extract the exact visible saved-confirmation text, draft reference/identifier, and LLC name associated with that saved draft. Use empty strings and saved=false when unavailable; never infer a reference.",
      z.object({
        saved: z.boolean(),
        confirmationText: z.string(),
        draftReference: z.string(),
        llcName: z.string(),
      }),
    );
    const afterSave = await page.evaluate(() => document.body.innerText);
    const draft = validateSavedDraft(
      evidence,
      beforeSave,
      afterSave,
      p.llc.name,
    );

    return {
      status: "draft_saved_for_human_signature" as const,
      sessionId,
      draft,
      handoff:
        "This browser session is closed when the run returns. Sign in to the portal and reopen the saved draft by its reference for human review and signature.",
      wallClockSeconds: +((Date.now() - t0) / 1000).toFixed(1),
    };
  } finally {
    await stagehand.close();
    await stagehand.browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(
    "\nSample Organization POC — UC1: CA LLC Formation (Steps 1-9, save draft for human signature)\n",
  );
  const result = await runUc1();
  console.log("\n──────── UC1 RESULT ────────");
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nWall clock: ${result.wallClockSeconds}s`);
}
