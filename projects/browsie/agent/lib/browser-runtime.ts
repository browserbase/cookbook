import {
  createAgentContext,
  ensureAgentContext,
  isDraftAgentContext,
  listAgentContexts,
  promoteAgentContext,
  selectAgentContext,
} from "../../server/agent-contexts.js";
import { BrowsieBrowserSession, CaptchaHandoffError } from "../../server/browser-session.js";
import { addTrace } from "../../server/trace.js";
import type { BrowserProxyLocation, ConversationState, TraceEvent } from "../../server/types.js";
import { runWithCancellation } from "./cancellation";
import {
  applyCaptchaTransition,
  closeTaskBrowser,
  reconcileCaptchaAfterRestart,
  recordTaskBrowserContext,
  recordTaskBrowserProxyLocation,
  setTaskBrowserContext,
  taskState,
  updateTaskBrowser,
  type DurableCaptchaRecord,
} from "./task-state";

type BrowserOperation<T> = (browser: BrowsieBrowserSession) => Promise<T>;

interface BrowserRuntime {
  browser: BrowsieBrowserSession;
  state: ConversationState;
  idleTimer?: ReturnType<typeof setTimeout>;
}

export interface BrowserToolOutput<T> {
  result: T;
  workbench: {
    browser: ConversationState["browser"];
    traces: TraceEvent[];
    screenshotDataUrl?: string;
    captcha?: DurableCaptchaRecord;
  };
}

const runtimes = new Map<string, BrowserRuntime>();
const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1_000;

function getRuntime(sessionId: string): BrowserRuntime {
  const current = runtimes.get(sessionId);
  if (current) return current;

  const saved = taskState.get();
  const durable = reconcileCaptchaAfterRestart(saved, new Date().toISOString());
  if (durable !== saved) taskState.update(() => durable);
  const state: ConversationState = {
    id: sessionId,
    traces: [],
    browser: {
      provider: durable.browser.sessionId ? "browserbase" : "not-started",
      status: durable.browser.lifecycle === "active" ? "idle" : "idle",
      contextId: durable.browser.contextId,
      contextStatus: durable.browser.contextStatus,
      proxyLocation: durable.browser.proxyLocation,
      sessionId: durable.browser.sessionId,
      url: durable.browser.url,
      title: durable.browser.title,
    },
  };
  const runtime = {
    state,
    browser: createRuntimeBrowser(
      sessionId,
      state,
      durable.browser.contextId,
      durable.browser.proxyLocation,
    ),
  };
  runtimes.set(sessionId, runtime);
  return runtime;
}

export async function runBrowserOperation<T>(
  sessionId: string,
  operation: BrowserOperation<T>,
  includeScreenshot = false,
): Promise<BrowserToolOutput<T>> {
  const runtime = getRuntime(sessionId);
  scheduleIdleClose(sessionId, runtime);
  const traceStart = runtime.state.traces.length;
  let settled = false;
  const pending = operation(runtime.browser).finally(() => {
    settled = true;
  });
  while (!settled) {
    await Promise.race([
      pending.then(
        () => undefined,
        () => undefined,
      ),
      new Promise((resolve) => setTimeout(resolve, 50)),
    ]);
    commitCaptchaQueue(runtime, traceStart);
  }
  let result: T;
  try {
    result = await pending;
  } catch (error) {
    if (!(error instanceof CaptchaHandoffError)) throw error;
    result = {
      status: "waiting_for_user",
      reason: "captcha",
      action: "Complete the challenge in the existing Live View, then resume this task.",
    } as T;
  }
  commitCaptchaQueue(runtime, traceStart);
  scheduleIdleClose(sessionId, runtime);
  return {
    result,
    workbench: {
      browser: { ...runtime.state.browser },
      traces: runtime.state.traces.slice(traceStart),
      captcha: taskState.get().captcha,
      ...(includeScreenshot && runtime.state.screenshot
        ? {
            screenshotDataUrl: `data:image/png;base64,${runtime.state.screenshot.toString("base64")}`,
          }
        : {}),
    },
  };
}

function commitCaptchaQueue(runtime: BrowserRuntime, traceStart: number): void {
  const transitions = runtime.browser.drainCaptchaTransitions();
  if (!transitions.length) return;
  taskState.update((current) => {
    let next = current;
    for (const transition of transitions) next = applyCaptchaTransition(next, transition);
    return updateTaskBrowser(
      next,
      runtime.state.browser,
      runtime.state.traces.slice(traceStart).map((trace) => trace.id),
    );
  });
}

