import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);

describe("Stagehand production assets", () => {
  it("copies the extension archive and unpacked extension after Eve builds", async () => {
    const script = await readFile(
      path.join(appRoot, "scripts", "copy-stagehand-assets.mjs"),
      "utf8",
    );
    expect(script).toContain('["assets", "extension"]');
    await execFileAsync(process.execPath, [
      path.join(appRoot, "scripts", "copy-stagehand-assets.mjs"),
    ]);

    await expect(
      access(
        path.join(
          appRoot,
          ".output/server/node_modules/@browserbasehq/stagehand/dist/assets/stagehand-extension.zip",
        ),
      ),
    ).resolves.toBeUndefined();
    await expect(
      access(
        path.join(
          appRoot,
          ".output/server/node_modules/@browserbasehq/stagehand/dist/extension/manifest.json",
        ),
      ),
    ).resolves.toBeUndefined();
  });
});
