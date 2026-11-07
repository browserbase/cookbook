"use client";

import { useEveAgent } from "eve/react";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Bot,
  Braces,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Compass,
  Database,
  Expand,
  Globe2,
  KeyRound,
  LockKeyhole,
  Menu,
  MessageSquare,
  Monitor,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Wrench,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { isNearScrollBottom } from "./chat-scroll";
import { buildClientContext } from "./client-context";
import ContextStudio from "./ContextStudio";
import { toEmbeddedBrowserbaseLiveViewUrl } from "./live-view";
import { parseTaskHistory, TASK_HISTORY_KEY, type TaskHistoryItem } from "./task-history";
import type { AgentSettings, Bootstrap, BrowserState, TraceEvent } from "./types";
import VaultStudio from "./VaultStudio";

type Message = { id: string; role: "user" | "assistant"; text: string };
type OptimisticMessage = Message & { baseUserCount: number };
type PendingInput = {
  requestId: string;
  prompt: string;
  allowFreeform?: boolean;
  options?: Array<{ id: string; label: string }>;
};
type WorkspaceView = "chat" | "skills" | "context" | "vault" | "settings";
type CaptchaProjection = {
  status: "idle" | "solving" | "solved" | "errored" | "timed_out";
  attemptCount: number;
};
type BrowserCardView = "browser" | "activity";
type StopStatus = "idle" | "stopping" | "stopped";

const starterPrompts = [
  { icon: Braces, label: "Fill a demo form", hint: "Stop before Submit" },
  {
    icon: Globe2,
    label: "Open and explain a page",
    hint: "Use the browser tool loop",
  },
  {
    icon: BookOpen,
    label: "Show how skills work",
    hint: "See the loaded skill",
  },
];

const viewNames: Record<WorkspaceView, string> = {
  chat: "Personal browser",
  skills: "Skills",
  context: "Contexts",
  vault: "Vault",
  settings: "Settings",
};

const initialBrowser: BrowserState = {
  provider: "not-started",
  status: "idle",
};
const AGENT_SETTINGS_KEY = "browsie.agent-settings.v1";
const defaultAgentSettings: AgentSettings = {
  model: "gpt-5.6-sol",
  reasoningEffort: "medium",
};
const builtInSkills: Bootstrap["skills"] = [
  {
    id: "browser-basics",
    name: "browser-basics",
    description:
      "Use snapshots, exact actions, screenshots, and recovery in one persistent browser.",
    path: "agent/skills/browser-basics/SKILL.md",
    scope: "browser",
  },
  {
    id: "fill-form",
    name: "fill-form",
    description: "Inspect and fill forms. Verify values before a requested submit.",
    path: "agent/skills/fill-form/SKILL.md",
    scope: "task",
  },
  {
    id: "amazon-product-research",
    name: "amazon-product-research",
    description: "Compare products with live facts and useful alternate sources.",
    path: "agent/skills/amazon-product-research/SKILL.md",
    scope: "site",
  },
];

