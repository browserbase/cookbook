const status = document.getElementById("status");
const button = document.getElementById("continue");
let encrypted,
  component,
  submitted = false;
async function request(path, body) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    cache: "no-store",
    headers: { "x-demo-request": "1", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Local request failed");
  return response.json();
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
      if (submitted) return;
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
  if (!encrypted || submitted) return;
  submitted = true;
  button.disabled = true;
  try {
    await request("/api/collect", encrypted);
    status.textContent = "Received encrypted card. See the terminal for progress and results.";
  } catch {
    status.textContent = "Receipt could not be confirmed. Check the terminal before restarting.";
  } finally {
    encrypted = undefined;
    component = undefined;
    document.getElementById("card-collection").replaceChildren();
  }
});
void mount();
