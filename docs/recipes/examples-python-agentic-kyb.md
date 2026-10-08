# Agentic KYB registry research (Python, Stagehand v4)

Research exact official business records with Stagehand v4, isolated Browserbase sessions, bounded batches, and evidence-backed partial outcomes

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · live workflow tested.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/python/agentic-kyb`.
- Languages: python.
- Frameworks: Stagehand, Browserbase SDK, Pydantic.
- [Upstream setup and behavior](../../examples/python/agentic-kyb/README.md).
- [Dependency manifest `examples/python/agentic-kyb/pyproject.toml`](../../examples/python/agentic-kyb/pyproject.toml).
- [Dependency manifest `examples/python/agentic-kyb/uv.lock`](../../examples/python/agentic-kyb/uv.lock).
- [Source `examples/python/agentic-kyb/main.py`](../../examples/python/agentic-kyb/main.py).
- Original use-case taxonomy: stagehand-v4, registry-research, bounded-batches.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/python/agentic-kyb
uv sync --frozen
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
uv run python main.py --live --input sample-input.jsonl --concurrency 1 --output runs/first-batch
```

## Environment

[Environment template](../../examples/python/agentic-kyb/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates hosted browsers and Model Gateway; no separate model-provider key is needed. Secret. | `<set-locally>` | Must be non-empty for explicit live execution. No default. |


## Dependencies

Declared runtime dependencies from [examples/python/agentic-kyb/pyproject.toml](../../examples/python/agentic-kyb/pyproject.toml). Alternate manifests may differ; use the documented setup path.

Declared source dependencies.

- `pydantic>=2.12,<3`
- `python-dotenv>=1.2,<2`
- `stagehand==4.1.0`

## Caveats and verification

Source and setup metadata were inspected. A scoped live workflow check is recorded below; only its stated command, date, result, and limits are verified. Other websites, accounts, permissions, costs, and configurations remain unverified.

| Check | Date | Runtime | Command | Result and limits |
| --- | --- | --- | --- | --- |
| Clean install verified | 2026-10-07 | `Python 3.11.14; uv frozen lock; stagehand 4.1.0; pydantic 2.13.5` | `uv sync --frozen --python 3.11` | passed. Independent disposable package directory; no browser session. All 36 synthetic tests also passed using the independent environment. |
| Typechecked | 2026-10-07 | `Python 3.13.12; mypy 1.20.2; stagehand 4.1.0` | `uv run mypy .` | passed. Static signatures and application contracts only. |
| Offline behavior tested | 2026-10-07 | `Python 3.13.12 and independent Python 3.11.14; stagehand 4.1.0; synthetic fixtures` | `uv run python -m unittest discover -s tests -v` | passed. 36 synthetic matching, proof, wait, challenge, retry, concurrency, deadline, and cleanup checks. No live websites. |
| Live workflow tested | 2026-10-07 | `Python 3.13.12; stagehand 4.1.0; Browserbase` | `uv run python main.py --live --input sample-input.jsonl --concurrency 2 --output runs/review-concurrent` | failed. Earlier diagnostic suite: nine jobs, 11 sessions; Colorado passed while Ohio and Wyoming failed. Led to readiness, credential-mode, and parsing corrections. Code changed during that suite. Public command substitutes only the private output directory; exact invocations and raw evidence remain private. |
| Live workflow tested | 2026-10-07 | `Python 3.13.12; stagehand 4.1.0; pydantic 2.13.5; Browserbase hosted Chromium` | `uv run python main.py --live --input sample-input.jsonl --concurrency 2 --output runs/acceptance-concurrent` | passed. Final suite: nine successful fresh jobs on three public records (individual, sequential, concurrency-2), nine sessions, no retries. Batch maxima 1 and 2; elapsed 30.250s and 18.938s. All fields checked against official evidence. No large-scale, reliability, CAPTCHA-recovery, or policy-decision claim. Public command substitutes only the private output directory; exact invocations and raw evidence remain private. |

- Registry research only; does not issue a KYB approval or risk-policy verdict.
- Fresh acceptance checks extracted one public record per adapter three times; this does not establish general registry coverage or live recovery guarantees.
- Small-batch diagnostic measurements do not establish production throughput or reliability. Protect runtime evidence and obtain site authorization.

## Provenance

Cookbook-authored example. Its reviewed source is included at the local paths above.

Related topics: [Business operations](../topics/business-operations.md), [Extraction and research](../topics/extraction-and-research.md), [Testing and observability](../topics/testing-and-observability.md), [Browser configuration](../topics/browser-features.md).
