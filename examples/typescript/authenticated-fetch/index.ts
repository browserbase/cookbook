import { mkdir, writeFile } from "node:fs/promises";
import { client, protectedText, reportError, requiredEnv, secureUrl } from "./config.js";

async function main(): Promise<void> {
  const bb = client();
  const contextId = requiredEnv("BROWSERBASE_CONTEXT_ID");
  const format = process.argv[2] ?? "raw";
  if (format !== "raw" && format !== "markdown" && format !== "json") {
    throw new Error("Usage: pnpm start [raw|markdown|json]");
  }

  // contextId is in the launch-gated API spec, ahead of the pinned SDK types.
  // A variable preserves the extra field when the SDK serializes this body.
  // Authenticated Fetch: https://docs.browserbase.com/platform/fetch/authenticated-fetch
  const request = { url: secureUrl, contextId, allowRedirects: true, format: "raw" as const };
  const raw = await bb.fetchAPI.create(request);
  if (
    raw.statusCode !== 200 || typeof raw.content !== "string" ||
    !raw.content.includes(protectedText) || !raw.content.includes('href="/logout"')
  ) {
    console.error("Protected content missing. Run pnpm login to refresh the context, then retry.");
    process.exitCode = 1;
    return;
  }

  const response = format === "raw" ? raw : await bb.fetchAPI.create({
    ...request,
    format,
    ...(format === "json" ? {
      schema: {
        type: "object",
        properties: {
          heading: { type: "string", description: "The main page heading" },
          message: { type: "string", description: "The welcome message in the secure area" },
        },
        required: ["heading", "message"],
        additionalProperties: false,
      },
    } : {}),
  });
  if (response.statusCode !== 200) throw new Error("Fetch returned a non-200 status.");
  if (format === "markdown" && (
    typeof response.content !== "string" || !response.content.includes(protectedText)
  )) throw new Error("Protected text missing from Markdown.");
  if (format === "json" && (
    typeof response.content !== "object" || response.content === null ||
    !("heading" in response.content) || typeof response.content.heading !== "string" ||
    !("message" in response.content) || typeof response.content.message !== "string" ||
    !response.content.message.includes(protectedText)
  )) throw new Error("JSON extraction did not contain the expected protected message.");

  const extension = { raw: "html", markdown: "md", json: "json" }[format];
  const output = `.audit/page.${extension}`;
  await mkdir(".audit", { recursive: true, mode: 0o700 });
  await writeFile(output, typeof response.content === "string"
    ? response.content : JSON.stringify(response.content, null, 2), { mode: 0o600 });
  console.log(`Protected content verified. Saved ${format} to ${output}.`);
}

main().catch(reportError);
