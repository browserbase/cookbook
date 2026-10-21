const $ = (id) => document.getElementById(id);
let config;
let component;
let encryptedCard;
let runId;
let busy = false;
let pollTimer;

async function api(path, body) {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "x-demo-request": "1",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "The local request failed");
  return data;
}

function showError(message) {
  $("error").textContent = message;
  $("error").hidden = false;
}
function isEncrypted(value) {
  return typeof value === "string" && /^ev:\S{20,}$/.test(value);
}
function destroyCollection() {
  try {
    component?.unmount?.();
  } catch {
    /* Remove the containing element below. */
  }
  try {
    component?.destroy?.();
  } catch {
    /* Remove the containing element below. */
  }
  component = undefined;
  encryptedCard = undefined;
  $("card-collection").replaceChildren();
}

async function mountCollection() {
  try {
    config ??= await api("/api/config");
    if (!window.Evervault)
      throw new Error("Hosted Card Collection did not load. Check network access to Evervault.");
    const evervault = new window.Evervault(config.teamId, config.appId);
    component = evervault.ui.card({
      fields: ["number", "cvc"],
      theme: evervault.ui.themes.clean(),
      autoFocus: true,
      redactCVC: true,
    });
    const accept = (payload) => {
      if (busy || runId) return;
      const card = payload?.card ?? payload?.values?.card ?? component?.values?.card;
      encryptedCard =
        isEncrypted(card?.number) && isEncrypted(card?.cvc)
          ? { number: card.number, cvc: card.cvc }
          : undefined;
      $("create").disabled = !encryptedCard;
      $("collection-status").textContent = encryptedCard
        ? "Encrypted test-card values ready"
        : "Complete the hosted test-card fields";
    };
    component.on("ready", () => {
      $("collection-status").textContent = "Secure collection ready";
    });
    component.on("change", accept);
    component.on("complete", accept);
    component.on("error", () => {
      encryptedCard = undefined;
      $("create").disabled = true;
      showError("The secure frame could not encrypt the test values.");
    });
    component.mount("#card-collection");
  } catch (error) {
    $("collection-status").textContent = "Secure collection unavailable";
    showError(error.message);
  }
}

function setView(prefix, url) {
  const frame = $(`${prefix}-view`);
  // Only render Browserbase's HTTPS Live View. Never render arbitrary provider URLs.
  let valid = false;
  try {
    const parsed = new URL(url);
    valid = parsed.protocol === "https:" && parsed.hostname.endsWith(".browserbase.com");
  } catch {
    /* No active view. */
  }
  if (valid) {
    if (frame.getAttribute("src") !== url) frame.src = url;
  } else frame.removeAttribute("src");
  frame.hidden = !valid;
  $(`${prefix}-placeholder`).hidden = valid;
  document.querySelector(`[data-view="${prefix}"]`).disabled = !valid;
}

function render(state) {
  $("enter").disabled = state.awaitingAction !== "enter_token" || busy;
  $("submit").disabled = state.awaitingAction !== "submit_token" || busy;
  $("stop").disabled = !runId || state.status === "stopping";
  $("status").textContent =
    state.awaitingAction === "enter_token"
      ? "Ready: enter matching tokens in both browsers (45 seconds)"
      : state.awaitingAction === "submit_token"
        ? "Ready: submit both synthetic checkouts (45 seconds)"
        : `Comparison: ${state.status} · cleanup: ${state.cleanupStatus}`;
  setView("proxied", state.proxiedLiveViewUrl);
  setView("control", state.controlLiveViewUrl);
  $("tokens").hidden = !state.displayCardTokens;
  $("number-token").textContent = state.displayCardTokens?.number ?? "";
  $("cvc-token").textContent = state.displayCardTokens?.cvc ?? "";
  $("proxied-result").textContent = state.proxiedOutcome ? "Approved" : "Waiting";
  $("proxied-result").classList.toggle("approved", Boolean(state.proxiedOutcome));
  $("control-result").textContent = state.controlOutcome ? "Declined as expected" : "Waiting";
  $("events").replaceChildren(
    ...state.events.map((event) => {
      const li = document.createElement("li");
      li.textContent = `${event.step}: ${event.detail}`;
      return li;
    }),
  );
  if (state.error) showError(state.error.message);
  const terminal =
    ["succeeded", "failed", "stopped"].includes(state.status) &&
    ["completed", "failed"].includes(state.cleanupStatus);
  if (terminal) {
    runId = undefined;
    $("stop").disabled = true;
    $("reset").hidden = false;
  }
  return terminal;
}

async function poll() {
  if (!runId) return;
  try {
    if (render(await api(`/api/runs/${runId}`))) return;
  } catch {
    showError(
      "Cannot read local run state. Keep this page open and try Stop. Sessions have a server-side timeout.",
    );
    // Clear stale private display values, but keep runId and the Stop control.
    $("number-token").textContent = "";
    $("cvc-token").textContent = "";
    $("tokens").hidden = true;
    $("enter").disabled = true;
    $("submit").disabled = true;
  }
  pollTimer = window.setTimeout(poll, 500);
}

$("create").addEventListener("click", async () => {
  if (busy || runId || !encryptedCard) return;
  busy = true;
  $("create").disabled = true;
  $("error").hidden = true;
  const payload = { encryptedCard: { ...encryptedCard }, expiry: config.cardExpiry };
  destroyCollection();
  $("collection-status").textContent =
    "Secure frame removed; ciphertext sent only to the local backend";
  try {
    const started = await api("/api/card-runs", payload);
    runId = started.runId;
    $("stop").disabled = false;
    await poll();
  } catch {
    showError(
      "Could not start or confirm the comparison. Check local run state and Browserbase before retrying; a lost response may hide an active run.",
    );
    $("reset").hidden = false;
  } finally {
    payload.encryptedCard.number = "";
    payload.encryptedCard.cvc = "";
    busy = false;
  }
});

for (const [id, action] of [
  ["enter", "enter_token"],
  ["submit", "submit_token"],
]) {
  $(id).addEventListener("click", async () => {
    if (busy || !runId) return;
    busy = true;
    $("enter").disabled = true;
    $("submit").disabled = true;
    try {
      await api(`/api/runs/${runId}/advance`, { action });
    } catch (error) {
      showError(error.message);
    } finally {
      busy = false;
    }
  });
}
$("stop").addEventListener("click", async () => {
  if (!runId) return;
  $("stop").disabled = true;
  try {
    await api(`/api/runs/${runId}/stop`, {});
  } catch {
    showError("Stop could not be confirmed. Check the local server and Browserbase dashboard.");
    $("stop").disabled = false;
  }
});
$("reset").addEventListener("click", () => {
  if (!runId && !busy) window.location.reload();
});
$("focus").addEventListener("click", () => {
  const focused = document.body.classList.toggle("focused");
  $("focus").textContent = focused ? "Exit comparison" : "Focus comparison";
  $("focus").setAttribute("aria-pressed", String(focused));
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.body.classList.remove("focused");
    $("focus").textContent = "Focus comparison";
    $("focus").setAttribute("aria-pressed", "false");
  }
});
document.querySelectorAll(".fullscreen").forEach((button) =>
  button.addEventListener("click", () => {
    void $(`${button.dataset.view}-view`)
      .requestFullscreen()
      .catch(() => showError("Full screen is unavailable in this browser."));
  }),
);
void mountCollection();
