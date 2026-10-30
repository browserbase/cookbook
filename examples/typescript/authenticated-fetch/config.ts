import "dotenv/config";
import Browserbase from "@browserbasehq/sdk";

export const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
export const secureUrl = "https://the-internet.herokuapp.com/secure";
export const protectedText = "Welcome to the Secure Area";

export function reportError(error: unknown): void {
  // Avoid printing SDK request details or credentials.
  console.error(error instanceof Browserbase.APIError
    ? `Browserbase request failed (HTTP ${error.status}). See README troubleshooting.`
    : error instanceof Error ? error.message : "Example failed.");
  process.exitCode = 1;
}
