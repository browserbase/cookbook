import assert from "node:assert/strict";
import test from "node:test";
import { exactHostname, loadConfig, publicConfig } from "../src/config.js";
import { config } from "./fixtures.js";

const environment = {
  EVERVAULT_TEAM_ID: config.evervaultTeamId,
  EVERVAULT_APP_ID: config.evervaultAppId,
  EVERVAULT_API_KEY: config.evervaultApiKey,
  BROWSERBASE_API_KEY: config.browserbaseApiKey,
  CARD_TARGET_HOST: config.cardTargetHost,
  BROWSERBASE_CA_CERTIFICATE_ID: config.caCertificateId,
};
test("accepts reader-owned API keys and exposes only public configuration", () => {
  const actual = loadConfig(environment, { requireCertificate: true });
  assert.equal(actual.browserbaseApiKey, config.browserbaseApiKey);
  assert.deepEqual(Object.keys(publicConfig(actual)).sort(), [
    "appId",
    "cardExpiry",
    "cardTargetHostname",
    "teamId",
  ]);
});
test("rejects missing credentials, placeholders, certificate, and invalid ports without echoing values", () => {
  assert.throws(
    () => loadConfig({ ...environment, EVERVAULT_API_KEY: "<your-key>" }),
    /EVERVAULT_API_KEY/,
  );
  assert.throws(
    () =>
      loadConfig(
        { ...environment, BROWSERBASE_CA_CERTIFICATE_ID: "" },
        { requireCertificate: true },
      ),
    /CERTIFICATE/,
  );
  for (const PORT of ["0", "65536", "abc", "4.5"])
    assert.throws(() => loadConfig({ ...environment, PORT }), /PORT/);
});
test("requires an exact public hostname, never wildcard, localhost, IP, URL, or port", () => {
  assert.equal(exactHostname(" Cards.Example.com "), "cards.example.com");
  for (const value of [
    "*",
    "*.example.com",
    "localhost",
    "test.localhost",
    "app.local",
    "127.0.0.1",
    "https://cards.example.com",
    "cards.example.com:443",
    "cards.example.com/path",
  ]) {
    assert.throws(() => exactHostname(value));
  }
});