export default function App({
  sessionId,
  modelConfigured,
  contextConfigured,
  browserbaseConfigured,
}: {
  sessionId?: string;
  modelConfigured: boolean;
  contextConfigured: boolean;
  browserbaseConfigured: boolean;
}) {
  const [input, setInput] = useState("");
  const [sidebar, setSidebar] = useState(true);
  const [view, setView] = useState<WorkspaceView>("chat");
  const [history, setHistory] = useState<TaskHistoryItem[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [stopStatus, setStopStatus] = useState<StopStatus>("idle");
  const [stopError, setStopError] = useState<string>();
  const stopRequestRef = useRef<Promise<unknown> | undefined>(undefined);
  const cancellationObservedRef = useRef(false);
  const registeredTaskRef = useRef<string | undefined>(undefined);
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(defaultAgentSettings);
  const agent = useEveAgent({
    initialSession: sessionId ? { sessionId, streamIndex: 0 } : undefined,
    resume: Boolean(sessionId),
    onEvent(event) {
      if (event.type === "turn.started") {
        if (!stopRequestRef.current) {
          cancellationObservedRef.current = false;
          setStopStatus("idle");
          setStopError(undefined);
        }
      } else if (event.type === "turn.cancelled") {
        cancellationObservedRef.current = true;
      }
    },
    onFinish() {
      const hadStopRequest = Boolean(stopRequestRef.current);
      stopRequestRef.current = undefined;
      if (cancellationObservedRef.current) {
        cancellationObservedRef.current = false;
        setStopStatus("stopped");
      } else if (hadStopRequest) {
        setStopStatus("idle");
      }
    },
    onSessionChange(session) {
      if (!sessionId && session) {
        History.prototype.replaceState.call(
          window.history,
          window.history.state,
          "",
          `/s/${encodeURIComponent(session.sessionId)}`,
        );
      }
    },
    prepareSend(payload) {
      return {
        ...payload,
        clientContext: buildClientContext(
          contextConfigured
            ? "Saved Browserbase Context"
            : browserbaseConfigured
              ? "Automatic draft Browserbase Context"
              : "Fresh session",
          `${window.location.origin}/fixture/form`,
          undefined,
          agentSettings,
        ),
      };
    },
  });
  const busy = agent.status === "submitted" || agent.status === "streaming";
  const resuming = agent.status === "resuming";
  const messages = useMemo(() => projectMessages(agent.data.messages), [agent.data.messages]);
  const visibleMessages = useMemo(() => {
    const confirmedUsers = messages.filter((message) => message.role === "user");
    const pendingMessages = optimisticMessages.filter(
      (optimistic) =>
        !confirmedUsers
          .slice(optimistic.baseUserCount)
          .some((message) => message.text === optimistic.text),
    );
    return [...messages, ...pendingMessages];
  }, [messages, optimisticMessages]);
  const workbench = useMemo(() => projectWorkbench(agent.events), [agent.events]);
  const pendingInput = useMemo(() => findPendingInput(agent.data.messages), [agent.data.messages]);
  const traces = workbench.traces;
  const browser = workbench.browser;
  const captcha = workbench.captcha;
  const activeSkill = workbench.activeSkill;
  const activeContext =
    browser.contextStatus === "draft"
      ? "Draft Context · Capturing"
      : browser.contextId || contextConfigured
        ? "Saved Browserbase Context"
        : browserbaseConfigured
          ? "Draft Context starts with browser"
          : "Fresh session";
  const activeSessionId = agent.session?.sessionId ?? sessionId;
  const firstRequest = messages.find((message) => message.role === "user")?.text;
  const bootstrap = useMemo<Bootstrap>(
    () => ({
      product: "Browsie",
      stagehandVersion: "v4",
      harness: "Eve",
      model: agentSettings.model,
      reasoningEffort: agentSettings.reasoningEffort,
      toolContract: ["run", "snapshot", "screenshot"],
      modelConfigured,
      agentMode: "agent",
      browserMode: browserbaseConfigured ? "browserbase" : "local",
      contexts: [
        {
          name: activeContext,
          configured: contextConfigured || browser.contextStatus === "saved",
        },
      ],
      skills: builtInSkills,
    }),
    [
      activeContext,
      agentSettings,
      browser.contextStatus,
      browserbaseConfigured,
      contextConfigured,
      modelConfigured,
    ],
  );

  useEffect(() => {
    const legacy = parseTaskHistory(window.localStorage.getItem(TASK_HISTORY_KEY));
    void Promise.all(
      legacy.map((item) =>
        fetch("/api/tasks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: item.sessionId }),
        }),
      ),
    )
      .then(() => {
        setAgentSettings(parseAgentSettings(window.localStorage.getItem(AGENT_SETTINGS_KEY)));
        window.localStorage.removeItem(TASK_HISTORY_KEY);
        return fetch("/api/tasks", { cache: "no-store" });
      })
      .then((response) => response.json())
      .then((body: { tasks?: TaskHistoryItem[] }) => setHistory(body.tasks ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!activeSessionId || !firstRequest) return;
    const registration =
      registeredTaskRef.current === activeSessionId
        ? Promise.resolve()
        : fetch("/api/tasks", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sessionId: activeSessionId }),
          }).then((response) => {
            if (!response.ok) throw new Error("Could not save the task in history.");
            registeredTaskRef.current = activeSessionId;
          });
    void registration
      .then(() => fetch("/api/tasks", { cache: "no-store" }))
      .then((response) => response.json())
      .then((body: { tasks?: TaskHistoryItem[] }) => setHistory(body.tasks ?? []))
      .catch(() => undefined);
  }, [activeSessionId, firstRequest, messages.length]);

  useEffect(() => {
    const updateLayout = () => setSidebar(window.innerWidth > 720);
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  const latestTool = useMemo(() => {
    const reversed = [...traces].reverse();
    if (workbench.stopped) return reversed.find((trace) => trace.name === "browser.stop");
    return reversed.find((trace) => trace.kind === "tool" || trace.kind === "browser");
  }, [traces, workbench.stopped]);

  async function submit(text = input) {
    const clean = text.trim();
    if (!clean || resuming) return;
    setInput("");
    setView("chat");
    cancellationObservedRef.current = false;
    setStopStatus("idle");
    setStopError(undefined);

    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    if (!pendingInput?.allowFreeform) {
      setOptimisticMessages((current) => [
        ...current,
        {
          id: optimisticId,
          role: "user",
          text: clean,
          baseUserCount: messages.filter((message) => message.role === "user").length,
        },
      ]);
    }

    try {
      if (pendingInput?.allowFreeform) {
        await agent.respond([{ requestId: pendingInput.requestId, text: clean }]);
        return;
      }
      await agent.send(clean, busy ? { turnPolicy: "steer" } : undefined);
    } catch (error) {
      console.error(error);
    } finally {
      setOptimisticMessages((current) => current.filter((message) => message.id !== optimisticId));
    }
  }

  async function stop() {
    if (!busy || stopRequestRef.current) return;
    setStopStatus("stopping");
    setStopError(undefined);
    const request = agent.cancel();
    stopRequestRef.current = request;
    try {
      const result = await request;
      if (result.status === "no_active_turn") {
        stopRequestRef.current = undefined;
        setStopStatus("idle");
      }
    } catch (error) {
      if (stopRequestRef.current !== request) return;
      stopRequestRef.current = undefined;
      setStopStatus("idle");
      setStopError(
        error instanceof Error
          ? `Browsie could not stop: ${error.message}`
          : "Browsie could not stop. Try again.",
      );
    }
  }

  function newChat() {
    agent.reset();
    cancellationObservedRef.current = false;
    stopRequestRef.current = undefined;
    setInput("");
    setOptimisticMessages([]);
    setStopStatus("idle");
    setStopError(undefined);
    setView("chat");
    History.prototype.replaceState.call(window.history, window.history.state, "", "/s");
    if (window.innerWidth <= 720) setSidebar(false);
  }

  function openWorkspace(nextView: WorkspaceView) {
    setView(nextView);
    if (window.innerWidth <= 720) setSidebar(false);
  }

  function saveAgentSettings(settings: AgentSettings) {
    setAgentSettings(settings);
    window.localStorage.setItem(AGENT_SETTINGS_KEY, JSON.stringify(settings));
  }

  return (
    <div className={`shell ${sidebar ? "" : "sidebar-off"}`}>
      <aside className="sidebar" aria-label="Browsie navigation">
        <button className="brand" onClick={() => openWorkspace("chat")}>
          <Logo />
          <span>Browsie</span>
        </button>
        <button className="new-chat" onClick={newChat}>
          <Plus size={17} /> New task
        </button>
        <div className="side-label">Tasks</div>
        <div className="history-list">
          {history.length ? (
            history.map((item) => (
              <a
                className={`history ${view === "chat" && activeSessionId === item.sessionId ? "active" : ""}`}
                href={`/s/${encodeURIComponent(item.sessionId)}`}
                key={item.sessionId}
              >
                <MessageSquare size={16} />
                <span>{item.title}</span>
              </a>
            ))
          ) : (
            <p className="history-empty">Your browser tasks will be here.</p>
          )}
        </div>
        <div className="sidebar-spacer" />
        <nav className="side-nav" aria-label="Workspace">
          <NavButton
            active={view === "skills"}
            icon={<Wrench size={17} />}
            label="Skills"
            badge={bootstrap.skills.length}
            onClick={() => openWorkspace("skills")}
          />
          <NavButton
            active={view === "context"}
            icon={<Database size={17} />}
            label="Contexts"
            onClick={() => openWorkspace("context")}
          />
          <NavButton
            active={view === "vault"}
            icon={<KeyRound size={17} />}
            label="Vault"
            onClick={() => openWorkspace("vault")}
          />
          <NavButton
            active={view === "settings"}
            icon={<Settings2 size={17} />}
            label="Settings"
            onClick={() => openWorkspace("settings")}
          />
        </nav>
        <div className="profile">
          <div className="avatar">SB</div>
          <div>
            <strong>Local workspace</strong>
            <small>Developer mode</small>
          </div>
          <ChevronDown size={15} />
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="icon-button mobile"
              onClick={() => setSidebar(!sidebar)}
              aria-label="Toggle navigation"
            >
              <Menu size={19} />
            </button>
            {view !== "chat" && (
              <button className="back-button" onClick={() => setView("chat")}>
                <ArrowLeft size={16} /> Browser
              </button>
            )}
            <span>{viewNames[view]}</span>
          </div>
          {view === "chat" && (
            <span
              className={`status ${browser.status} ${bootstrap.modelConfigured ? "" : "setup"}`}
            >
              <i />
              {browser.status === "active"
                ? "Browser live"
                : bootstrap.modelConfigured
                  ? "Ready"
                  : "Setup needed"}
            </span>
          )}
        </header>

        {view === "chat" ? (
          <ChatView
            bootstrap={bootstrap}
            browser={browser}
            captcha={captcha}
            busy={busy}
            error={agent.error?.message}
            input={input}
            latestTool={latestTool}
            messages={visibleMessages}
            pendingInput={pendingInput}
            respond={async (requestId, optionId) => {
              if (resuming) return;
              await agent.respond([{ requestId, optionId }]);
            }}
            resuming={resuming}
            setInput={setInput}
            stop={stop}
            stopError={stopError}
            stopStatus={stopStatus}
            stopped={workbench.stopped}
            submit={submit}
            traces={traces}
          />
        ) : (
          <WorkspacePage
            activeContext={activeContext}
            activeSkill={activeSkill}
            bootstrap={bootstrap}
            agentSettings={agentSettings}
            onSaveAgentSettings={saveAgentSettings}
            view={view}
          />
        )}
      </main>
    </div>
  );
}

function NavButton({
  active,
  badge,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  badge?: number;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      {icon}
      <span className="nav-label">{label}</span>
      {badge !== undefined && <span className="nav-badge">{badge}</span>}
    </button>
  );
}

function ChatView({
  bootstrap,
  browser,
  captcha,
  busy,
  error,
  input,
  latestTool,
  messages,
  pendingInput,
  respond,
  resuming,
  setInput,
  stop,
  stopError,
  stopStatus,
  stopped,
  submit,
  traces,
}: {
  bootstrap: Bootstrap;
  browser: BrowserState;
  captcha?: CaptchaProjection;
  busy: boolean;
  pendingInput?: PendingInput;
  respond: (requestId: string, optionId: string) => Promise<void>;
  error?: string;
  input: string;
  latestTool?: TraceEvent;
  messages: Message[];
  resuming: boolean;
  setInput: (value: string) => void;
  stop: () => Promise<void>;
  stopError?: string;
  stopStatus: StopStatus;
  stopped: boolean;
  submit: (text?: string) => Promise<void>;
  traces: TraceEvent[];
}) {
  const messagesRef = useRef<HTMLElement>(null);
  const nearBottomRef = useRef(true);
  const previousMessageVersionRef = useRef("");
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [browserExpanded, setBrowserExpanded] = useState(true);
  const hasBrowser = browser.provider !== "not-started";
  const latestMessage = messages.at(-1);
  const messageVersion = `${messages.length}:${latestMessage?.id ?? ""}:${latestMessage?.text.length ?? 0}:${busy}`;

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    const changed = previousMessageVersionRef.current !== messageVersion;
    previousMessageVersionRef.current = messageVersion;
    if (!changed) return;

    if (nearBottomRef.current) {
      const frame = requestAnimationFrame(() => {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
        setHasNewMessage(false);
      });
      return () => cancelAnimationFrame(frame);
    }
    setHasNewMessage(true);
  }, [messageVersion]);

  function scrollToLatest() {
    const container = messagesRef.current;
    if (!container) return;
    nearBottomRef.current = true;
    setHasNewMessage(false);
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }

  return (
    <div
      className={`chat-view ${hasBrowser ? "has-browser" : ""} ${browserExpanded ? "browser-open" : "browser-closed"}`}
    >
      <div className="conversation">
        <section
          className="messages"
          ref={messagesRef}
          onScroll={(event) => {
            const nearBottom = isNearScrollBottom(event.currentTarget);
            nearBottomRef.current = nearBottom;
            if (nearBottom) setHasNewMessage(false);
          }}
        >
          {messages.length === 0 ? (
            <div className="welcome">
              <p className="kicker">BROWSIE · BROWSER AGENT</p>
              <h1>
                Your personal
                <br />
                browser agent.
              </h1>
              <p className="lede">
                Ask Browsie to browse, research, and complete tasks on the web. Follow the live
                browser and inspect each action.
              </p>
              {!bootstrap.modelConfigured && (
                <div className="setup-note">
                  <KeyRound size={18} />
                  <div>
                    <strong>Connect the agent model</strong>
                    <span>
                      Add an OpenAI key to <code>.env</code>. Then restart Browsie.
                    </span>
                  </div>
                </div>
              )}
              <div className="starters">
                {starterPrompts.map(({ icon: Icon, label, hint }) => (
                  <button key={label} onClick={() => void submit(label)}>
                    <span className="starter-icon">
                      <Icon size={19} />
                    </span>
                    <span>
                      <strong>{label}</strong>
                      <small>{hint}</small>
                    </span>
                    <span className="arrow">↗</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="thread">
              {messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  <div className="message-body">
                    {message.role === "assistant" && (
                      <div className="message-role">
                        <Logo /> Browsie
                      </div>
                    )}
                    <p>
                      <MessageContent text={message.text} />
                    </p>
                  </div>
                </article>
              ))}
              {pendingInput ? (
                <article className="human-wait">
                  <strong>{pendingInput.prompt}</strong>
                  {pendingInput.options?.map((option) => (
                    <button
                      className="secondary-action"
                      disabled={resuming}
                      key={option.id}
                      onClick={() =>
                        void respond(pendingInput.requestId, option.id).catch(() => undefined)
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                  {pendingInput.allowFreeform ? (
                    <small>Enter the requested value below to resume this same task.</small>
                  ) : null}
                </article>
              ) : null}
              {busy ? (
                <article className="message assistant" role="status" aria-live="polite">
                  <div className="message-body">
                    <div className="message-role">
                      <Logo /> Browsie
                    </div>
                    <div className="thinking">
                      <span />
                      <span />
                      <span />
                    </div>
                    <span className="working-label">
                      {stopStatus === "stopping" ? "Stopping Browsie" : "Browsie is working"}
                    </span>
                  </div>
                </article>
              ) : null}
              {!busy && stopped ? (
                <article
                  className="message assistant stopped-message"
                  role="status"
                  aria-live="polite"
                >
                  <div className="message-body">
                    <div className="message-role">
                      <Logo /> Browsie
                    </div>
                    <p>
                      Stopped. The browser session is closed. Send a message to continue in a
                      replacement browser with the same Context.
                    </p>
                  </div>
                </article>
              ) : null}
              {stopError ? (
                <article className="message assistant error-message">
                  <div className="message-body">
                    <div className="message-role">
                      <Logo /> Browsie
                    </div>
                    <p>{stopError}</p>
                  </div>
                </article>
              ) : null}
              {!busy && error ? (
                <article className="message assistant error-message">
                  <div className="message-body">
                    <div className="message-role">
                      <Logo /> Browsie
                    </div>
                    <p>{error}</p>
                  </div>
                </article>
              ) : null}
            </div>
          )}
        </section>

        {hasNewMessage ? (
          <button type="button" className="new-message-control" onClick={scrollToLatest}>
            <ArrowDown size={14} /> New message
          </button>
        ) : null}

        <footer className="composer-wrap">
          <form
            className="composer"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void submit();
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder={
                busy
                  ? "Send another instruction or change this task…"
                  : "Ask Browsie to use the web…"
              }
              rows={1}
            />
            <div className="composer-meta">
              <span>
                <Sparkles size={14} />{" "}
                {bootstrap.modelConfigured
                  ? `${bootstrap.harness} · ${bootstrap.model} · ${bootstrap.reasoningEffort}`
                  : "Setup needed"}
              </span>
              {busy ? (
                <button
                  type="button"
                  className="stop-control"
                  disabled={stopStatus !== "idle"}
                  aria-label={stopStatus === "idle" ? "Stop Browsie" : "Stopping Browsie"}
                  onClick={() => void stop()}
                >
                  <Square size={10} fill="currentColor" />
                  <span>{stopStatus === "idle" ? "Stop" : "Stopping"}</span>
                </button>
              ) : (
                <button disabled={!input.trim() || resuming} aria-label="Send">
                  <ArrowUp size={18} />
                </button>
              )}
            </div>
          </form>
          <p className="fineprint">One task · one persistent browser · full activity trace</p>
        </footer>
      </div>

      {hasBrowser ? (
        <aside
          className={`browser-dock ${browserExpanded ? "expanded" : "collapsed"}`}
          aria-label="Browser workbench"
        >
          <BrowserDockCard
            browser={browser}
            captcha={captcha}
            expanded={browserExpanded}
            latestTool={latestTool}
            setExpanded={setBrowserExpanded}
            traces={traces}
          />
        </aside>
      ) : null}
    </div>
  );
}

function BrowserDockCard({
  browser,
  captcha,
  expanded,
  latestTool,
  setExpanded,
  traces,
}: {
  browser: BrowserState;
  captcha?: CaptchaProjection;
  expanded: boolean;
  latestTool?: TraceEvent;
  setExpanded: (expanded: boolean) => void;
  traces: TraceEvent[];
}) {
  const [cardView, setCardView] = useState<BrowserCardView>("browser");
  const [fullscreen, setFullscreen] = useState(false);
  const label =
    browser.status === "active"
      ? "Browser live"
      : browser.status === "starting"
        ? "Starting browser"
        : "Browser";

  return (
    <article
      className={`browser-experience ${expanded ? "expanded" : ""} ${fullscreen ? "fullscreen" : ""}`}
    >
      {fullscreen ? (
        <button
          className="browser-backdrop"
          aria-label="Close full screen browser"
          onClick={() => setFullscreen(false)}
        />
      ) : null}
      <div className="browser-surface">
        <header className="browser-card-header">
          <button className="browser-summary" onClick={() => setExpanded(!expanded)}>
            <span className={`live-dot ${browser.status}`} />
            <span>
              <strong>{label}</strong>
              <small>
                {latestTool ? `${latestTool.name} · ${latestTool.summary}` : "Stagehand v4 session"}
              </small>
            </span>
          </button>
          <div className="browser-controls">
            {expanded ? (
              <div className="view-switch" aria-label="Browser card view">
                <button
                  className={cardView === "browser" ? "active" : ""}
                  onClick={() => setCardView("browser")}
                >
                  <Monitor size={14} />
                  <span>Browser</span>
                </button>
                <button
                  className={cardView === "activity" ? "active" : ""}
                  onClick={() => setCardView("activity")}
                >
                  <Activity size={14} />
                  <span>Activity</span>
                </button>
              </div>
            ) : null}
            {expanded ? (
              <button
                className="card-icon"
                onClick={() => setFullscreen(!fullscreen)}
                aria-label={fullscreen ? "Close full screen browser" : "Open full screen browser"}
              >
                {fullscreen ? <X size={16} /> : <Expand size={16} />}
              </button>
            ) : null}
            <button
              className="card-icon"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? "Collapse browser" : "Expand browser"}
            >
              {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>
          </div>
        </header>
        {expanded && captcha?.status === "solving" ? (
          <div className="captcha-progress">Browserbase is solving a CAPTCHA</div>
        ) : null}
        {expanded && captcha?.status === "solved" ? (
          <div className="captcha-progress">CAPTCHA solved</div>
        ) : null}
        {expanded && (captcha?.status === "errored" || captcha?.status === "timed_out") ? (
          <div className="captcha-progress warning">CAPTCHA needs human input in Live View</div>
        ) : null}
        {expanded ? (
          <div className="browser-card-content">
            {cardView === "browser" ? (
              <BrowserPanel browser={browser} latestTool={latestTool} fullscreen={fullscreen} />
            ) : (
              <EventsPanel traces={traces} />
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function WorkspacePage({
  activeContext,
  activeSkill,
  agentSettings,
  bootstrap,
  onSaveAgentSettings,
  view,
}: {
  activeContext: string;
  activeSkill?: string;
  agentSettings: AgentSettings;
  bootstrap: Bootstrap;
  onSaveAgentSettings: (settings: AgentSettings) => void;
  view: Exclude<WorkspaceView, "chat">;
}) {
  const copy = {
    skills: ["Skills", "Focused instructions that Browsie can load for a browser task."],
    context: ["Contexts", "Browser identity and saved site state for persistent work."],
    vault: ["Vault", "Secure credentials that a browser session can use when you allow it."],
    settings: ["Settings", "The agent, browser, and model configuration for this workspace."],
  }[view];

  return (
    <section className="workspace-page">
      <header className="workspace-heading">
        <span>WORKSPACE</span>
        <h1>{copy[0]}</h1>
        <p>{copy[1]}</p>
      </header>
      {view === "skills" && <SkillsPanel skills={bootstrap.skills} active={activeSkill} />}
      {view === "context" && (
        <div className="workspace-stack">
          <ContextStudio configured={bootstrap.browserMode === "browserbase"} />
          <DetailsCard title="How Browsie uses Contexts" icon={<ShieldCheck size={20} />}>
            <p>
              Each login or test session is a single verified, proxied writer. Finish the browser
              and wait for synchronization before reusing its Context.
            </p>
          </DetailsCard>
        </div>
      )}
      {view === "vault" && <VaultStudio />}
      {view === "settings" && (
        <SettingsPanel
          key={`${agentSettings.model}:${agentSettings.reasoningEffort}`}
          bootstrap={bootstrap}
          settings={agentSettings}
          onSave={onSaveAgentSettings}
        />
      )}
    </section>
  );
}

function DetailsCard({
  children,
  icon,
  status,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  status?: string;
  title: string;
}) {
  return (
    <article className="details-card">
      <div className="details-icon">{icon}</div>
      <div className="details-copy">
        <div className="details-title">
          <h2>{title}</h2>
          {status ? <span>{status}</span> : null}
        </div>
        {children}
      </div>
    </article>
  );
}

function SettingsPanel({
  bootstrap,
  onSave,
  settings,
}: {
  bootstrap: Bootstrap;
  onSave: (settings: AgentSettings) => void;
  settings: AgentSettings;
}) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  const valid = draft.model.trim().length >= 2 && draft.model.trim().length <= 100;
  const dirty =
    draft.model !== settings.model || draft.reasoningEffort !== settings.reasoningEffort;

  function submitSettings(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    onSave({ ...draft, model: draft.model.trim() });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <form className="settings-form" onSubmit={submitSettings}>
      <div className="settings-section">
        <div className="settings-section-heading">
          <span>Agent</span>
          <p>Used for the next Browsie message.</p>
        </div>
        <label className="setting-control">
          <span>
            <strong>Model</strong>
            <small>OpenAI Responses model ID</small>
          </span>
          <input
            value={draft.model}
            onChange={(event) => setDraft({ ...draft, model: event.target.value })}
            aria-invalid={!valid}
            spellCheck={false}
          />
        </label>
        <label className="setting-control">
          <span>
            <strong>Reasoning</strong>
            <small>More reasoning can take more time.</small>
          </span>
          <select
            value={draft.reasoningEffort}
            onChange={(event) =>
              setDraft({
                ...draft,
                reasoningEffort: event.target.value as AgentSettings["reasoningEffort"],
              })
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="xhigh">Extra high</option>
          </select>
        </label>
      </div>

      <div className="settings-section">
        <div className="settings-section-heading">
          <span>Runtime</span>
          <p>These values describe the installed Browsie stack.</p>
        </div>
        <ReadOnlySetting label="Harness" value="Eve" detail="Durable agent runtime" />
        <ReadOnlySetting
          label="Browser"
          value={bootstrap.browserMode === "browserbase" ? "Browserbase" : "Local"}
          detail="Stagehand v4"
        />
        <ReadOnlySetting
          label="Hosted identity"
          value={bootstrap.browserMode === "browserbase" ? "Verified + proxy" : "Not active"}
          detail={
            bootstrap.browserMode === "browserbase"
              ? "Required for hosted sessions"
              : "Browserbase is not configured"
          }
        />
      </div>

      <div className="settings-actions">
        <p>{saved ? "Settings saved." : "Model changes apply to the next message."}</p>
        <button
          type="button"
          className="secondary-action"
          disabled={!dirty}
          onClick={() => setDraft(settings)}
        >
          Discard
        </button>
        <button type="submit" className="primary-action" disabled={!dirty || !valid}>
          Save changes
        </button>
      </div>
    </form>
  );
}

function ReadOnlySetting({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <article className="setting-row">
      <div>
        <span>{label}</span>
        <small>{detail}</small>
      </div>
      <strong>{value}</strong>
      <LockKeyhole size={14} aria-label="Fixed setting" />
    </article>
  );
}

function parseAgentSettings(value: string | null): AgentSettings {
  if (!value) return defaultAgentSettings;
  try {
    const parsed = JSON.parse(value) as Partial<AgentSettings>;
    const model = typeof parsed.model === "string" ? parsed.model.trim() : "";
    const efforts: AgentSettings["reasoningEffort"][] = ["low", "medium", "high", "xhigh"];
    return {
      model: model.length >= 2 && model.length <= 100 ? model : defaultAgentSettings.model,
      reasoningEffort: efforts.includes(parsed.reasoningEffort as AgentSettings["reasoningEffort"])
        ? (parsed.reasoningEffort as AgentSettings["reasoningEffort"])
        : defaultAgentSettings.reasoningEffort,
    };
  } catch {
    return defaultAgentSettings;
  }
}

function Logo() {
  return (
    <span className="logo">
      <Compass size={17} strokeWidth={2.6} />
    </span>
  );
}

function MessageContent({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
  return (
    <>
      {parts.map((part, index) => {
        const bold = part.match(/^\*\*(.+)\*\*$/s);
        if (bold) return <strong key={index}>{bold[1]}</strong>;
        const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
        if (link)
          return (
            <a key={index} href={link[2]} target="_blank" rel="noreferrer">
              {link[1]}
            </a>
          );
        return part;
      })}
    </>
  );
}

function BrowserPanel({
  browser,
  fullscreen,
  latestTool,
}: {
  browser: BrowserState;
  fullscreen: boolean;
  latestTool?: TraceEvent;
}) {
  const directLiveUrl = toEmbeddedBrowserbaseLiveViewUrl(browser.liveUrl);
  const [resolvedLiveUrl, setResolvedLiveUrl] = useState<string>();
  const [liveViewStatus, setLiveViewStatus] = useState<"idle" | "loading" | "ready" | "error">(
    directLiveUrl ? "ready" : "idle",
  );
  const [liveViewCapability, setLiveViewCapability] = useState<string>();

  useEffect(() => {
    if (browser.provider !== "browserbase") return;
    const controller = new AbortController();
    fetch("/api/context-capability", {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) =>
        response.ok ? (response.json() as Promise<{ token: string }>) : Promise.reject(),
      )
      .then(({ token }) => setLiveViewCapability(token))
      .catch(() => undefined);
    return () => controller.abort();
  }, [browser.provider]);

  useEffect(() => {
    let cancelled = false;
    const updateState = (status: "idle" | "loading" | "ready", url?: string) => {
      queueMicrotask(() => {
        if (cancelled) return;
        setResolvedLiveUrl(url);
        setLiveViewStatus(status);
      });
    };

    if (directLiveUrl) {
      updateState("ready");
      return () => {
        cancelled = true;
      };
    }
    if (
      browser.provider !== "browserbase" ||
      browser.status !== "active" ||
      !browser.sessionId ||
      !liveViewCapability
    ) {
      updateState("idle");
      return () => {
        cancelled = true;
      };
    }

    const controller = new AbortController();
    updateState("loading");
    fetch(`/api/browser-live-view?sessionId=${encodeURIComponent(browser.sessionId)}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "x-browsie-context-capability": liveViewCapability },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Live view unavailable");
        return response.json() as Promise<{ liveUrl?: string }>;
      })
      .then(({ liveUrl }) => {
        const safeLiveUrl = toEmbeddedBrowserbaseLiveViewUrl(liveUrl);
        if (!safeLiveUrl) throw new Error("Invalid live view URL");
        setResolvedLiveUrl(safeLiveUrl);
        setLiveViewStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLiveViewStatus("error");
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [browser.provider, browser.sessionId, browser.status, directLiveUrl, liveViewCapability]);

  const liveUrl = directLiveUrl ?? resolvedLiveUrl;
  const emptyTitle =
    liveViewStatus === "loading"
      ? "Connecting live view"
      : liveViewStatus === "error"
        ? "Live view unavailable"
        : "No page open";
  const emptyDetail =
    liveViewStatus === "loading"
      ? "Waiting for Browserbase."
      : liveViewStatus === "error"
        ? "Start a new task to open another session."
        : "Run a browser task to see the page.";

  return (
    <div className={`browser-panel ${fullscreen ? "is-fullscreen" : ""}`}>
      <div className="browser-chrome">
        <span />
        <span />
        <span />
        <div>{safeHost(browser.url)}</div>
      </div>
      <div className="browser-viewport">
        {liveUrl ? (
          <iframe
            src={liveUrl}
            title="Live Browserbase session"
            allow="clipboard-read; clipboard-write"
          />
        ) : browser.screenshotDataUrl ? (
          <img src={browser.screenshotDataUrl} alt="Current browser page" />
        ) : (
          <div className="empty-browser">
            <Globe2 size={32} />
            <strong>{emptyTitle}</strong>
            <span>{emptyDetail}</span>
          </div>
        )}
      </div>
      <div className="browser-meta">
        <span>
          <strong>{browser.provider === "browserbase" ? "Browserbase" : "Local"}</strong> provider
        </span>
        <span>
          <ShieldCheck size={14} /> Proxy{" "}
          {browser.provider === "browserbase" && browser.proxies !== false
            ? browser.proxyLocation
              ? formatProxyLocation(browser.proxyLocation)
              : "on"
            : "off"}
        </span>
        <span>
          <ShieldCheck size={14} /> Verified{" "}
          {browser.provider === "browserbase" && browser.verified !== false ? "on" : "off"}
        </span>
        {browser.contextId ? (
          <span>
            <Database size={14} />{" "}
            {browser.contextStatus === "draft" ? "Draft Context · Capturing" : "Saved Context"}
          </span>
        ) : null}
        <span className="tool-name">{latestTool?.name ?? "No tool"}</span>
      </div>
    </div>
  );
}

function SkillsPanel({ skills, active }: { skills: Bootstrap["skills"]; active?: string }) {
  return (
    <div className="skill-list">
      {skills.map((skill) => (
        <article key={skill.id} className={active === skill.name ? "selected" : ""}>
          <div className="skill-glyph">
            {skill.scope === "site" ? (
              <Globe2 size={19} />
            ) : skill.scope === "task" ? (
              <Braces size={19} />
            ) : (
              <Bot size={19} />
            )}
          </div>
          <div>
            <div className="scope">{skill.scope} skill</div>
            <strong>{skill.name}</strong>
            <p>{skill.description}</p>
            <code>{skill.path}</code>
          </div>
          {active === skill.name && <span className="loaded">Loaded</span>}
        </article>
      ))}
    </div>
  );
}

function ContextPanel({ active, configured }: { active?: string; configured?: boolean }) {
  return (
    <article className="context-card">
      <div className="context-icon">
        <Database size={22} />
      </div>
      <div>
        <span>Browser identity</span>
        <h2>{active ?? (configured ? "Saved Browserbase Context" : "Fresh session")}</h2>
        <p>
          {configured
            ? "Cookies and site state can persist between Browserbase sessions."
            : "No saved Context is set. Each new browser starts clean."}
        </p>
      </div>
      <strong className={configured ? "connected" : ""}>
        {configured ? "Connected" : "Fresh"}
      </strong>
    </article>
  );
}

function EventsPanel({ traces }: { traces: TraceEvent[] }) {
  if (!traces.length)
    return (
      <div className="empty-list">
        <CircleDot size={25} />
        <p>Run a task to see its redacted activity.</p>
      </div>
    );
  return (
    <div className="timeline">
      {traces.map((trace) => (
        <article key={trace.id}>
          <span className={`trace-dot ${trace.kind}`} />
          <div>
            <div className="trace-head">
              <strong>{trace.name}</strong>
              <small>
                {trace.durationMs
                  ? `${trace.durationMs} ms`
                  : new Date(trace.at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
              </small>
            </div>
            <p>{trace.summary}</p>
            {trace.code ? (
              <pre className="trace-code">
                <code>{trace.code}</code>
              </pre>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function safeHost(url?: string): string {
  if (!url) return "Stagehand browser";
  try {
    return new URL(url).host;
  } catch {
    return "Stagehand browser";
  }
}

function findPendingInput(source: readonly unknown[]): PendingInput | undefined {
  for (const value of [...source].reverse()) {
    if (!value || typeof value !== "object") continue;
    const parts = (value as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) continue;
    for (const part of [...parts].reverse()) {
      if (!part || typeof part !== "object") continue;
      const record = part as {
        state?: unknown;
        toolMetadata?: { eve?: { inputRequest?: PendingInput } };
      };
      if (record.state !== "approval-requested") continue;
      const request = record.toolMetadata?.eve?.inputRequest;
      if (request?.requestId && request.prompt) return request;
    }
  }
  return undefined;
}

function projectMessages(source: readonly unknown[]): Message[] {
  const messages: Message[] = [];
  for (const value of source) {
    if (!value || typeof value !== "object") continue;
    const message = value as { id?: unknown; role?: unknown; parts?: unknown };
    if (message.role !== "user" && message.role !== "assistant") continue;
    const text = Array.isArray(message.parts)
      ? message.parts
          .map((part) => {
            if (!part || typeof part !== "object") return "";
            const record = part as { type?: unknown; text?: unknown };
            return record.type === "text" && typeof record.text === "string" ? record.text : "";
          })
          .join("")
          .trim()
      : "";
    if (!text) continue;
    messages.push({
      id: typeof message.id === "string" ? message.id : crypto.randomUUID(),
      role: message.role,
      text,
    });
  }
  return messages;
}

function formatProxyLocation(location: { country: string; state?: string; city?: string }): string {
  return [location.city, location.state, location.country].filter(Boolean).join(", ");
}

function projectWorkbench(events: readonly unknown[]): {
  browser: BrowserState;
  traces: TraceEvent[];
  captcha?: CaptchaProjection;
  activeSkill?: string;
  stopped: boolean;
} {
  let browser: BrowserState = initialBrowser;
  let activeSkill: string | undefined;
  let captcha: CaptchaProjection | undefined;
  let stopped = false;
  const traceById = new Map<string, TraceEvent>();

  for (const value of events) {
    if (!value || typeof value !== "object") continue;
    const event = value as {
      type?: unknown;
      data?: unknown;
      meta?: { id?: unknown; at?: unknown };
    };
    if (event.type === "turn.started") stopped = false;
    if (event.type === "turn.cancelled") {
      stopped = true;
      browser = {
        ...browser,
        status: "idle",
        sessionId: undefined,
        liveUrl: undefined,
      };
      const id = typeof event.meta?.id === "string" ? event.meta.id : "browser-canceled";
      traceById.set(id, {
        id,
        at: typeof event.meta?.at === "string" ? event.meta.at : new Date(0).toISOString(),
        kind: "system",
        name: "browser.stop",
        summary: "Stopped the agent turn and closed the active browser session.",
        detail: { contextPreserved: Boolean(browser.contextId) },
      });
      continue;
    }
    if (
      event.type === "turn.completed" ||
      event.type === "turn.failed" ||
      event.type === "session.failed"
    )
      stopped = false;
    if (event.type !== "action.result" || !event.data || typeof event.data !== "object") continue;
    const result = (event.data as { result?: unknown }).result;
    if (!result || typeof result !== "object") continue;
    const action = result as {
      kind?: unknown;
      name?: unknown;
      output?: unknown;
      isError?: unknown;
    };

    if (action.kind === "load-skill-result" && typeof action.name === "string" && !action.isError) {
      activeSkill = action.name;
      continue;
    }
    if (action.kind !== "tool-result" || !action.output || typeof action.output !== "object")
      continue;
    const workbench = (action.output as { workbench?: unknown }).workbench;
    if (!workbench || typeof workbench !== "object") continue;
    const projection = workbench as {
      browser?: BrowserState;
      traces?: TraceEvent[];
      screenshotDataUrl?: string;
      captcha?: CaptchaProjection;
    };
    if (projection.browser) browser = { ...projection.browser };
    if (projection.captcha) captcha = projection.captcha;
    if (projection.screenshotDataUrl) browser.screenshotDataUrl = projection.screenshotDataUrl;
    for (const trace of projection.traces ?? []) traceById.set(trace.id, trace);
  }

  return {
    browser,
    traces: [...traceById.values()],
    captcha,
    activeSkill,
    stopped,
  };
}
