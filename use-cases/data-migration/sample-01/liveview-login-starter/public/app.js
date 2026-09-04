// Minimal client for the Live View login flow.
//   1. Ask the server for a session  -> render the Live View iframe.
//   2. Customer logs in inside the iframe.
//   3. "Finished" -> tell the server to end the session and save the context.

const el = (id) => document.getElementById(id);
const show = (id) => el(id).classList.remove("hidden");
const hide = (id) => el(id).classList.add("hidden");

let session = null; // { sessionId, contextId, liveViewUrl }
let failedOperation = null;

// Per-platform login instructions, matched against the START_URL host.
// Add an entry here to show steps for another platform.
const PLATFORM_GUIDES = [
  {
    match: "squareup.com",
    name: "Square",
    steps: [
      "Sign in to Square with your email and password.",
      "Enter your verification (MFA) code if Square prompts you.",
      "If Square emails you a magic sign-in link, open your email, copy the link, and paste it into the address bar of this browser session.",
      "Once you reach your Square dashboard, choose “I’ve finished logging in” above.",
    ],
  },
];

function guideFor(startUrl) {
  let host = "";
  try {
    host = new URL(startUrl).hostname;
  } catch {
    return null;
  }
  return PLATFORM_GUIDES.find((g) => host.includes(g.match)) || null;
}

function renderInstructions(startUrl) {
  const guide = guideFor(startUrl);
  if (!guide) {
    hide("instructions");
    return;
  }
  el("platform-name").textContent = guide.name;
  const list = el("instructions-steps");
  list.innerHTML = "";
  for (const step of guide.steps) {
    const li = document.createElement("li");
    li.textContent = step;
    list.appendChild(li);
  }
  show("instructions");
}

async function startSession() {
  failedOperation = null;
  hide("intro");
  hide("error-state");
  show("viewer");
  show("loading");
  hide("liveview");

  try {
    const res = await fetch("/api/session", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to start a session");

    session = data;
    renderInstructions(data.startUrl);
    const frame = el("liveview");
    frame.src = data.liveViewUrl;
    frame.onload = () => {
      hide("loading");
      show("liveview");
    };
  } catch (err) {
    showError(err.message);
  }
}

async function finishSession() {
  if (!session) return;
  el("done").disabled = true;
  el("status-text").textContent = "Saving connection…";
  el("status-dot").classList.remove("live");

  try {
    const res = await fetch("/api/finish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        contextId: session.contextId,
        finishToken: session.finishToken,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save the connection");

    // The context id is what your app stores per-user. Kept out of the customer-facing screen;
    // it's logged here (and written to .env by the server) for the engineer integrating this.
    console.log("Saved context id:", data.contextId);
    failedOperation = null;
    hide("viewer");
    show("done-state");
  } catch (err) {
    failedOperation = "finish";
    showError(err.message);
  }
}

function showError(message) {
  hide("viewer");
  hide("intro");
  el("error-msg").textContent = message;
  show("error-state");
}

el("start").addEventListener("click", startSession);
el("done").addEventListener("click", finishSession);
el("retry").addEventListener("click", async () => {
  el("done").disabled = false;
  el("status-text").textContent = "Live session";
  el("status-dot").classList.add("live");
  if (failedOperation === "finish" && session) {
    hide("error-state");
    show("viewer");
    await finishSession();
    return;
  }
  await startSession();
});
