import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { BrowserEvidence, InterfaceName, PrimitiveCall } from "../types.js";
import { runCommand } from "../runtime/process.js";
import type { BrowserInterface } from "./base.js";
import { wantsMobileViewport } from "./base.js";
import { browseTargetArgs, type BrowseTargetConfig } from "./browse-target.js";
import { launchCdpBrowser, type LaunchedCdpBrowser } from "./cdp-launch.js";
import { currentBrowserbaseSession } from "../runtime/browserbase-session.js";

export class BrowseInterface implements BrowserInterface {
  name: InterfaceName = "browse";
  private calls: PrimitiveCall[] = [];

  async inspect(input: {
    url: string;
    bugReport: string;
    artifactDir: string;
    repro: (bugReport: string, snapshot: string) => Promise<string | undefined>;
  }): Promise<BrowserEvidence> {
    this.calls = [];
    const session = `pb-${randomUUID().slice(0, 8)}`;
    let launched: LaunchedCdpBrowser | undefined;
    let target: BrowseTargetConfig;
    const browserbaseSession = currentBrowserbaseSession();
    if (browserbaseSession) {
      target = { mode: "cdp", args: ["--cdp", browserbaseSession.connectUrl, "--session", session], stopSession: session };
    } else if (process.env.BROWSE_TARGET === "cdp-launch") {
      launched = await launchCdpBrowser();
      target = { mode: "cdp-launch", args: ["--cdp", launched.endpoint], stopSession: "default" };
    } else {
      target = browseTargetArgs(session);
    }
    const screenshotPath = join(input.artifactDir, `${session}.png`);
    const observations: string[] = [];
    try {
      observations.push(`Browse target mode: ${target.mode}`);
      if (browserbaseSession) observations.push(`Browserbase session: ${browserbaseSession.dashboardUrl}`);
      if (target.mode === "cdp" || target.mode === "cdp-launch") {
        observations.push(await this.call(["stop", "--session", target.stopSession ?? "default", "--force"], 10000));
      }
      observations.push(await this.call(["open", input.url, ...target.args, "--wait", "networkidle", "--timeout", "45000"], 60000));
      if (!this.lastCallOk()) return this.evidence(input.url, observations, []);
      if (wantsMobileViewport(input.bugReport)) {
        observations.push(await this.call(["viewport", "375", "700", ...target.args, "--scale", "1"], 10000));
      }
      const snapshot = await this.call(["snapshot", ...target.args, "--compact", "--max-depth", "6"], 20000);
      observations.push(snapshot);
      if (!this.lastCallOk()) return this.evidence(input.url, observations, []);
      const reproExpression = await input.repro(input.bugReport, snapshot);
      if (reproExpression) {
        observations.push(await this.call(["eval", reproExpression, ...target.args], 30000));
        observations.push(await this.call(["snapshot", ...target.args, "--compact", "--max-depth", "6"], 20000));
      }
      observations.push(await this.call(["screenshot", ...target.args, "--full-page", "--path", screenshotPath], 20000));
      const screenshots = this.lastCallOk() ? [screenshotPath] : [];
      return this.evidence(input.url, observations, screenshots);
    } finally {
      if (target.stopSession) await this.call(["stop", "--session", target.stopSession, "--force"], 10000);
      if (launched) await launched.stop();
    }
  }

  private async call(args: string[], timeoutMs: number): Promise<string> {
    const command = process.env.BROWSE_CMD ?? "browse";
    const result = await runCommand(command, args, { timeoutMs });
    this.calls.push({
      interface: "browse",
      command: result.command,
      stdout: result.stdout,
      stderr: result.stderr,
      wallClockMs: result.wallClockMs,
      ok: result.code === 0
    });
    return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
  }

  private lastCallOk(): boolean {
    return this.calls[this.calls.length - 1]?.ok === true;
  }

  private evidence(url: string, observations: string[], screenshots: string[]): BrowserEvidence {
    return {
      url,
      observations: observations.filter(Boolean),
      console: [],
      network: [],
      screenshots,
      primitiveCalls: this.calls
    };
  }
}
