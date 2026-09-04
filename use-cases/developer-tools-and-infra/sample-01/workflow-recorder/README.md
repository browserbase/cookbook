# sample_org

Before recording, mark custom secret inputs with `data-private` or `data-redact`.
Recognized password, one-time-code, payment-secret, and secret-named fields are
captured as placeholders. Ordinary fields and page events can still contain
private information; keep recordings private. Legacy password traces must be
re-recorded, and existing artifacts are not retroactively cleaned.

Secret fill steps do not become CLI parameters or model-enrichment candidates.
Replay reads `WORKFLOW_SECRET_<trace index>` from the runtime environment and checks
that it is present before opening a browser. Supply it through your runtime's
secret configuration; do not put its value in the manifest or generated source.
The raw recording file contains normalized `[REC]` interaction events only; other
CDP console and page-domain events are discarded. Unsafe legacy password traces
are rejected and must be re-recorded. Existing recording files are not rewritten.

Multiple selections remain JSON arrays throughout capture, parameter detection,
CLI defaults, and replay. Pass an override as a JSON array of strings, for example
`--regions '["us-east","eu-west"]'`. A single value containing a comma remains
distinct from two selected values.


Record a human walkthrough of a workflow in a real Browserbase browser session, then turn it into a reusable, parameterized [Stagehand](https://github.com/browserbase/stagehand) TypeScript script.

The pitch: a real person clicks through a workflow *once* (orders, payouts, refunds, whatever), the recorder captures every interaction with stable selectors and accessibility labels, then auto-identifies which captured values are variables (`order_id`, `start_date`, …) so the resulting script can be replayed with different inputs.

## How it works

```
1. sample_org record [--context <id>] [--start-url <url>] [...]
        │   - bb sessions create --keep-alive (with your flags)
        │   - opens the live-view URL in your default browser
        │   - spawns `browse cdp` to capture the CDP firehose
        │   - injects recorder.js via Page.addScriptToEvaluateOnNewDocument
        ▼
2. Human drives the live-view window
        │   recorder.js emits console.log("[REC]" + JSON.stringify(op))
        │   → captured in runs/<run-id>/raw.ndjson
        ▼
3. ^C in the terminal → capture stops, transform runs automatically
        │
        ▼
4. sample_org export [<run-id>]
        │   - transform-recording.mjs    raw.ndjson → trace.json
        │   - detect-parameters.mjs      trace.json → parameters.manifest.json
        │   - emit-script.mjs            trace + manifest → stagehand/run.ts
        ▼
5. Review runs/<id>/parameters.manifest.json, rename fields → re-run export
        ▼
6. cd runs/<id>/stagehand && npm install && npx tsx run.ts --order-id ABC-456 ...
```

## Install

Globally:

```bash
git clone <this repo>
cd developer-tools-and-infra/sample-01/workflow-recorder
npm ci
npm test
npm link    # makes the `sample_org` command available globally
```

Or run locally without installing:

```bash
node scripts/cli.mjs <subcommand>
```

### Required tooling

| Tool | Why | Install |
|---|---|---|
| Node 18+ | runs the scripts | https://nodejs.org |
| `bb` CLI | creates and tears down Browserbase sessions | `npm i -g @browserbasehq/cli` |
| `BROWSERBASE_API_KEY` | your Browserbase account | export from `.env` |
| `ANTHROPIC_API_KEY` (optional) | smarter variable-name inference via Claude | export from `.env`; falls back to heuristic-only without it |

> All CDP traffic (injection, navigation, console-event firehose) goes over a single raw WebSocket from this CLI to the BB session's connect URL — no extra browser-side tools required.

## Quickstart

```bash
export BROWSERBASE_API_KEY=...
export ANTHROPIC_API_KEY=...    # optional

# 1. Record — one command, auto-opens the live-view window
sample_org record \
  --start-url https://demo.example.com/orders \
  --timeout 1800

# Drive your workflow in the browser. Ctrl-C the terminal when done.

# 2. Export (transform → detect parameters → emit script)
sample_org export

# 3. Review runs/<id>/parameters.manifest.json — rename auto-named fields,
#    confirm types, mark literals as is_variable: false.

# 4. Re-run export to pick up the edits
sample_org export

# 5. Run the emitted script with new inputs
cd runs/<id>/stagehand
npm install
npx tsx run.ts --order-id ABC-456 --start-date 2026-06-01
```

## Subcommands

```
sample_org record [flags...]     Start a recording session.
sample_org export [<run-id>]     Transform → detect parameters → emit script.
                                     Picks the latest run if no id given.
sample_org list                  List recorded runs.
sample_org help                  Show this.
```

### `record` flags

All of these pass through to `bb sessions create`:

| Flag                | Default          | Purpose |
|---------------------|------------------|---------|
| `--context <id>`    | none             | **Most important.** Record on an authed site without re-logging in. Pair with a tool like `cookie-sync` to populate the context first. |
| `--start-url <url>` | about:blank      | Pre-navigate so step 1 of the emitted script is `page.goto(url)`. |
| `--timeout <s>`     | 1800 (30 min)    | Wall-clock budget for the human to drive. |
| `--region <region>` | account default  | Latency tuning. One of `us-west-2`, `us-east-1`, `eu-central-1`, `ap-southeast-1`. |
| `--proxy`           | off              | Residential proxies for sites that block datacenter IPs. |
| `--verified`        | off              | [Verified Customization](https://docs.browserbase.com/platform/identity/verified-customization) — anti-bot fingerprint / identity tuning for protected target sites. |
| `--viewport <WxH>`  | 1280x800         | Selectors are viewport-stable; replay should match. |
| `--no-open`         | false            | CI / headless — print the URL instead of launching a browser. |
| `--run-id <id>`     | auto-generated   | Override the run directory name. |

The script emitter preserves each actionable trace event in order, including repeated clicks and key presses on the same target. Identical generated code does not establish that two recorded actions are interchangeable.

Variable checkbox steps use the runtime boolean parameter. CLI values must be exactly `true` or `false` (for example, `--include false`); omitted options use the recorded default. Programmatic callers must supply a boolean. Literal checkbox steps retain the recorded state. A checkbox parameter edited to a non-boolean type is rejected during export.

Text-field parameters default to strings, preserving values such as `00123`, long identifiers, and `$12.00`. Numeric-looking text and model suggestions alone do not trigger number conversion. A recorded number input is inferred as numeric only when its value round-trips exactly and its label does not identify an ID or code. You can explicitly edit a manifest parameter to `number` when numeric conversion is intended; existing manifest type edits are preserved.

Parameter names are normalized to lowercase snake_case with a valid leading letter. Repeated labels receive numeric suffixes; conflicting edits are normalized again during detection and recorded in `name_adjustment`. Direct emission rejects invalid or duplicate names, unsupported parameter types, and conflicting operation assignments before writing output.

### `export` flags

| Flag         | Purpose |
|--------------|---------|
| `--no-llm`   | Skip the Claude enrichment pass for variable naming (heuristic only). |

## What the recorder captures

For each interaction:

- **`op`** — `click`, `fill`, `select`, `check`, `submit`, `goto`, `press` (Enter/Tab/Escape).
- **`selectors`** — multiple candidates ranked by stability: `data-testid` → stable `id` → role+accessible-name → unique CSS path → text-normalized XPath. Multiple candidates stored so you can hand-fix the emitted script if the top pick turns out to be brittle.
- **`label`** — `<label>`, `aria-label`, `aria-labelledby`, or `placeholder`. Used to name variables.
- **`value`** — for `fill` / `select` / `check` ops, the typed/selected value.
- **`tag`** / **`role`** / **`type`** — element shape.
- **`url`** — page URL at the moment of interaction.

The recorder pierces shadow DOM via `composedPath()` and intercepts `pushState`/`replaceState`/`popstate` so SPA route changes emit `goto` ops without a full page navigation.

## Parameter manifest

`parameters.manifest.json` example:

```json
{
  "schema_version": 1,
  "parameters": [
    {
      "name": "order_id",
      "type": "string",
      "is_variable": true,
      "label": "Order ID",
      "source_op_indices": [3],
      "original_value": "ORD-12345",
      "pattern_hint": "prefixed_id"
    },
    {
      "name": "search_button_label",
      "type": "string",
      "is_variable": false,
      "label": "Search",
      "source_op_indices": [4],
      "rationale": "UI-button label — appears as a literal click target, not a typed value"
    }
  ]
}
```

The detector:

1. Pulls every `fill` / `select` / `check` op as a candidate.
2. Runs regex pattern detectors (dates, UUIDs, emails, currency, prefixed IDs, numeric IDs, …).
3. If `ANTHROPIC_API_KEY` is set, calls Claude Haiku (with prompt caching) to refine names, types, and `is_variable` rationale.
4. Emits the manifest for human review. **Re-running `export` after edits regenerates the script with your chosen names.**

## Emitted script shape

```ts
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import { parseArgs } from "node:util";

export type RunParams = {
  order_id: string;
  start_date: string;
};

const OutputSchema = z.object({
  // Edit this to describe what to extract at the end of the run.
});

export async function run(params: RunParams) {
  const stagehand = new Stagehand({
    env: process.env.BROWSERBASE_API_KEY ? "BROWSERBASE" : "LOCAL",
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
  });
  await stagehand.init();
  const page = stagehand.page;
  try {
    await page.goto("https://demo.example.com/orders");
    await page.locator('[data-testid="order-id"]').fill(params.order_id);
    await page.locator("#start-date").fill(params.start_date);
    await page.locator('[data-testid="search-btn"]').click();
    // Uncomment to extract:
    // return await stagehand.extract({ instruction: "...", schema: OutputSchema });
    return null;
  } finally {
    await stagehand.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: {
      "order-id":   { type: "string", default: "ORD-12345" },
      "start-date": { type: "string", default: "2026-05-01" },
    },
  });
  run({ order_id: values["order-id"]!, start_date: values["start-date"]! })
    .then(r => r && console.log(JSON.stringify(r, null, 2)))
    .catch(e => { console.error(e); process.exit(1); });
}
```

## Filesystem layout

```
runs/<run-id>/
  recording-config.json     run config: bb session id, viewport, region, flags
  raw.ndjson                CDP firehose (Runtime domain only)
  trace.json                clean op sequence (after transform)
  parameters.manifest.json  variable detection output (human-editable)
  stagehand/
    run.ts                  emitted script
    package.json            stagehand + zod deps
```

## Limitations (today)

- **Single-tab.** Multi-tab / popup capture is on the roadmap.
- **No file-upload capture** — `<input type="file">` interactions are skipped.
- **No drag/drop / canvas / WebGL.**
- **No replay-time self-healing** — the emitted script uses recorded selectors verbatim. If the target site changes its DOM, re-record or hand-edit the script. (Adding `stagehand.observe()` fallback is a planned follow-up.)

## Troubleshooting

- **`browse cdp` exits immediately**: BB session ended. Recreate with `--keep-alive` (the record command does this by default). Check `runs/<id>/cdp-stderr.log` for the underlying error.
- **No `[REC]` events in `raw.ndjson`**: the recorder didn't inject. Check `recording-config.json:injection` — if `error` is set, the CDP attach failed (usually the page never loaded the first document).
- **Recorded selectors break at replay time**: the target site changed its DOM. Either re-record, or hand-edit the emitted `run.ts` to use a more stable selector candidate from `trace.json` (the recorder stores multiple per op).
- **Manifest renames don't take effect**: re-run `sample_org export` after editing — the script isn't regenerated on every save.

## License

MIT.

### Connection interruptions

CDP connection setup and individual commands have a 30-second deadline. Socket closure or error rejects pending commands. An unexpected disconnect stops capture, records `capture_status: interrupted` and `stop_reason` in the recording config, and exits with a failure status. Partial events are retained for review and transformation. Session release cleanup is registered before CDP initialization and attempted once, including initialization failures. Ctrl-C records a normal stop.
