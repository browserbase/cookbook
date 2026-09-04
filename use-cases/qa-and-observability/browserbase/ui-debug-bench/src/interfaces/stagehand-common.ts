import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { Stagehand, browserbase, localBrowser, type Page } from "@browserbasehq/stagehand";
import type { BrowserEvidence, InterfaceName, PrimitiveCall } from "../types.js";
import { stagehandModelName } from "../config.js";
import { currentBrowserbaseSession } from "../runtime/browserbase-session.js";

type StagehandInstance = Stagehand;
export type StagehandPage = Page;

export class StagehandHarness {
  readonly calls: PrimitiveCall[] = [];
  readonly console: string[] = [];
  private stagehand?: StagehandInstance;
  private page?: StagehandPage;

  constructor(private readonly iface: InterfaceName) {}

  async init(): Promise<StagehandPage | undefined> {
    await this.record("stagehand.init", async () => {
      const browserbaseSession = currentBrowserbaseSession();
      const useBrowserbase = process.env.STAGEHAND_ENV === "BROWSERBASE" || Boolean(browserbaseSession);
      const apiKey = process.env.BROWSERBASE_API_KEY;
      if (useBrowserbase && !apiKey) throw new Error("BROWSERBASE_API_KEY is required");
      const browser = useBrowserbase
        ? browserbaseSession
          ? await browserbase.connect({ apiKey: apiKey!, sessionId: browserbaseSession.sessionId })
          : await browserbase.launch({ apiKey: apiKey!, browserSettings: { viewport: { width: 1280, height: 900 } } })
        : await localBrowser.launch({ headless: true, chromiumSandbox: false, viewport: { width: 1280, height: 900 } });
      this.stagehand = await Stagehand.create(StagehandCreateOptionsSchema.parse({ browser, model: stagehandModel() }));
      this.page = (await browser.context.pages())[0] ?? await browser.context.newPage();
      await this.page.on("console", (message) => {
        this.console.push(`${String(message.params.type)}: ${JSON.stringify(message.params.args ?? [])}`);
      });
      return JSON.stringify({
        env: useBrowserbase ? "BROWSERBASE" : "LOCAL",
        browserbaseSessionId: browserbaseSession?.sessionId,
        dashboardUrl: browserbaseSession?.dashboardUrl
      });
    });
    return this.page;
  }

  async goto(url: string): Promise<void> {
    if (!this.page) return;
    await this.record(`page.goto ${url}`, async () => {
      await this.page!.goto(url, {
        waitUntil: "load",
        timeout: Number(process.env.STAGEHAND_NAV_TIMEOUT_MS ?? 30000)
      });
      await this.page!.waitForTimeout(500);
      return this.page!.url();
    });
  }

  async snapshot(): Promise<string> {
    if (!this.page) return "";
    return this.record("page.snapshot", async () => {
      const snapshot = await this.page!.snapshot();
      return snapshot.formattedTree;
    });
  }

  async pageText(): Promise<string> {
    if (!this.page) return "";
    return this.record("page.evaluate document.body.innerText", async () => {
      return this.page!.evaluate<string>("document.body?.innerText ?? ''");
    });
  }

  async evaluate<R = unknown>(expression: string): Promise<R | undefined> {
    if (!this.page) return undefined;
    const output = await this.record(`page.evaluate ${expression.slice(0, 80)}`, async () => {
      const value = await this.page!.evaluate<R>(expression);
      return JSON.stringify(value);
    });
    try {
      return JSON.parse(output) as R;
    } catch {
      return undefined;
    }
  }

  async waitForTimeout(ms: number): Promise<void> {
    if (!this.page) return;
    await this.record(`page.waitForTimeout ${ms}`, async () => {
      await this.page!.waitForTimeout(ms);
      return `${ms}`;
    });
  }

  async setViewportSize(width: number, height: number): Promise<void> {
    if (!this.page) return;
    await this.record(`page.setViewportSize ${width}x${height}`, async () => {
      await this.page!.setViewportSize(width, height, { deviceScaleFactor: 1 });
      return `${width}x${height}`;
    });
  }

  async title(): Promise<string> {
    if (!this.page) return "";
    return this.record("page.title", async () => this.page!.title());
  }

  async screenshot(artifactDir: string, prefix: string): Promise<string[]> {
    if (!this.page) return [];
    const path = join(artifactDir, `${prefix}-${randomUUID()}.png`);
    await this.record(`page.screenshot ${path}`, async () => {
      const buffer = await this.page!.screenshot({ fullPage: true, path, timeout: 20000 });
      if (buffer.length > 0) {
        await writeFile(path, buffer);
      }
      return path;
    });
    return this.calls[this.calls.length - 1]?.ok ? [path] : [];
  }

  async observe(instruction: string): Promise<string> {
    if (!this.stagehand) return "";
    return this.record(`stagehand.observe ${instruction}`, async () => {
      const result = (await this.stagehand!.observe(instruction, {
              timeout: Number(process.env.STAGEHAND_LLM_TIMEOUT_MS ?? 45000)
            })).data;
      return JSON.stringify(result, null, 2);
    });
  }

  async extract(instruction: string): Promise<string> {
    if (!this.stagehand) return "";
    return this.record(`stagehand.extract ${instruction}`, async () => {
      const result = (await this.stagehand!.extract(instruction, {
              timeout: Number(process.env.STAGEHAND_LLM_TIMEOUT_MS ?? 45000)
            })).data;
      return JSON.stringify(result, null, 2);
    });
  }

  async act(instruction: string): Promise<string> {
    if (!this.stagehand) return "";
    return this.record(`stagehand.act ${instruction}`, async () => {
      const result = await this.stagehand!.act(instruction, {
              timeout: Number(process.env.STAGEHAND_LLM_TIMEOUT_MS ?? 45000)
            });
      return JSON.stringify(result, null, 2);
    });
  }

  async close(): Promise<void> {
    if (!this.stagehand) return;
    await this.record("stagehand.close", async () => {
      try {
        await this.stagehand!.close();
      } finally {
        await this.stagehand!.browser.close();
      }
      return "closed";
    });
  }

  evidence(url: string, observations: string[], screenshots: string[]): BrowserEvidence {
    return {
      url,
      observations: observations.filter(Boolean),
      console: this.console.slice(-80),
      network: [],
      screenshots,
      primitiveCalls: this.calls
    };
  }

  private async record(command: string, fn: () => Promise<string>): Promise<string> {
    const start = Date.now();
    try {
      const stdout = await withTimeout(fn(), Number(process.env.STAGEHAND_CALL_TIMEOUT_MS ?? 60000), command);
      this.calls.push({
        interface: this.iface,
        command,
        stdout,
        stderr: "",
        wallClockMs: Date.now() - start,
        ok: true
      });
      return stdout;
    } catch (error) {
      const stderr = error instanceof Error ? error.message : String(error);
      this.calls.push({
        interface: this.iface,
        command,
        stdout: "",
        stderr,
        wallClockMs: Date.now() - start,
        ok: false
      });
      return stderr;
    }
  }
}

function stagehandModel() {
  const modelName = stagehandModelName();
  if (modelName.startsWith("anthropic/") && process.env.ANTHROPIC_API_KEY) {
    return { modelName, apiKey: process.env.ANTHROPIC_API_KEY };
  }
  if (modelName.startsWith("openai/") && process.env.OPENAI_API_KEY) {
    return { modelName, apiKey: process.env.OPENAI_API_KEY };
  }
  if (modelName.startsWith("google/") && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return { modelName, apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY };
  }
  return { modelName };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
