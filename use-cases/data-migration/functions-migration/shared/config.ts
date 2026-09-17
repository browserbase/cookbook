function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set in the function runtime environment`);
  }
  return value;
}

// Keep function params focused on workflow inputs. Browserbase credentials belong in runtime env, not source.
export const BROWSERBASE_API_KEY = requireEnv("BROWSERBASE_API_KEY");
export const PLATFORM_A_CLIENT_PACKAGES_CONTEXT_ID = requireEnv(
  "PLATFORM_A_CLIENT_PACKAGES_CONTEXT_ID",
);
export const PLATFORM_A_CUSTOMER_NOTES_CONTEXT_ID = requireEnv(
  "PLATFORM_A_CUSTOMER_NOTES_CONTEXT_ID",
);
