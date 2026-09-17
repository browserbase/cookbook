import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
/**
 * Shared setup for the the cookbook example county-tax-bill Stagehand demos.
 * Loads env from the repo root .env and builds a configured Stagehand instance
 * pointed at Browserbase.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, ".."); // demo root (holds .env)

/** Minimal .env loader (no extra deps) — reads KEY=value lines from the demo root. */
export function loadEnv(): void {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export const MODEL =
  process.env.STAGEHAND_MODEL || "anthropic/claude-sonnet-4-5";
export const DESKTOP = path.join(process.env.HOME || ".", "Desktop");

export async function makeStagehand(): Promise<Stagehand> {
  loadEnv();
  for (const k of [
    "BROWSERBASE_API_KEY",
    "ANTHROPIC_API_KEY",
  ]) {
    if (!process.env[k])
      throw new Error(
        `Missing ${k} in environment (set it in ${path.join(ROOT, ".env")})`,
      );
  }
  return await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await browserbase.launch({
        apiKey: process.env.BROWSERBASE_API_KEY!,
      }),
      model: { modelName: MODEL, apiKey: process.env.ANTHROPIC_API_KEY! },
    }),
  );
}

export function replayUrl(stagehand: Stagehand): string {
  const id = stagehand.browser.sessionId;
  return id ? `https://www.browserbase.com/sessions/${id}` : "(no session id)";
}

/**
 * Read the "View Tax Bill" link URL deterministically from any open tab.
 * (AI actions navigate; reading an href is a precise DOM read, not an LLM guess.)
 */
export async function findBillHref(stagehand: Stagehand): Promise<string> {
  const pages = await stagehand.browser.context.pages();
  for (const p of pages) {
    try {
      const href = await p.evaluate(() => {
        const a = Array.from(document.querySelectorAll("a")).find((el) =>
          /view tax bill/i.test(el.textContent || ""),
        ) as HTMLAnchorElement | undefined;
        return a?.href || "";
      });
      if (href) return href;
    } catch {
      /* page may be a PDF/cross-origin tab; skip */
    }
  }
  return "";
}

/** Download a URL straight to a file (the portal serves the PDF from an API endpoint). */
export async function download(url: string, outPath: string): Promise<number> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok)
    throw new Error(`download failed: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  return buf.length;
}
