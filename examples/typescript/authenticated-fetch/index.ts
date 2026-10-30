import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { bb, protectedText, reportError, secureUrl } from "./config.js";

async function main() {
  const contextId = process.env.BROWSERBASE_CONTEXT_ID;
  assert(contextId, "Set BROWSERBASE_CONTEXT_ID in .env after running pnpm login.");
  const format = process.argv[2] ?? "raw";
  assert(format === "raw" || format === "markdown" || format === "json", "Usage: pnpm start [raw|markdown|json]");

  // Authenticated Fetch: https://docs.browserbase.com/platform/fetch/authenticated-fetch
  // The request variable carries contextId, which is not yet declared in the pinned SDK types.
  const request = { url: secureUrl, contextId, allowRedirects: true, format: "raw" as const };
  const raw = await bb.fetchAPI.create(request);
  assert(raw.statusCode === 200 && typeof raw.content === "string" &&
    raw.content.includes(protectedText) && raw.content.includes('href="/logout"'),
    "Protected content missing. Run pnpm login to refresh the context.");

  const response = format === "raw" ? raw : await bb.fetchAPI.create({
    ...request,
    format,
    ...(format === "json" && { schema: {
      type: "object",
      properties: { heading: { type: "string" }, message: { type: "string" } },
      required: ["heading", "message"],
      additionalProperties: false,
    } }),
  });
  const content = typeof response.content === "string"
    ? response.content : JSON.stringify(response.content, null, 2);
  assert(response.statusCode === 200 && content?.includes(protectedText), "Protected content missing from Fetch output.");

  const output = `.audit/page.${{ raw: "html", markdown: "md", json: "json" }[format]}`;
  await mkdir(".audit", { recursive: true, mode: 0o700 });
  await writeFile(output, content, { mode: 0o600 });
  console.log(`Protected content verified. Saved ${format} to ${output}.`);
}

main().catch(reportError);
