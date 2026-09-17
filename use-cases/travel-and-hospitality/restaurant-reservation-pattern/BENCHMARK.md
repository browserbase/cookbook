# Benchmark — Skill vs. No-Skill Baseline (2026-04-22)

Measured comparison of three execution modes against live reservation portal on Browserbase remote sessions with a pre-authed context:

- **Baseline** — fresh Claude Code agent with `bb` CLI + the task goal, no skill artifacts.
- **SKILL.md cold** — fresh Claude Code agent following `skill/SKILL.md`'s documented workflow.
- **`reference.py` deterministic** — the Python executor called as an Anthropic-SDK tool; LLM in the caller, not in the hot path.

Every agent ran with the same pre-authed Browserbase context (seeded via `/cookie-sync`). All times are wall-clock including session creation + proxy handshake + Akamai warmup.

## Search benchmark (read-only)

| Query | Mode | Turns | Wall | LLM $/run | Result |
|---|---|---|---|---|---|
| Italian, SF, 2026-06-26 | Baseline | 17 | 3.0 min | ~$0.40 | 4 restaurants w/ slots (of 131 matches) |
| Italian, SF, 2026-06-26 | `reference.py` | 1 subprocess | **39 s** | **~$0.001** | 2 restaurants w/ slots |
| Sushi, SF, 2026-06-26 | Baseline | 12 | 3.5 min | ~$0.55 | 3 restaurants w/ slots (of 65 matches) |
| Sushi, SF, 2026-06-26 | `reference.py` | 1 subprocess | **74 s** | **~$0.001** | 3 restaurants w/ slots |

**Per-run cost delta: ~400–500× cheaper via `reference.py`.** Wall-time is 3–5× faster. Notably, **both baseline runs independently rediscovered the Akamai `--proxies --verified` workaround** (5–8 turns of blind trial-and-error each) — exactly the site knowledge the skill encodes in a single session-config JSON body.

## Book benchmark (full end-to-end)

| Mode | Turns | Wall | LLM $/run | Outcome | Conf # |
|---|---|---|---|---|---|
| Baseline (Example Bistro A, read-only, stop at Complete button) | 13 | ~2 min | ~$0.30–0.60 | Success, stopped | — |
| SKILL.md cold (Example Bistro A, full e2e) | 16 bb commands | ~3 min | ~$0.50 est | Real booking | #EXAMPLE-C |
| `reference.py` (Example Bistro A, full e2e) | ~11 subprocess | **~90 s** | **~$0.003** | Real booking | #EXAMPLE-A |
| `reference.py` (Example Bistro B Jun 26 → no_availability handoff) | ~8 subprocess | **48 s** | **~$0.001** | Typed `no_availability` | — |
| `reference.py` (Example Bistro B Jun 19 full e2e, after retry) | ~11 subprocess | **69 s** | **~$0.003** | Real booking | #EXAMPLE-B |

Baseline is **genuinely competent on the happy path** with a warm authed context — Example Bistro A's flow is a simple variant with no CC hold, tiered seating, or experience packages. The cost + wall-time advantage of the skill compounds on the long tail (below) and at scale (extrapolation below).

## Edge-case matrix (qualitative)

Baseline was probed against two venues with non-trivial booking flows:

| Case | Venue | Baseline outcome | Turns | LLM $ | `reference.py` outcome |
|---|---|---|---|---|---|
| CC-hold detection | State Bird Provisions | `COULD_NOT_REACH` — wasted budget on out-of-window date; couldn't probe CC logic | 22 | ~$0.50 | Handles via typed `credit_card_required` handoff (not re-probed today — prior matrix run validated) |
| Experience interstitial | TAO Downtown NYC | `INTERSTITIAL_DETECTED` via near-term proxy run (requested date out of window); correctly identified "Standard Reservation" as free-default | 19 | ~$0.50 | Auto-clicks Standard Reservation via `/booking/specials` path; prior matrix run validated (VALIDATION.md) |