export async function saveBrowserRuntime(sessionId: string): Promise<void> {
  const runtime = runtimes.get(sessionId);
  if (runtime)
    taskState.update((current) =>
      updateTaskBrowser(
        current,
        runtime.state.browser,
        runtime.state.traces.map((trace) => trace.id),
      ),
    );
}

export async function closeBrowserRuntime(sessionId: string): Promise<void> {
  const runtime = runtimes.get(sessionId);
  if (runtime) {
    runtimes.delete(sessionId);
    if (runtime.idleTimer) clearTimeout(runtime.idleTimer);
    try {
      await runtime.browser.close();
    } finally {
      taskState.update((current) =>
        closeTaskBrowser(
          updateTaskBrowser(
            current,
            runtime.state.browser,
            runtime.state.traces.map((trace) => trace.id),
          ),
        ),
      );
    }
    return;
  }
  taskState.update(closeTaskBrowser);
}

export async function runCancelableBrowserWork<T>(
  sessionId: string,
  signal: AbortSignal,
  operation: () => Promise<T>,
): Promise<T> {
  return runWithCancellation(signal, operation, () => closeBrowserRuntime(sessionId));
}

export function hasBrowserRuntime(sessionId: string): boolean {
  return runtimes.has(sessionId);
}

export async function listBrowserContexts() {
  return listAgentContexts();
}

export async function createBrowserContext(
  sessionId: string,
  name: string,
): Promise<{
  id: string;
  name: string;
  selected: true;
  migratedCookieCount: number;
}> {
  const durable = taskState.get();
  const runtime =
    runtimes.get(sessionId) ?? (durable.browser.sessionId ? getRuntime(sessionId) : undefined);
  const currentContextId = durable.browser.contextId;
  if (currentContextId && (await isDraftAgentContext(currentContextId, sessionId))) {
    const context = await promoteAgentContext(currentContextId, name);
    taskState.update((current) => recordTaskBrowserContext(current, context.id, "saved"));
    if (runtime) runtime.state.browser.contextStatus = "saved";
    return {
      id: context.id,
      name: context.name,
      selected: true,
      migratedCookieCount: 0,
    };
  }
  const hasExistingBrowser = Boolean(
    runtime?.browser.hasStarted() || runtime?.state.browser.sessionId,
  );
  if (hasExistingBrowser) await runtime!.browser.start();
  const cookies = hasExistingBrowser ? await runtime!.browser.exportCookies() : [];
  const url = runtime?.state.browser.url;
  const context = await createAgentContext(name);
  if (hasExistingBrowser) await runtime!.browser.close();
  taskState.update((current) => setTaskBrowserContext(current, context.id));

  if (runtime) {
    runtime.state.browser = {
      provider: "not-started",
      status: "idle",
      contextId: context.id,
      contextStatus: "saved",
    };
    runtime.browser = createRuntimeBrowser(
      sessionId,
      runtime.state,
      context.id,
      runtime.state.browser.proxyLocation,
    );
    if (cookies.length) await runtime.browser.importCookies(cookies, url);
  }

  return {
    id: context.id,
    name: context.name,
    selected: true,
    migratedCookieCount: cookies.length,
  };
}

export async function selectBrowserContext(
  sessionId: string,
  contextId: string,
): Promise<{ id: string; name: string; selected: true }> {
  const runtime = runtimes.get(sessionId);
  if (runtime?.browser.hasStarted()) {
    throw new Error("Save or close the current browser before you select another Context.");
  }
  await selectAgentContext(contextId);
  const context = (await listAgentContexts()).find((item) => item.id === contextId);
  if (!context) throw new Error("Unknown Context.");
  taskState.update((current) => setTaskBrowserContext(current, contextId));
  if (runtime) {
    runtime.state.browser.contextId = contextId;
    runtime.state.browser.contextStatus = "saved";
    runtime.browser = createRuntimeBrowser(
      sessionId,
      runtime.state,
      contextId,
      runtime.state.browser.proxyLocation,
    );
  }
  return { id: context.id, name: context.name, selected: true };
}

