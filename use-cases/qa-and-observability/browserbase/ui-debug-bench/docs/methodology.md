# Methodology

## What this benchmark measures

Most browser evals test whether an agent can *use* a site like an end user. ui-debug-bench tests the maker-side loop: **can browser evidence help a code agent fix an app it has code access to, and verify the fix?**

Each bug eval runs:

```
bug report -> debugger (browser only) -> structured handoff
           -> fixer (code access)     -> localized patch
           -> validation (build)      -> check (deterministic browser assertion)
           -> on failure: the check's exact result feeds the next fix attempt
```

## The strategy ladder (and why the loop looks like it does)

The original prototype tested three strategies on the 18-bug suite (browse interface, Claude agents):

| Strategy | Fixed | What it added |
| --- | ---: | --- |
| One-shot handoff | 6/18 | debug once, fix once |
| Repair loop | 8/18 | on failure, re-browse with a narrower question and fix again |
| **Exact probes** | **10/18** | on failure, run a precise DOM/state probe and feed its JSON to the fixer |

The lesson: **more browsing is less important than sharper post-fix assertions.** The browser needs to be a diagnostic instrument, not only an explorer.

ui-debug-bench therefore ships ONE loop with ablation knobs instead of three strategies:

- `--max-attempts 1` reproduces one-shot.
- `--feedback failure-text` reproduces the repair loop's information level (failure text only).
- `--feedback full` (default) is the exact-probe strategy: the check's whole result object — measurements, passCondition, instructionToFixer — becomes the fixer's evidence.

Two deliberate simplifications vs the prototype (both testable against the suite):

1. **No second debugger browse during repair.** The prototype re-ran the debugger before each repair; the hypothesis encoded here is that the probe payload, not the fresh narrative browse, drove the recoveries. If a re-browse ablation beats this, add it back as a flag.
2. **Oracle and probe are one artifact.** The prototype kept hidden oracles (pass/fail) and targeted probes (diagnostics) as separate code in separate files; they were nearly the same JavaScript. Here every bug has a single `check.ts` whose `passed` gates success and whose full result is the failure feedback.

## Measured results (this harness)

Run 2026-06-09, browse CLI, `claude-opus-4-8`, 2 attempts unless noted. The retained aggregate matrix is below; the private per-bug result artifacts are excluded from this cookbook:

| Strategy | First pass | Final | Wall | Tokens (debug+fix) |
| --- | ---: | ---: | ---: | ---: |
| one-shot (`--max-attempts 1`) | 7/18 | **7/18** | 22 min | 1.1M |
| failure-text feedback | 8/18 | **12/18** | 40 min | 1.7M |
| exact-check feedback (default) | 8/18 | **11/18** | 32 min | 1.7M |

What the data says:

- **Check feedback is the load-bearing mechanism**: +4–5 bugs over one-shot. The bugs recovered at attempt 2 in both feedback modes — `mobile-nav`, `network-empty`, `functional-filter` — are the same bugs the prototype's exact probes recovered, replicated here **without any re-browse**. Simplification #1 is validated: 11–12/18 beats the prototype's 10/18 with less machinery.
- **Full payload vs failure-text is within noise** (one bug, `auth-logout`, n=18). Caveat: our "failure-text" mode still sends the check's precise `passCondition` sentence, which is itself derived from the unified check — so both modes benefit from sharp assertions, and this ablation under-measures the gap to the prototype's vaguer oracle-text. Distinguishing payload value from passCondition value needs more runs or a coarser ablation.
- **The hard core** — `a11y-dialog-focus`, `async-loading`, `mobile-table`, `network-retry`, `state-theme-reset`, `validation-email` — fails in every configuration. These are where better browser primitives (focus state, scroll metrics, network/timing visibility) should show up first.

## Integrity rules

- The **debugger never sees** source code, the check, or pass criteria — only the bug report and the browser.
- The **fixer never sees** the check itself — only its *result*, and only after a failed attempt. The check runs post-fix by construction.
- The **pre-fix check must fail** (`pre_fix_bug_confirmed`) — proving the planted bug actually reproduces before any credit can be earned.
- `files_modified` is computed by hashing the workspace before/after, never by trusting the fixer's own report.
- The bundled apps carry `data-btc-probe` attributes (test hooks, like `data-testid`). Checks prefer them but always include role/text fallbacks; real-world targets won't have them and don't need them.

## Reproduction is model-driven, not scripted

The debugger's reproduction step asks the LLM to write a source-blind probe from the bug report plus the page's accessibility snapshot (`src/agents/repro.ts`). The prototype used keyword heuristics (click buttons matching "Plus"/"Logout"/...) which overfit to the suite; generated probes are what let the harness work on apps it has never seen. Always-fresh agentic runs — never cached scripts.

## Modes

- **Local mode** is the full benchmark: isolated workspace copy, install, dev server, the loop, hashes, reports.
- **Hosted mode** runs the read-only phases (debugger + check) against live deployments — useful for validating checks, comparing browser interfaces, demos, and parallel evidence collection. The committed codebases are the source of truth; the hosted manifest pins each deployment's commit SHA.
- `--browserbase` wraps every browser operation in a fresh Browserbase session — enabling concurrency and session replays.

## Stagehand positioning

The browse CLI is the default interface today. The probe contract is the requirements list for what a low-level browser surface needs to win this benchmark: named DOM snapshots, computed styles, bounding boxes, focus state, eval, deterministic waits. A Stagehand v4-style surface exposing those primitives cleanly should beat text-first CLIs on diagnostic precision — re-run the suite when it lands.