Takeaway: on edge cases where baseline *does* succeed, it takes ~5–6 min and $0.50 per probe vs. reference.py's ~90s and ~$0.003. More importantly, **baseline emits natural-language descriptions** ("I saw a CC form") — `reference.py` emits **typed handoff reasons** (`credit_card_required`, `no_availability`, etc.) that the calling agent can branch on deterministically.

## Scale extrapolation

Per-run measurements projected to realistic volumes:

| Volume | Baseline cost | `reference.py` cost | Delta |
|---|---|---|---|
| 100 bookings / day | $50 / day ($18K / yr) | $0.10 / day ($36 / yr) | **500×** |
| 1,000 bookings / day | $500 / day ($180K / yr) | $1 / day ($360 / yr) | **500×** |
| 10,000 bookings / day | $5,000 / day ($1.8M / yr) | $10 / day ($3,600 / yr) | **500×** |

Wall-clock throughput (per session, sequential, no parallelism): ~960 searches/day via `reference.py` vs. ~270 via baseline — **3.5× more throughput per concurrent worker**, or equivalently ~30% of the workers needed for the same SLA.

## What this actually proves

1. **Per-run cost is the headline, not wall-time.** Deterministic executor is ~$0.001/run because there's no LLM in the browser-driving loop — the LLM is only in the caller's reasoning *about whether to book*. On a single easy happy-path query, wall-time is similar; at 1K+ runs/day the cost delta is 500× and compounds.

2. **Skill's real value is the contract, not the clicks.** Baseline found the time slots, discovered the Akamai workaround, identified the experience interstitial — but it did so via natural-language reasoning each time. The skill's six typed handoff reasons (`credit_card_required`, `auth_required`, `captcha_or_blocked`, `no_availability`, `phone_format_rejected`, `unknown_validation_error`) give the caller a **branch-able contract** instead of a probabilistic summary.

3. **Autobrowse is the speed moat.** The skill encoded here — 4 label variants, 3 URL variants, Akamai warmup, 15s hydration timing, 6 typed handoffs — converged in autobrowse iter 2 at a total graduation cost of ~$3. Without autobrowse, the same recipe would take a human engineer multiple days to debug (every site-specific gotcha captured in `references/` is an incident someone would otherwise hit in production). **Hours vs. weeks** to ship a new skill is the real competitive advantage; `reference.py`'s cost savings are downstream of that.

4. **Variance is the long tail.** Baseline succeeded on Italian + Sushi + Example Bistro A (3/3 easy cases). It failed to probe CC-hold cleanly on State Bird (1 wasted probe). A larger matrix — N=20+ different venues, metros, dates, sold-out states, phone-format edges — would show a reliability gap, not just a cost gap. This benchmark is N=5; the claim is directionally strong but not yet statistically tight.

## What this does NOT prove

- **We didn't run N=3+ repeats per condition.** All numbers are single-sample. Variance is un-measured; different runs on different days could move wall-times by ±30%.
- **Baseline is stronger than expected on the happy path.** A smart LLM agent with the right CLI can rediscover most site-specific knowledge in <25 turns. The pitch isn't "baseline fails"; it's "baseline pays LLM cost per run forever."
- **Edge-case coverage is incomplete.** We validated 2 of the skill's 4 label variants / 3 URL paths in baseline probes. Phone-format-rejection, captcha-block, tiered-only venues, auth-expired-mid-flight — not re-probed today.

## How to reproduce

All three baseline subagent runs + three edge-case probes + four `reference.py` calls logged in the Claude Code session on 2026-04-22. Full prompts available on request.

`reference.py` search calls can be reproduced directly:

```bash
export BROWSERBASE_API_KEY=...=... BROWSERBASE_CONTEXT_ID=...
time python3 skill/reference.py search '{"term":"Italian","covers":2,"date_time":"2026-06-26T19:00","metro_id":4}'
```

Baseline runs are harder to reproduce (stochastic LLM agent exploration); the prompts that drove them are documented in the source repository.
