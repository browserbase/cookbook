import "server-only";

import Browserbase from "@browserbasehq/sdk";
import {
  Stagehand,
  browserbase as stagehandBrowserbase,
  type StagehandBrowser,
} from "@browserbasehq/stagehand";

import { captchaSignalMessage, parseBrowserbaseCaptchaEvent } from "../src/captcha";
import {
  CAPTCHA_TIMEOUT_MS,
  challengeAfterTimeout,
  challengeFromConsole,
  CONTEXT_SYNC_WAIT_MS,
  type ChallengeState,
  type ContextRecord,
  type ContextSessionPurpose,
  type ContextSessionView,
} from "../src/context-studio";
import { toEmbeddedBrowserbaseLiveViewUrl } from "../src/live-view";
import { BrowserbaseConsoleAdapter } from "./browserbase-console";
import { getContextMetadataStore, type ContextMetadataStore } from "./context-metadata";

type RemoteSessionStatus = "PENDING" | "RUNNING" | "ERROR" | "TIMED_OUT" | "COMPLETED";

export interface RemoteContext {
  id: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContextStudioGateway {
  createContext(name: string): Promise<{ id: string }>;
  retrieveContext(id: string): Promise<RemoteContext>;
  deleteContext(id: string): Promise<void>;
  createSession(contextId: string, purpose: ContextSessionPurpose): Promise<{ id: string }>;
  retrieveSession(id: string): Promise<{ status: RemoteSessionStatus }>;
  releaseSession(id: string): Promise<void>;
  navigateSession(id: string, url: string): Promise<void>;
  liveView(id: string): Promise<string | undefined>;
  attachConsole(id: string, listener: (message: string) => void): Promise<() => Promise<void>>;
}

interface ActiveSession extends ContextSessionView {
  detachConsole?: () => Promise<void>;
  captchaTimer?: ReturnType<typeof setTimeout>;
  finishPromise?: Promise<void>;
}

export class ContextStudioService {
  private readonly activeBySession = new Map<string, ActiveSession>();
  private readonly writerByContext = new Map<string, string>();

