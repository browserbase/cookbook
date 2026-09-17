#!/usr/bin/env node
// emit-script.mjs — trace.json + parameters.manifest.json → parameterized Stagehand TS.
//
// The emitted script uses Stagehand's underlying Playwright `page` for
// deterministic replay (selector-based). It reserves `stagehand.act()` /
// `stagehand.observe()` for the P2 self-healing fallback.
//
// Usage: node emit-script.mjs <run-id> [--runs-root <dir>]

import fs from "node:fs";
import path from "node:path";
import { isSecretOperation, validateSecretOperations } from "./secret-inputs.mjs";
import { validateParameters } from "./parameter-names.mjs";

const args = process.argv.slice(2);
if (!args[0]) {
  console.error("usage: emit-script.mjs <run-id> [--runs-root <dir>]");
  process.exit(2);
}
const runId = args[0];
const runsRoot = (() => {
  const i = args.indexOf("--runs-root");
  return i !== -1 ? args[i + 1] : path.resolve(process.cwd(), "runs");
})();
const runDir = path.join(runsRoot, runId);

const tracePath = path.join(runDir, "trace.json");
const manifestPath = path.join(runDir, "parameters.manifest.json");
const configPath = path.join(runDir, "recording-config.json");

for (const p of [tracePath, manifestPath]) {
  if (!fs.existsSync(p)) {
    console.error(
      `✗ ${p} not found — run transform-recording.mjs and detect-parameters.mjs first`,
    );
    process.exit(1);
  }
}

const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
validateSecretOperations(trace.ops);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : null;

const secretIndices = new Set(trace.ops.filter(isSecretOperation).map(op => op.index));
if (manifest.parameters?.some(p => p.source_op_indices?.some(index => secretIndices.has(index)))) {
  throw new Error("Secret inputs cannot appear in the parameter manifest. Re-run detection.");
}
validateParameters(manifest, trace.ops);

// Map op_index → parameter for variable substitution
const paramByOpIndex = new Map();
for (const p of manifest.parameters) {
  if (!p.is_variable) continue;
  for (const idx of p.source_op_indices || []) paramByOpIndex.set(idx, p);
}

// Active parameters (those marked as variables) become the RunParams type.
const activeParams = manifest.parameters.filter((p) => p.is_variable);

// ── Selector picking ──────────────────────────────────────────────

