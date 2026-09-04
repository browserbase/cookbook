/**
 * Run using npx tsx downloads/cloud-download.ts
 **/

import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";
import JSZip from "jszip";

async function createSession() {
  const response = await fetch(`https://api.browserbase.com/v1/sessions`, {
    method: "POST",
    headers: {
      "x-bb-api-key": `${process.env.BROWSERBASE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: process.env.BROWSERBASE_PROJECT_ID,
    }),
  });
  const json = await response.json();
  return json;
}

async function saveDownloadsOnDisk(sessionId: string, timeoutMs: number) {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new Error("timeoutMs must be a positive integer no greater than 2147483647");
  }
  return new Promise<void>((resolve, reject) => {
    const controller = new AbortController();
    const deadline = Date.now() + timeoutMs;
    let settled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => finish(timeoutError()), timeoutMs);

    function timeoutError() {
      return new Error(`Downloads were not available within ${timeoutMs}ms`);
    }

    function finish(error?: unknown) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (pollTimer !== undefined) clearTimeout(pollTimer);
      controller.abort();
      if (error !== undefined) reject(error);
      else resolve();
    }

    function expired() {
      if (settled) return true;
      if (Date.now() >= deadline) {
        finish(timeoutError());
        return true;
      }
      return false;
    }

    async function fetchDownloads() {
      try {
        if (expired()) return;
        const response = await fetch(
          `https://api.browserbase.com/v1/sessions/${sessionId}/downloads`,
          {
            method: "GET",
            headers: {
              "x-bb-api-key": process.env.BROWSERBASE_API_KEY!,
            },
            signal: controller.signal,
          },
        );
        if (expired()) return;
        if (!response.ok) {
          throw new Error(`Download retrieval failed with HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        if (expired()) return;
        if (arrayBuffer.byteLength > 0) {
          const buffer = Buffer.from(arrayBuffer);
          const archive = await JSZip.loadAsync(buffer, { checkCRC32: true });
          if (expired()) return;
          if (Object.values(archive.files).some((entry) => !entry.dir)) {
            writeFileSync("downloads.zip", buffer, { flag: "wx" });
            finish();
            return;
          }
        }
        pollTimer = setTimeout(fetchDownloads, Math.min(2000, deadline - Date.now()));
      } catch (error) {
        finish(error ?? new Error("Download retrieval failed"));
      }
    }

    void fetchDownloads();
  });
}

(async () => {
  // `createSession()` performs a call to the Sessions API
  const { id: sessionId } = await createSession();
  const browser = await chromium.connectOverCDP(
    // we connect to a Session created via the API
    `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}&sessionId=${sessionId}`,
  );
  const defaultContext = browser.contexts()[0];
  const page = defaultContext.pages()[0];

  // Required to avoid playwright overriding location
  const client = await defaultContext.newCDPSession(page);
  await client.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: "downloads",
    eventsEnabled: true,
  });

  await page.goto("https://browser-tests-alpha.vercel.app/api/download-test");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#download").click(),
  ]);

  let downloadError = await download.failure();
  if (downloadError !== null) {
    console.log("Error happened on download:", downloadError);
    throw new Error(downloadError);
  }

  await page.close();
  await browser.close();

  if (!downloadError) {
    // wait up to 20s to save the downloaded files locally
    await saveDownloadsOnDisk(sessionId, 20000);
  }
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
