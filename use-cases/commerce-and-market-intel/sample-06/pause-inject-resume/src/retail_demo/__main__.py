"""Retailer POC: pause Stagehand, call an internal API, inject, resume.

Run with `uv run demo`. See README.md for what to point out in a demo.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from . import log
from .browser import create_stagehand, launch_browser
from .config import load_config
from .harness import run_harness
from .shelf.html import shelf_data_url
from .state import RunState


def _load_dotenv() -> None:
    """Minimal .env support so the package needs no extra dependency."""
    for candidate in (Path.cwd() / ".env", Path(__file__).resolve().parents[2] / ".env"):
        if not candidate.is_file():
            continue
        for line in candidate.read_text().splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, _, value = stripped.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))
        return


async def run() -> int:
    _load_dotenv()
    config = load_config()

    if config.target_url:
        url = config.target_url
        log.step("shelf", f"Using the configured target: {log.short_url(url)}")
    else:
        url = shelf_data_url()
        log.step("shelf", "Using the bundled synthetic Retailer shelf (self-contained data: URL).")

    browser = await launch_browser(config)
    stagehand = None
    state = RunState()

    try:
        stagehand = await create_stagehand(browser, config)

        if config.harness_mode == "code":
            # Code mode runs everything inside the extension, so the batch needs a
            # page to start from. Reuse the tab the session already has rather than
            # opening a second one; the model's first script navigates it.
            state.page = await browser.context.active_page()
            if state.page is None:
                state.page = await browser.context.new_page()

        await run_harness(stagehand, state, config, url)
        return await _print_summary(stagehand, state)
    except Exception as error:
        print(f"\nDemo failed:\n{error}", file=sys.stderr)
        return 1
    finally:
        if stagehand is not None:
            await _quiet(stagehand.close())
        await _quiet(browser.close())


async def _quiet(awaitable) -> None:
    try:
        await awaitable
    except Exception:
        pass


def verification_errors(state: RunState) -> list[str]:
    final = state.final_state or {}
    receipt = state.injection_receipt or {}
    observed = final.get("verification") or {}
    action = observed.get("action") or {} if isinstance(observed, dict) else {}
    recommended = state.signal_response.recommended_product_id if state.signal_response else None
    errors = []
    if not recommended or final.get("selected_product_id") != recommended:
        errors.append("Final selection does not match the recommendation")
    if final.get("injected") is not True or final.get("cart_added") is not True or not final.get("cart_status") or "empty" in str(final.get("cart_status")).lower():
        errors.append("Final injection/cart evidence is missing or contradictory")
    if not receipt.get("token") or receipt.get("injected") is not True or receipt.get("recommended_product_id") != recommended:
        errors.append("No matching host-recorded injection receipt")
    if receipt.get("search_applied") is not True or receipt.get("selected_before") is not None or receipt.get("cart_added_before") is not False:
        errors.append("Search-before-injection and empty-cart-before-injection were not observed")
    if state.injection_page is None or state.page is not state.injection_page:
        errors.append("Injection and final read are not tied to the same page")
    if not isinstance(observed, dict) or observed.get("token") != receipt.get("token") or not isinstance(action, dict) or action.get("token") != receipt.get("token") or action.get("product_id") != recommended or action.get("selected_product_id") != recommended or action.get("injected") is not True or action.get("cart_added") is not True:
        errors.append("No consistent cart-click observation after this injection")
    return errors


async def _print_summary(stagehand, state: RunState) -> int:
    """Verify observed sequencing and cart agreement, not model causation."""
    errors = verification_errors(state)
    verified = not errors
    log.step("result", "Final browser-visible state")
    log.table([{"field": key, "value": value} for key, value in (state.final_state or {}).items()])
    if verified:
        print("\n  VERIFIED SEQUENCE: search, injection, then matching cart action were observed.")
        print("  This does not prove that injected data caused the model's choice.")
    else:
        for error in errors:
            print(f"  Unverified: {error}")

    log.step("observability", "Counted Stagehand tool invocations and token usage")
    print(f"  Counted Stagehand tool invocations: {state.stagehand_tool_invocations}")

    print("  This counts instrumented adapter dispatches, not SDK methods or network requests.")
    print("  It excludes setup, final-state reads, metrics calls, Retailer tools and operations inside batches.")

    # The whole point is that one session survived the pause. Print the tab count
    # so that claim is visible every run instead of taken on faith.
    tabs = await stagehand.browser.context.pages()
    print(f"  Browser tabs still open: {len(tabs)} (the same tab the run started in)")
    if state.cache_events:
        log.table(
            [{"operation": operation, "cache": status} for operation, status in state.cache_events],
            ["operation", "cache"],
        )

    metrics = await stagehand.metrics()
    dumped = metrics.model_dump()
    rows = [
        {"metric": key, "value": value}
        for key, value in dumped.items()
        if isinstance(value, (int, float)) and value
    ]
    log.table(rows or [{"metric": "(no inference ran)", "value": 0}], ["metric", "value"])

    # Metrics are server-side, so they also cover act/observe/extract calls made
    # from inside a code-mode batch, which never pass through a tool wrapper.
    if not dumped.get("total_prompt_tokens"):
        print(
            "\n  NOTE: no act/observe/extract inference ran this run, so the AI layer was never\n"
            "  exercised -- the deterministic tools did all the work. That is a valid result in\n"
            "  code mode, but in tools mode it usually means the model credential was rejected."
        )

    if not verified:
        print("\n  RUN NOT VERIFIED: required injection, sequencing or cart evidence is incomplete.")
    return 0 if verified else 1


def main() -> None:
    raise SystemExit(asyncio.run(run()))


if __name__ == "__main__":
    main()
