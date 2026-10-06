import { readFileSync, writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { BrowsieBrowserSession } from "../server/browser-session.js";
import type { ConversationState } from "../server/types.js";

const live = process.env.BROWSIE_LIVE_RESTART === "1" && Boolean(process.env.BROWSERBASE_API_KEY),
  phase = process.env.BROWSIE_RESTART_PHASE,
  stateFile = process.env.BROWSIE_RESTART_STATE_FILE;

describe("opt-in Browserbase restart recovery", () => {
  it.runIf(live && phase === "prepare")(
    "leaves a live session for a new process",
    async () => {
      if (!stateFile) throw new Error("The restart state file is required.");
      const state: ConversationState = {
          id: "restart-otp-fixture",
          traces: [],
          browser: { provider: "not-started", status: "idle" },
        },
        session = new BrowsieBrowserSession(state),
        page = `data:text/html,${encodeURIComponent(`
          <title>Restart OTP fixture</title>
          <form id="login">
            <input id="username" />
            <input id="password" type="password" />
            <input id="otp" />
            <button id="submit" type="button" onclick="
              if (document.querySelector('#otp').value === '123456') {
                document.querySelector('#result').textContent = 'OTP accepted after restart';
              }
            ">Continue</button>
          </form>
          <p id="result">Waiting for OTP</p>
        `)}`;
      await session.run([
        { action: "goto", url: page },
        { action: "fill", target: "#username", value: "public-test-user" },
        { action: "fill", target: "#password", value: "public-test-password" },
      ]);
      if (!state.browser.sessionId) throw new Error("Browserbase did not return a session ID.");
      writeFileSync(
        stateFile,
        JSON.stringify({
          id: state.id,
          traces: [],
          browser: {
            provider: "browserbase",
            status: "idle",
            sessionId: state.browser.sessionId,
            url: state.browser.url,
            title: state.browser.title,
          },
        }),
        { mode: 0o600 },
      );
      console.log(JSON.stringify({ status: "parked", remoteSessionKeptAlive: true }));
    },
    60_000,
  );

  it.runIf(live && phase === "resume")(
    "reconnects and enters a code",
    async () => {
      if (!stateFile) throw new Error("The restart state file is required.");
      const saved = JSON.parse(readFileSync(stateFile, "utf8")) as ConversationState,
        session = new BrowsieBrowserSession(saved);
      try {
        await session.run([
          { action: "fill", target: "#otp", value: "123456" },
          { action: "click", target: "#submit" },
        ]);
        const page = await session.snapshot();
        expect(page.tree).toContain("OTP accepted after restart");
        expect(saved.traces.some((event) => event.name === "browser.reattach")).toBe(true);
        console.log(
          JSON.stringify({
            status: "pass",
            reattachedSameSession: true,
            otpAcceptedAfterRestart: true,
          }),
        );
      } finally {
        await session.close();
      }
    },
    60_000,
  );
});
