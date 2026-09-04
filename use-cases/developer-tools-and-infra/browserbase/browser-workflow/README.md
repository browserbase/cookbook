# browser-workflow — Browse-as-Code

**Turn a broad goal into a deterministic orchestration program whose leaves are fully-agentic
browser-agent loops.** The control flow (fan-out, retries, verification) is fixed, auditable
code; each leaf is one **Anthropic Managed Agent** session that figures out its own sub-task.
*Deterministic envelope, agentic interior.* Zero infrastructure — the only requirement is an
`ANTHROPIC_API_KEY`.

> This is both a **runnable demo** and a reusable **Claude Code skill**. Drop the folder into
> any `.claude/skills/` directory and type `/browser-workflow "<goal>"`, or run the emitted
> `.mjs` programs directly with `node`.

---

## Why this exists (the idea)

Anthropic shipped **dynamic workflows** in Claude Code; Perplexity shipped the same primitive
as "Search-as-Code." The pattern: **the model writes its own orchestration as code, and a
runtime executes it deterministically** — moving the plan *into code* so the agent can't get
lazy, drift, or trust its own unverified output.

Browser tasks are the ideal fit (fan-out, retries, verification, long-horizon), and they map
onto two **bookends** of the Browserbase platform:

- **Build** — a workflow composes the right agents/patterns for a customer's goal and emits a
  re-runnable program. *(this skill)*
- **Improve** — a continual learner reads the verifier's verdicts and tunes it over time.
  The adversarial **`verify()` gate is the join** between them.

The customer-grounded **browser-agent pattern language** lives in `patterns.md`.

## How it works

- **A leaf = one Anthropic Managed Agent session.** Anthropic hosts the agent loop *and* the
  container, so the result returns over the same API connection — **no Vercel, no tunnel, no
  callback, no Browserbase key to run it.** `harness.mjs` **self-bootstraps**: it find-or-creates
  an agent named `browser-workflow-agent` + a cloud env `bac-env` in your workspace (no
  hardcoded IDs — works for anyone with a key).
- **The orchestration is deterministic JS** — `parallel` / `forEach` / `pipeline` / `retry` /
  `until` / `verify` / `compute`. Fan-out is real: each leaf is an independent session, so N
  merchants run as N concurrent sessions.
- **Leaves are contract-bound.** A `resultSchema` is auto-validated and the leaf **re-runs**
  (feeding the exact error back) until the output conforms.
- **`verify()` records each check outcome.** Callers must require affirmative results before a conclusion and use `cache: false` for fresh agent checks. The price example enforces both rules.
- **Patterns vs primitives:** the harness holds *mechanism* (the verbs); `patterns.md` holds the
  *recipes + browser-domain judgment* the generator composes (the moat).

## What's inside

| File | What it is |
|---|---|
| `SKILL.md` | The generator: goal → decompose → steered agent leaves → patterns → emit `*.workflow.mjs` → run |
| `harness.mjs` | The runtime: `agent` (one managed-agent session) + control-flow primitives + self-bootstrap + schema-validate/retry + resume journal |
| `patterns.md` | The pattern library — generic orchestration + browser-native patterns mined from customer calls (the moat) |
| `examples/price-compare.workflow.mjs` | Runnable: fan out across merchants → rank by delivered cost → verify the winner |

## Quickstart

```bash
export ANTHROPIC_API_KEY=<anthropic-api-key> # the ONLY requirement (Node 18+)

# run the example directly:
node examples/price-compare.workflow.mjs --fresh

# parameterize it:
QUERY="AirPods Pro 2" ZIP="10001" MERCHANTS="Amazon,Best Buy,eBay" \
  node examples/price-compare.workflow.mjs --fresh

# or, as a Claude Code skill — generate + run a workflow for any goal:
#   /browser-workflow "monitor 3 competitors' pricing pages and flag changes"
```
First run prints `⚙ bootstrapped agent …` while it creates the managed agent; later runs reuse it.

## Authoring a workflow by hand

```js
import { agent, compute, forEach, retry, verify, phase } from "../harness.mjs";

phase("gather");
const results = await forEach(ITEMS, (it) =>
  retry(() => agent(`<scoped task for ${it}>`, { resultSchema: SHAPE, label: it.name }), 2));

const ranked = compute("rank", () => results.filter(Boolean).sort(/* … */));

phase("verify");
if (!ranked.length) throw new Error("No candidate to verify");
const checks = await verify([{ id: "winner-real", run: () =>
  agent(`Re-check ${ranked[0].url} in a fresh session…`, { resultSchema: CHECK, cache: false })
    .then(v => v.url === ranked[0].url && Number.isFinite(v.price) && v.price === ranked[0].price) }]);
if (checks.length !== 1 || checks.some(check => check.pass !== true)) {
  throw new Error("No verified conclusion; inspect the check results");
}
```

