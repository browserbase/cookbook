import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Browserbase } from "@browserbasehq/sdk";
import { Stagehand, browserbase, localBrowser, type Page } from "@browserbasehq/stagehand";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

type SiteKey = "hillsborough" | "lee" | "miwayne";

type AssessmentStatus =
  | "results_with_records"
  | "results_reached"
  | "form_reached"
  | "blocked_human_check"
  | "blocked_terms"
  | "blocked_site_denial"
  | "error";

type ControlShape = {
  tag: string;
  type: string | null;
  id: string;
  name: string | null;
  label: string | null;
  placeholder: string | null;
  text: string;
  options?: string[];
};

type ResultSummary = {
  tables: Array<{
    index: number;
    headers: string[];
    rowCount: number;
    sampleRows?: string[][];
  }>;
  links: Array<{ text: string; href: string | null }>;
  visibleText?: string;
  recordCount?: number | null;
  proofText?: string[];
  extracted?: Record<string, unknown>;
};

type SearchAttempt = {
  verifiedAt: string;
  criteria: Record<string, string | string[]>;
  dispatch: "pending" | "acknowledged" | "error";
};

type SiteAssessment = {
  site: SiteKey;
  searchAttempts?: SearchAttempt[];
  label: string;
  url: string;
  finalUrl: string;
  title: string;
  status: AssessmentStatus;
  blocker?: string;
  evidence?: string[];
  controls: ControlShape[];
  resultSummary?: ResultSummary;
  screenshotPath?: string;
  notes: string[];
};

const EnvSchema = z.object({
  BROWSERBASE_API_KEY: z.string().optional(),
  BROWSERBASE_PROJECT_ID: z.string().optional(),
  USE_BROWSERBASE: z.string().default("true"),
  BROWSERBASE_PROXIES: z.string().default("true"),
  BROWSERBASE_ADVANCED_STEALTH: z.string().default("true"),
  BROWSERBASE_SOLVE_CAPTCHAS: z.string().default("true"),
  BROWSERBASE_CAPTCHA_SETTLE_MS: z.coerce.number().int().nonnegative().default(10_000),
  BROWSERBASE_VERIFIED: z.string().default("true"),
  BROWSERBASE_REGION: z
    .enum(["us-west-2", "us-east-1", "eu-central-1", "ap-southeast-1"])
    .default("us-east-1"),
  BROWSERBASE_KEEP_ALIVE: z.string().default("false"),
  BROWSERBASE_CONTEXT_ID: z.string().optional(),
  BROWSERBASE_CREATE_CONTEXT: z.string().default("false"),
  BROWSERBASE_CONTEXT_PERSIST: z.string().default("true"),
  BROWSERBASE_TIMEOUT_SECONDS: z.coerce.number().default(1800),
  BROWSERBASE_VIEWPORT_WIDTH: z.coerce.number().default(1440),
  BROWSERBASE_VIEWPORT_HEIGHT: z.coerce.number().default(900),
  BROWSERBASE_USE_SITE_GEO: z.string().default("true"),
  BROWSERBASE_PROXY_COUNTRY: z.string().default("US"),
  BROWSERBASE_PROXY_STATE: z.string().optional(),
  BROWSERBASE_PROXY_CITY: z.string().optional(),
  BROWSERBASE_OS: z
    .enum(["windows", "mac", "linux", "mobile", "tablet"])
    .optional(),
  SITE: z.enum(["all", "hillsborough", "lee", "miwayne"]).default("all"),
  SEARCH_FIRST_NAME: z.string().default(""),
  SEARCH_LAST_NAME: z.string().default("Smith"),
  HILLSBOROUGH_FIRST_NAME_FALLBACK: z.string().default("John"),
  HILLSBOROUGH_CASE_CATEGORY: z.string().default("CRIMINAL"),
  HILLSBOROUGH_USE_HOME_LINK: z.string().default("false"),
  HILLSBOROUGH_PRE_SUBMIT_WAIT_MS: z.coerce.number().default(5_000),
  HILLSBOROUGH_WARMUP_ONLY: z.string().default("false"),
  LEE_FIRST_NAME_FALLBACK: z.string().default("Jo*"),
  SEARCH_FROM_DATE: z.string().optional(),
  SEARCH_TO_DATE: z.string().optional(),
  SEARCH_LOOKBACK_DAYS: z.coerce.number().default(365),
  REDACT_OUTPUT: z.string().default("true"),
});

const env = EnvSchema.parse(process.env);
const defaultDateRange = getDefaultDateRange(env.SEARCH_LOOKBACK_DAYS);

const searchCriteria = {
  firstName: env.SEARCH_FIRST_NAME,
  lastName: env.SEARCH_LAST_NAME,
  fromDate: env.SEARCH_FROM_DATE?.trim() || defaultDateRange.fromDate,
  toDate: env.SEARCH_TO_DATE?.trim() || defaultDateRange.toDate,
};

const siteOrder: SiteKey[] =
  env.SITE === "all" ? ["hillsborough", "lee", "miwayne"] : [env.SITE];

const targetSites: Record<SiteKey, { label: string; url: string }> = {
  hillsborough: {
    label: "FL Hillsborough HOVER",
    url: "https://hover.hillsclerk.com/html/case/caseSearch.html#nav-Party-tab",
  },
  lee: {
    label: "FL Lee MATRIX",
    url: "https://matrix.leeclerk.org/",
  },
  miwayne: {
    label: "MI Wayne MiCOURT D36",
    url: "https://micourt.courts.michigan.gov/case-search/court/D36",
  },
};

async function run() {
  const useBrowserbase = env.USE_BROWSERBASE.toLowerCase() !== "false";

  if (
    useBrowserbase &&
    (!env.BROWSERBASE_API_KEY || !env.BROWSERBASE_PROJECT_ID)
  ) {
    throw new Error(
      "USE_BROWSERBASE=true requires BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID.",
    );
  }

  const browserbaseContextId = useBrowserbase
    ? await resolveBrowserbaseContextId()
    : undefined;
  const browserbaseContextPersist =
    env.BROWSERBASE_CONTEXT_PERSIST.toLowerCase() === "true";

  const browser = await ((useBrowserbase ? "BROWSERBASE" : "LOCAL") === "LOCAL"
        ? localBrowser.launch(useBrowserbase ? undefined : { headless: true })
        : browserbase.launch({
            apiKey: env.BROWSERBASE_API_KEY!,
            projectId: env.BROWSERBASE_PROJECT_ID,
            ...(useBrowserbase
              ? {
                  projectId: env.BROWSERBASE_PROJECT_ID!,
                  keepAlive:
                    env.BROWSERBASE_KEEP_ALIVE.toLowerCase() === "true",
                  api_timeout: env.BROWSERBASE_TIMEOUT_SECONDS,
                  region: env.BROWSERBASE_REGION,
                  proxies: browserbaseProxyConfig(),
                  browserSettings: {
                    advancedStealth:
                      env.BROWSERBASE_ADVANCED_STEALTH.toLowerCase() === "true",
                    solveCaptchas:
                      env.BROWSERBASE_SOLVE_CAPTCHAS.toLowerCase() === "true",
                    verified: env.BROWSERBASE_VERIFIED.toLowerCase() === "true",
                    os: env.BROWSERBASE_OS,
                    recordSession: true,
                    context: browserbaseContextId
                      ? {
                          id: browserbaseContextId,
                          persist: browserbaseContextPersist,
                        }
                      : undefined,
                    viewport: {
                      width: env.BROWSERBASE_VIEWPORT_WIDTH,
                      height: env.BROWSERBASE_VIEWPORT_HEIGHT,
                    },
                  },
                }
              : undefined),
          }));

  const assessments: SiteAssessment[] = [];
  let browserbaseSessionID: string | undefined;
  let stagehand: Stagehand | undefined;
  const errors: unknown[] = [];

  try {
    stagehand = await Stagehand.create(StagehandCreateOptionsSchema.parse({ browser }));
    browserbaseSessionID = stagehand.browser.sessionId;

    if (useBrowserbase && browserbaseSessionID) {
      console.log(
        `Browserbase live session: https://browserbase.com/sessions/${browserbaseSessionID}`,
      );
    }

    const page = await getActivePage(stagehand);
    for (const site of siteOrder) {
      console.log(`\nAssessing ${targetSites[site].label}...`);
      assessments.push(await assessSite(stagehand, page, site));
    }
  } catch (error) {
    errors.push(error);
  } finally {
    if (stagehand) {
      try { await stagehand.close(); } catch (error) { errors.push(error); }
    }
    try { await browser.close(); } catch (error) { errors.push(error); }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, "Court assessment and cleanup failed.");

  const report = {
    generatedAt: new Date().toISOString(),
    runMode: useBrowserbase ? "BROWSERBASE" : "LOCAL",
    browserbase: useBrowserbase ? {
      sessionId: browserbaseSessionID,
      sessionDisposition: !useBrowserbase ? "local_browser_closed"
        : env.BROWSERBASE_KEEP_ALIVE.toLowerCase() === "true" ? "retained_by_request" : "release_requested",
      contextPersistence: browserbaseContextId && browserbaseContextPersist ? "requested_not_confirmed" : "not_requested",
      sessionUrl: browserbaseSessionID
        ? `https://browserbase.com/sessions/${browserbaseSessionID}`
        : undefined,
      proxies: browserbaseProxyConfig(),
      advancedStealth:
        env.BROWSERBASE_ADVANCED_STEALTH.toLowerCase() === "true",
      solveCaptchas: env.BROWSERBASE_SOLVE_CAPTCHAS.toLowerCase() === "true",
      solverSettleWaitMs: env.BROWSERBASE_SOLVE_CAPTCHAS.toLowerCase() === "true"
        ? env.BROWSERBASE_CAPTCHA_SETTLE_MS : 0,
      verified: env.BROWSERBASE_VERIFIED.toLowerCase() === "true",
      os: env.BROWSERBASE_OS,
      region: env.BROWSERBASE_REGION,
      keepAlive: env.BROWSERBASE_KEEP_ALIVE.toLowerCase() === "true",
      contextId: browserbaseContextId,
      contextPersist: browserbaseContextId
        ? browserbaseContextPersist
        : undefined,
      timeoutSeconds: env.BROWSERBASE_TIMEOUT_SECONDS,
      viewport: {
        width: env.BROWSERBASE_VIEWPORT_WIDTH,
        height: env.BROWSERBASE_VIEWPORT_HEIGHT,
      },
    } : undefined,
    searchCriteria: {
      ...searchCriteria,
      note: "Use only customer-approved criteria. Keep all reports private.",
    },
    assessments,
  };

  const redactOutput = env.REDACT_OUTPUT.toLowerCase() !== "false";
  const reportPath = writeAssessmentReport(report, redactOutput);

  console.log("\nAssessment summary");
  for (const assessment of assessments) {
    console.log(
      `- ${redactOutput ? assessment.site : assessment.label}: ${assessment.status}${
        !redactOutput && assessment.blocker ? ` (${assessment.blocker})` : ""
      }`,
    );
  }
  console.log(`\nSaved structured report to ${reportPath}`);
}


