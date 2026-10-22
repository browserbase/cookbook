import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop package includes the Browsie Workbench server and MCP entry", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.equal(packageJson.main, "electron/main.cjs");
  assert.ok(
    packageJson.build.extraResources.some(
      (entry) => entry.from === "../.next/standalone" && entry.to === "browsie-server",
    ),
  );
  assert.ok(
    packageJson.build.extraResources.some((entry) => entry.to === "browsie-server/.next/static"),
  );
  assert.ok(packageJson.build.files.includes("dist/**/*"));
  assert.match(packageJson.scripts["dev:mcp:node"], /launcher\.mjs/);
  assert.match(packageJson.scripts["build:mcp"], /http-server\.ts/);
});

test("desktop server starts the Next.js Workbench on the loopback interface", async () => {
  const main = await readFile(new URL("../electron/main.cjs", import.meta.url), "utf8");
  assert.match(main, /standaloneRoot/);
  assert.match(main, /server\.js/);
  assert.match(main, /DEFAULT_EVE_PORT = 4274/);
  assert.match(main, /\.output", "server", "index\.mjs/);
  assert.match(main, /EVE_NEXT_PRODUCTION_PORT/);
  assert.match(main, /EVE_DEV: "1"/);
  assert.match(main, /HOST: "127\.0\.0\.1"/);
  assert.match(main, /HOSTNAME: "127\.0\.0\.1"/);
  assert.match(main, /BROWSIE_MCP_TOKEN/);
  assert.match(main, /BROWSIE_MCP_HTTP_HOST: "127\.0\.0\.1"/);
});
