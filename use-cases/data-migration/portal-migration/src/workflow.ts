import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ZodTypeAny } from "zod";
import type { Stagehand } from "@browserbasehq/stagehand";
import type { tool } from "ai";

/** Return type of a per-workflow tool.ts factory — a Stagehand agent tool bound to the run's session. */
export type WorkflowTool = ReturnType<typeof tool>;
import {
  DEFAULT_MODEL,
  DEFAULT_MAX_STEPS,
  DEFAULT_NAV_TIMEOUT_MS,
  DEFAULT_AGENT_MAX_RETRIES,
  DEFAULT_FAILURE_RETRIES,
} from "./config.js";

const WORKFLOWS_DIR = resolve(process.cwd(), "workflows");
const DEFAULT_START_URL = "https://platform-a.example.invalid/dashboard/";

export interface WorkflowMeta {
  /** Page the agent starts on (we navigate here before running). */
  startUrl: string;
  /** Hard cap on agent steps. */
  maxSteps: number;
  /** Model override for this workflow. */
  model: string;
  /**
   * Results folder name for this workflow's runs — output goes to results/<resultsLabel>/
   * (created if missing, appended to if it exists). Overridden by the --label CLI flag;
   * falls back to DEFAULT_LABEL when unset.
   */
  resultsLabel?: string;
  /**
   * Built-in agent tools to disable for this workflow, e.g. ["act", "fillForm"] to restrict
   * how the agent is allowed to interact with the page.
   */
  excludeTools?: string[];
  /**
   * When true, a run only counts as "passed" if it produced a deliverable (downloaded file or
   * structured output) — the agent's self-reported success is NOT enough. Set this for
   * download/extraction workflows where the file IS the point, so an over-optimistic
   * "I did it" with no file gets retried instead of slipping through. Default false.
   */
  requireDeliverable?: boolean;
  /** Navigation timeout (ms) for the initial page.goto. Default 60000. */
  navTimeoutMs: number;
  /** Extra retries on Anthropic rate-limit errors (exponential backoff). Default 8. */
  agentMaxRetries: number;
  /** Extra rounds to re-run not-passed sessions after a batch. Default 2. */
  failureRetries: number;
}

export interface LoadedWorkflow {
  name: string;
  dir: string;
  /** The agent instruction — the file the customer edits. */
  prompt: string;
  meta: WorkflowMeta;
  /** Optional typed-output schema (present only if the folder has a schema.ts). */
  schema?: ZodTypeAny;
  /**
   * Optional deterministic agent tool (present only if the folder has a tool.ts). The factory is
   * bound to the run's Stagehand instance and registered for the agent as `extractAllNotes` — for
   * workflows whose heavy lifting must be fixed code the agent *calls* (not improvised JS). See
   * workflows/platform-b/customer-notes/tool.ts.
   */
  toolFactory?: (sh: Stagehand) => WorkflowTool;
}

/**
 * Load a workflow folder by name (e.g. "platform-a/customer-list").
 *
 * Required:  prompt.txt   — the agent instruction.
 * Optional:  workflow.json — { startUrl, maxSteps, model } overrides.
 * Optional:  schema.ts     — `export default z.object({...})` for typed output.
 *
 * The common case is prompt-only: just edit prompt.txt. schema.ts is the escape
 * hatch when you want structured JSON out of the run.
 */
export async function loadWorkflow(name: string): Promise<LoadedWorkflow> {
  const dir = join(WORKFLOWS_DIR, name);
  const promptPath = join(dir, "prompt.txt");

  if (!existsSync(promptPath)) {
    throw new Error(
      `Workflow "${name}" not found (expected ${promptPath}).\n` +
        `Workflows live under workflows/<platform>/<name>/ and need a prompt.txt.`,
    );
  }

  const prompt = (await readFile(promptPath, "utf8")).trim();
  if (!prompt) {
    throw new Error(
      `Workflow "${name}" has an empty prompt.txt — add the agent instruction first.`,
    );
  }

  let metaJson: Partial<WorkflowMeta> = {};
  const metaPath = join(dir, "workflow.json");
  if (existsSync(metaPath)) {
    metaJson = JSON.parse(
      await readFile(metaPath, "utf8"),
    ) as Partial<WorkflowMeta>;
  }

  const meta: WorkflowMeta = {
    startUrl: metaJson.startUrl ?? DEFAULT_START_URL,
    maxSteps: metaJson.maxSteps ?? DEFAULT_MAX_STEPS,
    model: metaJson.model ?? DEFAULT_MODEL,
    resultsLabel: metaJson.resultsLabel,
    excludeTools: metaJson.excludeTools,
    requireDeliverable: metaJson.requireDeliverable,
    navTimeoutMs: metaJson.navTimeoutMs ?? DEFAULT_NAV_TIMEOUT_MS,
    agentMaxRetries: metaJson.agentMaxRetries ?? DEFAULT_AGENT_MAX_RETRIES,
    failureRetries: metaJson.failureRetries ?? DEFAULT_FAILURE_RETRIES,
  };

  let schema: ZodTypeAny | undefined;
  const schemaPath = join(dir, "schema.ts");
  if (existsSync(schemaPath)) {
    const mod = (await import(pathToFileURL(schemaPath).href)) as {
      default?: ZodTypeAny;
    };
    if (!mod.default) {
      throw new Error(
        `schema.ts in "${name}" must have a default export (a Zod object).`,
      );
    }
    schema = mod.default;
  }

  let toolFactory: ((sh: Stagehand) => WorkflowTool) | undefined;
  const toolPath = join(dir, "tool.ts");
  if (existsSync(toolPath)) {
    const mod = (await import(pathToFileURL(toolPath).href)) as {
      default?: (sh: Stagehand) => WorkflowTool;
      [k: string]: unknown;
    };
    // Accept a default export or the first exported factory function (e.g. createExtractAllNotesTool).
    const factory =
      mod.default ??
      (Object.values(mod).find(
        (v) => typeof v === "function",
      ) as typeof mod.default);
    if (typeof factory !== "function") {
      throw new Error(
        `tool.ts in "${name}" must export a factory function (sh) => Tool.`,
      );
    }
    toolFactory = factory;
  }

  return { name, dir, prompt, meta, schema, toolFactory };
}