function writeAssessmentReport(
  report: { generatedAt: string; runMode: string; assessments: SiteAssessment[] },
  redact: boolean,
  outputDirectory = "results",
) {
  const count = (value: unknown) =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0
      ? value
      : undefined;
  const output = redact
    ? {
        generatedAt: report.generatedAt,
        runMode: report.runMode === "BROWSERBASE" ? "BROWSERBASE" : "LOCAL",
        privacy: {
          mode: "redacted",
          note: "Private aggregate report. Identifying text, URLs, search inputs, session metadata and extracted records are omitted.",
        },
        assessments: report.assessments.map((assessment) => ({
          site: ["hillsborough", "lee", "miwayne"].includes(assessment.site)
            ? assessment.site
            : "unknown",
          status: [
            "results_with_records", "results_reached", "form_reached",
            "blocked_human_check", "blocked_terms", "blocked_site_denial", "error",
          ].includes(assessment.status) ? assessment.status : "error",
          controlCount: assessment.controls.length,
          resultSummary: assessment.resultSummary
            ? {
                recordCount: count(assessment.resultSummary.recordCount),
                tableCount: assessment.resultSummary.tables.length,
                linkCount: assessment.resultSummary.links.length,
              }
            : undefined,
        })),
      }
    : {
        ...report,
        privacy: {
          mode: "unredacted",
          note: "Private report containing search inputs, page content and potentially identifying court records.",
        },
      };
  mkdirSync(outputDirectory, { recursive: true });
  const reportPath = path.join(outputDirectory, `court-assessment-${Date.now()}.json`);
  writeFileSync(reportPath, `${JSON.stringify(output, null, 2)}\n`);
  return reportPath;
}

async function resolveBrowserbaseContextId() {
  if (env.BROWSERBASE_CONTEXT_ID?.trim()) {
    console.log(
      `Using Browserbase context: ${env.BROWSERBASE_CONTEXT_ID.trim()}`,
    );
    return env.BROWSERBASE_CONTEXT_ID.trim();
  }

  if (env.BROWSERBASE_CREATE_CONTEXT.toLowerCase() !== "true") {
    return undefined;
  }

  const browserbase = new Browserbase({ apiKey: env.BROWSERBASE_API_KEY });
  const context = await browserbase.contexts.create({
    projectId: env.BROWSERBASE_PROJECT_ID,
  });
  console.log(`Created Browserbase context: ${context.id}`);
  return context.id;
}

function getDefaultDateRange(lookbackDays: number) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - lookbackDays);

  return {
    fromDate: formatDateForCourt(from),
    toDate: formatDateForCourt(to),
  };
}

