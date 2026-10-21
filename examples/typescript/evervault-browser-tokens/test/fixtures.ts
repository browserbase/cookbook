import type { AppConfig } from "../src/config.js";

// Deliberately synthetic strings; no captured credentials or token responses.
export const config: AppConfig = {
  evervaultTeamId: "fixture-team",
  evervaultAppId: "fixture-app",
  evervaultApiKey: "fixture-evervault-key",
  browserbaseApiKey: "fixture-browserbase-key",
  caCertificateId: "fixture-certificate",
  cardTargetHost: "cards.example.com",
  port: 4173,
};
export const encryptedCard = () => ({
  number: `ev:${"n".repeat(24)}`,
  cvc: `ev:${"c".repeat(24)}`,
});
export const rawTokens = () => ({
  data: [
    { id: "demo-card-number", value: "4000000000000002" },
    { id: "demo-card-cvc", value: "987" },
  ],
  proxyConfiguration: {
    hostname: "fixture.browser.relay.evervault.app",
    port: 443,
    username: "fixture-user",
    password: "fixture-proxy-value",
  },
});

export async function until(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Test condition timed out");
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
