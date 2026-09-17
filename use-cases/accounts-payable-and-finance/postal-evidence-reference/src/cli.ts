import { takePostmarkScreenshot } from "./service.js";
import { RETRYABLE_FAILURE_CODES } from "./retry-policy.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const trackingNumber = arg("tracking");
const filingId = arg("filing-id") ?? `filing_demo_${Date.now()}`;

if (!trackingNumber) {
  console.error(
    "Usage: npm start -- --tracking <postal-service-number> [--filing-id <id>] [--retries <n>]",
  );
  process.exit(1);
}

const retries = Number(arg("retries") ?? 2);

// Retry in a fresh session = fresh residential proxy IP.
for (let attempt = 1; attempt <= retries; attempt++) {
  console.log(
    `[attempt ${attempt}/${retries}] tracking=${trackingNumber} session=Verified, proxies=on, solveCaptchas=on`,
  );
  const result = await takePostmarkScreenshot({
    filingId,
    trackingNumber,
  });
  console.log(JSON.stringify(result, null, 2));
  if (
    result.ok ||
    !result.failureCode ||
    !RETRYABLE_FAILURE_CODES.has(result.failureCode)
  )
    process.exit(result.ok ? 0 : 2);
}
process.exit(2);