function formatDateForCourt(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function browserbaseProxyConfig() {
  if (env.BROWSERBASE_PROXIES.toLowerCase() !== "true") return false;

  const defaultGeo =
    env.BROWSERBASE_USE_SITE_GEO.toLowerCase() === "true" &&
    siteOrder.length === 1
      ? siteDefaultGeolocation(siteOrder[0])
      : { country: env.BROWSERBASE_PROXY_COUNTRY };

  const geolocation: { country: string; state?: string; city?: string } = {
    ...defaultGeo,
  };

  if (env.BROWSERBASE_PROXY_STATE)
    geolocation.state = env.BROWSERBASE_PROXY_STATE;
  if (env.BROWSERBASE_PROXY_CITY) geolocation.city = env.BROWSERBASE_PROXY_CITY;

  return [
    {
      type: "browserbase" as const,
      geolocation,
    },
  ];
}

function siteDefaultGeolocation(site: SiteKey) {
  switch (site) {
    case "hillsborough":
      return { country: "US", state: "FL", city: "Tampa" };
    case "lee":
      return { country: "US", state: "FL", city: "Fort Myers" };
    case "miwayne":
      return { country: "US", state: "MI", city: "Detroit" };
  }
}

async function getActivePage(stagehand: any) {
  const existing = (await stagehand.browser.context.pages())[0];
  return existing ?? stagehand.browser.context.newPage();
}

async function assessSite(stagehand: any, page: any, site: SiteKey): Promise<SiteAssessment> {
  const searchAttempts: SearchAttempt[] = [];
  let assessment: SiteAssessment;
  switch (site) {
    case "hillsborough": assessment = await assessHillsborough(page, searchAttempts); break;
    case "lee": assessment = await assessLee(page, searchAttempts); break;
    case "miwayne": assessment = await assessMiCourt(stagehand, page, searchAttempts); break;
  }
  const latestAttempt = searchAttempts.at(-1);
  if ((assessment.status === "results_with_records" || assessment.status === "results_reached")
      && latestAttempt?.dispatch !== "acknowledged") {
    assessment = {
      ...assessment,
      status: latestAttempt ? "error" : "form_reached",
      notes: [...assessment.notes, "Result-looking content was observed without an acknowledged current search dispatch; completion is unconfirmed."],
    };
  }
  return { ...assessment, searchAttempts };
}

async function recordSearchDispatch(
  attempts: SearchAttempt[],
  criteria: Record<string, string | string[]>,
  dispatch: () => Promise<unknown>,
) {
  const attempt: SearchAttempt = {
    verifiedAt: new Date().toISOString(),
    criteria: JSON.parse(JSON.stringify(criteria)),
    dispatch: "pending",
  };
  attempts.push(attempt);
  try {
    const result = await dispatch();
    attempt.dispatch = "acknowledged";
    return result;
  } catch (error) {
    attempt.dispatch = "error";
    throw error;
  }
}

async function assessHillsborough(page: any, attempts: SearchAttempt[] = []): Promise<SiteAssessment> {
  const target = targetSites.hillsborough;
  const notes = [
    "Party search has stable fields for first name, last name, case status, case category, case type, and filed-date range.",
    "Browserbase captcha solving is enabled when configured; unresolved PerimeterX states are recorded with evidence.",
    "Flow starts from the HOVER home page before navigating to party search to preserve site session initialization.",
  ];

  try {
    await gotoDocumentReady(
      page,
      "https://hover.hillsclerk.com/",
      notes,
      "Hillsborough home",
    );
    await page.waitForTimeout(3_000);
    await maybeWaitForBrowserbaseCaptcha(
      page,
      notes,
      "Hillsborough initial load",
    );

    await navigateToHillsboroughPartySearch(page, notes);
    await page.waitForTimeout(3_000);
    await maybeWaitForBrowserbaseCaptcha(
      page,
      notes,
      "Hillsborough party search load",
    );
    await waitForHillsboroughWarmup(page, notes);

    let signals = await getPageSignals(page);
    let controls = await extractControlShape(page);
    let blocker = classifyBlocker(signals);
    if (blocker) {
      return buildAssessment("hillsborough", target, signals, blocker.status, {
        blocker: blocker.reason,
        evidence: blocker.evidence,
        controls,
        notes,
      });
    }

    const firstName =
      searchCriteria.firstName.trim() ||
      env.HILLSBOROUGH_FIRST_NAME_FALLBACK.trim();
    await fillRequiredField(page, "#spFirstName", firstName);
    await fillRequiredField(page, "#spLastName", searchCriteria.lastName);
    if (!(await setHillsboroughCaseCategoryWithoutAjax(
      page,
      env.HILLSBOROUGH_CASE_CATEGORY,
      notes,
    ))) {
      throw new Error("Hillsborough requested case category could not be verified.");
    }
    await fillRequiredField(page, "#spDateFiledAfter", searchCriteria.fromDate);
    await fillRequiredField(page, "#spDateFiledBefore", searchCriteria.toDate);
    notes.push(
      `Hillsborough search criteria: first name ${firstName || "(blank)"}, last name ${searchCriteria.lastName}, filed ${searchCriteria.fromDate}-${searchCriteria.toDate}, ${env.HILLSBOROUGH_CASE_CATEGORY} case category.`,
    );
    notes.push(
      `Hillsborough pre-submit snapshot: ${JSON.stringify(await getHillsboroughSnapshot(page))}.`,
    );
    await simulateHillsboroughHumanSignals(page, notes);

    if (env.HILLSBOROUGH_WARMUP_ONLY.toLowerCase() === "true") {
      notes.push(
        "Hillsborough warmup-only mode enabled; stopping before submit. Context persistence, when enabled, is requested at session termination and is not confirmed by this run.",
      );
      signals = await getPageSignals(page);
      controls = await extractControlShape(page);
      return buildAssessment("hillsborough", target, signals, "form_reached", {
        controls,
        resultSummary: await extractResultSummary(page),
        notes,
      });
    }

    await installHillsboroughNetworkProbe(page, notes);
    const perimeterSolved = await solvePerimeterXPressAndHold(page, notes);
    if (
      !perimeterSolved &&
      (await selectorCount(page, "#px-captcha-modal")) > 0
    ) {
      signals = await getPageSignals(page);
      controls = await extractControlShape(page);
      return buildAssessment(
        "hillsborough",
        target,
        signals,
        "blocked_human_check",
        {
          blocker:
            "PerimeterX press-and-hold modal remained before search submit.",
          evidence: findEvidence(
            `${signals.finalUrl}\n${signals.title}\n${signals.text}\n${signals.html}`,
            ["px-captcha-modal", "Press", "PerimeterX", "captcha"],
          ),
          controls,
          notes,
        },
      );
    }

    const verifiedCriteria = await verifyHillsboroughCriteria(page);
    const submit = page.locator("#btnSubmitPartySearch");
    if ((await submit.count()) !== 1) {
      throw new Error("Hillsborough submit control is unavailable or ambiguous.");
    }
    {
      await recordSearchDispatch(attempts, verifiedCriteria, () => submit.click());
      await dismissJavaScriptDialog(page, notes, "Hillsborough search submit");
      await waitForHillsboroughResultsContent(page, notes);
      await maybeWaitForBrowserbaseCaptcha(
        page,
        notes,
        "Hillsborough search submit",
      );
    }

    signals = await getPageSignals(page);
    controls = await extractControlShape(page);
    const networkBlocker = hillsboroughNetworkBlocker(
      await getHillsboroughNetworkEvents(page),
    );
    if (networkBlocker) {
      return buildAssessment(
        "hillsborough",
        target,
        signals,
        networkBlocker.status,
        {
          blocker: networkBlocker.reason,
          evidence: networkBlocker.evidence,
          controls,
          resultSummary: await extractResultSummary(page),
          notes,
        },
      );
    }
    const perimeterXBlocker = hillsboroughPerimeterXBlocker(
      await getHillsboroughPerimeterXState(page),
    );
    if (perimeterXBlocker) {
      return buildAssessment(
        "hillsborough",
        target,
        signals,
        perimeterXBlocker.status,
        {
          blocker: perimeterXBlocker.reason,
          evidence: perimeterXBlocker.evidence,
          controls,
          resultSummary: await extractResultSummary(page),
          notes,
        },
      );
    }
    blocker = classifyBlocker(signals);
    if (
      blocker?.status === "blocked_site_denial" &&
      /perimeterx|px-captcha|px-cloud/i.test(`${signals.text}\n${signals.html}`)
    ) {
      const solved = await solvePerimeterXPressAndHold(page, notes);
      if (solved) {
        await page.waitForTimeout(5_000);
        signals = await getPageSignals(page);
        controls = await extractControlShape(page);
        blocker = classifyBlocker(signals);
      }
    }

    if (blocker) {
      return buildAssessment("hillsborough", target, signals, blocker.status, {
        blocker: blocker.reason,
        evidence: blocker.evidence,
        controls,
        notes,
      });
    }

    const resultSummary = await extractResultSummary(page);

    return buildAssessment(
      "hillsborough",
      target,
      signals,
      completionStatus(resultSummary),
      {
        controls,
        resultSummary,
        notes,
      },
    );
  } catch (error) {
    return errorAssessment("hillsborough", target, error, notes);
  }
}

async function assessLee(page: any, attempts: SearchAttempt[] = []): Promise<SiteAssessment> {
  const target = targetSites.lee;
  const notes = [
    "Records Search exposes party name, case number, citation number, date range, hearing calendar, and case-type checkboxes.",
    "Browserbase captcha solving is enabled when configured; unresolved Akamai states are recorded with evidence.",
  ];

  try {
    await gotoPage(page, target.url, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForTimeout(3_000);
    await maybeWaitForBrowserbaseCaptcha(page, notes, "Lee initial load");

    let signals = await getPageSignals(page);
    let controls = await extractControlShape(page);
    let blocker = classifyBlocker(signals);
    if (blocker) {
      return buildAssessment("lee", target, signals, blocker.status, {
        blocker: blocker.reason,
        evidence: blocker.evidence,
        controls,
        notes,
      });
    }

    await setLeeCriminalCaseTypes(page);

    const firstName = searchCriteria.firstName.trim() || env.LEE_FIRST_NAME_FALLBACK.trim();
    await fillRequiredField(page, "#cs_FirstName", firstName);
    await fillRequiredField(page, "#cs_LastName", searchCriteria.lastName);
    await fillRequiredField(page, "#cs_DateFrom", searchCriteria.fromDate);
    await fillRequiredField(page, "#cs_DateTo", searchCriteria.toDate);
    notes.push(
      `Lee search criteria: first name ${firstName || "(blank)"}, last name ${searchCriteria.lastName}, filed/opened ${searchCriteria.fromDate}-${searchCriteria.toDate}.`,
    );
    notes.push(
      `Lee field snapshot before submit: ${JSON.stringify(await getLeeFieldSnapshot(page))}.`,
    );

    await submitLeeSearch(page, notes, attempts);

    signals = await getPageSignals(page);
    controls = await extractControlShape(page);
    blocker = classifyBlocker(signals);
    if (blocker?.status === "blocked_human_check") {
      notes.push(
        "Lee Akamai checkpoint surfaced after submit; retrying through a fresh landing-page warmup in the same Browserbase session.",
      );
      await gotoPage(page, target.url, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await page.waitForTimeout(8_000);
      await maybeWaitForBrowserbaseCaptcha(
        page,
        notes,
        "Lee warmup retry landing",
      );
      await setLeeCriminalCaseTypes(page);
      await fillRequiredField(page, "#cs_FirstName", firstName);
      await fillRequiredField(page, "#cs_LastName", searchCriteria.lastName);
      await fillRequiredField(page, "#cs_DateFrom", searchCriteria.fromDate);
      await fillRequiredField(page, "#cs_DateTo", searchCriteria.toDate);
      notes.push(
        `Lee warmup retry criteria: first name ${firstName || "(blank)"}, last name ${searchCriteria.lastName}, filed/opened ${searchCriteria.fromDate}-${searchCriteria.toDate}.`,
      );
      await clickLeeSubmit(page, attempts);
      await page.waitForTimeout(
        Math.max(8_000, env.BROWSERBASE_CAPTCHA_SETTLE_MS),
      );
      await maybeWaitForBrowserbaseCaptcha(
        page,
        notes,
        "Lee warmup retry submit",
      );
      signals = await getPageSignals(page);
      controls = await extractControlShape(page);
      blocker = classifyBlocker(signals);
    }
    if (blocker) {
      return buildAssessment("lee", target, signals, blocker.status, {
        blocker: blocker.reason,
        evidence: blocker.evidence,
        controls,
        notes,
      });
    }

    const resultSummary = await extractResultSummary(page);

    return buildAssessment(
      "lee",
      target,
      signals,
      completionStatus(resultSummary),
      {
        controls,
        resultSummary,
        notes,
      },
    );
  } catch (error) {
    return errorAssessment("lee", target, error, notes);
  }
}

async function assessMiCourt(
  stagehand: any,
  page: any,
  attempts: SearchAttempt[] = [],
): Promise<SiteAssessment> {
  const target = targetSites.miwayne;
  const notes = [
    "The D36 link redirects through MiCOURT's terms page before court search.",
    "This runner clicks Continue for the customer-authorized demo workflow and records any anti-bot state surfaced afterward.",
  ];

  try {
    await gotoPage(page, target.url, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForTimeout(3_000);
    await maybeWaitForBrowserbaseCaptcha(page, notes, "MiCOURT initial load");

    const continued = await clickIfPresent(page, "#continue-button-id");
    notes.push(
      continued
        ? "MiCOURT Continue clicked."
        : "MiCOURT Continue button was not clicked by deterministic selector.",
    );
    await page.waitForTimeout(5_000);
    await maybeWaitForBrowserbaseCaptcha(page, notes, "MiCOURT terms continue");

    let signals = await getPageSignals(page);
    let controls = await extractControlShape(page);
    let blocker = classifyBlocker(signals);
    if (blocker) {
      return buildAssessment("miwayne", target, signals, blocker.status, {
        blocker: blocker.reason,
        evidence: blocker.evidence,
        controls,
        notes,
      });
    }

    await searchMiCourt(stagehand, page, notes, attempts);
    await waitForMiCourtResultsContent(page, notes);
    await maybeWaitForBrowserbaseCaptcha(page, notes, "MiCOURT search submit");

    signals = await getPageSignals(page);
    controls = await extractControlShape(page);
    blocker = classifyBlocker(signals);
    if (
      blocker?.status === "blocked_human_check" &&
      /captcha was not completed successfully/i.test(
        `${signals.text}\n${signals.html}`,
      )
    ) {
      notes.push(
        "MiCOURT hCaptcha completion error surfaced after submit; closing modal and retrying search once.",
      );
      await clickFirstMatchingButton(page, ["Close"]).catch(() => false);
      await waitForHCaptchaToken(
        page,
        notes,
        "MiCOURT retry before search",
        45_000,
      );
      const criteria = await verifyMiCourtCriteria(page);
      await recordSearchDispatch(attempts, criteria, async () => {
        if (!(await clickFirstMatchingButton(page, ["Search", "Submit", "Find"]))) {
          throw new Error("MiCOURT retry submit control is unavailable.");
        }
      });
      await waitForMiCourtResultsContent(page, notes);
      await maybeWaitForBrowserbaseCaptcha(
        page,
        notes,
        "MiCOURT retry search submit",
      );
      signals = await getPageSignals(page);
      controls = await extractControlShape(page);
      blocker = classifyBlocker(signals);
    }
    if (blocker) {
      return buildAssessment("miwayne", target, signals, blocker.status, {
        blocker: blocker.reason,
        evidence: blocker.evidence,
        controls,
        notes,
      });
    }

    const resultSummary = await extractResultSummary(page);
    resultSummary.extracted = await extractMiCourtContent(
      stagehand,
      page,
      notes,
    );

    return buildAssessment(
      "miwayne",
      target,
      signals,
      completionStatus(resultSummary),
      {
        controls,
        resultSummary,
        notes,
      },
    );
  } catch (error) {
    return errorAssessment("miwayne", target, error, notes);
  }
}

async function gotoPage(
  page: any,
  url: string,
  options: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle";
    timeout?: number;
  } = {},
) {
  return page.goto(url, {
    waitUntil: options.waitUntil,
    timeout: options.timeout,
  });
}

async function gotoDocumentReady(
  page: Page,
  url: string,
  notes: string[],
  context: string,
) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    notes.push(`${context}: document navigation completed.`);
    return true;
  } catch (error) {
    notes.push(`${context}: document navigation failed: ${toErrorMessage(error)}`);
    return false;
  }
}

async function selectorCount(page: any, selector: string) {
  return page
    .evaluate(
      (selector: string) => document.querySelectorAll(selector).length,
      selector,
    )
    .catch(() => 0);
}

async function selectorValue(page: any, selector: string) {
  return page
    .evaluate((selector: string) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      return (el as HTMLInputElement).value ?? el.getAttribute("value") ?? null;
    }, selector)
    .catch(() => null);
}