  constructor(
    private readonly gateway: ContextStudioGateway,
    private readonly metadata: ContextMetadataStore,
    private readonly sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {}

  async listContexts(): Promise<ContextRecord[]> {
    const metadata = await this.metadata.read();
    const configuredId = process.env.BROWSERBASE_CONTEXT_ID;
    if (configuredId && !metadata.contexts[configuredId]) {
      await this.metadata.add(configuredId, "Configured Context");
      return this.listContexts();
    }
    const records = await Promise.all(
      Object.entries(metadata.contexts).map(async ([id, local]) => {
        if (local.status === "draft") return undefined;
        try {
          const remote = await this.gateway.retrieveContext(id);
          return {
            id,
            name: local.name || remote.name || "Saved Context",
            createdAt: remote.createdAt || local.createdAt,
            updatedAt: remote.updatedAt || local.updatedAt,
            selected: metadata.selectedContextId === id,
            writerActive: this.writerByContext.has(id),
          } satisfies ContextRecord;
        } catch {
          return undefined;
        }
      }),
    );
    return records.filter((record) => record !== undefined);
  }

  async createContext(name: string): Promise<ContextRecord> {
    const cleanName = validateName(name);
    const remote = await this.gateway.createContext(cleanName);
    await this.metadata.add(remote.id, cleanName);
    await this.metadata.select(remote.id);
    return {
      id: remote.id,
      name: cleanName,
      selected: true,
      writerActive: false,
    };
  }

  async selectContext(id: string): Promise<void> {
    validateId(id, "Context");
    await this.gateway.retrieveContext(id);
    await this.metadata.select(id);
  }

  async deleteContext(id: string): Promise<void> {
    validateId(id, "Context");
    if (this.writerByContext.has(id))
      throw new ContextConflictError("Finish the active session first.");
    await this.gateway.deleteContext(id);
    await this.metadata.remove(id);
  }

  async startSession(
    contextId: string,
    purpose: ContextSessionPurpose,
    startUrl: string,
  ): Promise<ContextSessionView> {
    validateId(contextId, "Context");
    if (purpose !== "login" && purpose !== "test") throw new Error("Invalid session purpose.");
    const destination = validateStartUrl(startUrl);
    if (this.writerByContext.has(contextId)) {
      throw new ContextConflictError("This Context already has an active writer.");
    }
    await this.gateway.retrieveContext(contextId);
    this.writerByContext.set(contextId, "starting");
    let remoteId: string | undefined;
    try {
      const remote = await this.gateway.createSession(contextId, purpose);
      remoteId = remote.id;
      const session: ActiveSession = {
        sessionId: remote.id,
        contextId,
        purpose,
        status: "starting",
        challenge: { status: "idle" },
      };
      this.activeBySession.set(remote.id, session);
      this.writerByContext.set(contextId, remote.id);
      session.detachConsole = await this.gateway.attachConsole(remote.id, (message) => {
        this.receiveConsoleMessage(remote.id, message);
      });
      await this.gateway.navigateSession(remote.id, destination);
      session.status = "live";
      session.message =
        purpose === "login"
          ? "Use Live View to sign in, including OTP or other challenges."
          : "Use Live View to confirm that your saved login is present.";
      return publicSession(session);
    } catch (error) {
      if (remoteId) await this.gateway.releaseSession(remoteId).catch(() => undefined);
      this.writerByContext.delete(contextId);
      throw error;
    }
  }

  getSession(sessionId: string): ContextSessionView | undefined {
    validateId(sessionId, "Session");
    const session = this.activeBySession.get(sessionId);
    return session ? publicSession(session) : undefined;
  }

  async getLiveView(sessionId: string): Promise<string | undefined> {
    const session = this.activeBySession.get(sessionId);
    if (!session || (session.status !== "live" && session.status !== "disconnected"))
      return undefined;
    return this.gateway.liveView(sessionId);
  }

  markDisconnected(sessionId: string): ContextSessionView | undefined {
    const session = this.activeBySession.get(sessionId);
    if (!session) return undefined;
    if (session.status === "live") {
      session.status = "disconnected";
      session.message = "Live View disconnected. Reconnect to the same running session.";
    }
    return publicSession(session);
  }

  markReconnected(sessionId: string): ContextSessionView | undefined {
    const session = this.activeBySession.get(sessionId);
    if (!session) return undefined;
    if (session.status === "disconnected") {
      session.status = "live";
      session.message = "Live View reconnected.";
    }
    return publicSession(session);
  }

  finishSession(sessionId: string): ContextSessionView {
    const session = this.activeBySession.get(sessionId);
    if (!session) throw new Error("Unknown session.");
    if (!session.finishPromise || session.status === "error") {
      session.status = "closing";
      session.message = "Closing the browser before saving the Context.";
      session.finishPromise = this.finishInBackground(session);
    }
    return publicSession(session);
  }

  private receiveConsoleMessage(sessionId: string, message: string): void {
    const session = this.activeBySession.get(sessionId);
    if (!session || session.status !== "live") return;
    const previous = session.challenge;
    session.challenge = challengeFromConsole(previous, message);
    if (session.challenge.status === "solving_captcha" && previous.status !== "solving_captcha") {
      if (session.captchaTimer) clearTimeout(session.captchaTimer);
      session.captchaTimer = setTimeout(() => {
        session.challenge = challengeAfterTimeout(session.challenge);
        session.message =
          "CAPTCHA solving exceeded 30 seconds. The session is still live for manual completion.";
      }, CAPTCHA_TIMEOUT_MS);
      session.message = "Browserbase is solving a CAPTCHA. This can take up to 30 seconds.";
    } else if (session.challenge.status === "captcha_solved") {
      if (session.captchaTimer) clearTimeout(session.captchaTimer);
      session.captchaTimer = undefined;
      session.message = "CAPTCHA solving finished. Continue in the same Live View.";
    } else if (session.challenge.status === "captcha_error") {
      if (session.captchaTimer) clearTimeout(session.captchaTimer);
      session.captchaTimer = undefined;
      session.message = "CAPTCHA solving errored. Complete the challenge in Live View.";
    }
  }

  private async finishInBackground(session: ActiveSession): Promise<void> {
    try {
      if (session.captchaTimer) clearTimeout(session.captchaTimer);
      await session.detachConsole?.().catch(() => undefined);
      await this.gateway.releaseSession(session.sessionId);
      const closed = await this.waitUntilClosed(session.sessionId);
      if (!closed) {
        session.status = "error";
        session.message =
          "Browserbase did not confirm that the session closed. The Context is not marked saved.";
        return;
      }
      session.status = "syncing";
      session.message = "Session closed. Waiting a few seconds for Context synchronization.";
      await this.sleep(CONTEXT_SYNC_WAIT_MS);
      session.status = "saved";
      session.message = "Login session closed and Context synchronization wait completed.";
    } catch {
      session.status = "error";
      session.message = "The session could not be closed safely. The Context is not marked saved.";
    } finally {
      if (session.status === "saved") {
        this.writerByContext.delete(session.contextId);
      } else {
        session.finishPromise = undefined;
      }
    }
  }

  private async waitUntilClosed(sessionId: string): Promise<boolean> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const remote = await this.gateway.retrieveSession(sessionId);
      if (
        remote.status === "COMPLETED" ||
        remote.status === "TIMED_OUT" ||
        remote.status === "ERROR"
      )
        return true;
      await this.sleep(1_000);
    }
    return false;
  }
}

export class ContextConflictError extends Error {}

export function browserbaseSessionOptions(contextId: string, purpose: ContextSessionPurpose) {
  return {
    ...(process.env.BROWSERBASE_PROJECT_ID
      ? { projectId: process.env.BROWSERBASE_PROJECT_ID }
      : {}),
    keepAlive: true,
    proxies: true,
    browserSettings: {
      context: { id: contextId, persist: true },
      verified: true,
      solveCaptchas: true,
    },
    userMetadata: { product: "browsie", flow: `context-${purpose}` },
  } as const;
}

