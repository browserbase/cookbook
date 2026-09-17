// cdp.mjs — minimal CDP client over raw `ws`. Shared by injection,
// navigation, and the recording firehose so we don't depend on `browse`'s
// daemon behavior (which mis-routes `browse cdp` after the daemon attaches
// to a session via `browse --connect`).

import { WebSocket } from "ws";

export function makeCdpClient(connectUrl, { timeoutMs = 30_000 } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid CDP timeout.");
  const ws = new WebSocket(connectUrl);
  let nextId = 0;
  let terminal = null;
  let isOpen = false;
  const pending = new Map();
  const eventHandlers = new Map();
  let resolveOpen, rejectOpen, resolveClosed;
  const opened = new Promise((resolve, reject) => { resolveOpen = resolve; rejectOpen = reject; });
  const closed = new Promise(resolve => { resolveClosed = resolve; });
  const openTimer = setTimeout(() => finish("connection-timeout"), timeoutMs);

  function finish(reason) {
    if (terminal) return;
    terminal = { reason };
    clearTimeout(openTimer);
    const error = new Error(`CDP connection ended: ${reason}`);
    if (!isOpen) rejectOpen(error);
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); }
    pending.clear();
    eventHandlers.clear();
    resolveClosed(terminal);
    try { ws.terminate(); } catch {}
  }

  ws.on("open", () => {
    if (terminal) return;
    isOpen = true;
    clearTimeout(openTimer);
    resolveOpen();
  });
  ws.on("error", () => finish("socket-error"));
  ws.on("close", () => finish("socket-closed"));
  ws.on("message", data => {
    if (terminal) return;
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (msg.id != null && pending.has(msg.id)) {
      const item = pending.get(msg.id);
      pending.delete(msg.id);
      clearTimeout(item.timer);
      if (msg.error) item.reject(new Error(`${msg.error.code}: ${msg.error.message}`));
      else item.resolve(msg.result);
      return;
    }
    for (const handler of eventHandlers.get(msg.method) || []) handler(msg);
  });

  function send(method, params = {}, sessionId = undefined) {
    if (terminal || !isOpen) return Promise.reject(new Error("CDP connection is not open."));
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const fail = error => {
        const item = pending.get(id);
        if (!item) return;
        pending.delete(id);
        clearTimeout(item.timer);
        reject(error);
      };
      const timer = setTimeout(() => fail(new Error(`CDP command timed out: ${method}`)), timeoutMs);
      pending.set(id, { resolve, reject, timer });
      const msg = { id, method, params };
      if (sessionId) msg.sessionId = sessionId;
      try {
        ws.send(JSON.stringify(msg), error => { if (error) fail(new Error("CDP send failed.")); });
      } catch { fail(new Error("CDP send failed.")); }
    });
  }

  function on(method, handler) {
    if (terminal) return () => {};
    if (!eventHandlers.has(method)) eventHandlers.set(method, new Set());
    const handlers = eventHandlers.get(method);
    handlers.add(handler);
    return () => handlers.delete(handler);
  }

  function onRaw(handler) {
    const listener = data => {
      if (terminal) return;
      try { handler(JSON.parse(data.toString())); } catch {}
    };
    ws.on("message", listener);
    return () => ws.off("message", listener);
  }

  function close() { finish("client-closed"); }
  return { opened, closed, send, on, onRaw, close };
}

export async function attachToPage(client) {
  const { targetInfos } = await client.send("Target.getTargets");
  const pageTarget = targetInfos.find(
    (t) => t.type === "page" && !t.url.startsWith("devtools://"),
  );
  if (!pageTarget) {
    throw new Error(
      `No page target found. Available: ${targetInfos.map((t) => `${t.type}(${(t.url || "").slice(0, 40)})`).join(", ") || "(none)"}`,
    );
  }
  const { sessionId } = await client.send("Target.attachToTarget", {
    targetId: pageTarget.targetId,
    flatten: true,
  });
  return {
    targetId: pageTarget.targetId,
    sessionId,
    initialUrl: pageTarget.url,
  };
}
