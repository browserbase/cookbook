import { chromium } from "playwright-core";

let sessionId;

async function createSession() {
  const response = await fetch(`https://api.browserbase.com/v1/sessions`, {
    method: "POST",
    headers: {
      "x-bb-api-key": process.env["BROWSERBASE_API_KEY"]!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: process.env["BROWSERBASE_PROJECT_ID"]!,
      browserSettings: {
        advancedStealth: false,
        blockAds: false,
        solveCaptchas: true,
      },
      proxies: false,
    }),
  });
  const json = await response.json();
  return json;
}

(async () => {
  const sleep = async () =>
    await new Promise((resolve) =>
      setTimeout(resolve, Math.floor(50 + Math.random() * 100)),
    );

  const { id, connectUrl } = await createSession();
  sessionId = id;
  const browser = await chromium.connectOverCDP(connectUrl);
  const defaultContext = browser.contexts()[0];
  const page = defaultContext.pages()[0];
  await page.goto(
    "https://www.dewa.gov.ae/en/consumer/my-account/login?returnUrl=%2fen%2fconsumer%2fmy-account%2fdashboard",
    { waitUntil: "load" },
  );

  //Locate the username input
  const usernameInput = page.locator('input[name="Username"]');
  await usernameInput.fill(process.env["DEWA_USERNAME"]!);
  await sleep();

  const passwordInput = page.locator('input[name="Password"]');
  await passwordInput.fill(process.env["DEWA_PASSWORD"]!);
  await sleep();

  const loginButton = page.locator('button[id="loginButton"]');
  await loginButton.click();
})();
