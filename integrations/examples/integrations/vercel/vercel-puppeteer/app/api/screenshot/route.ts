import { NextResponse } from "next/server";
import Browserbase from "@browserbasehq/sdk";
import puppeteer from "puppeteer-core";
import { acquireBrowserRequest, authorizeBrowserRequest, readExportUrl } from "@/lib/request-guard";

export async function POST(req: Request) {
  const denied = authorizeBrowserRequest(req);
  if (denied) return denied;
  const acquired = acquireBrowserRequest(req);
  if (acquired instanceof Response) return acquired;
  let browser: Awaited<ReturnType<typeof puppeteer.connect>> | undefined;
  let bb: Browserbase | undefined;
  let sessionId: string | undefined;
  try {
    const url = await readExportUrl(req);
    if (url instanceof Response) return url;

    // Initialize Browserbase with API key
    bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });

    // Create a new browser session with specified viewport
    const session = await bb.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      browserSettings: {
        viewport: { width: 1920, height: 1080 },
      },
    });
    sessionId = session.id;

    // Connect to browser instance using Puppeteer
    browser = await puppeteer.connect({
      browserWSEndpoint: session.connectUrl,
    });

    // Navigate to URL and capture screenshot
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const screenshot = await page.screenshot();
    // Set appropriate headers for image response
    const headers = new Headers();
    headers.set("Content-Type", "image/png");
    headers.set("Content-Length", screenshot.byteLength.toString());

    // Return screenshot as binary response
    return new NextResponse(Buffer.from(screenshot), { status: 200, headers });
  } catch (error) {
    console.error("Screenshot generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate screenshot",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    try {
      if (browser) await browser.close();
      else if (bb && sessionId) await bb.sessions.update(sessionId, { status: "REQUEST_RELEASE" });
    } catch { /* session expiry remains the fallback */ }
    acquired();
  }
}
