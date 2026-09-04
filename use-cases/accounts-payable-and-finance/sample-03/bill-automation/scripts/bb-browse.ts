#!/usr/bin/env tsx
import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
/**
 * Browserbase-powered browser CLI — same interface as `browser` but uses
 * Browserbase cloud sessions with keepAlive + WS reattach.
 *
 * Usage:
 *   npx tsx scripts/bb-browse.ts navigate <url>
 *   npx tsx scripts/bb-browse.ts screenshot
 *   npx tsx scripts/bb-browse.ts act "<instruction>"
 *   npx tsx scripts/bb-browse.ts extract "<instruction>" ['{"field":"type"}']
 *   npx tsx scripts/bb-browse.ts observe "<query>"
 *   npx tsx scripts/bb-browse.ts close
 */

import "dotenv/config";
import Browserbase from "@browserbasehq/sdk";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import {
  commandFailure,
  releaseSavedSession,
  requireSuccessfulAction,
} from "./cli-contracts.mjs";

const PROJECT_ROOT = join(import.meta.dirname, "..");
const STATE_FILE = join(PROJECT_ROOT, ".bb-session.json");
const SCREENSHOTS_DIR = join(PROJECT_ROOT, "screenshots");

if (!existsSync(SCREENSHOTS_DIR))
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });

interface SessionState {
  sessionId: string;
  connectUrl: string;
  ts: number;
}

function saveSession(state: SessionState) {
  writeFileSync(STATE_FILE, JSON.stringify(state));
}

function loadSession(allowExpired = false): SessionState | null {
  if (!existsSync(STATE_FILE)) return null;
  try {
    const data: SessionState = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    // Expire after 15 minutes
    if (!allowExpired && Date.now() - data.ts > 15 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

function clearSession() {
  if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE);
}

async function getOrCreateSession(): Promise<SessionState> {
  const existing = loadSession();
  if (existing) {
    // Get fresh WS URL via debug endpoint
    try {
      const liveUrls = await bb.sessions.debug(existing.sessionId);
      const state: SessionState = {
        sessionId: existing.sessionId,
        connectUrl: liveUrls.wsUrl,
        ts: Date.now(),
      };
      saveSession(state);
      console.error(
        `Reattaching to session: https://www.browserbase.com/sessions/${existing.sessionId}`,
      );
      return state;
    } catch (e: any) {
      console.error(
        `Session expired or invalid, creating new one: ${e.message}`,
      );
      clearSession();
    }
  }

  // Create new session with keepAlive
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    keepAlive: true,
    browserSettings: {
      solveCaptchas: true,
      viewport: { width: 1280, height: 900 },
    },
  });

  const state: SessionState = {
    sessionId: session.id,
    connectUrl: session.connectUrl,
    ts: Date.now(),
  };
  saveSession(state);
  console.error(
    `New session: https://www.browserbase.com/sessions/${session.id}`,
  );
  return state;
}

async function initBrowser(): Promise<{ stagehand: Stagehand; page: any }> {
  const session = await getOrCreateSession();

  const stagehand = await Stagehand.create(
    StagehandCreateOptionsSchema.parse({
      browser: await localBrowser.connect({ cdpUrl: session.connectUrl }),
      model: {
        modelName: "anthropic/claude-haiku-4-5-20251001",
        apiKey: process.env.ANTHROPIC_API_KEY,
      },
    }),
  );

  return { stagehand, page: (await stagehand.browser.context.activePage())! };
}

async function takeScreenshot(page: any): Promise<string> {
  const filename = `screenshot-${Date.now()}.png`;
  const filepath = join(SCREENSHOTS_DIR, filename);
  const buffer = await page.screenshot({ fullPage: false });
  writeFileSync(filepath, buffer);
  return filepath;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.error(
      "Usage: bb-browse <navigate|act|extract|observe|screenshot|close> [args]",
    );
    process.exit(1);
  }

  let stagehand: Stagehand | null = null;

  try {
    let result: any;

    switch (command) {
      case "navigate": {
        if (!args[1]) throw new Error("Usage: bb-browse navigate <url>");
        const { stagehand: sh, page } = await initBrowser();
        stagehand = sh;
        await page.goto(args[1], {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        const screenshotPath = await takeScreenshot(page);
        result = {
          success: true,
          message: `Navigated to ${args[1]}`,
          screenshot: screenshotPath,
        };
        break;
      }

      case "act": {
        if (!args[1]) throw new Error('Usage: bb-browse act "<instruction>"');
        const { stagehand: sh, page } = await initBrowser();
        stagehand = sh;
        const instruction = args.slice(1).join(" ");
        const action = await stagehand.act(instruction, { page: page });
        const screenshotPath = await takeScreenshot(page);
        requireSuccessfulAction(action, screenshotPath);
        result = {
          success: true,
          message: `Performed: ${instruction}`,
          screenshot: screenshotPath,
        };
        break;
      }

      case "extract": {
        if (!args[1])
          throw new Error('Usage: bb-browse extract "<instruction>" [schema]');
        const { stagehand: sh, page } = await initBrowser();
        stagehand = sh;
        const extractOpts: any = { instruction: args[1] };
        if (args[2]) {
          const schemaInput = JSON.parse(args[2]);
          const zodFields: Record<string, any> = {};
          for (const [key, type] of Object.entries(schemaInput)) {
            if (type === "string") zodFields[key] = z.string();
            else if (type === "number") zodFields[key] = z.number();
            else if (type === "boolean") zodFields[key] = z.boolean();
          }
          if (Object.keys(zodFields).length > 0)
            extractOpts.schema = z.object(zodFields);
        }
        const data = (await stagehand.extract(extractOpts, { page: page }))
          .data;
        const screenshotPath = await takeScreenshot(page);
        result = { success: true, data, screenshot: screenshotPath };
        break;
      }

      case "observe": {
        if (!args[1]) throw new Error('Usage: bb-browse observe "<query>"');
        const { stagehand: sh, page } = await initBrowser();
        stagehand = sh;
        const query = args.slice(1).join(" ");
        const observations = (await stagehand.observe(query, { page: page }))
          .data;
        const screenshotPath = await takeScreenshot(page);
        result = { success: true, observations, screenshot: screenshotPath };
        break;
      }

      case "screenshot": {
        const { stagehand: sh, page } = await initBrowser();
        stagehand = sh;
        const screenshotPath = await takeScreenshot(page);
        result = { success: true, screenshot: screenshotPath };
        break;
      }

      case "close": {
        result = await releaseSavedSession({
          loadSavedSession: () => loadSession(true),
          requestRelease: async (sessionId: string) => {
            await bb.sessions.update(sessionId, {
              projectId: process.env.BROWSERBASE_PROJECT_ID!,
              status: "REQUEST_RELEASE",
            });
          },
          clearSavedSession: clearSession,
        });
        break;
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    const failure = commandFailure(error);
    if (failure.clearSession) clearSession();
    console.error(failure.output);
    process.exitCode = failure.exitCode;
  } finally {
    // Do NOT call stagehand.close() — it kills the Browserbase session.
    // Just exit the process; the CDP WebSocket disconnects naturally,
    // and keepAlive keeps the remote browser alive.
    // Leaving exitCode unset preserves success; errors above set it to 1.
  }
}

main();
