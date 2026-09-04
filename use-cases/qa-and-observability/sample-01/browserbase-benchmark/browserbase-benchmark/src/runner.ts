/**
 * General benchmark runner.
 *
 * Discovers all scenarios (src/scenarios/) and competitors (src/competitors/),
 * runs every combination across the configured sites, and saves results to
 * results/<timestamp>.json.
 *
 * CLI usage:
 *   npm run benchmark                                      # all scenarios × all competitors
 *   npm run benchmark -- --local-only                     # only local-chromium competitor
 *   npm run benchmark -- --competitors browserbase        # filter competitors by name
 *   npm run benchmark -- --scenarios basic-navigation     # filter scenarios by name
 *   npm run benchmark -- --sites https://a.com,https://b.com
 *   npm run benchmark -- --runs 10
 *   npm run benchmark -- --browser-only                   # skip LLM steps
 */

import { RunResources } from "./run-resources.js";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RunResult, Competitor, Scenario } from "./types.js";
import type { NavigationTiming, PageMetrics } from "./types.js";
import { discoverScenarios, discoverCompetitors } from "./discover.js";

// ---------------------------------------------------------------------------
// Public API (used by server.ts)
// ---------------------------------------------------------------------------

export interface RunnerOptions {
  runTimeoutMs?: number;
  scenarios: Scenario[];
  competitors: Competitor[];
  sites: string[];
  runs: number;
  browserOnly?: boolean;
  host?: string;
}

export async function runBenchmark(opts: RunnerOptions): Promise<RunResult[]> {
  const { scenarios, competitors, sites, runs, browserOnly = false, host } = opts;

  console.log(`\nBrowserbase Benchmark Framework`);
  console.log(`Scenarios  : ${scenarios.map((s) => s.name).join(", ")}`);
  console.log(`Competitors: ${competitors.map((c) => c.label).join(", ")}`);
  console.log(`Sites      : ${sites.join(", ")}`);
  console.log(`Runs       : ${runs} per site × scenario × competitor`);
  if (host) console.log(`Host       : ${host}`);
  console.log();

  const allResults: RunResult[] = [];

  // Sequential execution: all runs for one competitor before moving to the next.
  // Avoids resource contention between local Chromium and Browserbase sessions.
  for (const competitor of competitors) {
    for (const scenario of scenarios) {
      for (const site of sites) {
        for (let i = 0; i < runs; i++) {
          console.log(`[${competitor.name}][${scenario.name}] run ${i + 1}/${runs} → ${site}`);

          const result = await runOnce(competitor, scenario, site, i, {
            browserOnly, host, timeoutMs: opts.runTimeoutMs ?? 60_000,
          });

          allResults.push(result);

          if (result.error) {
            console.log(`  ERROR: ${result.error}`);
          } else {
            const stepStr = Object.entries(result.steps)
              .map(([k, v]) => `${k}=${v}ms`)
              .join(" ");
            console.log(`  ${stepStr} total=${result.total}ms`);
          }
        }
      }
    }
  }

  return allResults;
}

// ---------------------------------------------------------------------------
// Single run
// ---------------------------------------------------------------------------

interface RunOnceOpts {
  timeoutMs?: number;
  browserOnly?: boolean;
  host?: string;
}

