const $ = (id) => document.getElementById(id);
let config, component, encryptedCard, runId;
let starting = false;

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
function clearTokens() {
  $("number-token").textContent = $("cvc-token").textContent = "";
  $("tokens").hidden = true;
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
      autoFocus: false,
      redactCVC: true,
    });
    const accept = (payload) => {
      if (starting || runId) return;
      const card = payload?.card ?? payload?.values?.card ?? component?.values?.card;
      encryptedCard =
        isEncrypted(card?.number) && isEncrypted(card?.cvc)
          ? { number: card.number, cvc: card.cvc }
          : undefined;
      $("run").disabled = !encryptedCard;
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
      $("run").disabled = true;
      showError("The secure frame could not encrypt the test values.");
    });
    component.mount("#card-collection");
  } catch (error) {
    $("collection-status").textContent = "Secure collection unavailable";
    showError("Secure collection unavailable. Check Evervault access and reload the page.");
  }
}

async function poll() {
  if (!runId) return;
  try {
    const state = await api(`/api/runs/${runId}`);
    $("status").textContent = `${state.progress} · ${state.status}`;
    $("cancel").disabled = state.status === "stopping";
    $("tokens").hidden = !state.displayCardTokens;
    $("number-token").textContent = state.displayCardTokens?.number ?? "";
    $("cvc-token").textContent = state.displayCardTokens?.cvc ?? "";
    $("results").hidden = false;
    $("proxied-result").textContent = state.proxiedOutcome ? "Approved" : "Not confirmed";
    $("control-result").textContent = state.controlOutcome
      ? "Declined as expected"
      : "Not confirmed";
    $("cleanup-status").textContent = `Session cleanup: ${state.cleanupStatus}`;
    if (state.error) showError(state.error.message);
    if (["succeeded", "failed", "stopped"].includes(state.status)) {
      clearTokens();
      runId = undefined;
      $("cancel").disabled = true;
      if (state.cleanupStatus === "completed") await mountCollection();
      return;
    }
  } catch {
    clearTokens();
    showError(
      "Cannot read run state. Keep this page open and try Cancel. Sessions also have a server timeout.",
    );
  }
  window.setTimeout(poll, 500);
}

$("run").addEventListener("click", async () => {
  if (starting || runId || !encryptedCard) return;
  starting = true;
  $("run").disabled = true;
  $("error").hidden = $("results").hidden = true;
  clearTokens();
  const payload = { encryptedCard: { ...encryptedCard }, expiry: config.cardExpiry };
  destroyCollection();
  $("collection-status").textContent =
    "Hosted frame removed; only ciphertext was sent to the local server.";
  $("status").textContent = "Starting comparison…";
  try {
    const started = await api("/api/card-runs", payload);
    runId = started.runId;
    $("cancel").disabled = false;
  } catch {
    showError(
      "Could not confirm startup. Check the local server and Browserbase before reloading; a lost response may hide an active comparison.",
    );
  } finally {
    payload.encryptedCard.number = payload.encryptedCard.cvc = "";
    starting = false;
  }
  if (runId) await poll();
});
$("cancel").addEventListener("click", async () => {
  if (!runId) return;
  $("cancel").disabled = true;
  try {
    await api(`/api/runs/${runId}/stop`, {});
  } catch {
    showError("Cancel could not be confirmed. Check the local server and Browserbase.");
    $("cancel").disabled = false;
  }
});
void mountCollection();