## Example output when coverage is incomplete

Illustrative output, not a live market result:

```text
Provisional comparison only. No verified winner: some merchants or shipping quotes remain unknown
Incomplete merchants: Example merchant
```

The price example ranks only available USD quotes with known shipping to the requested ZIP. Its candidate check bypasses the resume journal and checks both price components, currency, stock, listing URL, and destination. Failed checks or incomplete coverage prevent a winner claim. Amounts exclude tax and separately charged fees; they are not a complete checkout total. Only the candidate is freshly rechecked, so the result is scoped to captured listings rather than current market-wide cheapest pricing.

## Roadmap: the Browserbase-backed leaf

When the Browserbase Agents API ships, swap the leaf behind the *same* `agent()` signature —
the orchestration, patterns, and every emitted `*.workflow.mjs` run unchanged. The harness is
deliberately leaf-agnostic, so it's a one-function change. See `SKILL.md` → Future.

## Caveats
- Managed Agents is in beta (`anthropic-beta: managed-agents-2026-04-01`).
- Today's leaf is **not** Browserbase-backed (local Chromium in Anthropic's sandbox) — fine for
  research/aggregation/monitoring on public pages; auth/bot-walled flows need the BB leaf.
- Each run spends tokens across several managed sessions; start with a small `MERCHANTS`/scope.

## Resume identity and freshness

Completed leaves are saved in `.browser-workflow-journals/` beside the workflow entrypoint. Each versioned journal is scoped to the entrypoint's canonical path and source contents, the harness version, and execution context: API endpoint, model, agent name or explicit ID, environment name, and a credential fingerprint. Credentials and task text are not stored in journal metadata. Results can contain private data; keep journals out of source control.

A leaf is reused only when its position, label, exact task, output schema, and validation retry setting match. Object-property ordering in a schema does not change its identity. The requested schema is copied before queuing work so later mutations cannot change what the saved key represents. Schema-failure sentinels are not cached.

For programmatic workflows without an entrypoint, set both `BAC_WORKFLOW_ID` and `BAC_WORKFLOW_VERSION` to your own stable identity and immutable version. Bump the version whenever workflow logic or external dependencies change. For entrypoint-based workflows, `BAC_WORKFLOW_VERSION` can additionally invalidate results when imported helpers change. Set `BAC_CONTEXT_VERSION` when the contents of a named remote agent or environment change, since their current server-side definitions are not fetched to validate a local cache hit.

`BAC_JOURNAL_DIR` selects another private directory. Symlinked journal files or directory ancestors are rejected; use a canonical directory path. Journal files use mode `0600`, and newly created directories use `0700`. Writes lock the journal, merge existing entries, flush a temporary file, and atomically replace the file. Malformed or mismatched journals fail closed, including with `--fresh`; inspect and move aside the affected file before retrying. Only remove a stale `.lock` after confirming no workflow writer is running.

`--fresh` skips all prior results for this invocation and replaces the current namespace on its first successful write. Legacy `.journal.json` files are never read or migrated automatically. A leaf can also use `{ cache: false }` to skip both replay and persistence, which is appropriate for a fresh-evidence check. A cache hit establishes identity, not freshness: it does not recheck a website or rerun the agent. Journaling completed results does not provide exactly-once execution or prevent two processes from running the same leaf concurrently.

Credential-free regression checks:

```sh
node --test tests/journal.test.mjs
```

These checks exercise the actual harness and journal code with temporary workflows, synthetic execution contexts, and a stubbed managed leaf. They verify task/schema/workflow isolation, resume, fresh behavior, defensive copies, locked merging, malformed files, and atomic-write failures. No real journals, credentials, or managed-agent sessions are accessed.

## Verification results

`verify()` retains one result for each check. Only literal `true` passes. `false` is failed, any other return value is unknown, and exceptions produce an error result. IDs must be nonempty and unique. Callers must require every expected result to have `pass === true` before presenting a conclusion; an empty check list proves nothing. For fresh agent evidence, pass `cache: false` to the verification leaf.

```sh
node --test tests/*.test.mjs
```

The price-workflow checks execute its actual orchestration with synthetic merchant and verification responses. They cover unknown shipping, stock and currency mismatches, changed prices or shipping, failed checks, incomplete merchants, and zero-cost quotes. They do not retrieve real prices or start managed-agent sessions.