export async function saveBrowserContext(
  sessionId: string,
  name?: string,
): Promise<{
  id: string;
  name: string;
  status: "saved";
  migratedCookieCount: number;
}> {
  let contextId = taskState.get().browser.contextId;
  let migratedCookieCount = 0;
  if (!contextId) {
    const created = await createBrowserContext(
      sessionId,
      name?.trim() || `Browsie ${new Date().toISOString().slice(0, 10)}`,
    );
    contextId = created.id;
    migratedCookieCount = created.migratedCookieCount;
  }

  const draft = await isDraftAgentContext(contextId, sessionId);
  const contextName = name?.trim() || (draft ? defaultContextName(taskState.get()) : undefined);
  await saveBrowserRuntime(sessionId);
  await closeBrowserRuntime(sessionId);
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  const context = await promoteAgentContext(contextId, contextName);
  taskState.update((current) => setTaskBrowserContext(current, contextId, "closed", "saved"));
  return {
    id: context.id,
    name: context.name,
    status: "saved",
    migratedCookieCount,
  };
}

export function configureBrowserProxyLocation(
  sessionId: string,
  requested: BrowserProxyLocation,
): BrowserToolOutput<{
  status: "configured";
  location: BrowserProxyLocation;
  appliesTo: "next_browser_session";
}> {
  if (!process.env.BROWSERBASE_API_KEY) throw new Error("Browserbase is not configured.");
  const runtime = getRuntime(sessionId);
  if (runtime.browser.hasStarted() || runtime.state.browser.sessionId) {
    throw new Error(
      "Proxy location must be set before the first browser action. Start a new task to use another location.",
    );
  }
  const location = normalizeProxyLocation(requested);
  const traceStart = runtime.state.traces.length;
  runtime.state.browser.proxyLocation = location;
  taskState.update((current) => recordTaskBrowserProxyLocation(current, location));
  runtime.browser = createRuntimeBrowser(
    sessionId,
    runtime.state,
    runtime.state.browser.contextId,
    location,
  );
  addTrace(
    runtime.state,
    "browser",
    "proxy.location.configure",
    `Set the next Browserbase session proxy location to ${formatProxyLocation(location)}.`,
    { location, appliesTo: "next_browser_session" },
  );
  return {
    result: {
      status: "configured",
      location,
      appliesTo: "next_browser_session",
    },
    workbench: {
      browser: { ...runtime.state.browser },
      traces: runtime.state.traces.slice(traceStart),
    },
  };
}

function createRuntimeBrowser(
  sessionId: string,
  state: ConversationState,
  contextId?: string,
  proxyLocation?: BrowserProxyLocation,
): BrowsieBrowserSession {
  return new BrowsieBrowserSession(state, {
    contextId,
    proxyLocation,
    ensureContext: async (currentContextId) => {
      const context = await ensureAgentContext(sessionId, currentContextId);
      state.browser.contextId = context.id;
      state.browser.contextStatus = context.status;
      taskState.update((current) => recordTaskBrowserContext(current, context.id, context.status));
      return { id: context.id, status: context.status };
    },
  });
}

function normalizeProxyLocation(location: BrowserProxyLocation): BrowserProxyLocation {
  const country = location.country.trim().toUpperCase();
  const state = location.state?.trim().toUpperCase();
  const city = location.city?.trim();
  if (!/^[A-Z]{2}$/.test(country))
    throw new Error("Proxy country must be a two-letter country code.");
  if (state && !/^[A-Z0-9_-]{1,32}$/.test(state)) throw new Error("Proxy state is invalid.");
  if (city && city.length > 80) throw new Error("Proxy city is too long.");
  return {
    country,
    ...(state ? { state } : {}),
    ...(city ? { city } : {}),
  };
}

function formatProxyLocation(location: BrowserProxyLocation): string {
  return [location.city, location.state, location.country].filter(Boolean).join(", ");
}

function defaultContextName(record: { title: string }): string {
  const title = record.title.trim();
  if (title && title !== "New task") return title.slice(0, 80);
  return `Browsie ${new Date().toISOString().slice(0, 10)}`;
}

function scheduleIdleClose(sessionId: string, runtime: BrowserRuntime): void {
  if (runtime.idleTimer) clearTimeout(runtime.idleTimer);
  const configured = Number(process.env.BROWSIE_BROWSER_IDLE_MS ?? DEFAULT_IDLE_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_IDLE_TIMEOUT_MS;
  runtime.idleTimer = setTimeout(() => {
    void closeBrowserRuntime(sessionId).catch(() => undefined);
  }, timeoutMs);
  runtime.idleTimer.unref?.();
}