async function selectorBox(page: any, selector: string) {
  return page
    .evaluate((selector: string) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return null;
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }, selector)
    .catch(() => null);
}

async function getPageSignals(page: any) {
  const [finalUrl, title, content] = await Promise.all([
    Promise.resolve(page.url()),
    page.title().catch(() => ""),
    page
      .evaluate(
        String.raw`(() => ({
        text: document.body?.innerText || "",
        html: document.documentElement?.outerHTML || ""
      }))()`,
      )
      .catch(() => ({ text: "", html: "" })),
  ]);

  return {
    finalUrl,
    title,
    text: normalizeWhitespace(content.text).slice(0, 10_000),
    html: normalizeWhitespace(content.html).slice(0, 20_000),
  };
}

function classifyBlocker(signals: {
  finalUrl: string;
  title: string;
  text: string;
  html?: string;
}):
  | {
      status: Extract<
        AssessmentStatus,
        "blocked_human_check" | "blocked_terms" | "blocked_site_denial"
      >;
      reason: string;
      evidence: string[];
    }
  | undefined {
  const haystack = `${signals.finalUrl}\n${signals.title}\n${signals.text}\n${signals.html ?? ""}`;

  if (
    (/matrix\.leeclerk\.org\/Home\/CheckSearch/i.test(signals.finalUrl) &&
      (/access denied/i.test(haystack) ||
        /challenge validation/i.test(haystack) ||
        /i'?m not a robot/i.test(haystack) ||
        /akamai/i.test(haystack))) ||
    /challenge validation/i.test(haystack) ||
    /powered and protected by\s+akamai/i.test(haystack)
  ) {
    return {
      status: "blocked_human_check",
      reason: "Lee MATRIX redirected to Akamai challenge validation.",
      evidence: findEvidence(haystack, [
        "Home/CheckSearch",
        "Challenge Validation",
        "Akamai",
        "I'm not a robot",
        "Access Denied",
      ]),
    };
  }

  if (
    /access to this page has been denied/i.test(haystack) ||
    /automation tools to browse the website/i.test(haystack) ||
    /perimeterx/i.test(haystack) ||
    /^access denied$/i.test(signals.title)
  ) {
    return {
      status: "blocked_site_denial",
      reason: "Site-level bot protection denied automated access.",
      evidence: findEvidence(haystack, [
        "Access to this page has been denied",
        "Access Denied",
        "automation tools",
        "PerimeterX",
        "Please verify you are a human",
      ]),
    };
  }

  if (
    /press\s*&\s*hold to confirm/i.test(haystack) ||
    /i'?m not a robot/i.test(haystack) ||
    /powered and protected by\s+akamai/i.test(haystack) ||
    /captcha was not completed successfully/i.test(haystack) ||
    /please confirm you.?re a human/i.test(haystack)
  ) {
    return {
      status: "blocked_human_check",
      reason: "A CAPTCHA or human-verification checkpoint is required.",
      evidence: findEvidence(haystack, [
        "Press & Hold",
        "I'm not a robot",
        "Akamai",
        "hCaptcha",
        "Captcha was not completed successfully",
        "confirm you",
      ]),
    };
  }

  return undefined;
}

async function extractControlShape(page: any): Promise<ControlShape[]> {
  return page.evaluate(String.raw`(() => {
    const labelFor = (el) => {
      const id = el.id || "";
      const aria =
        el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
      if (aria) return aria;

      if (id) {
        const label = document.querySelector('label[for="' + id.replace(/"/g, '\\"') + '"]');
        if (label?.textContent) return label.textContent;
      }

      const parentText = el.parentElement?.textContent || "";
      return parentText.length < 120 ? parentText : null;
    };

    return Array.from(
      document.querySelectorAll("input, select, textarea, button, [role='tab']"),
    )
      .filter((el) => {
        const style = window.getComputedStyle(el);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          el.type !== "hidden"
        );
      })
      .slice(0, 80)
      .map((el) => {
        return {
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute("type"),
          id: el.id || "",
          name: el.getAttribute("name"),
          label: labelFor(el)?.trim().replace(/\s+/g, " ").slice(0, 120) ?? null,
          placeholder: el.getAttribute("placeholder"),
          text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
          options:
            el.tagName.toLowerCase() === "select"
              ? Array.from(el.options).map((option) => option.text.trim())
              : undefined,
        };
      });
  })()`);
}

async function extractResultSummary(page: any) {
  const includeSamples = env.REDACT_OUTPUT.toLowerCase() === "false";

  return page.evaluate(
    String.raw`(() => {
    const includeSampleRows = __INCLUDE_SAMPLE_ROWS__;
    const allText = (document.body?.innerText || "").trim().replace(/\s+/g, " ");
    const visibleText = allText.slice(0, 6000);
    const tables = Array.from(document.querySelectorAll("table")).map(
      (table, index) => {
        const rows = Array.from(table.querySelectorAll("tr"));
        const dataRows = rows.slice(1).filter((row) =>
          Array.from(row.querySelectorAll("td, th")).some((cell) =>
            (cell.textContent || "").trim().length > 0
          )
        );
        return {
          index,
          headers: Array.from(table.querySelectorAll("th"))
            .map((th) => (th.textContent || "").trim().replace(/\s+/g, " "))
            .filter(Boolean),
          rowCount: dataRows.length,
          sampleRows: includeSampleRows
            ? dataRows.slice(0, 3).map((row) =>
                Array.from(row.querySelectorAll("td, th")).map((cell) =>
                  (cell.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
                ),
              )
            : undefined,
        };
      },
    );

    const links = Array.from(document.querySelectorAll("a[href]"))
      .map((anchor) => ({
        text: (anchor.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
        href: anchor.getAttribute("href"),
      }))
      .filter((link) => {
        const text = link.text.trim();
        const href = link.href || "";
        if (!text) return false;
        if (/^\/?case-search\/?$/i.test(href)) return false;
        return /case|detail|docket|view/i.test(text + href);
      })
      .slice(0, 25);

    const countPatterns = [
      /records returned for this search:\s*([0-9,]+)/i,
      /total record count:\s*([0-9,]+)/i,
      /([0-9,]+)\s+records?\s+returned/i,
      /showing\s+\d+\s*[-–]\s*\d+\s+of\s+([0-9,]+)/i,
      /result count\s*:?\s*([0-9,]+)/i,
      /([0-9,]+)\s+matching\s+results?/i
    ];
    let recordCount = null;
    const proofText = [];
    for (const pattern of countPatterns) {
      const match = allText.match(pattern);
      if (match) {
        recordCount = Number(match[1].replace(/,/g, ""));
        proofText.push(match[0].slice(0, 180));
        break;
      }
    }

    const proofPatterns = [
      /records returned for this search:\s*[0-9,]+/i,
      /total record count:\s*[0-9,]+/i,
      /search results/i,
      /showing\s+\d+\s*[-–]\s*\d+\s+of\s+[0-9,]+/i,
      /case number/i,
      /captcha was not completed successfully/i,
      /defendant/i,
      /party name/i
    ];
    for (const pattern of proofPatterns) {
      const match = allText.match(pattern);
      if (match && !proofText.includes(match[0])) {
        proofText.push(match[0].slice(0, 180));
      }
      if (proofText.length >= 5) break;
    }

    return { tables, links, visibleText, recordCount, proofText };
  })()`.replace("__INCLUDE_SAMPLE_ROWS__", JSON.stringify(includeSamples)),
  );
}

function completionStatus(
  resultSummary: ResultSummary | undefined,
): AssessmentStatus {
  if (!resultSummary) return "form_reached";
  const visibleText = resultSummary.visibleText ?? "";
  if (/results? (?:are |is )?loading|loading (?:search )?results?|search (?:is )?in progress/i.test(visibleText)) {
    return "form_reached";
  }
  const observedCount = resultSummary.recordCount;
  if (typeof observedCount === "number" && Number.isSafeInteger(observedCount) && observedCount >= 0) {
    return observedCount > 0 ? "results_with_records" : "results_reached";
  }
  if (/\bno (?:matching )?(?:results|records|cases)(?: were)? (?:found|returned)\b/i.test(visibleText)) {
    return "results_reached";
  }
  return "form_reached";
}

async function fillRequiredField(page: any, selector: string, value: string) {
  if (!(await fillIfPresent(page, selector, value))) {
    throw new Error(`Required search field could not be verified: ${selector}`);
  }
}

async function fillIfPresent(page: any, selector: string, value: string) {
  if ((await selectorCount(page, selector)) !== 1) return false;
  const filled = await page
    .locator(selector)
    .fill(value)
    .then(() => true)
    .catch(() => false);
  if (filled && (await selectorValue(page, selector)) === value) return true;

  return page
    .evaluate(
      ({ selector, value }: { selector: string; value: string }) => {
        const el = document.querySelector(selector) as HTMLInputElement | null;
        if (!el) return false;
        const proto = Object.getPrototypeOf(el);
        const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
        descriptor?.set?.call(el, value);
        if (el.value !== value) el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
        return el.value === value;
      },
      { selector, value },
    )
    .catch(() => false);
}

