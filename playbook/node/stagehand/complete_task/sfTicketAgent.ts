import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { createInterface } from "node:readline";
import "dotenv/config";

function waitForReview(timeoutMs = 300_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const review = createInterface({ input, output: process.stdout });
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function finish(error?: Error) {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      review.off("line", onLine);
      review.off("close", onClose);
      review.off("error", onError);
      review.off("SIGINT", onInterrupt);
      input.off("error", onError);
      process.off("SIGINT", onInterrupt);
      review.close();
      if (error) reject(error);
      else resolve();
    }

    function onLine() {
      finish();
    }
    function onClose() {
      finish(new Error("Interactive review closed before acknowledgement."));
    }
    function onError() {
      finish(new Error("Interactive review input failed."));
    }
    function onInterrupt() {
      finish(new Error("Interactive review interrupted."));
    }

    review.once("line", onLine);
    review.once("close", onClose);
    review.once("error", onError);
    review.once("SIGINT", onInterrupt);
    input.once("error", onError);
    process.once("SIGINT", onInterrupt);
    timer = setTimeout(
      () => finish(new Error("Interactive review timed out after five minutes.")),
      timeoutMs,
    );
    try {
      process.stdout.write(
        "Review the citations in the session browser. Complete any payment yourself.\n" +
          "Press Enter when finished to close the session (five-minute limit).\n",
      );
    } catch {
      onError();
    }
  });
}

async function main() {
  const plate = process.env.SF_PLATE?.trim();
  if (!plate || !/^(?=.*[A-Za-z0-9])[A-Za-z0-9 -]{1,10}$/.test(plate)) {
    throw new Error("Set SF_PLATE to 1–10 ASCII letters, digits, spaces, or hyphens.");
  }
  if (!process.stdin.isTTY) {
    throw new Error("An interactive terminal is required for human review.");
  }

  const browser = await browserbase.launch({
    browserSettings: {
      captchaImageSelector: "img[id='captcha']",
      captchaInputSelector: "input[size='10']",
    },
    apiKey: process.env.BROWSERBASE_API_KEY!,
  });
  try {
    if (browser.provider !== "browserbase" || !browser.sessionId?.trim()) {
      throw new Error("The browser session has no human-review URL.");
    }
    const sessionUrl = `https://www.browserbase.com/sessions/${encodeURIComponent(browser.sessionId)}`;
    const stagehand = await Stagehand.create({ browser });
    try {
      const page = (await browser.context.pages())[0];
      if (!page) throw new Error("The session has no page.");
      await page.goto(
        "https://wmq.etimspayments.com/pbw/include/sanfrancisco/input.jsp",
      );
      const result = await stagehand.act(
        "Enter the plate number %plate% and then search for citations.",
        { page, variables: { plate } },
      );
      if (result.data.success !== true) {
        throw new Error("Citation search failed.");
      }
      console.log(`Open this session for human review: ${sessionUrl}`);
      await waitForReview();
    } finally {
      await stagehand.close();
    }
  } finally {
    await browser.close();
  }
  console.log("Human review ended and the session closed. Payment was not verified.");
}

main().catch(() => {
  console.error("Citation lookup or human review failed; payment was not verified.");
  process.exitCode = 1;
});
