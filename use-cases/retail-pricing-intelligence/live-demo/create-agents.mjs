// Idempotent agent sync. Matches existing agents by name: creates what's missing,
// updates what drifted, leaves the rest alone. Safe to re-run before every demo.
// Writes agents.json — the manifest the runner and demo server read.
import Browserbase from "@browserbasehq/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AGENTS, RESULT_SCHEMA } from "./agents/definitions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiKey = process.env.BROWSERBASE_API_KEY;
if (!apiKey) {
  console.error("BROWSERBASE_API_KEY is not set.");
  process.exit(1);
}
const bb = new Browserbase({ apiKey });
const DRY = process.argv.includes("--dry-run");

// The API echoes the schema back with object keys in a different order, so a plain
// JSON.stringify compare reports false drift on every run. Sort keys before comparing.
const canonical = (v) =>
  JSON.stringify(v, (_, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(
          Object.keys(val)
            .sort()
            .map((k) => [k, val[k]]),
        )
      : val,
  );

const existing = new Map();
let cursor;
do {
  const page = await bb.agents.list(
    cursor ? { limit: 100, cursor } : { limit: 100 },
  );
  for (const a of page.data) existing.set(a.name, a);
  cursor = page.nextCursor;
} while (cursor);
console.log(`found ${existing.size} existing agent(s) on this account\n`);

const manifest = [];
for (const def of AGENTS) {
  const prior = existing.get(def.name);
  const body = {
    name: def.name,
    systemPrompt: def.systemPrompt,
    resultSchema: RESULT_SCHEMA,
  };

  if (!prior) {
    if (DRY) {
      console.log(`WOULD CREATE  ${def.name}`);
      continue;
    }
    const created = await bb.agents.create(body);
    console.log(`CREATED   ${created.agentId}  ${def.name}`);
    manifest.push({ ...def, agentId: created.agentId });
    continue;
  }

  const drifted =
    prior.systemPrompt !== def.systemPrompt ||
    canonical(prior.resultSchema) !== canonical(RESULT_SCHEMA);
  if (drifted) {
    if (DRY) {
      console.log(`WOULD UPDATE  ${prior.agentId}  ${def.name}`);
      continue;
    }
    await bb.agents.update(prior.agentId, body);
    console.log(`UPDATED   ${prior.agentId}  ${def.name}`);
  } else {
    console.log(`UNCHANGED ${prior.agentId}  ${def.name}`);
  }
  manifest.push({ ...def, agentId: prior.agentId });
}

if (DRY) {
  console.log("\ndry run — nothing written");
  process.exit(0);
}

// Drop the long prompts from the manifest; the definitions file stays the source of truth.
const slim = manifest.map(({ key, name, display, task, agentId }) => ({
  key,
  name,
  display,
  task,
  agentId,
}));
const out = path.join(__dirname, "agents.json");
fs.writeFileSync(
  out,
  JSON.stringify({ syncedAt: new Date().toISOString(), agents: slim }, null, 2),
);
console.log(`\nwrote ${out} — ${slim.length} agent(s) ready`);
