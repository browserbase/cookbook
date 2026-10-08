import "server-only";

import { captchaSignalMessage, parseBrowserbaseCaptchaEvent } from "../src/captcha";

type Pending = {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
};

export class BrowserbaseConsoleAdapter {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  private constructor(
    private readonly socket: WebSocket,
    private readonly onConsole: (message: string) => void,
  ) {
    socket.addEventListener("message", (event) => this.receive(String(event.data)));
    socket.addEventListener("close", () => this.rejectPending());
  }

  static async connect(
    connectUrl: string,
    onConsole: (message: string) => void,
  ): Promise<BrowserbaseConsoleAdapter> {
    const socket = new WebSocket(connectUrl);
    await waitForOpen(socket);
    const adapter = new BrowserbaseConsoleAdapter(socket, onConsole);
    await adapter.send("Target.setAutoAttach", {
      autoAttach: true,
      waitForDebuggerOnStart: false,
      flatten: true,
    });
    const result = await adapter.send("Target.getTargets");
    const targets = Array.isArray(result.targetInfos) ? result.targetInfos : [];
    for (const target of targets) {
      if (!target || typeof target !== "object" || (target as { type?: unknown }).type !== "page")
        continue;
      const targetId = (target as { targetId?: unknown }).targetId;
      if (typeof targetId !== "string") continue;
      const attached = await adapter.send("Target.attachToTarget", {
        targetId,
        flatten: true,
      });
      if (typeof attached.sessionId === "string") {
        await adapter.send("Runtime.enable", {}, attached.sessionId);
      }
    }
    return adapter;
  }

  close(): void {
    this.socket.close();
    this.rejectPending();
  }

  private send(
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
  ): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Browserbase CDP command timed out."));
      }, 10_000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      this.socket.send(
        JSON.stringify({
          id,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        }),
      );
    });
  }

  private receive(raw: string): void {
    let value: Record<string, unknown>;
    try {
      value = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    if (typeof value.id === "number") {
      const pending = this.pending.get(value.id);
      if (!pending) return;
      this.pending.delete(value.id);
      if (value.error) pending.reject(new Error("Browserbase CDP command failed."));
      else
        pending.resolve(
          value.result && typeof value.result === "object"
            ? (value.result as Record<string, unknown>)
            : {},
        );
      return;
    }
    if (
      value.method === "Target.attachedToTarget" &&
      value.params &&
      typeof value.params === "object"
    ) {
      const sessionId = (value.params as { sessionId?: unknown }).sessionId;
      if (typeof sessionId === "string")
        void this.send("Runtime.enable", {}, sessionId).catch(() => undefined);
      return;
    }
    const message = consoleMessageFromCdpEvent(value);
    if (message) this.onConsole(message);
  }

  private rejectPending(): void {
    for (const pending of this.pending.values())
      pending.reject(new Error("Browserbase CDP connection closed."));
    this.pending.clear();
  }
}

export function consoleMessageFromCdpEvent(value: unknown): string | undefined {
  const signal = parseBrowserbaseCaptchaEvent(value);
  return signal ? captchaSignalMessage(signal) : undefined;
}

function waitForOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Browserbase CDP connection timed out.")),
      10_000,
    );
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timeout);
        reject(new Error("Browserbase CDP connection failed."));
      },
      { once: true },
    );
  });
}
