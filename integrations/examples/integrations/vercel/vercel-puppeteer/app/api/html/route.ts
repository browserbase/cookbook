import { NextResponse } from "next/server";
import Browserbase from "@browserbasehq/sdk";
import puppeteer from "puppeteer-core";
import prettier from "prettier";
import htmlParser from "prettier/parser-html";
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
      browserSettings: {
        viewport: { width: 1920, height: 1080 },
      },
    });
    sessionId = session.id;

    // Connect to browser instance using Puppeteer
    browser = await puppeteer.connect({
      browserWSEndpoint: session.connectUrl,
    });

    // Navigate to URL and capture HTML
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const html = await page.evaluate(
      () => document.querySelector("*")?.outerHTML
    );

    const formattedHtml = await prettier.format(html || "", {
      parser: "html",
      plugins: [htmlParser],
    });

    return NextResponse.json({ html: formattedHtml });
  } catch (error) {
    console.error("HTML generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate HTML",
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
