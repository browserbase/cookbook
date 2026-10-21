const status = document.getElementById("status");
const button = document.getElementById("continue");
let encrypted, component;
async function request(path, body) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: { "x-demo-request": "1", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Local request failed");
  return data;
}
async function mount() {
  try {
    const config = await request("/api/config");
    const evervault = new window.Evervault(config.teamId, config.appId);
    component = evervault.ui.card({
      fields: ["number", "cvc"],
      theme: evervault.ui.themes.clean(),
      autoFocus: false,
      redactCVC: true,
    });
    component.on("change", (state) => {
      if (!component) return;
      const card = component.values.card;
      encrypted = state.isComplete ? { number: card.number, cvc: card.cvc } : undefined;
      button.disabled = !encrypted;
    });
    component.on("error", () => {
      encrypted = undefined;
      button.disabled = true;
      status.textContent = "Hosted collection failed. Reload to try again.";
    });
    component.mount("#card-collection");
    status.textContent = "Enter the public test number and CVC in the hosted fields.";
  } catch {
    status.textContent = "Hosted collection unavailable. Check Evervault configuration and reload.";
  }
}
button.addEventListener("click", async () => {
  if (!encrypted) return;
  button.disabled = true;
  try {
    status.textContent = "Starting the session…";
    const pending = request("/api/collect", encrypted);
    encrypted = component = undefined;
    document.getElementById("card-collection").replaceChildren();
    const { sessionUrl } = await pending;
    const link = document.getElementById("session");
    link.href = sessionUrl;
    link.hidden = false;
    status.textContent =
      "Session launched. Open Browserbase to watch; see the terminal for final results.";
  } catch (error) {
    status.textContent =
      error instanceof TypeError
        ? "Connection lost. Check the terminal before restarting."
        : error.message;
  }
});
void mount();
