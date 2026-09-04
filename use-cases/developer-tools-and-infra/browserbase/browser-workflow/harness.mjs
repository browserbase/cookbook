// ════════════════════════════════════════════════════════════════════════
//  harness.mjs — Browse-as-Code runtime on Anthropic Managed Agents.
//
//  The orchestration (parallel/forEach/retry/verify) is deterministic JS.
//  Each agent() leaf = ONE Anthropic Managed Agent session: Anthropic hosts
//  the loop AND the container, and the result returns over this same API
//  connection — no infra, no tunnel, no callback.
//
//  Requirements: Node 18+ and ANTHROPIC_API_KEY. Nothing else.
//  Self-bootstrapping: on first run it creates (then forever reuses) an agent
//  named "browser-workflow-agent" and a cloud environment named "bac-env"
//  in YOUR workspace. No hardcoded IDs — works for anyone with a key.
//
//  Run an emitted program:   ANTHROPIC_API_KEY=... node my.workflow.mjs
//  Optional env overrides:
//    BAC_AGENT_ID        use an existing managed agent instead of bootstrapping
//    BAC_AGENT_NAME      bootstrap name        (default "browser-workflow-agent")
//    BAC_ENV_NAME        environment name      (default "bac-env")
//    BAC_MODEL           bootstrap model       (default "claude-opus-4-8")
//    BAC_CONCURRENCY     max concurrent leaves (default 6)
//    ANTHROPIC_BASE_URL  API host override
// ════════════════════════════════════════════════════════════════════════

import { readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJournal, fingerprint } from "./journal.mjs";

const KEY = process.env.ANTHROPIC_API_KEY;
const BASE = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
const AGENT_NAME = process.env.BAC_AGENT_NAME || "browser-workflow-agent";
const ENV_NAME = process.env.BAC_ENV_NAME || "bac-env";
const MODEL = process.env.BAC_MODEL || "claude-opus-4-8";
const AGENT_ID = process.env.BAC_AGENT_ID || null;
const HEADERS = {
  "x-api-key": KEY,
  "anthropic-version": "2023-06-01",
  "anthropic-beta": "managed-agents-2026-04-01",
  "content-type": "application/json",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, init) {
  const r = await fetch(`${BASE}${path}`, { headers: HEADERS, ...init });
  const body = await r.text();
  if (!r.ok)
    throw new Error(
      `${init?.method || "GET"} ${path} → ${r.status}: ${body.slice(0, 200)}`,
    );
  return body ? JSON.parse(body) : {};
}

// ── bootstrap: resolve-or-create the agent + environment (once per workspace) ─
// Memoize the in-flight PROMISE (not the result) so concurrently-launched leaves
// share ONE bootstrap and never race to double-create the agent/environment.
let _bootstrap;
function bootstrap() {
  return (_bootstrap ||= doBootstrap());
}
async function doBootstrap() {
  if (!KEY) throw new Error("ANTHROPIC_API_KEY is not set");

  let agentId = AGENT_ID;
  if (!agentId) {
    const agents = await api("/v1/agents?limit=100").catch(() => ({
      data: [],
    }));
    agentId = (agents.data || []).find(
      (a) => a.name === AGENT_NAME && !a.archived_at,
    )?.id;
  }
  if (!agentId) {
    const created = await api("/v1/agents", {
      method: "POST",
      body: JSON.stringify({
        name: AGENT_NAME,
        model: MODEL,
        system:
          "You are a browser-workflow leaf agent. You receive ONE scoped web task and complete it " +
          "autonomously using your tools (web_search, web_fetch, and bash with a headless browser via " +
          "the `browse` CLI if available — run `browse --help` to check). Prefer the cheapest approach " +
          "that works: search/fetch first; drive a browser only when pages are JS-heavy or interactive. " +
          "If a site blocks you and you cannot recover, say so explicitly rather than inventing data. " +
          "Never fabricate prices, URLs, or facts. When asked for JSON, return ONLY raw JSON.",
        tools: [{ type: "agent_toolset_20260401" }],
      }),
    });
    agentId = created.id;
    log(`  ⚙ bootstrapped agent "${AGENT_NAME}" (${agentId})`);
  }

  const envs = await api("/v1/environments?limit=100").catch(() => ({
    data: [],
  }));
  let envId = (envs.data || []).find(
    (e) => e.name === ENV_NAME && !e.archived_at,
  )?.id;
  if (!envId) {
    envId = (
      await api("/v1/environments", {
        method: "POST",
        body: JSON.stringify({
          name: ENV_NAME,
          config: { type: "cloud", networking: { type: "unrestricted" } },
        }),
      })
    ).id;
    log(`  ⚙ bootstrapped environment "${ENV_NAME}" (${envId})`);
  }

  return { agentId, envId };
}

