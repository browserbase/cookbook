import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { loadConfig } from "./config.js";

export interface WorkflowSessionOpts {
  contextId: string;
  model: string;
}

/**
 * Create + init a Stagehand instance for a WORKFLOW run.
 *
 * Invariant: workflow sessions ALWAYS attach the context with `persist: false`.
 * They only replay the saved login state — they must never write back to the context.
 * Only `portal-login` ever persists (writes) to the context. Keeping this hard-coded
 * here (not a parameter) means a workflow can't accidentally corrupt the shared auth.
 *
 * `experimental: true` is required for the agent's structured `output` schema support.
 */
export async function makeWorkflowStagehand(
  opts: WorkflowSessionOpts,
): Promise<Stagehand> {
  const cfg = loadConfig();
  const sh = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: cfg.browserbaseApiKey,
        ...{
          proxies: false, // residential proxies
          browserSettings: {
            context: { id: opts.contextId, persist: false },
            viewport: { width: 1288, height: 711 },
            verified: false, // Verified Browser Mode — must match the login session's settings
          },
        },
      }),
      model: opts.model,
    }),
  );

  return sh;
}

/**
 * Create + init a Stagehand instance for the one-time LOGIN flow.
 *
 * Unlike workflow sessions this attaches the context with `persist: true` (so the human's
 * login is written back into the context) and `keepAlive: true` (so the session survives
 * while they log in via the live view). Same proxies + verified settings as workflow runs
 * so the saved auth matches the fingerprint it'll be replayed under.
 */
export async function makeLoginStagehand(
  contextId: string,
): Promise<Stagehand> {
  const cfg = loadConfig();
  const sh = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: cfg.browserbaseApiKey,
        ...{
          proxies: false,
          browserSettings: {
            context: { id: contextId, persist: true },
            viewport: { width: 1288, height: 711 },
            verified: false,
          },
        },
      }),
    }),
  );

  return sh;
}