async function selectIfPresent(page: any, selector: string, label: string) {
  if ((await selectorCount(page, selector)) !== 1) return false;
  return page
    .evaluate(
      ({ selector, label }: { selector: string; label: string }) => {
        const select = document.querySelector(selector);
        if (!select || select.tagName.toLowerCase() !== "select") return false;
        const wanted = String(label).toLowerCase();
        const option = Array.from((select as HTMLSelectElement).options).find(
          (item) =>
            String(item.textContent || item.value)
              .trim()
              .toLowerCase() === wanted ||
            String(item.textContent || item.value)
              .toLowerCase()
              .includes(wanted),
        );
        if (!option) return false;
        (select as HTMLSelectElement).value = option.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      },
      { selector, label },
    )
    .catch(() => false);
}

async function clickIfPresent(page: any, selector: string) {
  if ((await selectorCount(page, selector)) !== 1) return false;
  const clicked = await page
    .locator(selector)
    .click()
    .then(() => true)
    .catch(() => false);
  if (clicked) return true;

  return page
    .evaluate((selector: string) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      (el as HTMLElement).click();
      return true;
    }, selector)
    .catch(() => false);
}

async function setCheckedIfPresent(
  page: any,
  selector: string,
  checked: boolean,
) {
  if ((await selectorCount(page, selector)) !== 1) return false;
  return page
    .evaluate(
      ({ selector, checked }: { selector: string; checked: boolean }) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        if ("checked" in el) {
          (el as HTMLInputElement).checked = checked;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
        (el as HTMLElement).click();
        return true;
      },
      { selector, checked },
    )
    .catch(() => false);
}

async function submitLeeSearch(page: any, notes: string[], attempts: SearchAttempt[] = []) {
  await clickLeeSubmit(page, attempts);
  await page.waitForTimeout(5_000);
  await maybeWaitForBrowserbaseCaptcha(page, notes, "Lee search submit");

  const firstSignals = await getPageSignals(page);
  const firstNameFieldStillVisible =
    (await selectorCount(page, "#cs_FirstName")) === 1;
  const needsWildcard =
    /first name is required if ['’]?last name['’]? is specified|place an asterisk/i.test(
      `${firstSignals.title}\n${firstSignals.text}\n${firstSignals.html}`,
    ) && firstNameFieldStillVisible;

  if (!needsWildcard) return;
  if (searchCriteria.firstName.trim()) {
    throw new Error("Lee rejected the configured first-name criteria; search was not broadened to a wildcard.");
  }

  notes.push(
    `Lee required first-name criteria for last-name search; retrying with site-documented wildcard \`${env.LEE_FIRST_NAME_FALLBACK}\`.`,
  );
  await fillRequiredField(page, "#cs_FirstName", env.LEE_FIRST_NAME_FALLBACK);
  notes.push(
    `Lee field snapshot before wildcard retry submit: ${JSON.stringify(await getLeeFieldSnapshot(page))}.`,
  );
  await submitLeeSearchNatively(page, attempts);
  await page
    .waitForLoadState("domcontentloaded", 30_000)
    .catch(() => undefined);
  await page.waitForTimeout(5_000);
  await maybeWaitForBrowserbaseCaptcha(
    page,
    notes,
    "Lee wildcard search submit",
  );
}

async function verifyLeeCriteria(page: any) {
  const expected = {
    firstName: searchCriteria.firstName.trim() || env.LEE_FIRST_NAME_FALLBACK.trim(),
    lastName: searchCriteria.lastName,
    fromDate: searchCriteria.fromDate,
    toDate: searchCriteria.toDate,
  };
  const verified = await page.evaluate((expected: Record<string, string>) => {
    const fields: Record<string, string> = {
      firstName: "#cs_FirstName", lastName: "#cs_LastName",
      fromDate: "#cs_DateFrom", toDate: "#cs_DateTo",
    };
    for (const [name, selector] of Object.entries(fields)) {
      const controls = document.querySelectorAll<HTMLInputElement>(selector);
      if (controls.length !== 1 || controls[0].value !== expected[name]) return false;
    }
    const wanted = ["Adult - Felony", "CriminalTraffic", "Misdemeanor", "County Ordinance", "Municipal Ordinance"];
    const controls = Array.from(document.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][id^="cs_CaseTypes_"][id$="__CaseTypeChecked"]',
    ));
    const types = controls.map((input) => ({
      description: ((document.getElementById(input.id.replace("__CaseTypeChecked", "__Description")) as HTMLInputElement | null)?.value || input.parentElement?.textContent || "").trim().toLowerCase(),
      checked: input.checked,
    }));
    return wanted.every((name) => types.filter((item) => item.description === name.toLowerCase()).length === 1)
      && types.every((item) => item.description.length > 0 && item.checked === wanted.some((name) => item.description === name.toLowerCase()));
  }, expected);
  if (!verified) throw new Error("Lee search criteria changed or could not be verified before submission.");
  return { ...expected, caseTypes: ["Adult - Felony", "CriminalTraffic", "Misdemeanor", "County Ordinance", "Municipal Ordinance"] };
}

async function clickLeeSubmit(page: any, attempts: SearchAttempt[] = []) {
  const criteria = await verifyLeeCriteria(page);
  await recordSearchDispatch(attempts, criteria, async () => {
    if (!(await clickIfPresent(page, "#submit2"))) throw new Error("Lee submit control is unavailable.");
  });

  await page
    .waitForLoadState("domcontentloaded", 30_000)
    .catch(() => undefined);
  await page.waitForTimeout(2_000);
  return true;
}

async function submitLeeSearchNatively(page: any, attempts: SearchAttempt[] = []) {
  const criteria = await verifyLeeCriteria(page);
  return recordSearchDispatch(attempts, criteria, async () => {
    const submitted = await page
      .evaluate(() => {
        const button = document.querySelector(
          "#submit2",
        ) as HTMLButtonElement | null;
        const form = button?.closest("form") as HTMLFormElement | null;
        if (!button || !form) return false;
        if (typeof form.requestSubmit === "function") {
          form.requestSubmit(button);
        } else {
          button.click();
        }
        return true;
      })
      .catch(() => false);
    if (!submitted) throw new Error("Lee native submit control is unavailable.");
    return true;
  });
}

async function getLeeFieldSnapshot(page: any) {
  return page
    .evaluate(() => {
      const value = (selector: string) =>
        (document.querySelector(selector) as HTMLInputElement | null)?.value ??
        null;
      const checked = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          'input[type="checkbox"][id^="cs_CaseTypes_"][id$="__CaseTypeChecked"]',
        ),
      )
        .filter((input) => input.checked)
        .map((input) => input.id);
      return {
        firstName: value("#cs_FirstName"),
        lastName: value("#cs_LastName"),
        dateFrom: value("#cs_DateFrom"),
        dateTo: value("#cs_DateTo"),
        checkedCaseTypeCount: checked.length,
        checkedCaseTypeIds: checked.slice(0, 8),
      };
    })
    .catch(() => undefined);
}

async function navigateToHillsboroughPartySearch(page: any, notes: string[]) {
  const homeLink = page.locator(
    'a[href="/html/case/caseSearch.html#nav-Party-tab"]',
  );

  if (
    env.HILLSBOROUGH_USE_HOME_LINK.toLowerCase() === "true" &&
    (await selectorCount(
      page,
      'a[href="/html/case/caseSearch.html#nav-Party-tab"]',
    )) === 1
  ) {
    await homeLink.click().catch(() => undefined);
    await page.waitForTimeout(2_000);
    notes.push("Hillsborough navigated to party search via home page link.");
    return;
  }

  await gotoDocumentReady(
    page,
    targetSites.hillsborough.url,
    notes,
    "Hillsborough direct party search",
  );
  notes.push(
    env.HILLSBOROUGH_USE_HOME_LINK.toLowerCase() === "true"
      ? "Hillsborough party search link not found; used direct route."
      : "Hillsborough used direct party-search route after home warmup.",
  );
}

async function waitForHillsboroughWarmup(page: any, notes: string[]) {
  const startedAt = Date.now();
  const timeoutMs = Math.max(45_000, env.BROWSERBASE_CAPTCHA_SETTLE_MS);

  while (Date.now() - startedAt < timeoutMs) {
    await dismissJavaScriptDialog(page, notes, "Hillsborough warmup");
    const snapshot = await getHillsboroughSnapshot(page);
    const ready =
      snapshot.formReady &&
      snapshot.categoryOptionCount > 1 &&
      snapshot.requestorGuidPresent &&
      !snapshot.perimeterXModalPresent;

    if (ready) {
      notes.push(`Hillsborough warmup ready: ${JSON.stringify(snapshot)}.`);
      return true;
    }

    if (snapshot.perimeterXModalPresent) {
      notes.push(
        `Hillsborough warmup saw PerimeterX modal before form submit: ${JSON.stringify(snapshot)}.`,
      );
      await solvePerimeterXPressAndHold(page, notes);
    }

    await page.waitForTimeout(1_000);
  }

  notes.push(
    `Hillsborough warmup timed out with snapshot: ${JSON.stringify(await getHillsboroughSnapshot(page))}.`,
  );
  return false;
}

