# ui-debug-bench

**Evals for agentic UI debugging: fixing web apps from browser evidence.** A debugger agent with *browser-only* access reproduces a user-reported bug, hands structured evidence to a fixer agent with *code* access, and a deterministic browser **check** verifies the patch — feeding its exact failure back into the next attempt until the bug is fixed.

The headline finding, measured on the bundled 18-bug suite: **more browsing is less important than sharper assertions.** One-shot fixing solves 7/18; feeding the check's exact failure back into the fixer reaches **11–12/18** — with *zero* re-browsing during repair. The browser is a diagnostic instrument, not just an explorer. See [methodology](docs/methodology.md) for the strategy ladder and integrity rules.

| Strategy (browse CLI, claude-opus-4-8) | First pass | Final |
| --- | ---: | ---: |
| One-shot (`--max-attempts 1`) | 7/18 | 7/18 |
| Check-failure feedback (`--feedback failure-text`) | 8/18 | **12/18** |
| Exact-check feedback (default) | 8/18 | **11/18** |

```
bug report -> debugger (browser only) -> handoff -> fixer (code) -> patch
           -> build validation -> CHECK (oracle + diagnostic probe in one)
           -> on failure: the check's exact JSON result -> fixer -> re-check
```

The winning technique is also packaged as a standalone agent skill — [`skill/ui-debugging/`](skill/ui-debugging/SKILL.md) — usable in any repo with no harness; this suite is its regression test.

## Quickstart

```bash
npm ci
npm test
cp .env.example .env        # ANTHROPIC_API_KEY required; Browserbase keys optional

# Fix one tiny starter bug end-to-end (~3 min)
npm run eval -- --target targets/starter/functional-counter

# Zero-install demo: watch a check confirm a live bug (no fixing, hosted app)
npm run eval -- --target targets/bench/interaction-state-lab --bug functional-counter --mode hosted
```

Results land in `results/<run-id>/` (handoffs, patches, check results, screenshots) plus an `aggregate.md` table.

## Run the benchmark

```bash
# The full 18-bug suite, winning strategy (exact check feedback, 2 attempts)
npm run eval -- --target targets/bench

# Ablations — reproduce the strategy ladder
npm run eval -- --target targets/bench --max-attempts 1                 # one-shot
npm run eval -- --target targets/bench --feedback failure-text          # repair loop without the check payload
npm run eval -- --target targets/bench --feedback full                  # exact checks (default)

# Compare browser interfaces
npm run eval -- --target targets/bench --interface stagehand-cdp

# Hosted sweep on Browserbase: 18 live apps, parallel sessions with replays
npm run eval -- --target targets/bench --mode hosted --browserbase --concurrency 6
```

## Test your own app

A **target** is a folder: your app + a list of bugs, each with a report and a check.

```
targets/my-app/
├── target.config.json        # how to install/serve/validate the app
├── app/                      # the codebase (any web app with a dev server)
└── bugs/<bug-id>/
    ├── bug.md                # user report + expected behavior
    ├── check.ts              # the unified oracle + diagnostic check (below)
    └── repair-hints.md       # optional extra guidance for repair attempts
```

`target.config.json`:

```json
{
  "name": "my-app",
  "app": "app",
  "install": "npm ci",
  "serve": "npm run dev -- --port {port}",
  "validate": ["npm run build"],
  "fixerContext": ["src/pages/", "src/"],
  "hosted": { "my-bug": "https://staging.example.com/my-bug" }
}
```

`check.ts` — **the core idea of this repo.** One page-side expression that is both the oracle (gates success) and the diagnostic probe (tells the fixer exactly what's wrong when it fails):

```ts
export default {
  viewport: { width: 375, height: 700 },   // optional
  expression: `(async () => {
    document.querySelector("button")?.click();
    await new Promise((r) => setTimeout(r, 200));
    const nav = document.querySelector("nav");
    const style = nav ? getComputedStyle(nav) : null;
    return {
      passed: !!style && style.display !== "none" && nav.querySelectorAll("a").length > 0,
      matched: nav?.className ?? "none",
      display: style?.display ?? "",
      linkCount: nav?.querySelectorAll("a").length ?? 0,
      passCondition: "opening the menu reveals a visible nav containing links",
      instructionToFixer: "If the matched nav is a hidden desktop nav, make the visible mobile menu the first matching navigation surface after opening."
    };
  })()`
};
```

Then: `npm run eval -- --target targets/my-app`.

The runner validates the check result at runtime. `passed` must be a boolean, `passCondition` a string, and `instructionToFixer`, when present, a string. Values such as `"false"`, numbers, arrays, or missing required fields produce a check error with `ok: false`; they cannot validate a patch. Additional measurement fields are retained for valid results.

Run the local checker regression tests with `node --test tests/check.test.cjs`. These execute the actual checker with a synthetic browser harness and do not launch a browser or call a model.

Integrity is built in: the debugger never sees code or the check; the fixer sees the check's *result* only after a failed attempt; the check must fail pre-fix (proving the bug reproduces); modified files are detected by hashing, not by trusting the model. See [docs/methodology.md](docs/methodology.md).

## What's in the box

| Path | What it is |
| --- | --- |
| `targets/starter/` | 3 tiny single-bug Vite+React fixtures — the five-minute on-ramp |
| `targets/bench/` | the 18-bug benchmark: 6 realistic vibe-coded React apps x 3 planted bugs, with live hosted mirrors (`hosted-manifest.json`, commit-pinned) |
| `src/` | the harness: one loop (`loop.ts`), two agents (debugger + fixer), pluggable browser interfaces (browse CLI default; stagehand-act / stagehand-cdp), check runner, reporting |
| `skill/ui-debugging/` | the winning strategy packaged as an agent skill — use it in any repo, no harness required |
| `docs/methodology.md` | strategy ladder, ablation knobs, integrity rules |

## Configuration

| Env var | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | required — debugger/fixer agents (default model `claude-opus-4-8`, override with `CLAUDE_MODEL`) |
| `BROWSE_TARGET` | browse CLI mode: `local` (default), `cdp-launch` (spawn headless Chrome), `cdp`, `remote` |
| `BROWSERBASE_API_KEY` / `BROWSERBASE_PROJECT_ID` | for `--browserbase` cloud sessions |
| `STAGEHAND_MODEL` | model for stagehand-act's LLM actions |

Bench target apps declare Bun 1.3.12. From a target's `app/` directory, check `bun --version`, install with `bun install --frozen-lockfile`, and serve with `bun run dev`. Keep each app's `bunfig.toml` release-age settings. These six frozen installations were verified independently on the review host; this does not verify target behavior or make the existing registry URLs portable. Starter targets use `npm`. The runner reads install and serve commands from `target.config.json`.

## Notes on the bench apps

The 6 bench codebases were generated with a vibe-coding tool (TanStack Start + shadcn/ui) and then hardened with realistic planted bugs. They carry `data-btc-probe` attributes — test hooks like `data-testid`; checks prefer them but always have role/text fallbacks, and your own targets don't need them. The hosted mirrors are convenience deployments of the committed code (commit SHAs in `hosted-manifest.json`); the committed codebases are the source of truth and can be redeployed anywhere.
