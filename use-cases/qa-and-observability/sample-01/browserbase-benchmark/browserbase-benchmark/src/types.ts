import type { RunResourcesContext } from "./run-resources.js";
import type { Stagehand } from "@browserbasehq/stagehand";
import type { Page } from "playwright-core";

// ---------------------------------------------------------------------------
// Browser metrics
// ---------------------------------------------------------------------------

export interface NavigationTiming {
  dns: number;            // DNS lookup (domainLookupEnd - domainLookupStart)
  tcp: number;            // TCP handshake (connectEnd - connectStart)
  tls: number;            // TLS negotiation (connectEnd - secureConnectionStart, 0 for HTTP)
  ttfb: number;           // Time to first byte (responseStart - requestStart)
  download: number;       // HTML body download (responseEnd - responseStart)
  domContentLoaded: number; // DCL event handler duration
}

export interface PageMetrics {
  domNodes: number;       // Total elements in the document tree
  resources: number;      // Number of subresources (scripts, stylesheets, images, XHRs)
  transferBytes: number;  // Total bytes transferred across all resources
}

export type Host = "ec2" | "render" | "local-machine";

// ---------------------------------------------------------------------------
// Scenario — defines what to benchmark
//
// Create a new file in src/scenarios/ exporting a `scenario` constant.
// The `init` step (browser session startup) is always measured implicitly by
// the runner before your steps run — do not include it here.
// ---------------------------------------------------------------------------

export interface StepContext {
  /** Abort signal for the current measurement. */
  signal: AbortSignal;
  /** URL being benchmarked in this run */
  site: string;
  /** When true, skip LLM-powered steps (extract, act) for a faster browser-only run */
  browserOnly?: boolean;
}

export interface Step {
  name: string;
  run: (stagehand: Stagehand, page: Page, ctx: StepContext) => Promise<void>;
}

export interface Scenario {
  name: string;
  description?: string;
  steps: Step[];
}

// ---------------------------------------------------------------------------
// Competitor — defines a browser infrastructure option to benchmark
//
// Create a new file in src/competitors/ exporting a `competitor` constant.
// `createStagehand` returns a ready Stagehand instance. Register allocated
// browser and Stagehand handles with resources.own immediately for timeout cleanup.
// ---------------------------------------------------------------------------

export interface Competitor {
  /** Slug used for CLI filtering and result grouping (e.g. "browserbase", "local-chromium") */
  name: string;
  /** Human-readable label shown in reports */
  label: string;
  /** Return a ready instance; register each allocation before continuing setup. */
  createStagehand: (resources: RunResourcesContext) => Promise<Stagehand>;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface RunResult {
  competitor: string;              // matches Competitor.name
  scenario: string;                // matches Scenario.name
  site: string;
  runIndex: number;
  /** Duration in ms for each step. Always includes 'init' (measured by runner before scenario steps). */
  steps: Record<string, number>;
  /** Sum of all step durations */
  total: number;
  /** Arbitrary metadata: host, sessionId, navigation timing, page metrics */
  metadata?: Record<string, unknown>;
  error?: string;
}