async function getHillsboroughSnapshot(page: any) {
  return page
    .evaluate(
      String.raw`(() => {
      const parseJson = (value) => {
        if (!value) return null;
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      };
      const userInfo = parseJson(sessionStorage.getItem("UserInformationModel"));
      const categorySelect = document.querySelector("#spCaseCategory");
      const typeSelect = document.querySelector("#spCaseTypes");
      const selectedCaseCategory =
        document.querySelector("#selectedCaseCategory")?.value ?? "";
      const selectedCaseType =
        document.querySelector("#selectedCaseType")?.value ?? "";
      const fieldValue = (selector) =>
        document.querySelector(selector)?.value ?? "";

      return {
        formReady:
          Boolean(document.querySelector("#spFirstName")) &&
          Boolean(document.querySelector("#spLastName")) &&
          Boolean(document.querySelector("#btnSubmitPartySearch")),
        requestorGuidPresent: Boolean(userInfo?.RequestorGuid),
        accessTokenPresent: Boolean(userInfo?.AccessToken),
        userName: userInfo?.UserName ?? null,
        roleCount: Array.isArray(userInfo?.Roles) ? userInfo.Roles.length : 0,
        categoryOptionCount: categorySelect?.options.length ?? 0,
        categoryOptions: categorySelect
          ? Array.from(categorySelect.options).map((option) => ({
              text: option.text.trim(),
              value: option.value,
            }))
          : [],
        typeOptionCount: typeSelect?.options.length ?? 0,
        selectedCaseCategory,
        selectedCaseType,
        firstNameLength: fieldValue("#spFirstName").length,
        lastNameLength: fieldValue("#spLastName").length,
        dateFiledAfter: fieldValue("#spDateFiledAfter"),
        dateFiledBefore: fieldValue("#spDateFiledBefore"),
        perimeterXModalPresent: Boolean(
          document.querySelector("#px-captcha, #px-captcha-modal, iframe[name='px-captcha-modal']"),
        ),
        perimeterXTelemetryIframeCount: document.querySelectorAll(
          "iframe[id*='px'], iframe[src*='px-cloud']",
        ).length,
      };
    })()`,
    )
    .catch((error: unknown) => ({
      error: toErrorMessage(error),
      formReady: false,
      requestorGuidPresent: false,
      accessTokenPresent: false,
      userName: null,
      roleCount: 0,
      categoryOptionCount: 0,
      categoryOptions: [],
      typeOptionCount: 0,
      selectedCaseCategory: "",
      selectedCaseType: "",
      firstNameLength: 0,
      lastNameLength: 0,
      dateFiledAfter: "",
      dateFiledBefore: "",
      perimeterXModalPresent: false,
      perimeterXTelemetryIframeCount: 0,
    }));
}

async function installHillsboroughNetworkProbe(page: Page, notes: string[]) {
  const source = String.raw`(() => {
    if (window.__courtDemoNetworkProbeInstalled) return;
    window.__courtDemoNetworkProbeInstalled = true;
    window.__courtDemoNetworkEvents = window.__courtDemoNetworkEvents || [];
    const push = (event) => {
      window.__courtDemoNetworkEvents.push({
        ...event,
        at: new Date().toISOString()
      });
      if (window.__courtDemoNetworkEvents.length > 80) {
        window.__courtDemoNetworkEvents.splice(0, window.__courtDemoNetworkEvents.length - 80);
      }
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
      this.__courtDemoMethod = method;
      this.__courtDemoUrl = String(url);
      return originalOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
      this.addEventListener("loadend", () => {
        push({
          kind: "xhr",
          method: this.__courtDemoMethod || "",
          url: this.__courtDemoUrl || "",
          status: this.status,
          statusText: this.statusText || ""
        });
      });
      return originalSend.apply(this, arguments);
    };

    if (window.fetch) {
      const originalFetch = window.fetch;
      window.fetch = async function(input, init) {
        const method = init?.method || (typeof input !== "string" ? input.method : "GET");
        const url = typeof input === "string" ? input : input.url;
        try {
          const response = await originalFetch.apply(this, arguments);
          push({
            kind: "fetch",
            method,
            url,
            status: response.status,
            statusText: response.statusText || ""
          });
          return response;
        } catch (error) {
          push({
            kind: "fetch",
            method,
            url,
            status: 0,
            statusText: String(error)
          });
          throw error;
        }
      };
    }
  })();`;

  await page
    .addInitScript(source)
    .then(() =>
      notes.push("Hillsborough network probe registered for future documents."),
    )
    .catch((error: unknown) =>
      notes.push(
        `Hillsborough network probe init-script registration failed: ${toErrorMessage(error)}`,
      ),
    );
  await page
    .evaluate(source)
    .then(() =>
      notes.push("Hillsborough network probe installed on current document."),
    )
    .catch((error: unknown) =>
      notes.push(
        `Hillsborough network probe current-document install failed: ${toErrorMessage(error)}`,
      ),
    );
}

async function getHillsboroughNetworkEvents(page: any) {
  return page
    .evaluate(
      String.raw`(() => {
      const events = window.__courtDemoNetworkEvents;
      return Array.isArray(events) ? events.slice(-80) : [];
    })()`,
    )
    .catch(() => []);
}

function hillsboroughNetworkBlocker(
  events: Array<{
    kind?: string;
    method?: string;
    url?: string;
    status?: number;
    statusText?: string;
    at?: string;
  }>,
) {
  const caseSearch = events.find((event) =>
    /\/Case\/Search/i.test(event.url ?? ""),
  );
  if (!caseSearch || (caseSearch.status ?? 0) < 400) return undefined;

  return {
    status: "blocked_site_denial" as const,
    reason:
      `HOVER Case/Search returned HTTP ${caseSearch.status} ${caseSearch.statusText || ""}`.trim(),
    evidence: [
      `${caseSearch.method || "POST"} ${caseSearch.url}`,
      `status=${caseSearch.status}`,
      caseSearch.at ? `at=${caseSearch.at}` : "",
    ].filter(Boolean),
  };
}

async function getHillsboroughPerimeterXState(page: any) {
  return page
    .evaluate(
      String.raw`(() => {
      const scriptUrls = Array.from(document.scripts)
        .map((script) => script.src || "")
        .filter(Boolean);
      const iframeUrls = Array.from(document.querySelectorAll("iframe"))
        .map((iframe) => [iframe.src, iframe.id, iframe.name, iframe.title].filter(Boolean).join(" "))
        .filter(Boolean);
      const text = document.body?.innerText || "";
      return {
        url: location.href,
        title: document.title || "",
        captchaElementPresent: Boolean(
          document.querySelector("#px-captcha, #px-captcha-modal, iframe[name='px-captcha-modal']"),
        ),
        captchaScriptUrls: scriptUrls
          .filter((url) => /\/x9LbctPG\/captcha\/captcha\.js|captcha\.px-cdn\.net/i.test(url))
          .slice(-5),
        pxScriptUrls: scriptUrls
          .filter((url) => /PXx9LbctPG|px-cloud|x9LbctPG/i.test(url))
          .slice(-8),
        pxIframeUrls: iframeUrls
          .filter((url) => /px-cloud|PXx9LbctPG|x9LbctPG|px-captcha-modal|captcha/i.test(url))
          .slice(-8),
        accessDeniedText: /access to this page has been denied/i.test(text),
        verifyHumanText: /verify you are a human|press\s*&\s*hold|please confirm/i.test(text),
      };
    })()`,
    )
    .catch((error: unknown) => ({
      error: toErrorMessage(error),
      url: page.url(),
      title: "",
      captchaElementPresent: false,
      captchaScriptUrls: [],
      pxScriptUrls: [],
      pxIframeUrls: [],
      accessDeniedText: false,
      verifyHumanText: false,
    }));
}

function hillsboroughPerimeterXBlocker(state: {
  error?: string;
  url?: string;
  title?: string;
  captchaElementPresent?: boolean;
  captchaScriptUrls?: string[];
  pxScriptUrls?: string[];
  pxIframeUrls?: string[];
  accessDeniedText?: boolean;
  verifyHumanText?: boolean;
}) {
  if (
    !state.captchaElementPresent &&
    !state.accessDeniedText &&
    !state.verifyHumanText
  ) return undefined;

  const captchaScriptUrls = state.captchaScriptUrls ?? [];
  const evidence = [
    state.url ? `url=${state.url}` : "",
    state.captchaElementPresent ? "px captcha element present" : "",
    state.accessDeniedText ? "Access denied text present" : "",
    state.verifyHumanText ? "Verify-human text present" : "",
    ...captchaScriptUrls.map((url) => `captcha script=${url}`),
  ].filter(Boolean);

  return {
    status: (state.accessDeniedText
      ? "blocked_site_denial"
      : "blocked_human_check") as "blocked_site_denial" | "blocked_human_check",
    reason: state.accessDeniedText
      ? "PerimeterX access-denied page surfaced."
      : "PerimeterX captcha challenge surfaced before HOVER Case/Search returned results.",
    evidence,
  };
}

async function verifyHillsboroughCriteria(page: any) {
  const expected = {
    firstName: searchCriteria.firstName.trim() || env.HILLSBOROUGH_FIRST_NAME_FALLBACK.trim(),
    lastName: searchCriteria.lastName, fromDate: searchCriteria.fromDate, toDate: searchCriteria.toDate,
    category: env.HILLSBOROUGH_CASE_CATEGORY.trim(),
  };
  const verified = await page.evaluate((expected: Record<string, string>) => {
    const unique = (selector: string) => {
      const matches = document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(selector);
      return matches.length === 1 ? matches[0] : undefined;
    };
    for (const [name, selector] of Object.entries({firstName: "#spFirstName", lastName: "#spLastName", fromDate: "#spDateFiledAfter", toDate: "#spDateFiledBefore"})) {
      if (unique(selector)?.value !== expected[name]) return false;
    }
    const category = unique("#spCaseCategory") as HTMLSelectElement | undefined;
    if (!category?.options) return false;
    const wanted = expected.category.toLowerCase();
    const options = Array.from(category.options).filter((option) =>
      option.text.trim().toLowerCase() === wanted || option.value.trim().toLowerCase() === wanted,
    );
    return options.length === 1 && category.value === options[0].value
      && unique("#selectedCaseCategory")?.value === options[0].value
      && unique("#spCaseTypes")?.value === "ALL"
      && unique("#selectedCaseType")?.value === "ALL";
  }, expected);
  if (!verified) throw new Error("Hillsborough search criteria changed or could not be verified before submission.");
  return expected;
}

