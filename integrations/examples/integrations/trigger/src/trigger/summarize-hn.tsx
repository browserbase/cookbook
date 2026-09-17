import { withBrowser } from "./with-browser";
import { createElement } from "react";
import { render } from "@react-email/render";
import { logger, schedules, task, wait } from "@trigger.dev/sdk/v3";
import { OpenAI } from "openai";
import puppeteer from "puppeteer-core";
import { Resend } from "resend";
import { HNSummaryEmail } from "./summarize-hn-email";



// Parent task (scheduled)
export const summarizeHackerNews = schedules.task({
  id: "summarize-hacker-news",
  cron: {
    pattern: "0 9 * * 1-5",
    timezone: "Europe/London",
  }, // Run at 9 AM, Monday to Friday
  run: async () => {
    const browser = await puppeteer.connect({
      browserWSEndpoint: `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}`,
    });
    const articles = await withBrowser(browser, async browser => {
      logger.info("Connected to Browserbase");
      const page = await browser.newPage();

      // Navigate to Hacker News and scrape top 3 articles
      await page.goto("https://news.ycombinator.com/news", {
        waitUntil: "networkidle0",
      });
      logger.info("Navigated to Hacker News");

      return await page.evaluate(() => {
        const items = document.querySelectorAll(".athing");
        return Array.from(items)
          .slice(0, 3)
          .map((item) => {
            const titleElement = item.querySelector(".titleline > a");
            const link = titleElement?.getAttribute("href");
            const title = titleElement?.textContent;
            return { title, link };
          });
      });
    });
    await wait.for({ seconds: 5 });

    if (articles.length === 0) throw new Error("No Hacker News articles were found");
    const batch = await scrapeAndSummarizeArticle.batchTriggerAndWait(
      articles.map(article => {
        if (!article.title?.trim() || !article.link?.trim()) throw new Error("Article is missing a title or URL");
        const link = new URL(article.link, "https://news.ycombinator.com/").href;
        if (!/^https?:/.test(link)) throw new Error("Article URL must use HTTP or HTTPS");
        return { payload: { title: article.title, link } };
      }),
    );
    const failures = batch.runs.filter(run => !run.ok).length;
    if (failures || batch.runs.length !== articles.length) {
      throw new Error(`Summary batch incomplete: ${failures} failed runs; ${batch.runs.length} results for ${articles.length} articles`);
    }
    const summaries = validateSummaries(batch.runs.map(run => {
      if (!run.ok) throw new Error("Article summary failed");
      return run.output;
    }));
    const html = await render(createElement(HNSummaryEmail, { articles: summaries }));
    logger.info("Summary ready for review; no email sent", { articleCount: summaries.length });
    return { status: "ready-for-review", articles: summaries, html };
  },
});

type SummaryArticle = { title: string; link: string; summary: string };

function validateSummaries(value: unknown): SummaryArticle[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) throw new Error("Provide one to three complete article summaries");
  return value.map(article => {
    if (!article || typeof article !== "object" ||
        typeof article.title !== "string" || !article.title.trim() ||
        typeof article.link !== "string" ||
        typeof article.summary !== "string" || !article.summary.trim()) {
      throw new Error("Each article needs a title, HTTP(S) URL and nonempty summary");
    }
    const link = new URL(article.link);
    if (!["http:", "https:"].includes(link.protocol) || link.username || link.password) throw new Error("Article URL must use HTTP or HTTPS without credentials");
    return { title: article.title, link: link.href, summary: article.summary };
  });
}

export const sendHackerNewsSummary = task({
  id: "send-hacker-news-summary",
  retry: { maxAttempts: 1 },
  run: async (payload: { send: boolean; deliveryId: string; articles: SummaryArticle[] }) => {
    if (!payload || payload.send !== true) throw new Error("Sending requires explicit send: true");
    if (typeof payload.deliveryId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(payload.deliveryId)) throw new Error("Provide a stable deliveryId for this reviewed email");
    const articles = validateSummaries(payload.articles);
    const from = process.env.HN_EMAIL_FROM;
    const to = process.env.HN_EMAIL_TO;
    const address = /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/;
    if (!from || !to || !address.test(from) || !address.test(to) || !process.env.RESEND_API_KEY) {
      throw new Error("Configure RESEND_API_KEY, HN_EMAIL_FROM and HN_EMAIL_TO with explicit single email addresses");
    }
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from, to: [to], subject: "Your morning HN summary",
      html: await render(createElement(HNSummaryEmail, { articles })),
    }, { idempotencyKey: `hn-summary-${payload.deliveryId}` });
    if (result.error || !result.data?.id) throw new Error("Email provider did not confirm acceptance");
    logger.info("Email accepted by provider", { emailId: result.data.id });
    return { status: "accepted", emailId: result.data.id };
  },
});

// Child task for scraping and summarizing individual articles
export const scrapeAndSummarizeArticle = task({
  id: "scrape-and-summarize-articles",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 10000,
    factor: 2,
    randomize: true,
  },
  run: async ({ title, link }: { title: string; link: string }) => {
    logger.info(`Summarizing ${title}`);

    const browser = await puppeteer.connect({
      browserWSEndpoint: `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}`,
    });
    const content = await withBrowser(browser, async browser => {
      const page = await browser.newPage();

      // Prevent all assets from loading, images, stylesheets etc
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        if (
          ["script", "stylesheet", "image", "media", "font"].includes(
            request.resourceType()
          )
        ) {
          request.abort();
        } else {
          request.continue();
        }
      });

      await page.goto(link, { waitUntil: "networkidle0" });
      logger.info(`Navigated to article: ${title}`);

      // Extract the main content of the article
      return await page.evaluate(() => {
        const articleElement = document.querySelector("article") || document.body;
        return articleElement.innerText.trim().slice(0, 1500); // Limit to 1500 characters
      });
    });

    logger.info(`Extracted content for article: ${title}`, { content });

    // Summarize the content using ChatGPT
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `Summarize this article in 2-3 concise sentences:\n\n${content}`,
        },
      ],
    });

    logger.info(`Generated summary for article: ${title}`);

    return {
      title,
      link,
      summary: response.choices[0].message.content,
    };
  },
});