// ── concurrency limiter ───────────────────────────────────────────────────
function createLimiter(max) {
  let active = 0;
  const q = [];
  const pump = () => {
    if (active >= max || !q.length) return;
    active++;
    const { fn, res, rej } = q.shift();
    Promise.resolve()
      .then(fn)
      .then(res, rej)
      .finally(() => {
        active--;
        pump();
      });
  };
  return (fn) =>
    new Promise((res, rej) => {
      q.push({ fn, res, rej });
      pump();
    });
}
const limit = createLimiter(Number(process.env.BAC_CONCURRENCY || 6));

const runtimeVersion = fingerprint(readFileSync(fileURLToPath(import.meta.url), "utf8"));
let workflowJournal;
function getWorkflowJournal() {
  if (workflowJournal) return workflowJournal;
  const explicitId = process.env.BAC_WORKFLOW_ID;
  const explicitVersion = process.env.BAC_WORKFLOW_VERSION;
  let workflow;
  let directory;
  if (explicitId) {
    if (!explicitId.trim() || !explicitVersion?.trim()) {
      throw new Error("BAC_WORKFLOW_ID requires a nonempty BAC_WORKFLOW_VERSION.");
    }
    workflow = { id: explicitId, version: explicitVersion };
    directory = resolve(process.cwd(), ".browser-workflow-journals");
  } else {
    if (!process.argv[1]) throw new Error("Set BAC_WORKFLOW_ID and BAC_WORKFLOW_VERSION for programmatic workflows.");
    let entry;
    try { entry = realpathSync(process.argv[1]); }
    catch { throw new Error("Cannot identify the workflow entrypoint. Set BAC_WORKFLOW_ID and BAC_WORKFLOW_VERSION."); }
    workflow = { entry, source: fingerprint(readFileSync(entry, "utf8")), version: explicitVersion || null };
    directory = resolve(dirname(entry), ".browser-workflow-journals");
  }
  workflowJournal = createJournal({
    directory: process.env.BAC_JOURNAL_DIR || directory,
    fresh: process.argv.includes("--fresh"),
    identity: {
      workflow, runtimeVersion,
      execution: { base: BASE, agentName: AGENT_NAME, agentId: AGENT_ID,
        environmentName: ENV_NAME, model: MODEL, credentialIdentity: fingerprint(KEY || null),
        contextVersion: process.env.BAC_CONTEXT_VERSION || null },
    },
  });
  return workflowJournal;
}

let CALL = 0;
export const log = (m) => console.log(m);
export const phase = (t) =>
  console.log(`\n━━ ${t} ${"━".repeat(Math.max(0, 52 - t.length))}`);
const trunc = (s, n = 64) => {
  s = String(s);
  return s.length > n ? s.slice(0, n) + "…" : s;
};