async function setHillsboroughCaseCategoryWithoutAjax(
  page: any,
  label: string,
  notes: string[],
) {
  const result = await page
    .evaluate(
      String.raw`((label) => {
      const select = document.querySelector("#spCaseCategory");
      const hidden = document.querySelector("#selectedCaseCategory");
      const typeSelect = document.querySelector("#spCaseTypes");
      const typeHidden = document.querySelector("#selectedCaseType");
      if (!select) return { ok: false, reason: "missing #spCaseCategory" };

      const wanted = label.trim().toLowerCase();
      const matchingOptions = Array.from(select.options).filter((item) => {
        const text = (item.textContent || "").trim().toLowerCase();
        const value = item.value.trim().toLowerCase();
        return text === wanted || value === wanted;
      });

      const option = matchingOptions.length === 1 ? matchingOptions[0] : undefined;
      if (!option) {
        return {
          ok: false,
          reason: "missing or ambiguous option " + label,
          options: Array.from(select.options).map((item) => ({
            text: item.text.trim(),
            value: item.value,
          })),
        };
      }

      select.value = option.value;
      if (hidden) hidden.value = option.value;
      if (typeSelect) typeSelect.value = "ALL";
      if (typeHidden) typeHidden.value = "ALL";

      return {
        ok: true,
        selectedText: option.text.trim(),
        selectedValue: option.value,
        typeValue: typeHidden?.value ?? typeSelect?.value ?? "",
      };
    })(__LABEL__)`.replace("__LABEL__", JSON.stringify(label)),
    )
    .catch((error: unknown) => ({ ok: false, reason: toErrorMessage(error) }));

  notes.push(
    `Hillsborough category set without case-type XHR: ${JSON.stringify(result)}.`,
  );
  await dismissJavaScriptDialog(page, notes, "Hillsborough category set");
  return Boolean((result as { ok?: boolean }).ok);
}

async function waitForHillsboroughResultsContent(page: any, notes: string[]) {
  const startedAt = Date.now();
  const timeoutMs = 120_000;
  let targetedPxSolveAttempted = false;

  while (Date.now() - startedAt < timeoutMs) {
    await dismissJavaScriptDialog(page, notes, "Hillsborough results wait");
    const networkBlocker = hillsboroughNetworkBlocker(
      await getHillsboroughNetworkEvents(page),
    );
    if (networkBlocker) {
      notes.push(
        `Hillsborough network terminal state: ${JSON.stringify(networkBlocker)}.`,
      );
      return true;
    }

    const pxState = await getHillsboroughPerimeterXState(page);
    if (/searchResults\.html/i.test(pxState.url ?? "")) {
      const pxBlocker = hillsboroughPerimeterXBlocker(pxState);
      if (pxBlocker) {
        if (!targetedPxSolveAttempted) {
          targetedPxSolveAttempted = true;
          const solved = await waitForTargetedBrowserbaseCaptcha(
            page,
            notes,
            "Hillsborough result-page PerimeterX",
          );
          if (solved) {
            await page.waitForTimeout(5_000);
            continue;
          }
          const held = await solvePerimeterXPressAndHold(page, notes);
          if (held) {
            await page.waitForTimeout(5_000);
            continue;
          }
        }
        notes.push(
          `Hillsborough result-page PerimeterX terminal state: ${JSON.stringify(pxState)}.`,
        );
        return true;
      }
    }

    const signals = await getPageSignals(page);
    const haystack = `${signals.finalUrl}\n${signals.title}\n${signals.text}\n${signals.html}`;
    const resultSummary = await extractResultSummary(page);
    if (
      /searchResults\.html/i.test(signals.finalUrl) &&
      (/records returned for this search|search results|case number|party name|no records|no cases|forbidden|access to this page has been denied|px-captcha/i.test(
        haystack,
      ) ||
        resultSummary.tables.some(
          (table: { rowCount: number }) => table.rowCount > 0,
        ))
    ) {
      notes.push("Hillsborough result page reached a terminal visible state.");
      return true;
    }

    if (/first name is required|last name is required|error!/i.test(haystack)) {
      notes.push(
        `Hillsborough stayed on form with validation/error text: ${findEvidence(
          haystack,
          ["First Name", "Last Name", "Error", "Forbidden"],
        ).join(" | ")}`,
      );
      return false;
    }

    await page.waitForTimeout(2_000);
  }

  notes.push(
    `Hillsborough results did not reach a terminal state after ${timeoutMs}ms; final URL ${page.url()}.`,
  );
  return false;
}

async function simulateHillsboroughHumanSignals(page: Page, notes: string[]) {
  const selectors = [
    "#spFirstName",
    "#spLastName",
    "#spCaseCategory",
    "#spDateFiledAfter",
    "#spDateFiledBefore",
    "#btnSubmitPartySearch",
  ];

  let moved = 0;
  for (const selector of selectors) {
    const box = await selectorBox(page, selector);
    if (!box) continue;
    const targetX = box.x + box.width * (0.35 + Math.random() * 0.3);
    const targetY = box.y + box.height * (0.35 + Math.random() * 0.3);
    const startX = Math.max(1, targetX - 120 - Math.random() * 80);
    const startY = Math.max(1, targetY - 40 - Math.random() * 60);
    const steps = 8;

    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps;
      const x =
        startX + (targetX - startX) * progress + (Math.random() - 0.5) * 2;
      const y =
        startY + (targetY - startY) * progress + (Math.random() - 0.5) * 2;
      await page
        .hover(x, y)
        .catch(() => undefined);
      await page.waitForTimeout(70 + Math.floor(Math.random() * 60));
    }
    moved += 1;
  }

  await page
    .scroll(900, 700, 0, 180)
    .catch(() => undefined);
  await page.waitForTimeout(400);
  await page
    .scroll(900, 700, 0, -120)
    .catch(() => undefined);

  if (env.HILLSBOROUGH_PRE_SUBMIT_WAIT_MS > 0) {
    await page.waitForTimeout(env.HILLSBOROUGH_PRE_SUBMIT_WAIT_MS);
  }
  notes.push(
    `Hillsborough human-signal pass moved across ${moved} control(s) and waited ${env.HILLSBOROUGH_PRE_SUBMIT_WAIT_MS}ms before submit.`,
  );
}

async function dismissJavaScriptDialog(
  page: any,
  notes: string[],
  context: string,
) {
  return page
    .sendCDP("Page.handleJavaScriptDialog", { accept: true })
    .then(() => {
      notes.push(`${context}: dismissed a JavaScript dialog.`);
      return true;
    })
    .catch(() => false);
}

async function solvePerimeterXPressAndHold(page: any, notes: string[]) {
  const targetSelector = await firstPresentSelector(page, [
    "#px-captcha",
    "#px-captcha-modal",
    "iframe[name='px-captcha-modal']",
    "iframe[src*='captcha']",
  ]);

  if (!targetSelector) {
    notes.push(
      "PerimeterX press-and-hold fallback: captcha element not found.",
    );
    return false;
  }

  const box = await selectorBox(page, targetSelector);
  if (!box) {
    notes.push(
      "PerimeterX press-and-hold fallback: #px-captcha has no visible box.",
    );
    return false;
  }

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  notes.push(
    "PerimeterX press-and-hold fallback: attempting hold interaction.",
  );
  await page.sendCDP("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x,
    y,
    button: "none",
  });
  await page.sendCDP("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await page.waitForTimeout(12_000);
  await page.sendCDP("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  await page.waitForTimeout(5_000);

  const signals = await getPageSignals(page);
  const modalStillPresent =
    (await selectorCount(page, "#px-captcha-modal")) > 0;
  const stillDenied =
    modalStillPresent ||
    /access to this page has been denied|automation tools|perimeterx/i.test(
      `${signals.title}\n${signals.text}\n${signals.html}`,
    );

  notes.push(
    `PerimeterX press-and-hold fallback: ${
      stillDenied ? "still denied after hold" : "denial cleared after hold"
    }.`,
  );

  return !stillDenied;
}

async function firstPresentSelector(page: any, selectors: string[]) {
  for (const selector of selectors) {
    if ((await selectorCount(page, selector)) > 0) return selector;
  }
  return null;
}

async function waitForInputValue(
  page: any,
  selector: string,
  notes: string[],
  context: string,
  timeoutMs = Math.max(20_000, env.BROWSERBASE_CAPTCHA_SETTLE_MS),
) {
  if ((await selectorCount(page, selector)) !== 1) {
    notes.push(`${context}: token input not found.`);
    return false;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await selectorValue(page, selector);
    if (value && value.trim().length > 0) {
      notes.push(`${context}: token populated.`);
      return true;
    }
    await page.waitForTimeout(1_000);
  }

  notes.push(`${context}: token did not populate within ${timeoutMs}ms.`);
  return false;
}

async function maybeWaitForBrowserbaseCaptcha(page: Page, notes: string[], context: string) {
  if (env.USE_BROWSERBASE.toLowerCase() === "false" || env.BROWSERBASE_SOLVE_CAPTCHAS.toLowerCase() !== "true") return;
  const delay = env.BROWSERBASE_CAPTCHA_SETTLE_MS;
  if (delay > 0) await page.waitForTimeout(delay);
  notes.push(`${context}: waited ${delay}ms for Browserbase solver settling; solver completion is not confirmed.`);
}

async function waitForTargetedBrowserbaseCaptcha(
  page: any,
  notes: string[],
  context: string,
) {
  if (
    env.USE_BROWSERBASE.toLowerCase() === "false" ||
    env.BROWSERBASE_SOLVE_CAPTCHAS.toLowerCase() !== "true"
  ) {
    return false;
  }

  if (typeof page.waitForCaptchaSolve !== "function") {
    notes.push(
      `${context}: no page.waitForCaptchaSolve hook exposed; waiting ${env.BROWSERBASE_CAPTCHA_SETTLE_MS}ms for solver settle.`,
    );
    await page.waitForTimeout(env.BROWSERBASE_CAPTCHA_SETTLE_MS);
    return false;
  }

  try {
    await Promise.race([
      page.waitForCaptchaSolve(90_000),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Targeted captcha timeout")), 95_000),
      ),
    ]);
    notes.push(`${context}: Browserbase targeted captcha solver completed.`);
    return true;
  } catch (error) {
    notes.push(
      `${context}: targeted Browserbase solve did not complete (${toErrorMessage(error)}).`,
    );
    return false;
  }
}