async function runOnce(
  competitor: Competitor,
  scenario: Scenario,
  site: string,
  runIndex: number,
  opts: RunOnceOpts = {},
): Promise<RunResult> {
  const { browserOnly = false, host } = opts;
  const steps: Record<string, number> = {};

  const timeoutMs = opts.timeoutMs ?? 60_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error("Invalid measurement timeout");
  const controller = new AbortController();
  const resources = new RunResources(controller.signal);
  const abort = () => resources.beginClosing();
  controller.signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error(`Run timed out after ${timeoutMs} ms`)), timeoutMs);
  const initStartedAt = Date.now();
  try {
    const stagehand = await competitor.createStagehand(resources);
    await resources.own(stagehand.browser);
    await resources.own(stagehand);
    steps.init = Date.now() - initStartedAt;
    controller.signal.throwIfAborted();
    let t: number;

    // Capture Browserbase session ID if available
    let sessionId: string | undefined;
    try {
      // @ts-expect-error — internal property, may vary by Stagehand version
      sessionId = stagehand.browser.sessionId ?? stagehand.sessionId;
    } catch {
      // ignore
    }

    // Cast through unknown: stagehand.browser.context returns its own internal Page type
    // which is structurally equivalent to playwright-core's Page but doesn't satisfy
    // the index signature check at compile time.
    const page = (await stagehand.browser.context.pages())[0] as unknown as import("playwright-core").Page;
    if (!page) throw new Error("No page available after init");

    let navigation: NavigationTiming | undefined;
    let pageMetrics: PageMetrics | undefined;

    // Execute scenario steps
    for (const step of scenario.steps) {
      controller.signal.throwIfAborted();
      t = Date.now();
      await step.run(stagehand, page, { site, browserOnly, signal: controller.signal });
      controller.signal.throwIfAborted();
      steps[step.name] = Date.now() - t;

      // After the 'goto' step, collect W3C Navigation Timing and page complexity
      // metrics from the browser context. These are independent of CDP transport
      // and reflect the page's own load characteristics.
      if (step.name === "goto") {
        try {
          const raw = await page.evaluate(() => {
            const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
            const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
            return {
              navigation: nav
                ? {
                    dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
                    tcp: Math.round(nav.connectEnd - nav.connectStart),
                    tls:
                      nav.secureConnectionStart > 0
                        ? Math.round(nav.connectEnd - nav.secureConnectionStart)
                        : 0,
                    ttfb: Math.round(nav.responseStart - nav.requestStart),
                    download: Math.round(nav.responseEnd - nav.responseStart),
                    domContentLoaded: Math.round(
                      nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
                    ),
                  }
                : null,
              page: {
                domNodes: document.querySelectorAll("*").length,
                resources: resources.length,
                transferBytes: resources.reduce((sum, r) => sum + (r.transferSize ?? 0), 0),
              },
            };
          });
          if (raw.navigation) navigation = raw.navigation as NavigationTiming;
          pageMetrics = raw.page as PageMetrics;
        } catch {
          // Non-fatal — results still recorded without timing breakdown
        }
      }
    }

    controller.signal.throwIfAborted();
    const total = Object.values(steps).reduce((a, b) => a + b, 0);

    return {
      competitor: competitor.name,
      scenario: scenario.name,
      site,
      runIndex,
      steps,
      total,
      metadata: {
        ...(host ? { host } : {}),
        ...(sessionId ? { sessionId } : {}),
        ...(navigation ? { navigation } : {}),
        ...(pageMetrics ? { page: pageMetrics } : {}),
      },
    };
  } catch (err) {
    if (steps.init === undefined) steps.init = Date.now() - initStartedAt;
    return {
      competitor: competitor.name,
      scenario: scenario.name,
      site,
      runIndex,
      steps,
      total: Object.values(steps).reduce((a, b) => a + b, 0),
      metadata: { ...(host ? { host } : {}) },
      error: controller.signal.aborted ? String(controller.signal.reason.message) : err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", abort);
    await resources.close();
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  function getArg(flag: string): string | undefined {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  }

  const localOnly = args.includes("--local-only");
  const browserOnly = args.includes("--browser-only");

  const sitesRaw = getArg("--sites") ?? process.env.BENCHMARK_SITES ?? "";
  const sites = sitesRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (sites.length === 0) {
    console.error("No sites configured. Set BENCHMARK_SITES in .env or pass --sites <urls>");
    process.exit(1);
  }

  const runs = parseInt(getArg("--runs") ?? process.env.BENCHMARK_RUNS ?? "5", 10);
  const host = process.env.BENCHMARK_HOST;

  const scenarioFilter = getArg("--scenarios")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const competitorFilter = localOnly
    ? ["local-chromium"]
    : getArg("--competitors")
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  const [scenarios, competitors] = await Promise.all([
    discoverScenarios(scenarioFilter),
    discoverCompetitors(competitorFilter),
  ]);

  const allResults = await runBenchmark({
    scenarios,
    competitors,
    sites,
    runs,
    browserOnly,
    host,
  });

  // Save results
  const resultsDir = join(process.cwd(), "results");
  if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });

  const ts = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\.\d+Z$/, "");
  const outFile = join(resultsDir, `${ts}.json`);
  writeFileSync(outFile, JSON.stringify(allResults, null, 2));

  console.log(`\nResults saved to: ${outFile}`);
  console.log(`Run "npm run report" to generate report.html`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