// ── THE LEAF: agent() = one Managed Agent session ─────────────────────────
export async function agent(task, opts = {}) {
  if (typeof task !== "string" || !task.trim()) throw new Error("Agent task must be a nonempty string.");
  const snapshot = { resultSchema: opts.resultSchema ?? null, validateRetries: opts.validateRetries ?? 2 };
  fingerprint(snapshot);
  const request = JSON.parse(JSON.stringify(snapshot));
  const ordinal = ++CALL;
  const id = `${ordinal}:${opts.label || "agent"}`;
  const key = fingerprint({ ordinal, task, label: opts.label || "agent",
    resultSchema: request.resultSchema, validateRetries: request.validateRetries });
  const journal = opts.cache === false ? null : getWorkflowJournal();
  if (journal?.has(key)) {
    log(`  ↺ cached   ${id}`);
    return journal.get(key);
  }
  return limit(async () => {
    log(`  ▶ agent    ${id}  «${trunc(task)}»`);
    const out = await leafWithSchema(task, request);
    if (!(out && typeof out === "object" && "_invalid" in out)) journal?.set(key, out);
    return out;
  });
}

async function runManaged(task, { resultSchema } = {}) {
  const { agentId, envId } = await bootstrap();
  const session = await api("/v1/sessions", {
    method: "POST",
    body: JSON.stringify({
      agent: agentId,
      environment_id: envId,
    }),
  });
  const prompt = resultSchema
    ? `${task}\n\nIMPORTANT: Respond with ONLY a single raw JSON object conforming to this JSON Schema — no prose, no markdown fences, nothing before or after the JSON.\nSchema: ${JSON.stringify(resultSchema)}`
    : task;
  await api(`/v1/sessions/${session.id}/events`, {
    method: "POST",
    body: JSON.stringify({
      events: [
        { type: "user.message", content: [{ type: "text", text: prompt }] },
      ],
    }),
  });

  const seen = new Set();
  let answer = "";
  for (let i = 0; i < 240; i++) {
    // ~12 min cap per leaf
    await sleep(3000);
    const ev = await api(`/v1/sessions/${session.id}/events?limit=1000`).catch(
      () => ({ data: [] }),
    );
    for (const e of ev.data || []) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      if (e.type === "agent.message")
        answer += (e.content || [])
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("");
    }
    if ((ev.data || []).some((e) => e.type === "session.status_terminated"))
      break;
    if (
      (ev.data || []).some(
        (e) =>
          e.type === "session.status_idle" &&
          e.stop_reason?.type !== "requires_action",
      )
    )
      break;
  }

  return answer; // raw text; parse + schema-validate + retry handled by leafWithSchema()
}

// ── schema-validate + retry-if-invalid (wraps the managed leaf) ───────────
async function leafWithSchema(task, opts) {
  const { resultSchema } = opts;
  if (!resultSchema) return runManaged(task, opts);
  const tries = opts.validateRetries ?? 2;
  let lastErr = "";
  for (let i = 0; i <= tries; i++) {
    const fix =
      i === 0
        ? ""
        : `\n\nYour previous reply was NOT valid for the schema (${lastErr}). Reply with ONLY the corrected raw JSON object — no prose, no fences.`;
    const text = await runManaged(task + fix, opts);
    const parsed = extractJson(text);
    const { ok, errors } = parsed
      ? validateSchema(parsed, resultSchema)
      : { ok: false, errors: ["no JSON object found"] };
    if (ok) return parsed;
    lastErr = errors.slice(0, 3).join("; ");
    if (i < tries) log(`  ↻ schema-retry ${i + 1}/${tries}: ${lastErr}`);
  }
  log(`  ⚠ schema never satisfied after ${tries} retries: ${lastErr}`);
  return { _invalid: lastErr };
}

export function extractJson(text) {
  const cleaned = String(text)
    .replace(/```json/gi, "")
    .replace(/```/g, "");
  const m = cleaned.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(m ? m[0] : cleaned);
  } catch {
    return null;
  }
}

