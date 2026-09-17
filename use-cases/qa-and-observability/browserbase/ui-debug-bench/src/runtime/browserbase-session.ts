import { AsyncLocalStorage } from "node:async_hooks";

export interface BrowserbaseSession {
  sessionId: string;
  connectUrl: string;
  dashboardUrl: string;
}

const storage = new AsyncLocalStorage<BrowserbaseSession>();

export function currentBrowserbaseSession(): BrowserbaseSession | undefined {
  return storage.getStore();
}

/** Run fn inside a fresh Browserbase session; the session is released afterwards. */
export async function withBrowserbaseSession<T>(fn: (session: BrowserbaseSession) => Promise<T>): Promise<T> {
  const session = await createBrowserbaseSession();
  try {
    return await storage.run(session, () => fn(session));
  } finally {
    await releaseBrowserbaseSession(session.sessionId);
  }
}

async function createBrowserbaseSession(): Promise<BrowserbaseSession> {
  if (!process.env.BROWSERBASE_API_KEY) {
    throw new Error("BROWSERBASE_API_KEY is required for Browserbase mode.");
  }
  const response = await fetch("https://api.browserbase.com/v1/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bb-api-key": process.env.BROWSERBASE_API_KEY
    },
    body: JSON.stringify({
      browserSettings: {
        viewport: { width: 1280, height: 900 }
      }
    })
  });
  if (!response.ok) {
    throw new Error(`Browserbase session create failed: ${response.status} ${await response.text()}`);
  }
  const json = await response.json() as { id: string; connectUrl: string };
  return {
    sessionId: json.id,
    connectUrl: json.connectUrl,
    dashboardUrl: `https://www.browserbase.com/sessions/${json.id}`
  };
}

async function releaseBrowserbaseSession(id: string): Promise<void> {
  await fetch(`https://api.browserbase.com/v1/sessions/${id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bb-api-key": process.env.BROWSERBASE_API_KEY ?? ""
    },
    body: JSON.stringify({ status: "REQUEST_RELEASE" })
  }).catch(() => undefined);
}
