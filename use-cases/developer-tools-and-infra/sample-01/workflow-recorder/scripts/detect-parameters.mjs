#!/usr/bin/env node
// detect-parameters.mjs — turn trace.json's fill/select/check ops into a
// parameters.manifest.json with auto-named variables.
//
// Two passes:
//   1. Heuristic — pattern detectors + label-derived names + collapse duplicates.
//   2. Optional Claude enrichment — better names, type inference, rationale.
//
// The manifest is *human-editable*. Re-running export after edits regenerates
// the script with the user's chosen names.
//
// Usage: node detect-parameters.mjs <run-id> [--runs-root <dir>] [--no-llm]

import fs from "node:fs";
import path from "node:path";
import { enrichmentCandidates, isSecretOperation, validateSecretOperations } from "./secret-inputs.mjs";
import { allocateParameterNames, validateParameters } from "./parameter-names.mjs";

const args = process.argv.slice(2);
if (!args[0]) {
  console.error(
    "usage: detect-parameters.mjs <run-id> [--runs-root <dir>] [--no-llm]",
  );
  process.exit(2);
}
const runId = args[0];
const useLlm =
  !args.includes("--no-llm") && Boolean(process.env.ANTHROPIC_API_KEY);
const runsRoot = (() => {
  const i = args.indexOf("--runs-root");
  return i !== -1 ? args[i + 1] : path.resolve(process.cwd(), "runs");
})();
const runDir = path.join(runsRoot, runId);

const tracePath = path.join(runDir, "trace.json");
if (!fs.existsSync(tracePath)) {
  console.error(`✗ ${tracePath} not found — run transform-recording.mjs first`);
  process.exit(1);
}
const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
validateSecretOperations(trace.ops);
const manifestPath = path.join(runDir, "parameters.manifest.json");

// Preserve user edits if manifest already exists.
const existing = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : null;

// ── Pattern detectors ─────────────────────────────────────────────

const PATTERNS = [
  {
    name: "date",
    type: "string",
    regex:
      /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:Z|[+\-]\d{2}:?\d{2})?)?$/,
    suggested_name: "date",
  },
  {
    name: "date_us",
    type: "string",
    regex: /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
    suggested_name: "date",
  },
  {
    name: "uuid",
    type: "string",
    regex: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    suggested_name: "id",
  },
  {
    name: "email",
    type: "string",
    regex: /^[^@\s]+@[^@\s]+\.\w{2,}$/,
    suggested_name: "email",
  },
  {
    name: "url",
    type: "string",
    regex: /^https?:\/\/\S+$/,
    suggested_name: "url",
  },
  {
    name: "phone",
    type: "string",
    regex: /^[+\d][\d\s\-().]{6,}$/,
    suggested_name: "phone",
  },
  {
    name: "currency",
    type: "string",
    regex: /^\$\d+(?:\.\d{1,2})?$/,
    suggested_name: "amount",
  },
  {
    name: "prefixed_id",
    type: "string",
    regex: /^[A-Z]{2,}[-_]?\d{3,}$/,
    suggested_name: "id",
  },
  {
    name: "numeric_id",
    type: "string",
    regex: /^\d{4,}$/,
    suggested_name: "id",
  },
  {
    name: "integer",
    type: "number",
    regex: /^-?\d+$/,
    suggested_name: "value",
  },
  {
    name: "decimal",
    type: "number",
    regex: /^-?\d+\.\d+$/,
    suggested_name: "value",
  },
];

function identifierLabel(label) {
  return /\b(id|identifier|account|code|zip|postal|phone|pin|reference)\b/i.test(label || "");
}

function detectPattern(v, label) {
  if (v == null) return null;
  if (Array.isArray(v)) return null;
  const s = String(v);
  if (identifierLabel(label) || /^0\d/.test(s)) {
    return { name: "identifier", type: "string", suggested_name: "id" };
  }
  for (const p of PATTERNS) {
    if (p.regex.test(s)) return p;
  }
  return null;
}

// ── Name normalization ────────────────────────────────────────────

