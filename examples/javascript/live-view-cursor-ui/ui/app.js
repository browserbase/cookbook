const stage = document.querySelector("#stage");
const frame = document.querySelector("#live-frame");
const agent = document.querySelector("#agent-cursor");
const status = document.querySelector("#status");
const sessionLabel = document.querySelector("#session-id");
const loading = document.querySelector("#loading");
const runButton = document.querySelector("#run-agent");
const playwrightButton = document.querySelector("#run-playwright");
const newButton = document.querySelector("#new-session");
let viewport = { width: 1280, height: 800 };
let agentRunning = false;
let agentPoint = null;
let loadedSessionId = null;
let lastPointSeq = 0;
let pollingPointer = false;

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

function showAgentIfNeeded() {
  if (agentRunning && agentPoint) agent.classList.add("visible");
  else agent.classList.remove("visible");
}

async function loadSession() {
  const response = await fetch("/api/config", { cache: "no-store" });
  const config = await response.json();
  if (!config.liveViewUrl) throw new Error(config.error || "Live View is not ready");
  if (config.sessionId === loadedSessionId) return;
  loadedSessionId = config.sessionId;
  viewport = config.viewport;
  sessionLabel.textContent = config.sessionId;
  loading.classList.remove("hidden");
  frame.onload = () => loading.classList.add("hidden");
  frame.src = config.liveViewUrl;
  status.textContent = "Live View is ready";
}

async function pollPointer() {
  if (pollingPointer || document.visibilityState !== "visible") return;
  pollingPointer = true;
  try {
    const response = await fetch("/api/pointer", { cache: "no-store" });
    if (!response.ok) return;
    const snapshot = await response.json();
    if (snapshot.sessionId && snapshot.sessionId !== loadedSessionId) {
      void loadSession().catch((error) => {
        status.textContent = error.message;
      });
    }
    agentRunning = snapshot.running;
    runButton.disabled = agentRunning;
    playwrightButton.disabled = agentRunning;
    if (snapshot.status) status.textContent = snapshot.status;
    if (snapshot.seq !== lastPointSeq && snapshot.point) {
      lastPointSeq = snapshot.seq;
      agentPoint = snapshot.point;
      moveCursor(
        agent,
        (agentPoint.x / viewport.width) * stage.clientWidth,
        (agentPoint.y / viewport.height) * stage.clientHeight,
      );
      if (agentPoint.click) pulse(agent);
    }
    if (!agentRunning) agentPoint = null;
    showAgentIfNeeded();
  } catch (error) {
    status.textContent = String(error.message ?? error);
  } finally {
    pollingPointer = false;
  }
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
  if (message.type === "session" && message.sessionId !== loadedSessionId) {
    void loadSession().catch((error) => {
      status.textContent = error.message;
    });
  }
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
setInterval(() => void pollPointer(), 100);
setInterval(() => {
  if (document.visibilityState === "visible") {
    void loadSession().catch((error) => {
      status.textContent = error.message;
    });
  }
}, 5000);
