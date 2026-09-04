import { randomUUID } from "node:crypto";
import type { Stagehand, Action, Page } from "@browserbasehq/stagehand";
import boxen from "boxen";
import chalk from "chalk";
import fs from "fs/promises";
import { z } from "zod";

export function announce(message: string, title?: string) {
  console.log(
    boxen(message, {
      padding: 1,
      margin: 3,
      title: title || "Stagehand",
    }),
  );
}

/**
 * Get an environment variable and throw an error if it's not found
 * @param name - The name of the environment variable
 * @returns The value of the environment variable
 */
export function getEnvVar(name: string, required = true): string | undefined {
  const value = process.env[name];
  if (!value && required) {
    throw new Error(`${name} not found in environment variables`);
  }
  return value;
}

/**
 * Validate a Zod schema against some data
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate
 * @returns Whether the data is valid against the schema
 */
export function validateZodSchema(schema: z.ZodTypeAny, data: unknown) {
  try {
    schema.parse(data);
    return true;
  } catch {
    return false;
  }
}

export async function drawObserveOverlay(page: Page, results: Action[]) {
  // Convert single xpath to array for consistent handling
  const xpathList = results.map((result) => result.selector);

  // Filter out empty xpaths
  const validXpaths = xpathList.filter((xpath) => xpath !== "xpath=");

  await page.evaluate((selectors) => {
    selectors.forEach((selector) => {
      let element;
      if (selector.startsWith("xpath=")) {
        const xpath = selector.substring(6);
        element = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null,
        ).singleNodeValue;
      } else {
        element = document.querySelector(selector);
      }

      if (element instanceof HTMLElement) {
        const overlay = document.createElement("div");
        overlay.setAttribute("stagehandObserve", "true");
        const rect = element.getBoundingClientRect();
        overlay.style.position = "absolute";
        overlay.style.left = rect.left + "px";
        overlay.style.top = rect.top + "px";
        overlay.style.width = rect.width + "px";
        overlay.style.height = rect.height + "px";
        overlay.style.backgroundColor = "rgba(255, 255, 0, 0.3)";
        overlay.style.pointerEvents = "none";
        overlay.style.zIndex = "10000";
        document.body.appendChild(overlay);
      }
    });
  }, validXpaths);
}

export async function clearOverlays(page: Page) {
  // remove existing stagehandObserve attributes
  await page.evaluate(() => {
    const elements = document.querySelectorAll('[stagehandObserve="true"]');
    elements.forEach((el) => {
      const parent = el.parentNode;
      while (el.firstChild) {
        parent?.insertBefore(el.firstChild, el);
      }
      parent?.removeChild(el);
    });
  });
}

const CachedActionSchema = z.object({
  selector: z.string().trim().min(1).refine(value => value !== "xpath="),
  description: z.string(),
  method: z.string().optional(),
  arguments: z.array(z.string()).optional(),
}).strict();

async function cacheDocument(): Promise<Record<string, unknown>> {
  let text: string;
  try { text = await fs.readFile("cache.json", "utf-8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error("Cannot read the action cache.");
  }
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new Error("Invalid action cache JSON. Repair or remove the cache before retrying."); }
}

let cacheWrite: Promise<void> = Promise.resolve();
function updateCache(instruction: string, action: Action | null): Promise<void> {
  const next = cacheWrite.then(async () => {
    const cache = await cacheDocument();
    if (action === null) delete cache[instruction];
    else Object.defineProperty(cache, instruction, { value: action, enumerable: true, configurable: true, writable: true });
    const temporary = `cache.json.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify(cache, null, 2), { mode: 0o600, flag: "wx" });
      await fs.rename(temporary, "cache.json");
    } finally { await fs.unlink(temporary).catch(() => undefined); }
  });
  cacheWrite = next.catch(() => undefined);
  return next;
}

export async function simpleCache(instruction: string, actionToCache: Action) {
  await updateCache(instruction, CachedActionSchema.parse(actionToCache));
}

export async function readCache(instruction: string): Promise<Action | null> {
  const cache = await cacheDocument();
  if (!Object.hasOwn(cache, instruction)) return null;
  const parsed = CachedActionSchema.safeParse(cache[instruction]);
  if (parsed.success) return parsed.data;
  await updateCache(instruction, null);
  return null;
}

/** One cached attempt, then at most one fresh observation and action. */
export async function actWithCache(
  stagehand: Stagehand,
  page: Page,
  instruction: string,
): Promise<void> {
  const cachedAction = await readCache(instruction);
  if (cachedAction) {
    let result;
    try { result = await stagehand.act(cachedAction, { page }); }
    catch {
      await updateCache(instruction, null);
      throw new Error("Cached action execution was interrupted; its outcome is unknown. Inspect the page before retrying.");
    }
    if (result?.data?.success === true) return;
    await updateCache(instruction, null);
    if (result?.data?.success !== false) {
      throw new Error("Cached action returned no confirmed outcome. Inspect the page before retrying.");
    }
  }

  let observed;
  try { observed = (await stagehand.observe(instruction, { page })).data; }
  catch { throw new Error("Could not observe a replacement action."); }
  const parsed = z.array(CachedActionSchema).min(1).safeParse(observed);
  if (!parsed.success) throw new Error("Observation returned no valid action candidates.");
  const action = parsed.data[0];
  let result;
  try { result = await stagehand.act(action, { page }); }
  catch { throw new Error("Fresh action execution was interrupted; its outcome is unknown. Inspect the page before retrying."); }
  if (result?.data?.success !== true) throw new Error("Fresh action did not confirm success; nothing was cached.");
  try { await simpleCache(instruction, action); }
  catch { console.warn("Action succeeded, but its cache could not be saved."); }
}
