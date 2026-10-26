import "dotenv/config";
import Browserbase from "@browserbasehq/sdk";

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} in .env before running this script.`);
  return value;
}

export const secureUrl = "https://the-internet.herokuapp.com/secure";
export const protectedText = "Welcome to the Secure Area";

export function client(): Browserbase {
  return new Browserbase({ apiKey: requiredEnv("BROWSERBASE_API_KEY") });
}

export function reportError(error: unknown): void {
  // SDK and browser errors can contain request details; do not dump them.
  if (error instanceof Browserbase.APIError) {
    if (error.message.includes("Fetching with a context is not enabled for this project") ||
        error.message.includes("Fetching with a context is not supported for this project")) {
      console.error("Authenticated Fetch is not enabled for this Browserbase project. Contact Browserbase support to enable it, then retry.");
      process.exitCode = 1;
      return;
    }
    console.error(`Browserbase request failed (HTTP ${error.status ?? "unknown"}). See README troubleshooting.`);
  } else {
    console.error("Example failed. Check configuration, login state, and the README troubleshooting steps.");
  }
  process.exitCode = 1;
}
