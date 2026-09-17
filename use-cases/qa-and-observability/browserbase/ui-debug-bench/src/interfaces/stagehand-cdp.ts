import type { BrowserEvidence, InterfaceName } from "../types.js";
import type { BrowserInterface } from "./base.js";
import { wantsMobileViewport } from "./base.js";
import { StagehandHarness } from "./stagehand-common.js";

/**
 * Low-level interface: no act/observe/extract LLM calls inside the browser
 * layer. Navigation, snapshots, evaluate, and screenshots only — the
 * reproduction expression comes from the debugger's repro builder.
 */
export class StagehandCdpInterface implements BrowserInterface {
  name: InterfaceName = "stagehand-cdp";

  async inspect(input: {
    url: string;
    bugReport: string;
    artifactDir: string;
    repro: (bugReport: string, snapshot: string) => Promise<string | undefined>;
  }): Promise<BrowserEvidence> {
    const harness = new StagehandHarness(this.name);
    const observations: string[] = [];
    const screenshots: string[] = [];
    try {
      const page = await harness.init();
      if (!page) return harness.evidence(input.url, ["Stagehand did not create a page."], []);
      await harness.goto(input.url);
      if (wantsMobileViewport(input.bugReport)) {
        await harness.setViewportSize(375, 700);
      }
      observations.push(`Title: ${await harness.title()}`);
      const snapshot = await harness.snapshot();
      observations.push(`Snapshot:\n${snapshot}`);
      const reproExpression = await input.repro(input.bugReport, snapshot);
      if (reproExpression) {
        const probe = await harness.evaluate(reproExpression);
        observations.push(`Source-blind reproduction probe:\n${JSON.stringify(probe, null, 2)}`);
        observations.push(`Post-reproduction snapshot:\n${await harness.snapshot()}`);
      }
      observations.push(`Visible text:\n${(await harness.pageText()).slice(0, 4000)}`);
      screenshots.push(...(await harness.screenshot(input.artifactDir, "stagehand-cdp")));
      return harness.evidence(input.url, observations, screenshots);
    } finally {
      await harness.close();
    }
  }
}