async function waitForHCaptchaToken(
  page: any,
  notes: string[],
  context: string,
  timeoutMs: number,
) {
  const hasCaptcha = await page
    .evaluate(() =>
      Boolean(
        document.querySelector(
          'iframe[src*="hcaptcha.com"], textarea[name="h-captcha-response"], [name="h-captcha-response"]',
        ),
      ),
    )
    .catch(() => false);

  if (!hasCaptcha) {
    notes.push(`${context}: no hCaptcha widget/response field detected.`);
    return false;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const tokenLength = await page
      .evaluate(() => {
        const field =
          document.querySelector<HTMLTextAreaElement>(
            'textarea[name="h-captcha-response"]',
          ) ||
          document.querySelector<HTMLInputElement>(
            'input[name="h-captcha-response"]',
          ) ||
          document.querySelector<HTMLTextAreaElement>(
            '[name="h-captcha-response"]',
          );
        return field?.value?.trim().length ?? 0;
      })
      .catch(() => 0);
    if (tokenLength > 20) {
      notes.push(`${context}: hCaptcha response token populated.`);
      return true;
    }
    await page.waitForTimeout(1_000);
  }

  notes.push(
    `${context}: hCaptcha response token not populated within ${timeoutMs}ms; submitting to capture site response.`,
  );
  return false;
}

async function searchMiCourt(_stagehand: any, page: any, notes: string[], attempts: SearchAttempt[] = []) {
  await fillMiCourtDeterministicFields(page, notes);
  await waitForHCaptchaToken(page, notes, "MiCOURT before search", 45_000);
  const criteria = await verifyMiCourtCriteria(page);
  await recordSearchDispatch(attempts, criteria, async () => {
    if (!(await clickFirstMatchingButton(page, ["Search", "Submit", "Find"]))) {
      throw new Error("MiCOURT search submit control is unavailable.");
    }
  });
  notes.push("MiCOURT submitted the verified name, dates and criminal/traffic criteria.");
}

async function extractMiCourtContent(
  stagehand: any,
  page: any,
  notes: string[],
) {
  if (typeof stagehand.extract !== "function") {
    notes.push(
      "MiCOURT Stagehand extract skipped because extract is unavailable.",
    );
    return undefined;
  }

  try {
    const schema = z.object({
      pageState: z.string(),
      resultCountText: z.string().nullable(),
      visibleCaseRows: z
        .array(
          z.object({
            caseNumber: z.string().nullable(),
            name: z.string().nullable(),
            status: z.string().nullable(),
            caseType: z.string().nullable(),
            date: z.string().nullable(),
          }),
        )
        .nullable(),
    });

    const extracted = (
      await stagehand.extract(
        "Extract the current MiCOURT D36 search result state. Include any result count text and the first visible case rows if present. If results are still loading or there are no matching results, say that in pageState.",
        schema,
        {
          page,
          timeout: 120_000,
          serverCache: false,
        },
      )
    ).data;

    notes.push(
      "MiCOURT Stagehand extract completed with 120000ms timeout.",
    );
    return extracted;
  } catch (error) {
    notes.push(
      `MiCOURT Stagehand extract failed: ${toErrorMessage(error)}`,
    );
    return undefined;
  }
}

async function fillMiCourtDeterministicFields(page: any, notes: string[]) {
  await fillRequiredField(page, "#last-name-input-id", searchCriteria.lastName);
  await fillRequiredField(page, "#first-name-input-id", searchCriteria.firstName);
  const filterOpened = await clickFirstMatchingButton(page, ["Show Filter", "Show"]);
  if (filterOpened) await page.waitForTimeout(1_000);
  await fillRequiredField(page, "#filed-from-date-input-id", searchCriteria.fromDate);
  await fillRequiredField(page, "#filed-to-date-input-id", searchCriteria.toDate);
  if (!(await setCheckedIfPresent(page, "#criminal-traffic-checkbox-id", true))) {
    throw new Error("MiCOURT criminal/traffic filter could not be set.");
  }
  await verifyMiCourtCriteria(page);
  notes.push("MiCOURT name, filed-date range and criminal/traffic criteria verified.");
  return true;
}

async function verifyMiCourtCriteria(page: any) {
  for (const [selector, expected] of [
    ["#last-name-input-id", searchCriteria.lastName],
    ["#first-name-input-id", searchCriteria.firstName],
    ["#filed-from-date-input-id", searchCriteria.fromDate],
    ["#filed-to-date-input-id", searchCriteria.toDate],
  ]) {
    if ((await selectorCount(page, selector)) !== 1 || (await selectorValue(page, selector)) !== expected) {
      throw new Error(`MiCOURT search criterion changed or is unavailable: ${selector}`);
    }
  }
  const checked = await page.evaluate(() => {
    const controls = document.querySelectorAll<HTMLInputElement>("#criminal-traffic-checkbox-id");
    return controls.length === 1 && controls[0].checked === true;
  });
  if (!checked) throw new Error("MiCOURT criminal/traffic filter is not verified.");
  return { ...searchCriteria, caseTypes: ["criminal/traffic"] };
}

async function waitForMiCourtResultsContent(page: any, notes: string[]) {
  const startedAt = Date.now();
  const timeoutMs = 120_000;

  while (Date.now() - startedAt < timeoutMs) {
    const signals = await getPageSignals(page);
    const haystack = `${signals.finalUrl}\n${signals.text}`;
    if (
      /\/court\/D36\/search/i.test(signals.finalUrl) &&
      /total record count:\s*\d+|records returned|no (matching )?results|showing \d+\s*[-–]\s*\d+\s+of\s+\d+|result count|captcha was not completed successfully/i.test(
        haystack,
      )
    ) {
      notes.push("MiCOURT result content detected after search.");
      return true;
    }
    await page.waitForTimeout(2_000);
  }

  notes.push(`MiCOURT result content did not settle within ${timeoutMs}ms.`);
  return false;
}

async function clickFirstMatchingButton(page: any, names: string[]) {
  return page.evaluate(
    String.raw`((names) => {
    const normalized = names.map((name) => name.toLowerCase());
    const candidates = Array.from(document.querySelectorAll("button, input[type='submit'], input[type='button']"));
    const match = candidates.find((element) => {
      const text = (element.textContent || element.value || "").trim().toLowerCase();
      return normalized.includes(text);
    });
    if (!match) return false;
    match.click();
    return true;
  })(__NAMES__)`.replace("__NAMES__", JSON.stringify(names)),
  );
}

async function setLeeCriminalCaseTypes(page: any) {
  const wanted = [
    "Adult - Felony",
    "CriminalTraffic",
    "Misdemeanor",
    "County Ordinance",
    "Municipal Ordinance",
  ];

  const caseTypes: Array<{
    id: string;
    description: string;
    checked: boolean;
  }> = await page.evaluate(String.raw`(() => {
      return Array.from(
        document.querySelectorAll(
          'input[type="checkbox"][id^="cs_CaseTypes_"][id$="__CaseTypeChecked"]',
        ),
      ).map((input) => {
        const prefix = input.id.replace("__CaseTypeChecked", "");
        const descriptionInput = document.getElementById(
          prefix + "__Description",
        );
        const description =
          descriptionInput?.value ||
          input.parentElement?.textContent?.trim().replace(/\s+/g, " ") ||
          "";
        return { id: input.id, description, checked: input.checked };
      });
    })()`);

  const normalize = (value: string) => value.trim().toLowerCase();
  for (const description of wanted) {
    if (caseTypes.filter((item) => normalize(item.description) === normalize(description)).length !== 1) {
      throw new Error("Lee required case-type controls are missing or ambiguous.");
    }
  }
  if (caseTypes.some((item) => !item.id || !item.description.trim())) {
    throw new Error("Lee case-type controls cannot be identified reliably.");
  }
  const expected = caseTypes.map((item) => ({
    id: item.id,
    checked: wanted.some((name) => normalize(item.description) === normalize(name)),
  }));
  for (const item of expected) {
    if (!(await setCheckedIfPresent(page, `#${item.id}`, item.checked))) {
      throw new Error("Lee case-type selection failed.");
    }
  }
  const verified = await page.evaluate((expected: Array<{ id: string; checked: boolean }>) => {
    const controls = Array.from(document.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][id^="cs_CaseTypes_"][id$="__CaseTypeChecked"]',
    ));
    return controls.length === expected.length && expected.every((item) => {
      const matches = controls.filter((control) => control.id === item.id);
      return matches.length === 1 && matches[0].checked === item.checked;
    });
  }, expected);
  if (!verified) throw new Error("Lee case-type selection did not retain the required scope.");
}

function buildAssessment(
  site: SiteKey,
  target: { label: string; url: string },
  signals: { finalUrl: string; title: string },
  status: AssessmentStatus,
  extras: Omit<
    Partial<SiteAssessment>,
    "site" | "label" | "url" | "finalUrl" | "title" | "status"
  >,
): SiteAssessment {
  return {
    site,
    label: target.label,
    url: target.url,
    finalUrl: signals.finalUrl,
    title: signals.title,
    status,
    controls: extras.controls ?? [],
    notes: extras.notes ?? [],
    blocker: extras.blocker,
    evidence: extras.evidence,
    resultSummary: extras.resultSummary,
    screenshotPath: extras.screenshotPath,
  };
}

async function errorAssessment(
  site: SiteKey,
  target: { label: string; url: string },
  error: unknown,
  notes: string[],
): Promise<SiteAssessment> {
  return {
    site,
    label: target.label,
    url: target.url,
    finalUrl: target.url,
    title: "",
    status: "error",
    blocker: toErrorMessage(error),
    controls: [],
    notes,
  };
}

function findEvidence(text: string, needles: string[]) {
  const normalized = normalizeWhitespace(text);
  return needles
    .map((needle) => {
      const index = normalized.toLowerCase().indexOf(needle.toLowerCase());
      if (index === -1) return undefined;
      return normalized.slice(
        Math.max(0, index - 80),
        index + needle.length + 140,
      );
    })
    .filter((item): item is string => Boolean(item));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
