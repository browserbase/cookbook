/**
 * Registry of source platforms we extract from. Each workflow lives under
 * workflows/<platform>/<name>/, so the platform is the first path segment of a workflow name
 * (e.g. "square/customer-list" → square). Each platform has its OWN Browserbase context env var,
 * so logging into one site never collides with another's auth.
 *
 * Adding a new site = one entry here + a workflows/<platform>/ folder.
 */
export interface Platform {
  key: string;
  label: string;
  /** Where `customer-login` navigates so you can sign in. */
  loginUrl: string;
  /** The .env var holding this platform's saved Browserbase context id. */
  contextEnv: string;
}

export const PLATFORMS: Record<string, Platform> = {
  square: {
    key: "square",
    label: "Square",
    loginUrl: "https://squareup.com/us/en",
    contextEnv: "SQUARE_CONTEXT_ID",
  },
  vagaro: {
    key: "vagaro",
    label: "Vagaro",
    loginUrl: "https://www.vagaro.com/",
    contextEnv: "VAGARO_CONTEXT_ID",
  },
};

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

/** Resolve a platform by key (e.g. from a CLI arg), with a clear error for unknown sites. */
export function platformByKey(key: string): Platform {
  const p = PLATFORMS[key];
  if (!p) {
    throw new Error(
      `Unknown platform "${key}". Known platforms: ${Object.keys(PLATFORMS).join(", ")}.`,
    );
  }
  return p;
}

/** Resolve the platform from a workflow name's first path segment (e.g. "vagaro/customer-list"). */
export function platformForWorkflow(name: string): Platform {
  return platformByKey(name.split("/")[0]);
}

/**
 * The saved context id for a platform, read from its env var. For Square we also honor the legacy
 * `CONTEXT_ID` so existing setups keep working before a re-login writes SQUARE_CONTEXT_ID.
 */
export function resolveContextId(platform: Platform): string | undefined {
  return (
    read(platform.contextEnv) ??
    (platform.key === "square" ? read("CONTEXT_ID") : undefined)
  );
}
