import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);
const entry = fileURLToPath(new URL("../index.ts", import.meta.url));
const loader = import.meta.resolve("tsx");
const protectedHtml = '<h2>Secure Area</h2><p>Welcome to the Secure Area</p><a href="/logout">Logout</a>';

for (const format of ["raw", "markdown", "json", "expired", "disabled"]) {
  test(`Fetch ${format}: context serialization and protected-content validation`, async () => {
    const requests = [];
    const server = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      const input = JSON.parse(body);
      requests.push(input);
      if (format === "disabled") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Fetching with a context is not enabled for this project." }));
        return;
      }
      const content = format === "expired" ? "<h2>Login Page</h2>"
        : input.format === "json" ? { heading: "Secure Area", message: "Welcome to the Secure Area" }
        : input.format === "markdown" ? "## Secure Area\nWelcome to the Secure Area\n[Logout](/logout)"
        : protectedHtml;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ statusCode: 200, content, headers: {}, contentType: "text/html", encoding: "utf-8" }));
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const cwd = await mkdtemp(join(tmpdir(), "authenticated-fetch-test-"));
    try {
      const execution = run(process.execPath, ["--import", loader, entry, ["expired", "disabled"].includes(format) ? "raw" : format], {
        cwd,
        env: { ...process.env, BROWSERBASE_API_KEY: "offline-test-key", BROWSERBASE_CONTEXT_ID: "offline-context", BROWSERBASE_BASE_URL: `http://127.0.0.1:${server.address().port}` },
      });
      if (format === "disabled") {
        await assert.rejects(execution, error => error.code === 1 && error.stderr.includes("Browserbase request failed (HTTP 400)"));
        await assert.rejects(readFile(join(cwd, ".audit/page.html")), { code: "ENOENT" });
      } else if (format === "expired") {
        await assert.rejects(execution, error => error.code === 1 && error.stderr.includes("Protected content missing"));
        await assert.rejects(readFile(join(cwd, ".audit/page.html")), { code: "ENOENT" });
      } else {
        const { stdout } = await execution;
        assert.match(stdout, /Protected content verified/);
        const extension = { raw: "html", markdown: "md", json: "json" }[format];
        assert.match(await readFile(join(cwd, `.audit/page.${extension}`), "utf8"), /Welcome to the Secure Area/);
      }
      assert.equal(requests.length, ["raw", "expired", "disabled"].includes(format) ? 1 : 2);
      for (const request of requests) {
        assert.equal(request.contextId, "offline-context");
        assert.equal(request.url, "https://the-internet.herokuapp.com/secure");
        assert.equal(request.allowRedirects, true);
      }
      if (format === "json") assert.deepEqual(requests[1].schema.required, ["heading", "message"]);
    } finally {
      await new Promise(resolve => server.close(resolve));
      await rm(cwd, { recursive: true, force: true });
    }
  });
}
