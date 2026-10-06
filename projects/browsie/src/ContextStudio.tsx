"use client";

import {
  Database,
  LoaderCircle,
  Monitor,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  isBrowserbaseDisconnectMessage,
  type ContextRecord,
  type ContextSessionPurpose,
  type ContextSessionView,
} from "./context-studio";
import { toEmbeddedBrowserbaseLiveViewUrl } from "./live-view";

export default function ContextStudio({ configured }: { configured: boolean }) {
  const [capability, setCapability] = useState<string>();
  const [contexts, setContexts] = useState<ContextRecord[]>([]);
  const [session, setSession] = useState<ContextSessionView>();
  const [liveUrl, setLiveUrl] = useState<string>();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string>();
  const [startUrl, setStartUrl] = useState("");
  const [error, setError] = useState<string>();

  const request = useCallback(
    async (url: string, init: RequestInit = {}) => {
      if (!capability) throw new Error("Context access is not ready.");
      const response = await fetch(url, {
        ...init,
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "x-browsie-context-capability": capability,
          ...init.headers,
        },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || "Context request failed.");
      }
      return response;
    },
    [capability],
  );

  const loadContexts = useCallback(async () => {
    if (!capability) return;
    const response = await request("/api/contexts");
    const body = (await response.json()) as { contexts: ContextRecord[] };
    setContexts(body.contexts);
  }, [capability, request]);

  const loadLiveView = useCallback(
    async (sessionId: string) => {
      const response = await request(
        `/api/browser-live-view?sessionId=${encodeURIComponent(sessionId)}`,
      );
      const body = (await response.json()) as { liveUrl?: string };
      const safe = toEmbeddedBrowserbaseLiveViewUrl(body.liveUrl);
      if (!safe) throw new Error("Browserbase returned an invalid Live View URL.");
      setLiveUrl(safe);
    },
    [request],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/context-capability", {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Context access could not be initialized.");
        return response.json() as Promise<{ token: string }>;
      })
      .then(({ token }) => setCapability(token))
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError"))
          setError(message(cause));
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!capability) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void loadContexts().catch((cause) => setError(message(cause)));
    });
    return () => {
      cancelled = true;
    };
  }, [capability, loadContexts]);

  useEffect(() => {
    if (!session || session.status === "saved" || session.status === "error") return;
    const timer = window.setInterval(() => {
      void request(`/api/context-sessions?sessionId=${encodeURIComponent(session.sessionId)}`)
        .then((response) => response.json() as Promise<{ session: ContextSessionView }>)
        .then(({ session: next }) => {
          setSession(next);
          if (next.status === "saved" || next.status === "error") {
            setLiveUrl(undefined);
            void loadContexts();
          }
        })
        .catch(() => undefined);
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [loadContexts, request, session]);

  useEffect(() => {
    if (!session) return;
    const onMessage = (event: MessageEvent) => {
      if (!isBrowserbaseDisconnectMessage(event.data)) return;
      setLiveUrl(undefined);
      void updateSession("disconnected");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [session?.sessionId]);

  async function createContext(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    await act("create", async () => {
      await request("/api/contexts", {
        method: "POST",
        body: JSON.stringify({ name: clean }),
      });
      setName("");
      await loadContexts();
    });
  }

  async function selectContext(id: string) {
    await act("select", async () => {
      await request("/api/contexts", {
        method: "PATCH",
        body: JSON.stringify({ id }),
      });
      await loadContexts();
    });
  }

  async function deleteContext(context: ContextRecord) {
    if (!window.confirm(`Permanently delete “${context.name}”? This cannot be undone.`)) return;
    await act("delete", async () => {
      await request(`/api/contexts?id=${encodeURIComponent(context.id)}`, {
        method: "DELETE",
        headers: { "x-browsie-delete-confirmation": context.id },
      });
      await loadContexts();
    });
  }

  async function startSession(contextId: string, purpose: ContextSessionPurpose) {
    if (!startUrl.trim()) return setError("Enter the website you want to open.");
    await act(purpose, async () => {
      setLiveUrl(undefined);
      const response = await request("/api/context-sessions", {
        method: "POST",
        body: JSON.stringify({ contextId, purpose, startUrl: startUrl.trim() }),
      });
      const body = (await response.json()) as { session: ContextSessionView };
      setSession(body.session);
      await loadLiveView(body.session.sessionId);
      await loadContexts();
    });
  }

  async function updateSession(action: "finish" | "disconnected" | "reconnected") {
    if (!session) return;
    const response = await request("/api/context-sessions", {
      method: "PATCH",
      body: JSON.stringify({ sessionId: session.sessionId, action }),
    });
    const body = (await response.json()) as { session: ContextSessionView };
    setSession(body.session);
  }

  async function reconnect() {
    await act("reconnect", async () => {
      await updateSession("reconnected");
      if (session) await loadLiveView(session.sessionId);
    });
  }

  async function finish() {
    await act("finish", async () => {
      setLiveUrl(undefined);
      await updateSession("finish");
    });
  }

  async function act(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError(undefined);
    try {
      await action();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(undefined);
    }
  }

  const selected = useMemo(() => contexts.find((context) => context.selected), [contexts]);
  const sessionOpen = session && session.status !== "saved";

  if (!configured) {
    return (
      <article className="details-card">
        <div className="details-icon">
          <Database size={20} />
        </div>
        <div className="details-copy">
          <h2>Browserbase setup required</h2>
          <p>Add BROWSERBASE_API_KEY to use real persistent Contexts.</p>
        </div>
      </article>
    );
  }

  return (
    <div className="context-studio">
      <form className="context-create" onSubmit={createContext}>
        <label>
          <span>New Context</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder="Work email"
            disabled={!capability || Boolean(busy)}
          />
        </label>
        <button className="primary-action" disabled={!capability || !name.trim() || Boolean(busy)}>
          <Plus size={15} /> Create
        </button>
      </form>

      {error ? (
        <p className="context-error" role="alert">
          {error}
        </p>
      ) : null}
      {!capability ? (
        <div className="context-loading">
          <LoaderCircle className="spin" size={18} /> Securing Context access…
        </div>
      ) : null}

      <div className="context-list">
        {contexts.map((context) => (
          <article
            className={context.selected ? "context-row selected" : "context-row"}
            key={context.id}
          >
            <button
              className="context-select"
              onClick={() => void selectContext(context.id)}
              disabled={Boolean(busy) || Boolean(sessionOpen)}
            >
              <span className="context-icon">
                <Database size={18} />
              </span>
              <span>
                <strong>{context.name}</strong>
                <small>
                  {context.updatedAt
                    ? `Updated ${new Date(context.updatedAt).toLocaleString()}`
                    : "Ready for persistent login"}
                </small>
              </span>
            </button>
            <div className="context-row-actions">
              {context.selected ? <span className="connected">Selected</span> : null}
              {context.writerActive ? <span className="writer">Writer active</span> : null}
              <button
                aria-label={`Delete ${context.name}`}
                onClick={() => void deleteContext(context)}
                disabled={Boolean(busy) || context.writerActive}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </article>
        ))}
        {!contexts.length && capability ? (
          <div className="empty-list">
            <Database size={24} />
            <p>Create a Context to save a browser login.</p>
          </div>
        ) : null}
      </div>

      <article className="context-session-card">
        <label className="context-destination">
          <span>Website to open</span>
          <input
            type="url"
            value={startUrl}
            onChange={(event) => setStartUrl(event.target.value)}
            placeholder="https://accounts.example.com"
            disabled={Boolean(sessionOpen) || Boolean(busy)}
          />
        </label>
        <div className="context-session-heading">
          <div>
            <span>LOGIN HANDOFF</span>
            <h2>{selected ? selected.name : "Select a Context"}</h2>
          </div>
          <div className="session-actions">
            <button
              className="secondary-action"
              disabled={!selected || !startUrl.trim() || Boolean(busy) || Boolean(sessionOpen)}
              onClick={() => selected && void startSession(selected.id, "test")}
            >
              <ShieldCheck size={14} /> Test Context
            </button>
            <button
              className="primary-action"
              disabled={!selected || !startUrl.trim() || Boolean(busy) || Boolean(sessionOpen)}
              onClick={() => selected && void startSession(selected.id, "login")}
            >
              <Monitor size={14} /> Start login
            </button>
          </div>
        </div>

        {session ? (
          <div className="context-session-status">
            <strong>{statusLabel(session)}</strong>
            <p>{session.message}</p>
            {session.challenge.status === "solving_captcha" && (
              <div className="captcha-progress">
                <LoaderCircle className="spin" size={16} /> CAPTCHA solving in progress
              </div>
            )}
            {session.challenge.status === "captcha_timeout" && (
              <div className="captcha-progress warning">
                Solver timed out after 30 seconds. Complete the challenge in Live View.
              </div>
            )}
            {session.challenge.status === "captcha_error" && (
              <div className="captcha-progress warning">
                Solver errored. Complete the challenge in Live View.
              </div>
            )}
          </div>
        ) : null}

        {liveUrl && sessionOpen ? (
          <div className="context-live-view">
            <iframe
              key={liveUrl}
              src={liveUrl}
              title="Interactive Browserbase login"
              sandbox="allow-same-origin allow-scripts"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        ) : null}

        {sessionOpen ? (
          <div className="context-session-footer">
            {session.status === "disconnected" ? (
              <button
                className="primary-action"
                disabled={Boolean(busy)}
                onClick={() => void reconnect()}
              >
                <RefreshCw size={14} /> Reconnect Live View
              </button>
            ) : (
              <button
                className="primary-action"
                disabled={Boolean(busy) || !["live", "error"].includes(session.status)}
                onClick={() => void finish()}
              >
                {session.status === "error"
                  ? "Retry finish"
                  : session.purpose === "login"
                    ? "Finish login and save"
                    : "Finish test session"}
              </button>
            )}
          </div>
        ) : null}
      </article>
    </div>
  );
}

function statusLabel(session: ContextSessionView): string {
  const labels: Record<ContextSessionView["status"], string> = {
    starting: "Starting verified browser…",
    live: session.purpose === "login" ? "Login session live" : "Context test live",
    closing: "Closing session…",
    syncing: "Waiting for Context sync…",
    saved: session.purpose === "login" ? "Context saved" : "Test session closed",
    disconnected: "Live View disconnected",
    error: "Context not saved",
  };
  return labels[session.status];
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