// minimal JSON-Schema check for the subset we emit (object/array/string/number/
// boolean/null, type-unions, enum, required, nested properties + items).
export function validateSchema(obj, schema) {
  const errors = [];
  const matches = (v, t) =>
    t === "string"
      ? typeof v === "string"
      : t === "number" || t === "integer"
        ? typeof v === "number"
        : t === "boolean"
          ? typeof v === "boolean"
          : t === "array"
            ? Array.isArray(v)
            : t === "object"
              ? v !== null && typeof v === "object" && !Array.isArray(v)
              : t === "null"
                ? v === null
                : true;
  const check = (v, s, path) => {
    if (!s || typeof s !== "object") return;
    const types = Array.isArray(s.type) ? s.type : s.type ? [s.type] : null;
    if (types && !types.some((t) => matches(v, t))) {
      errors.push(
        `${path || "root"}: expected ${types.join("|")}, got ${v === null ? "null" : Array.isArray(v) ? "array" : typeof v}`,
      );
      return;
    }
    if (s.enum && !s.enum.includes(v))
      errors.push(`${path}: "${v}" not in enum`);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const r of s.required || [])
        if (!(r in v)) errors.push(`${path || "root"}: missing "${r}"`);
      for (const [k, ps] of Object.entries(s.properties || {}))
        if (k in v) check(v[k], ps, path ? `${path}.${k}` : k);
    }
    if (Array.isArray(v) && s.items)
      v.forEach((it, i) => check(it, s.items, `${path}[${i}]`));
  };
  check(obj, schema, "");
  return { ok: errors.length === 0, errors };
}

// ── pure in-code logic (no agent, no I/O) ─────────────────────────────────
export function compute(label, fn) {
  log(`  · compute  ${label}`);
  return fn();
}

// ── control flow — the deterministic scaffold ─────────────────────────────
export async function parallel(thunks) {
  return Promise.all(
    thunks.map((t) =>
      Promise.resolve()
        .then(t)
        .catch((e) => {
          log(`  ✗ branch: ${e.message}`);
          return null;
        }),
    ),
  );
}
export async function pipeline(items, ...stages) {
  return Promise.all(
    items.map(async (item, i) => {
      let cur = item;
      for (const s of stages) {
        try {
          cur = await s(cur, item, i);
        } catch (e) {
          log(`  ✗ item[${i}] dropped: ${e.message}`);
          return null;
        }
      }
      return cur;
    }),
  );
}
export async function forEach(items, body) {
  return parallel(items.map((it, i) => () => body(it, i)));
}
export async function until(cond, step, max = 5) {
  for (let i = 0; i < max; i++) {
    const r = await step(i);
    if (await cond(r, i)) return r;
  }
  throw new Error(`until: not met after ${max}`);
}
export async function retry(fn, n = 3) {
  let last;
  for (let i = 0; i < n; i++) {
    try {
      return await fn(i);
    } catch (e) {
      last = e;
      log(`  ↻ retry ${i + 1}/${n}: ${e.message}`);
    }
  }
  throw last;
}
// the load-bearing wall: gate conclusions on fresh-evidence checks
export async function verify(checks) {
  if (!Array.isArray(checks)) throw new Error("Verification checks must be an array.");
  const ids = checks.map(check => check?.id);
  return Promise.all(checks.map(async (check, index) => {
    if (typeof check?.id !== "string" || !check.id.trim() || ids.filter(id => id === check.id).length !== 1) {
      return { id: typeof check?.id === "string" ? check.id : `check-${index}`, pass: false, status: "error", error: "Verification check IDs must be nonempty and unique" };
    }
    try {
      const result = await check.run();
      const pass = result === true;
      const status = pass ? "passed" : result === false ? "failed" : "unknown";
      log(`  ${pass ? "PASS" : "NOT VERIFIED"} verify:${check.id} (${status})`);
      return { id: check.id, pass, status };
    } catch {
      log(`  NOT VERIFIED verify:${check.id} (error)`);
      return { id: check.id, pass: false, status: "error", error: "Verification check threw an error" };
    }
  }));
}
