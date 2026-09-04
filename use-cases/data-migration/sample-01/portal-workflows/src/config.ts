import "dotenv/config";

// Stagehand passes our systemPrompt as a system message inside `messages`, which makes the
// AI SDK emit a raw console.warn on every call. The SDK doesn't route this one through
// AI_SDK_LOG_WARNINGS, and Stagehand doesn't expose `allowSystemInMessages`, so we filter just
// that one warning line out of console.warn and leave every other warning intact.
{
  const SUPPRESS = "System messages in the prompt or messages fields";
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes(SUPPRESS)) return;
    originalWarn(...(args as []));
  };
}

/**
 * Default agent model. Overridable per workflow via `workflow.json` -> "model".
 * We run the agent in DOM mode (the Stagehand default), which works with any model
 * and supports structured `output` schemas — so any "provider/model" string is valid here.
 */
export const DEFAULT_MODEL = "anthropic/claude-haiku-4-5-20251001";

/** Maps a model's provider prefix to the env var the AI SDK auto-loads its key from. */
const PROVIDER_KEY_ENV: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  openai: "OPENAI_API_KEY",
};

/**
 * Default results label — segments output into results/<label>/ so each experiment stays
 * separate. Update this per experiment, or override per run with `--label`.
 */
export const DEFAULT_LABEL = "haiku-4.5-no-cdp";

/** Default cap on agent steps per run. Overridable per workflow via `workflow.json`. */
export const DEFAULT_MAX_STEPS = 25;

/**
 * Default number of extra rounds to re-run not-passed sessions after a batch. With a tight
 * maxSteps, stuck runs fail fast and a retry on a fresh session usually recovers the flaky ones.
 * Overridable per workflow via `workflow.json` or per run with `--retries`.
 */
export const DEFAULT_FAILURE_RETRIES = 2;

/** Default navigation timeout (ms) for the initial page.goto. Overridable via `workflow.json`. */
export const DEFAULT_NAV_TIMEOUT_MS = 60_000;

/**
 * How many times to retry the agent on Anthropic rate-limit (429 / tokens-per-minute) errors,
 * on top of the SDK's own attempts. Backoff is exponential with jitter. Overridable via `workflow.json`.
 */
export const DEFAULT_AGENT_MAX_RETRIES = 8;

export interface Config {
  browserbaseApiKey: string;
}

export interface LoadConfigOptions {
  /** Require the API key for DEFAULT_MODEL's provider (workflow runs need it; login does not). */
  requireModelKey?: boolean;
}

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

/**
 * Load and validate environment. Fails fast with a friendly, actionable message
 * pointing at .env.example / the login step rather than letting the SDK throw later.
 */
export function loadConfig(opts: LoadConfigOptions = {}): Config {
  const missing: string[] = [];

  // Browserbase scopes by API key now — project ID is no longer required.
  // Context is resolved per-platform (see src/platforms.ts), not here.
  const browserbaseApiKey = read("BROWSERBASE_API_KEY");

  if (!browserbaseApiKey) missing.push("BROWSERBASE_API_KEY");

  if (opts.requireModelKey) {
    const provider = DEFAULT_MODEL.split("/")[0];
    const envName = PROVIDER_KEY_ENV[provider];
    if (envName && !read(envName)) missing.push(envName);
  }

  if (missing.length) {
    throw new Error(
      `Missing required env var(s): ${missing.join(", ")}.\n` +
        `Copy .env.example to .env and fill them in (see the README).`,
    );
  }

  return {
    browserbaseApiKey: browserbaseApiKey!,
  };
}