function snakeCase(s) {
  return (s || "")
    .replace(/\*/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .slice(0, 40);
}

function nameForCandidate(c, fallbackIndex) {
  if (c.label) {
    const n = snakeCase(c.label);
    if (n) return n;
  }
  if (c.pattern) return `${c.pattern.suggested_name}_${fallbackIndex}`;
  if (c.type === "checkbox" || c.type === "radio")
    return `flag_${fallbackIndex}`;
  return `text_input_${fallbackIndex}`;
}

// ── Pass 1: heuristic clustering ──────────────────────────────────

const variableOps = trace.ops.filter(
  (op) => !isSecretOperation(op) && (op.op === "fill" || op.op === "select" || op.op === "check"),
);

// Cluster key: label + first selector + tag. Same key → same variable.
function clusterKey(op) {
  const selKey = op.selectors?.[0]
    ? `${op.selectors[0].kind}:${op.selectors[0].value || op.selectors[0].name || ""}`
    : "";
  return JSON.stringify([op.tag, op.label, selKey]);
}

const clusters = new Map();
for (const op of variableOps) {
  const k = clusterKey(op);
  if (!clusters.has(k)) clusters.set(k, []);
  clusters.get(k).push(op);
}

let fallbackIdx = 1;
const candidates = [];
for (const [key, ops] of clusters) {
  const repr = ops[ops.length - 1]; // use last value as "most recent"
  const pattern = detectPattern(repr.value, repr.label);
  const c = {
    label: repr.label,
    tag: repr.tag,
    type: repr.type || null,
    is_check: repr.op === "check",
    source_op_indices: ops.map((o) => o.index),
    original_value: repr.value,
    pattern,
    selectors: repr.selectors,
  };
  c.name = nameForCandidate(c, fallbackIdx++);
  candidates.push(c);
}

// ── Pass 2: Claude enrichment (optional) ──────────────────────────

let llmRationale = null;
if (useLlm && candidates.length > 0) {
  try {
    const enriched = await enrichWithLlm(candidates);
    if (enriched) {
      for (let i = 0; i < candidates.length; i++) {
        const e = enriched[i];
        if (!e) continue;
        if (e.name && /^[a-z_][a-z0-9_]*$/.test(e.name))
          candidates[i].name = e.name;
        if (e.type && /^(string|number|boolean)$/.test(e.type))
          candidates[i].type_hint = e.type;
        if (typeof e.is_variable === "boolean")
          candidates[i].is_variable_hint = e.is_variable;
        candidates[i].rationale = e.rationale || null;
      }
      llmRationale = "claude-haiku-4-5";
    }
  } catch (err) {
    console.warn(
      `⚠ LLM enrichment failed (${err.message}) — falling back to heuristic only`,
    );
  }
}

// ── Resolve final shape ───────────────────────────────────────────

function inferredType(c) {
  if (c.is_check) return "boolean";
  if (c.type === "select-multiple" || Array.isArray(c.original_value)) return "string[]";
  // Browser text is lossless by default. Numeric syntax or an LLM hint alone
  // does not establish that formatting and leading zeros are insignificant.
  const value = String(c.original_value ?? "");
  const number = Number(value);
  if (c.type === "number" && !identifierLabel(c.label) &&
      Number.isFinite(number) && String(number) === value &&
      (!Number.isInteger(number) || Number.isSafeInteger(number))) return "number";
  return "string";
}

const parameters = candidates.map((c, i) => ({
  name: c.name,
  type: inferredType(c),
  is_variable: c.is_variable_hint != null ? c.is_variable_hint : true,
  label: c.label || null,
  source_op_indices: c.source_op_indices,
  original_value: c.original_value,
  pattern_hint: c.pattern?.name || null,
  selector_hint: c.selectors?.[0] || null,
  ...(c.rationale ? { rationale: c.rationale } : {}),
}));

allocateParameterNames(parameters);

// If a previous manifest exists, preserve user-edited names by selector_hint match.
if (existing && Array.isArray(existing.parameters)) {
  const byOpIndex = new Map();
  for (const p of existing.parameters) {
    for (const idx of p.source_op_indices || []) byOpIndex.set(idx, p);
  }
  for (const p of parameters) {
    for (const idx of p.source_op_indices) {
      const prev = byOpIndex.get(idx);
      if (prev) {
        const origAutoName = p.name;
        if (prev.name && prev.name !== p.name) {
          p.name = prev.name;
          p._user_renamed_from = `auto: ${origAutoName}`;
        }
        if (prev.type && prev.type !== p.type) p.type = prev.type;
        if (prev.is_variable != null) p.is_variable = prev.is_variable;
        break;
      }
    }
  }
}

allocateParameterNames(parameters);

const manifest = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  enriched_with: llmRationale,
  parameters,
};

validateParameters(manifest, trace.ops);

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`✓ wrote ${manifestPath}`);
console.log(`  ${parameters.length} candidate parameter(s)`);
for (const p of parameters) {
  const flag = p.is_variable ? "✓" : "·";
  console.log(
    `    ${flag} ${p.name.padEnd(24)} ${p.type.padEnd(8)} ← ${JSON.stringify(p.original_value).slice(0, 40)}${p.label ? `  [${p.label}]` : ""}`,
  );
}
if (existing)
  console.log(
    `  (merged with previous manifest — user-renamed names preserved)`,
  );

// ── LLM enrichment helper ─────────────────────────────────────────

async function enrichWithLlm(cands) {
  // Lazy import so the dep is truly optional.
  let Anthropic;
  try {
    Anthropic = (await import("@anthropic-ai/sdk")).default;
  } catch {
    throw new Error(
      "@anthropic-ai/sdk not installed — run `npm install` first",
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `You are a code-generation assistant that names variables for a recorded browser workflow.

Each candidate represents a value the user typed/selected on a webpage. Your job: for each candidate, decide whether it's a *variable* (something the user would want to change on a future replay, like an order ID or a date range) or a *literal* (a fixed value that's always the same on this workflow, like clicking the "Search" button label or filling a constant field).

For each candidate, return: {"name": "<snake_case_name>", "type": "string|number|boolean", "is_variable": true|false, "rationale": "<one short sentence>"}.

Naming rules:
- snake_case, max 30 chars, valid JS identifier (start with letter or underscore).
- Use the field's label/role as the basis. "Order ID" → "order_id". "Start date" → "start_date".
- Generic UI fields (search query, login email): name them descriptively (search_query, login_email).
- If is_variable is false, the name still matters for traceability — name it after what the value represents.

Type inference: prefer "string" for IDs even if numeric-looking (preserves leading zeros). Use "number" only for genuine numeric quantities (amounts, counts).

Return ONLY a JSON array, one object per candidate, in the same order.`;

  const userPrompt = JSON.stringify({ candidates: enrichmentCandidates(cands) });

  const resp = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  // Try to find a JSON array in the response.
  const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (!match) throw new Error("LLM response had no JSON array");
  return JSON.parse(match[0]);
}
