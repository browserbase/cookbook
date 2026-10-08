from __future__ import annotations

import re

from browser_helpers import (
    Context,
    detail_identity,
    extract_detail,
    poll_expression,
    ready,
)
from matching import official_url, select_candidate
from models import Candidate, Proof, Result, WorkflowError

SEARCH_URL = "https://wyobiz.wyo.gov/Business/FilingSearch.aspx"


async def finish_challenges(ctx: Context) -> None:
    while await ctx.page.locator("#ans").count():
        if ctx.challenges >= 3:
            raise WorkflowError("challenge", "replacement challenge limit reached")
        ctx.challenges += 1
        await poll_expression(ctx, "Boolean(document.querySelector('#ans')?.value)", 35)
        answer = await ctx.page.locator("#ans").input_value()
        if not answer or not ctx.solve_finished.is_set():
            raise WorkflowError(
                "challenge", "challenge completion was not established", retryable=True
            )
        await ctx.page.locator("#ans").fill("")
        await ctx.page.locator("#ans").fill(answer)
        ctx.solve_finished.clear()
        await ctx.page.locator("#jar").click()
        await ctx.page.wait_for_load_state("domcontentloaded", timeout=20_000)


async def run(ctx: Context) -> Result:
    await ctx.page.goto(SEARCH_URL, wait_until="domcontentloaded", timeout=45_000)
    await finish_challenges(ctx)
    await ready(ctx, "#MainContent_txtFilingName", 45_000)
    ctx.proof = Proof.ACCESSED
    await ctx.page.locator("#MainContent_txtFilingName").fill(ctx.target.legal_name)
    await ctx.page.locator("#MainContent_cmdSearch").click()
    await finish_challenges(ctx)
    if not await ctx.page.wait_for_selector(
        "a[href*='FilingDetail']", state="visible", timeout=35_000
    ):
        state = await ctx.capture("result-state")
        if "no results" in str(state.get("text", "")).casefold():
            ctx.proof = Proof.SEARCHED
            return Result(
                target=ctx.target,
                outcome="not_found",
                proof_level=ctx.proof,
                source_url=ctx.source_url,
            )
        warmups = [
            link["href"]
            for link in state.get("links", [])
            if "FilingSearchResults" in str(link.get("href", ""))
        ]
        if "loading" in str(state.get("text", "")).casefold() and len(set(warmups)) == 1:
            # Only a page-advertised public result route; never invent a route.
            await ctx.page.goto(
                official_url("WY", SEARCH_URL, warmups[0]),
                wait_until="domcontentloaded",
                timeout=30_000,
            )
            await finish_challenges(ctx)
        await ready(ctx, "a[href*='FilingDetail']", 15_000)
    snapshot = await ctx.capture("search")
    candidates = []
    for link in snapshot.get("links", []):
        href = str(link.get("href", ""))
        if "FilingDetail" not in href:
            continue
        # The href's FilingID is an application token, not the public filing ID.
        match = re.fullmatch(
            r"(.+?)\s*-\s*(\d{4}-\d+)\s*\([^)]+\)", str(link["text"]).strip().splitlines()[0]
        )
        status = re.search(r"Status:\s*([^\n]+)", str(link.get("context", "")))
        if match:
            candidates.append(
                Candidate(
                    legal_name=match[1],
                    entity_id=match[2],
                    status=status[1].strip() if status else None,
                    href=href,
                )
            )
    ctx.proof = Proof.SEARCHED
    outcome, selected = select_candidate(ctx.target, candidates)
    if not selected:
        if not candidates:
            raise WorkflowError("parsing", "search result shape was not recognized")
        return Result(
            target=ctx.target,
            outcome=outcome,  # type: ignore[arg-type]
            proof_level=ctx.proof,
            source_url=ctx.source_url,
        )
    ctx.proof = Proof.RESULT_FOUND
    detail_url = official_url("WY", SEARCH_URL, selected.href)
    # The exact result already provides a stable official href: no inference needed.
    await ctx.page.goto(detail_url, wait_until="domcontentloaded", timeout=45_000)
    await finish_challenges(ctx)
    await ready(ctx, "#txtFilingName2", 30_000)
    ctx.proof = Proof.DETAIL_OPENED
    snapshot = await ctx.capture("detail")
    identity = detail_identity(snapshot, selected.entity_id)
    record = await extract_detail(ctx, identity)
    return Result(
        target=ctx.target,
        outcome="success",
        proof_level=ctx.proof,
        record=record,
        source_url=detail_url,
        identity_evidence=identity,
    )
