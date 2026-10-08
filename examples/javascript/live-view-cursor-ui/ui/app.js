const stage = document.querySelector("#stage");
const layer = document.querySelector("#input-layer");
const frame = document.querySelector("#live-frame");
const human = document.querySelector("#human-cursor");
const agent = document.querySelector("#agent-cursor");
const status = document.querySelector("#status");
const sessionLabel = document.querySelector("#session-id");
const loading = document.querySelector("#loading");
const runButton = document.querySelector("#run-agent");
const playwrightButton = document.querySelector("#run-playwright");
const newButton = document.querySelector("#new-session");
let viewport = { width: 1280, height: 800 };
let agentRunning = false;
let humanInside = false;
let agentPoint = null;
let buttons = 0;
let sendQueue = Promise.resolve();
let pendingMove = null;
let moveTimer = null;

function moveCursor(element, x, y) {
  element.style.transform = `translate3d(${x - 2}px,${y - 2}px,0)`;
  element.classList.add("visible");
}

function pulse(element) {
  const ring = element.querySelector(".click-ring");
  ring.classList.remove("pulse");
  void ring.offsetWidth;
  ring.classList.add("pulse");
}

function screenPoint(event) {
  const rect = stage.getBoundingClientRect();
  const localX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
  const localY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
  return {
    x: Math.round((localX / rect.width) * viewport.width),
    y: Math.round((localY / rect.height) * viewport.height),
    localX,
    localY,
  };
}

function send(input) {
  sendQueue = sendQueue
    .catch(() => {})
    .then(async () => {
      const response = await fetch("/api/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("Browser input failed");
    });
  return sendQueue;
}

function flushMove() {
  moveTimer = null;
  if (!pendingMove || agentRunning) return;
  const point = pendingMove;
  pendingMove = null;
  void send({ type: "move", x: point.x, y: point.y, buttons });
}

function showAgentIfNeeded() {
  if (agentRunning && agentPoint) agent.classList.add("visible");
  else agent.classList.remove("visible");
}

layer.addEventListener("pointerenter", () => {
  humanInside = true;
  showAgentIfNeeded();
});
layer.addEventListener("pointerleave", () => {
  humanInside = false;
  human.classList.remove("visible");
  showAgentIfNeeded();
});
layer.addEventListener("pointermove", (event) => {
  const point = screenPoint(event);
  moveCursor(human, point.localX, point.localY);
  if (agentRunning) return;
  pendingMove = point;
  if (!moveTimer) moveTimer = setTimeout(flushMove, 32);
});
layer.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  layer.focus();
  layer.setPointerCapture(event.pointerId);
  const point = screenPoint(event);
  moveCursor(human, point.localX, point.localY);
  pulse(human);
  if (agentRunning) return;
  buttons = 1;
  pendingMove = null;
  void send({ type: "move", x: point.x, y: point.y, buttons: 0 });
  void send({ type: "down", x: point.x, y: point.y });
});
layer.addEventListener("pointerup", (event) => {
  if (event.button !== 0 || agentRunning) return;
  buttons = 0;
  const point = screenPoint(event);
  void send({ type: "up", x: point.x, y: point.y });
});
layer.addEventListener("pointercancel", (event) => {
  if (buttons && !agentRunning) {
    const point = screenPoint(event);
    void send({ type: "up", x: point.x, y: point.y });
  }
  buttons = 0;
});
layer.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    if (agentRunning) return;
    const point = screenPoint(event);
    void send({
      type: "wheel",
      x: point.x,
      y: point.y,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
    });
  },
  { passive: false },
);
layer.addEventListener("keydown", (event) => {
  if (agentRunning || ["Shift", "Control", "Alt", "Meta"].includes(event.key)) {
    event.preventDefault();
    return;
  }
  const key = event.key;
  if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === "v") return;
  if (!event.metaKey && !event.ctrlKey && !event.altKey && key.length === 1) return;
  event.preventDefault();
  const mods = [
    event.ctrlKey && "Control",
    event.metaKey && "Meta",
    event.altKey && "Alt",
    event.shiftKey && "Shift",
  ].filter(Boolean);
  void send({ type: "key", key: [...mods, key].join("+") });
});
layer.addEventListener("beforeinput", (event) => {
  event.preventDefault();
  if (agentRunning || !event.data) return;
  if (event.inputType === "insertText" || event.inputType === "insertCompositionText") {
    void send({ type: "text", text: event.data });
  }
});
layer.addEventListener("paste", (event) => {
  event.preventDefault();
  if (agentRunning) return;
  const text = event.clipboardData?.getData("text/plain");
  if (text) void send({ type: "text", text });
});
window.addEventListener("blur", () => human.classList.remove("visible"));

async function loadSession() {
  const response = await fetch("/api/config", { cache: "no-store" });
  const config = await response.json();
  if (!config.liveViewUrl) throw new Error(config.error || "Live View is not ready");
  viewport = config.viewport;
  sessionLabel.textContent = config.sessionId;
  frame.src = config.liveViewUrl;
  frame.onload = () => loading.classList.add("hidden");
  status.textContent = "Live View is ready";
}

async function startDemo(driver) {
  runButton.disabled = true;
  playwrightButton.disabled = true;
  try {
    const response = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driver }),
    });
    if (!response.ok) throw new Error(`${driver} could not start`);
  } catch (error) {
    status.textContent = error.message;
    runButton.disabled = false;
    playwrightButton.disabled = false;
  }
}
runButton.addEventListener("click", () => void startDemo("stagehand"));
playwrightButton.addEventListener("click", () => void startDemo("playwright"));
newButton.addEventListener("click", async () => {
  newButton.disabled = true;
  loading.classList.remove("hidden");
  status.textContent = "Starting a new Browserbase session";
  try {
    const response = await fetch("/api/new", { method: "POST" });
    if (!response.ok) throw new Error("New session failed");
    await loadSession();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    newButton.disabled = false;
  }
});

const events = new EventSource("/api/events");
events.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.type === "status") status.textContent = message.text;
  if (message.type === "session") sessionLabel.textContent = message.sessionId;
  if (message.type === "agent-state") {
    agentRunning = message.running;
    runButton.disabled = agentRunning;
    playwrightButton.disabled = agentRunning;
    if (agentRunning) agentPoint = null;
    showAgentIfNeeded();
  }
  if (message.type === "agent-pointer") {
    agentPoint = message;
    moveCursor(
      agent,
      (message.x / viewport.width) * stage.clientWidth,
      (message.y / viewport.height) * stage.clientHeight,
    );
    showAgentIfNeeded();
    if (message.click) pulse(agent);
  }
};
loadSession().catch((error) => {
  status.textContent = error.message;
});
