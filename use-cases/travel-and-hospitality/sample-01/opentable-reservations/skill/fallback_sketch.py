"""
fallback_sketch.py — Illustrative self-heal pattern for the dev→prod loop.

NOT wired up / NOT validated. Shows the shape an executor would take
when a deterministic path hits a typed failure and needs fresh LLM
inference to recover THIS request while recording learnings for next time.

Read alongside LOOP.md § "Step 4: Self-heal". Customer adapts to their
architecture (Stagehand, Anthropic SDK, MCP, etc.) — this illustrates
the flow, not an implementation.
"""

from reference import book_opentable  # deterministic executor

RECOVERABLE_REASONS = {"unknown_validation_error", "label_not_found", "phone_format_rejected"}
MAX_FALLBACK_TURNS = 5
MAX_FALLBACK_COST_USD = 0.50


def book_with_fallback(**kwargs) -> dict:
    # 1. Try the deterministic path first.
    result = book_opentable(**kwargs)
    if result["success"] or result.get("reason") not in RECOVERABLE_REASONS:
        return result

    # 2. Deterministic path hit a recoverable failure — hand off to fresh inference.
    #    a. Snapshot the current page (via `bb browse --connect <sid> snapshot`).
    #    b. Call Claude with (snapshot, goal, typed failure) under turn + cost caps.
    #    c. If Claude identifies a working action, apply it via `bb browse click/fill`.
    #    d. Land the new heuristic as a file in references/ + one row in SKILL.md's lookup table.
    #    e. Return the recovered result, or escalate to live-view handoff if still stuck.

    # recovered = _fresh_inference_recovery(
    #     result, kwargs,
    #     max_turns=MAX_FALLBACK_TURNS,
    #     max_cost_usd=MAX_FALLBACK_COST_USD,
    # )
    # return recovered
    raise NotImplementedError("wire up fresh-inference recovery for your agent runtime")