export function consoleMessageFromStagehandEvent(event: unknown): string | undefined {
  const signal = parseBrowserbaseCaptchaEvent(event);
  return signal ? captchaSignalMessage(signal) : undefined;
}

class BrowserbaseGateway implements ContextStudioGateway {
  private readonly sdk: Browserbase;
  private readonly apiKey: string;
  private readonly launched = new Map<string, StagehandBrowser>();
  private readonly connections = new Map<
    string,
    {
      browser: StagehandBrowser;
      stagehand: Stagehand;
      console: BrowserbaseConsoleAdapter;
    }
  >();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.sdk = new Browserbase({ apiKey });
  }
  async createContext(name: string) {
    return this.sdk.contexts.create({
      name,
      ...(process.env.BROWSERBASE_PROJECT_ID
        ? { projectId: process.env.BROWSERBASE_PROJECT_ID }
        : {}),
    });
  }
  retrieveContext(id: string) {
    return this.sdk.contexts.retrieve(id);
  }
  deleteContext(id: string) {
    return deleteBrowserbaseContext(this.apiKey, id);
  }
  async createSession(contextId: string, purpose: ContextSessionPurpose) {
    const browser = await stagehandBrowserbase.launch({
      apiKey: this.apiKey,
      ...browserbaseSessionOptions(contextId, purpose),
    });
    if (!browser.sessionId) throw new Error("Stagehand did not return a Browserbase session ID.");
    this.launched.set(browser.sessionId, browser);
    return { id: browser.sessionId };
  }
  async retrieveSession(id: string) {
    const session = await this.sdk.sessions.retrieve(id);
    return { status: session.status };
  }
  async releaseSession(id: string) {
    const launched = this.launched.get(id);
    this.launched.delete(id);
    const connection = this.connections.get(id);
    this.connections.delete(id);
    connection?.console.close();
    if (launched && launched !== connection?.browser) await launched.close().catch(() => undefined);
    await connection?.stagehand.close().catch(() => undefined);
    await this.sdk.sessions.update(id, { status: "REQUEST_RELEASE" }).catch(() => undefined);
  }
  async liveView(id: string) {
    const debug = await this.sdk.sessions.debug(id);
    return toEmbeddedBrowserbaseLiveViewUrl(debug.debuggerFullscreenUrl);
  }
  async navigateSession(id: string, url: string) {
    const connection = this.connections.get(id);
    if (!connection) throw new Error("The Browserbase session is unavailable for navigation.");
    const page =
      (await connection.stagehand.browser.context.activePage()) ??
      (await connection.stagehand.browser.context.pages())[0] ??
      (await connection.stagehand.browser.context.newPage());
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  }
  async attachConsole(id: string, listener: (message: string) => void) {
    const browser = this.launched.get(id);
    if (!browser) throw new Error("The Stagehand browser session is unavailable.");
    const remote = await this.sdk.sessions.retrieve(id);
    if (!remote.connectUrl) throw new Error("The Browserbase CDP connection is unavailable.");
    const console = await BrowserbaseConsoleAdapter.connect(remote.connectUrl, listener);
    let stagehand: Stagehand;
    try {
      stagehand = await Stagehand.create({ browser });
    } catch (error) {
      console.close();
      throw error;
    }
    this.launched.delete(id);
    this.connections.set(id, { browser, stagehand, console });
    return async () => console.close();
  }
}

declare global {
  var __browsieContextStudio: ContextStudioService | undefined;
}

export function getContextStudio(): ContextStudioService {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) throw new Error("Browserbase is not configured.");
  globalThis.__browsieContextStudio ??= new ContextStudioService(
    new BrowserbaseGateway(apiKey),
    getContextMetadataStore(),
  );
  return globalThis.__browsieContextStudio;
}

function validateName(value: string): string {
  const clean = value.trim();
  if (clean.length < 1 || clean.length > 80)
    throw new Error("Context name must be 1–80 characters.");
  return clean;
}

function validateId(value: string, label: string): void {
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(value)) throw new Error(`Invalid ${label} ID.`);
}

function publicSession(session: ActiveSession): ContextSessionView {
  return {
    sessionId: session.sessionId,
    contextId: session.contextId,
    purpose: session.purpose,
    status: session.status,
    challenge: { ...session.challenge } as ChallengeState,
    message: session.message,
  };
}

export async function deleteBrowserbaseContext(
  apiKey: string,
  contextId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher(
    `https://api.browserbase.com/v1/contexts/${encodeURIComponent(contextId)}`,
    {
      method: "DELETE",
      headers: { "x-bb-api-key": apiKey },
    },
  );
  if (!response.ok) throw new Error("Browserbase rejected Context deletion.");
}

export function validateStartUrl(value: string): string {
  if (value.length > 2_048) throw new Error("Website URL is too long.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid HTTPS website URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) {
    throw new Error("Enter a valid HTTPS website URL without embedded credentials.");
  }
  url.hash = "";
  return url.toString();
}
