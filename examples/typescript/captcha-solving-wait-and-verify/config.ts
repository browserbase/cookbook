import "dotenv/config";
import type { Outcome } from "./wait-and-verify.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} in .env`);
  return value;
}
function flag(name: string): boolean {
  const value = process.env[name] ?? "false";
  if (!["true", "false"].includes(value)) throw new Error(`${name} must be true or false`);
  return value === "true";
}
export function config() {
  const targetUrl = required("TARGET_URL");
  if (!["http:", "https:"].includes(new URL(targetUrl).protocol))
    throw new Error("TARGET_URL must be HTTP(S)");
  const timeoutMs = Number(process.env.CAPTCHA_TIMEOUT_MS ?? 90_000);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 300_000) {
    throw new Error("CAPTCHA_TIMEOUT_MS must be between 1000 and 300000");
  }
  return {
    apiKey: required("BROWSERBASE_API_KEY"),
    targetUrl,
    selector: required("EXPECTED_SELECTOR"),
    timeoutMs,
    proxies: flag("USE_PROXIES"),
    verified: flag("USE_VERIFIED"),
  };
}
export function report(outcome: Outcome) {
  console.log(JSON.stringify(outcome));
  if (outcome.status !== "ready") {
    console.error(
      outcome.status === "solving-timeout"
        ? "Deadline reached while solving; stopping this run, without human handoff."
        : "Expected element is still missing; reporting failure. Review the session before retrying.",
    );
    process.exitCode = 1;
  }
}
