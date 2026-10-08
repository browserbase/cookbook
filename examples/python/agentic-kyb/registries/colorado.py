from __future__ import annotations

from urllib.parse import parse_qs, urlsplit

from browser_helpers import Context, detail_identity, extract_detail, ready
from matching import official_url, select_candidate
from models import Candidate, Proof, Result, WorkflowError

SEARCH_URL = "https://www.sos.state.co.us/biz/BusinessEntityCriteriaExt.do"


async def run(ctx: Context) -> Result:
    await ctx.page.goto(SEARCH_URL, wait_until="domcontentloaded", timeout=45_000)
    await ready(ctx, "#searchCriteria", 45_000)
    ctx.proof = Proof.ACCESSED
    await ctx.page.locator("#searchCriteria").fill(ctx.target.legal_name)
    await ctx.page.locator("input[name='cmd'][type='submit']").click()
    await ready(ctx, "table", 30_000)
    snapshot = await ctx.capture("search")
    headers = [row.get("cells", []) for row in snapshot.get("rows", [])]
    expected = [
        "#",
        "ID Number",
        "Document Number",
        "Name",
        "Event",
        "Status",
        "Form",
        "Formation Date",
    ]
    if not any(
        [str(cell).casefold() for cell in row] == [cell.casefold() for cell in expected]
        for row in headers
    ):
        raise WorkflowError("parsing", "official search table headers changed")
    candidates = []
    for row in snapshot.get("rows", []):
        for link in row.get("links", []):
            href = str(link.get("href", ""))
            if "BusinessEntityDetail" not in href:
                continue
            identifier = parse_qs(urlsplit(href).query).get("masterFileId", [""])[0]
            cells = row.get("cells", [])
            if identifier and len(cells) == 8:
                candidates.append(
                    Candidate(legal_name=cells[3], entity_id=identifier, status=cells[5], href=href)
                )
    ctx.proof = Proof.SEARCHED
    outcome, selected = select_candidate(ctx.target, candidates)
    if not selected:
        if not candidates and "no results" not in str(snapshot.get("text", "")).casefold():
            raise WorkflowError("parsing", "search result shape was not recognized")
        return Result(
            target=ctx.target,
            outcome=outcome,  # type: ignore[arg-type]
            proof_level=ctx.proof,
            source_url=ctx.source_url,
        )
    ctx.proof = Proof.RESULT_FOUND
    detail_url = official_url("CO", SEARCH_URL, selected.href)
    await ctx.page.goto(detail_url, wait_until="domcontentloaded", timeout=45_000)
    await ready(ctx, "table")
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