function pickBestSelector(selectors) {
  if (!selectors || !selectors.length) return null;
  // Priority: data-testid CSS > stable-id CSS > unique CSS > XPath > role
  const score = (s) => {
    if (s.kind === "css" && /^\[data-testid=/.test(s.value)) return 0;
    if (s.kind === "css" && /^#[^\s]+$/.test(s.value)) return 1;
    if (s.kind === "css") return 2;
    if (s.kind === "xpath") return 3;
    if (s.kind === "role") return 4;
    return 5;
  };
  return [...selectors].sort((a, b) => score(a) - score(b))[0];
}

// Format a selector for Stagehand's act() — CSS selectors as-is, XPath
// prefixed with "xpath=". Stagehand auto-classifies but explicit prefix
// avoids the V3 Locator's xpath-fallback path that breaks CSS selectors.
function selectorForStagehand(sel) {
  if (!sel) return null;
  if (sel.kind === "css") return sel.value;
  if (sel.kind === "xpath")
    return sel.value.startsWith("xpath=") ? sel.value : `xpath=${sel.value}`;
  if (sel.kind === "role")
    return `role=${sel.role}[name="${(sel.name || "").replace(/"/g, '\\"')}"]`;
  return null;
}

// ── Value emission (literal vs param) ─────────────────────────────

function valueExprFor(op) {
  if (isSecretOperation(op)) return `process.env.WORKFLOW_SECRET_${op.index}!`;
  const p = paramByOpIndex.get(op.index);
  if (p) {
    if (p.type === "number") return `String(params.${p.name})`;
    if (p.type === "boolean") return `String(params.${p.name})`;
    return `params.${p.name}`;
  }
  return JSON.stringify(op.value ?? "");
}

// ── Step emission ─────────────────────────────────────────────────

const lines = [];
let stepNum = 0;
let lastGotoUrl = null;

for (const op of trace.ops) {
  stepNum++;
  const descLabel = op.label || op.tag || op.op;

  if (op.op === "navigation" || op.op === "goto") {
    // Skip pushState/replaceState ops at script generation time — Playwright's
    // navigation events will fire naturally as user actions trigger them.
    // But emit explicit page.goto() for the *first* navigation, since the
    // emitted script needs to start from a clean state.
    if (
      op.url &&
      lastGotoUrl !== op.url &&
      op.reason === "document-loaded" &&
      lines.length === 0
    ) {
      lines.push(`    // Step ${stepNum}: initial navigation`);
      lines.push(`    await page.goto(${JSON.stringify(op.url)});`);
      lines.push(
        `    await page.waitForLoadState("domcontentloaded").catch(() => {});`,
      );
      lines.push("");
      lastGotoUrl = op.url;
    }
    continue;
  }

  const sel = pickBestSelector(op.selectors);
  const center = op.position?.center;

  if (!sel && op.op !== "press" && op.op !== "submit") {
    if (op.op === "click" && center) {
      pushStep(
        `click ${descLabel} (coord fallback — no stable selector)`,
        `await page.mouse.click(${center.x}, ${center.y});`,
      );
      continue;
    }
    lines.push(
      `    // Step ${stepNum}: skipped ${op.op} on ${descLabel} — no usable selector or position`,
    );
    continue;
  }
  const selStr = selectorForStagehand(sel);

  if (op.op === "click") {
    pushStep(`click ${descLabel}`, actCall("click", selStr, descLabel));
  } else if (op.op === "fill") {
    pushStep(
      `fill ${descLabel}`,
      actCall("fill", selStr, descLabel, [valueExprFor(op)]),
    );
  } else if (op.op === "select") {
    const value = valueExprFor(op);
    pushStep(`select ${descLabel}`, actCall("selectOption", selStr, descLabel,
      op.multiple ? [] : [value], op.multiple ? value : null));
  } else if (op.op === "check") {
    const parameter = paramByOpIndex.get(op.index);
    if (parameter) {
      if (parameter.type !== "boolean") throw new Error(`Checkbox parameter ${parameter.name} must have boolean type.`);
      pushStep(`set checkbox ${descLabel}`,
        `if (params.${parameter.name}) { ${actCall("check", selStr, descLabel)} } else { ${actCall("uncheck", selStr, descLabel)} }`);
    } else {
      if (![true, false, "true", "false"].includes(op.value)) throw new Error(`Invalid recorded checkbox value at op ${op.index}.`);
      const label = op.value === true || op.value === "true" ? "check" : "uncheck";
      pushStep(`${label} ${descLabel}`, actCall(label, selStr, descLabel));
    }
  } else if (op.op === "submit") {
    pushStep(
      `${descLabel} submitted`,
      `await page.waitForLoadState("networkidle").catch(() => {});`,
    );
  } else if (op.op === "press") {
    pushStep(
      `press ${op.key}`,
      `await page.keyboard.press(${JSON.stringify(op.key)});`,
    );
  } else {
    lines.push(`    // Step ${stepNum}: unhandled op '${op.op}'`);
  }
}

// Preserve each trace action, even when successive actions emit identical code.
function pushStep(comment, codeLine) {
  lines.push(`    // Step ${stepNum}: ${comment}`);
  lines.push(`    ${codeLine}`);
  lines.push("");
}

function actCall(method, selector, description, args = [], rawArguments = null) {
  const argList = rawArguments ? `, arguments: ${rawArguments}` : args.length ? `, arguments: [${args.join(", ")}]` : "";
  return `await stagehand.act({ description: ${JSON.stringify(description)}, method: ${JSON.stringify(method)}, selector: ${JSON.stringify(selector)}${argList} });`;
}

// ── RunParams type + CLI parser ───────────────────────────────────

const paramsTypeBody = activeParams.length
  ? activeParams
      .map(
        (p) =>
          `  ${p.name}: ${p.type === "number" ? "number" : p.type === "boolean" ? "boolean" : p.type === "string[]" ? "string[]" : "string"};`,
      )
      .join("\n")
  : "  // No variables detected — this script takes no parameters.";

const cliOptions = activeParams.length
  ? activeParams
      .map(
        (p) =>
          `      "${kebab(p.name)}": { type: "string", default: ${JSON.stringify(p.type === "string[]" ? JSON.stringify(p.original_value ?? []) : String(p.original_value ?? ""))} },`,
      )
      .join("\n")
  : "";

const cliPick = activeParams.length
  ? activeParams
      .map((p) => {
        const k = kebab(p.name);
        if (p.type === "number")
          return `      ${p.name}: Number(values["${k}"]),`;
        if (p.type === "boolean")
          return `      ${p.name}: (() => { const value = values["${k}"]; if (value !== "true" && value !== "false") throw new Error(${JSON.stringify(`--${k} must be true or false`)}); return value === "true"; })(),`;
        if (p.type === "string[]")
          return `      ${p.name}: (() => { const value = JSON.parse(values["${k}"]!); if (!Array.isArray(value) || value.some(item => typeof item !== "string")) throw new Error(${JSON.stringify(`--${k} must be a JSON array of strings`)}); return value; })(),`;
        return `      ${p.name}: values["${k}"]!,`;
      })
      .join("\n")
  : "";

// ── Final TS source ───────────────────────────────────────────────

const startUrl = config?.config?.start_url || null;

const script = `#!/usr/bin/env tsx
// Generated by cookbook_example on ${new Date().toISOString()}.
// Source run: ${runId}
// Parameters: ${activeParams.length ? activeParams.map((p) => p.name).join(", ") : "(none)"}
//
// Edit this file freely — it's a regular TypeScript file. If you need to
// regenerate from the trace, re-run \`node scripts/cli.mjs export ${runId}\`.

import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";
import { parseArgs } from "node:util";

export type RunParams = {
${paramsTypeBody}
};

// Edit this schema to describe what you want extracted at the end of the run.
const OutputSchema = z.object({
  // example: title: z.string(),
});
export type Output = z.infer<typeof OutputSchema>;

export async function run(params: RunParams): Promise<Output | null> {
${trace.ops.filter(op => isSecretOperation(op) && op.op === "fill").map(op => `  if (!process.env.WORKFLOW_SECRET_${op.index}) throw new Error("Set WORKFLOW_SECRET_${op.index} in the runtime environment before replay.");`).join("\n")}
${activeParams.filter(p => p.type === "boolean").map(p => `  if (typeof params.${p.name} !== "boolean") throw new Error(${JSON.stringify(`${p.name} must be a boolean`)});`).join("\n")}
${activeParams.filter(p => p.type === "string[]").map(p => `  if (!Array.isArray(params.${p.name}) || params.${p.name}.some(value => typeof value !== "string")) throw new Error(${JSON.stringify(`${p.name} must be an array of strings`)});`).join("\n")}
  const browser = process.env.BROWSERBASE_API_KEY
    ? await browserbase.launch({ apiKey: process.env.BROWSERBASE_API_KEY })
    : await localBrowser.launch();
  const stagehand = await Stagehand.create({ browser });
  const page = await browser.context.activePage();
  if (!page) throw new Error("No active browser page.");

  try {
${lines.join("\n") || "    // (no ops recorded)"}

    // Uncomment to extract structured data from the final page:
    // return (await stagehand.extract("describe what to extract", OutputSchema)).data;
    return null;
  } finally {
    await stagehand.close();
await stagehand.browser.close();
  }
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  const { values } = parseArgs({
    options: {
${cliOptions}
    },
  });
  run({
${cliPick}
  })
    .then((r) => { if (r) console.log(JSON.stringify(r, null, 2)); })
    .catch((e) => { console.error(e); process.exit(1); });
}
`;

const outDir = path.join(runDir, "stagehand");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "run.ts"), script);

// ── package.json for the emitted script ───────────────────────────

const pkg = {
  name: `cookbook_example-${runId}`,
  version: "0.0.1",
  type: "module",
  private: true,
  scripts: {
    start: "tsx run.ts",
  },
  dependencies: {
    "@browserbasehq/stagehand": "*",
    zod: "*",
  },
  devDependencies: {
    tsx: "*",
    typescript: "*",
  },
};
fs.writeFileSync(
  path.join(outDir, "package.json"),
  JSON.stringify(pkg, null, 2) + "\n",
);

console.log(`✓ wrote ${outDir}/run.ts`);
console.log(`  ${trace.ops.length} ops → ${stepNum} step(s)`);
console.log(
  `  ${activeParams.length} parameter(s): ${activeParams.map((p) => p.name).join(", ") || "(none)"}`,
);
console.log(`\n  To run:`);
console.log(
  `    cd ${path.relative(process.cwd(), outDir)} && npm install && npx tsx run.ts ${activeParams.map((p) => `--${kebab(p.name)} <${p.type}>`).join(" ")}`,
);

// ── helpers ──────────────────────────────────────────────────────

function kebab(s) {
  return s.replace(/_/g, "-");
}
