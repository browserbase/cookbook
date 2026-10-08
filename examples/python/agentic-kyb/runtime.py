"""Bounded session lifecycle and application-owned batch scheduling."""

from __future__ import annotations

import asyncio
import os
import re
import time
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

from stagehand import BrowserbaseBrowserSettings, Stagehand, browserbase

from browser_helpers import Context
from models import Attempt, Failure, Proof, Result, Target, WorkflowError
from registries import colorado, ohio, wyoming

WORKFLOWS: dict[str, Callable[[Context], Awaitable[Result]]] = {
    "CO": colorado.run,
    "OH": ohio.run,
    "WY": wyoming.run,
}


def safe_message(error: Exception) -> str:
    text = str(error)
    key = os.environ.get("BROWSERBASE_API_KEY")
    if key:
        text = text.replace(key, "[redacted]")
    text = re.sub(r"(?i)bearer\s+\S+", "Bearer [redacted]", text)
    text = re.sub(r"https?://\S+", "[URL omitted]", text)
    text = re.sub(r"(?:/Users/|/home/)\S+", "[local path omitted]", text)
    return text[:350]


def failure_for(error: Exception) -> Failure:
    if isinstance(error, WorkflowError):
        return Failure(
            category=error.category,  # type: ignore[arg-type]
            message=safe_message(error),
            retryable=error.retryable,
        )
    if isinstance(error, TimeoutError):
        return Failure(category="wait_selector", message="session attempt deadline exceeded")
    text = str(error).casefold()
    if any(
        term in text
        for term in (
            "err_http2",
            "err_tunnel",
            "connection reset",
            "connection closed",
            "connecterror",
            "inspected target navigated or closed",
        )
    ):
        return Failure(
            category="transient_network", message="browser transport failed", retryable=True
        )
    # SDK exceptions may contain request payloads; never persist their raw text.
    if isinstance(error, ValueError):
        return Failure(
            category="record_matching",
            message="detail identity or extracted fields failed validation",
        )
    return Failure(
        category="unknown", message=f"unexpected workflow failure ({type(error).__name__})"
    )


async def close_handles(handles: list[tuple[str, Any]], timeout: float = 15) -> list[str]:
    errors = []
    for name, handle in handles:
        if handle is None:
            continue
        try:
            await asyncio.wait_for(handle.close(), timeout=timeout)
        except Exception:
            errors.append(f"{name} cleanup did not complete")
    return errors


async def run_target(target: Target, directory: Path, *, deadline: float = 180) -> Result:
    key = os.environ.get("BROWSERBASE_API_KEY")
    if not key:
        raise RuntimeError("BROWSERBASE_API_KEY is required")
    started = time.monotonic()
    attempts: list[Attempt] = []
    result: Result | None = None
    for number in range(1, 3):
        attempt_started = time.monotonic()
        browser: Any = None
        stagehand: Any = None
        ctx: Context | None = None
        cleanup_timeout = min(15, deadline / 6)
        try:
            # Reserve time for both close calls within the attempt budget.
            async with asyncio.timeout(deadline - 2 * cleanup_timeout):
                settings = BrowserbaseBrowserSettings(solve_captchas=True, record_session=True)
                if target.state == "WY":
                    settings["captcha_image_selector"] = "body > img:first-of-type"
                    settings["captcha_input_selector"] = "#ans"
                if target.state == "OH":
                    settings["advanced_stealth"] = True
                    settings["os"] = "windows"
                browser = await browserbase.launch(
                    api_key=key,
                    browser_settings=settings,
                    proxies=target.state == "OH",
                    timeout=240,
                )
                stagehand = await Stagehand.create(browser=browser, logging={"level": "off"})
                page = await browser.context.active_page()
                ctx = Context(
                    stagehand,
                    page,
                    target,
                    directory / f"attempt-{number}",
                    refresh_page=browser.context.active_page,
                )
                await page.on("console", ctx.console)
                result = await WORKFLOWS[target.state](ctx)
        except Exception as exc:
            failure = failure_for(exc)
            result = Result(
                target=target,
                outcome="blocked" if failure.category in {"access", "challenge"} else "partial",
                proof_level=ctx.proof if ctx else Proof.NONE,
                source_url=ctx.source_url if ctx else None,
                failure=failure,
            )
        finally:
            errors = await close_handles(
                [("Stagehand", stagehand), ("Browserbase", browser)], cleanup_timeout
            )
        if result is None:
            # Cancellation is propagated after cleanup; it never becomes success.
            raise RuntimeError("session ended without a result")
        attempts.append(
            Attempt(
                number=number,
                duration_ms=int((time.monotonic() - attempt_started) * 1000),
                session_reference=browser.session_id if browser else None,
                failure=result.failure,
                cleanup_errors=errors,
            )
        )
        if errors:
            result.outcome = "error"
            result.failure = Failure(category="unknown", message="session cleanup requires review")
            break
        if (
            not result.failure
            or not result.failure.retryable
            or result.failure.category not in {"access", "transient_network"}
        ):
            break
    assert result is not None
    result.attempts = attempts
    result.duration_ms = int((time.monotonic() - started) * 1000)
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "result.json").write_text(result.model_dump_json(indent=2))
    return result


async def run_batch(
    targets: list[Target],
    directory: Path,
    concurrency: int,
    worker: Callable[[Target, Path], Awaitable[Result]] = run_target,
) -> tuple[list[Result], dict[str, Any]]:
    if not 1 <= concurrency <= 3:
        raise ValueError("concurrency must be between 1 and 3")
    global_limit = asyncio.Semaphore(concurrency)
    state_limits = {state: asyncio.Semaphore(1) for state in WORKFLOWS}
    active = peak = 0
    started = time.monotonic()

    async def job(index: int, target: Target) -> Result:
        nonlocal active, peak
        async with state_limits[target.state], global_limit:
            active += 1
            peak = max(peak, active)
            try:
                return await worker(target, directory / f"{index:03d}-{target.state}")
            except Exception as exc:
                return Result(target=target, outcome="error", failure=failure_for(exc))
            finally:
                active -= 1

    results = await asyncio.gather(*(job(i, target) for i, target in enumerate(targets, 1)))
    report = {
        "jobs": len(targets),
        "configured_concurrency": concurrency,
        "max_active_jobs": peak,
        "duration_ms": int((time.monotonic() - started) * 1000),
        "sessions": sum(len(result.attempts) for result in results),
        "outcomes": {
            outcome: sum(r.outcome == outcome for r in results)
            for outcome in sorted({r.outcome for r in results})
        },
    }
    return results, report
