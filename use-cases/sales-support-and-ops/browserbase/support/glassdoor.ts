import { chromium } from "playwright-core";

let sessionId;

async function createSession() {
  if (!process.env.BROWSERBASE_API_KEY) {
    throw new Error("BROWSERBASE_API_KEY is not defined");
  }

  const response = await fetch(`https://api.browserbase.com/v1/sessions`, {
    method: "POST",
    headers: {
      "x-bb-api-key": process.env.BROWSERBASE_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      browserSettings: {
        // verified: true,
        // blockAds: false,
        // solveCaptchas: true,
        keepAlive: true,
      },
      proxies: true,
    }),
  });
  const json = await response.json();
  return json;
}

(async () => {
  const { id, connectUrl } = await createSession();
  sessionId = id;
  const browser = await chromium.connectOverCDP(connectUrl);
  const defaultContext = browser.contexts()[0];
  const page = defaultContext.pages()[0];

  await page.route(
    (url) => /main\.js/.test(url.toString()),
    async (route, request) => {},
  );

  console.log("https://www.browserbase.com/sessions/" + sessionId);
  // await page.goto("https://www.glassdoor.com/Community/index.htm", {waitUntil: "load"});
  await page.goto("https://live.buildops.com/");
})();
