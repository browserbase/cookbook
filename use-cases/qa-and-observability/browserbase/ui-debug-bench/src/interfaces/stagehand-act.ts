import type { BrowserEvidence, InterfaceName } from "../types.js";
import type { BrowserInterface } from "./base.js";
import { wantsMobileViewport } from "./base.js";
import { StagehandHarness } from "./stagehand-common.js";

export class StagehandActInterface implements BrowserInterface {
  name: InterfaceName = "stagehand-act";

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
      observations.push(`Relevant actions:\n${await harness.observe(`Find controls and page state relevant to this bug: ${input.bugReport}`)}`);
      observations.push(`Act reproduction attempt:\n${await harness.act(`Reproduce this user-facing bug without inspecting source code: ${input.bugReport}`)}`);
      const reproExpression = await input.repro(input.bugReport, snapshot);
      if (reproExpression) {
        const probe = await harness.evaluate(reproExpression);
        observations.push(`Source-blind reproduction probe:\n${JSON.stringify(probe, null, 2)}`);
      }
      observations.push(`Post-reproduction snapshot:\n${await harness.snapshot()}`);
      observations.push(`Extracted diagnosis evidence:\n${await harness.extract(`Extract visible page text and evidence relevant to this bug report: ${input.bugReport}`)}`);
      screenshots.push(...(await harness.screenshot(input.artifactDir, "stagehand-act")));
      return harness.evidence(input.url, observations, screenshots);
    } finally {
      await harness.close();
    }
  }
}
