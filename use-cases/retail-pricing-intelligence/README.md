# Retailer — Payment Experience Competitive Benchmark

Competitive-intelligence engagement for Retailer's Payments Product team: a consultant-grade benchmark of the customer payment experience across **Retailer, Amazon, Instacart, Costco, and a representative Shopify store**, built with Browserbase managed agents + browse CLI on live sites.

Scope is a 10-phase study (RQ1–RQ10) mapped to the customer's request, delivered as journey maps, a payment-method matrix, annotated screenshots, a friction log, best practices, and a scored UX scorecard. See `coverage-map.md` for full traceability of the customer's ask across all phases.

## Status
- **Phase 1 (Payment Discovery) — complete.** Report: `rq1-report.html` (self-contained, print-to-PDF). Every finding is backed by a live screenshot.
- Phases 2–10 pending (need authenticated Contexts, real orders, and benefit instruments).

## Key files
| Path | What |
|------|------|
| `rq1-report.html` | The Phase 1 deliverable — exec summary, scorecard, payment-method matrix, per-retailer teardowns, best practices, opportunities, roadmap |
| `coverage-map.md` | Traceability: customer's 10 RQs × 3 shopping missions × 6 deliverables × 8 scorecard dimensions |
| `demo/rq1/findings.json` | Consolidated RQ1 structured findings (per retailer) |
| `demo/rq1/shots/` | Curated proof screenshots, per retailer |
| `demo/teardowns/` | Earlier guest checkout teardowns (Amazon/Target/Kroger/Instacart) + `findings-guest.json` |
| `index.html`, `showcase.html` | Earlier framing deck + "what we can pull" showcase |
| `demo/` | Live interactive demo app (parallel Browserbase sessions + embedded replays) and the reusable engine |

## The engine (reusable across phases)
- `demo/agents-runner.mjs` — fan-out managed Browserbase agent runs with a shared JSON `resultSchema`, poll to terminal, write structured results. Point it at a new phase's `tasks.json`.
- `demo/pull-shots.mjs` — pull a run's message stream (screenshots come from the curated browse-CLI pass, not the agent API).
- `demo/server.js` + `demo/public/` — the live parallel-session UI with embedded HLS session replays.

Requires `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID`. No LLM key needed for the deterministic extraction paths.
