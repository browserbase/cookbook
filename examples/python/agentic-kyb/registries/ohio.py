from __future__ import annotations

import asyncio
import json
from typing import Any
from urllib.parse import quote, urlsplit

from browser_helpers import Context, poll_expression
from matching import select_candidate, validate_identity
from models import Candidate, Identity, Proof, Record, Result, Target, WorkflowError

SEARCH_URL = "https://businesssearch.ohiosos.gov/"
API_ORIGIN = "https://businesssearchapi.ohiosos.gov"


def endpoint(configuration: Any, prefix: str) -> str:
    if not isinstance(configuration, dict) or not isinstance(configuration.get("data"), list):
        raise WorkflowError("parsing", "public endpoint configuration changed")
    urls = {
        v
        for row in configuration["data"]
        if isinstance(row, dict)
        for v in row.values()
        if isinstance(v, str) and v == f"{API_ORIGIN}/{prefix}_"
    }
    if len(urls) != 1:
        raise WorkflowError("parsing", "expected public route was not advertised")
    return next(iter(urls))


async def fetch_json(ctx: Context, url: str, *, retry_transient: bool = False) -> Any:
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or parsed.netloc not in {urlsplit(SEARCH_URL).netloc, urlsplit(API_ORIGIN).netloc}
        or parsed.username
        or parsed.password
    ):
        raise WorkflowError("navigation", "endpoint left the official allowlist")
    for attempt in range(2 if retry_transient else 1):
        response = await ctx.page.evaluate(
            # The public frontend explicitly uses cross-origin credentials for
            # its official API subdomain. Let the browser send its own cookies.
            "(async () => {const r = await fetch("
            + json.dumps(url)
            + ", {credentials:'include'}); return {status:r.status, text:await r.text()};})()"
        )
        if not isinstance(response, dict):
            raise WorkflowError("parsing", "official endpoint returned no response envelope")
        status = response.get("status")
        if status == 503 and retry_transient and attempt == 0:
            await asyncio.sleep(1.5)
            continue
        if status != 200:
            raise WorkflowError(
                "transient_network" if status == 503 else "access",
                "official endpoint rejected the read",
                retryable=status == 503,
            )
        try:
            return json.loads(str(response["text"]))
        except (ValueError, KeyError) as exc:
            raise WorkflowError("parsing", "official endpoint did not return JSON") from exc
    raise WorkflowError(
        "transient_network", "official endpoint remained unavailable", retryable=True
    )


def rows(payload: Any) -> list[dict[str, Any]]:
    data = payload.get("data") if isinstance(payload, dict) else payload
    if not isinstance(data, list) or any(not isinstance(row, dict) for row in data):
        raise WorkflowError("parsing", "official record response shape changed")
    return data


def field(row: dict[str, Any], *aliases: str) -> str | None:
    values = {"".join(c for c in k.casefold() if c.isalnum()): v for k, v in row.items()}
    for alias in aliases:
        value = values.get(alias)
        if isinstance(value, (str, int)) and str(value).strip():
            return str(value).strip()
    return None


def identity_from(row: dict[str, Any]) -> Identity:
    name = field(row, "businessname", "entityname", "name")
    identifier = field(row, "entitynumber", "entitynum", "entityid", "charternumber", "charternum")
    status = field(row, "status", "entitystatus", "businessstatus")
    if not name or not identifier or not status:
        raise WorkflowError(
            "parsing", "official identity fields were absent; review the public schema"
        )
    return Identity(legal_name=name, entity_id=identifier, status=status)


def normalized_detail(payload: Any, target: Target, selected_id: str) -> tuple[Identity, Record]:
    sections = rows(payload)
    panels = [row["firstpanel"] for row in sections if "firstpanel" in row]
    if (
        len(panels) != 1
        or not isinstance(panels[0], list)
        or len(panels[0]) != 1
        or not isinstance(panels[0][0], dict)
    ):
        raise WorkflowError("parsing", "official detail did not contain one record")
    row = panels[0][0]
    identity = identity_from(row)
    if identity.entity_id != selected_id:
        raise WorkflowError("record_matching", "detail identity disagreed with the selected result")
    validate_identity(target, identity)
    entity_type = field(row, "entitytype", "businesstype", "type")
    agent = field(row, "agentname", "registeredagent")
    # The registry's registrant section means an agent for corporate/LLC filings,
    # but can mean an applicant for other filing types. Do not conflate them.
    if entity_type and any(
        term in entity_type.casefold() for term in ("corporation", "limited liability company")
    ):
        names = set()
        for section in sections:
            contacts = section.get("registrant", [])
            if not isinstance(contacts, list):
                raise WorkflowError("parsing", "official registrant section changed")
            for contact in contacts:
                if not isinstance(contact, dict):
                    raise WorkflowError("parsing", "official registrant record changed")
                if (
                    field(contact, "charternum") == selected_id
                    and field(contact, "status") == "Active"
                ):
                    name = field(contact, "contactname")
                    if name:
                        names.add(name)
        if len(names) == 1:
            agent = next(iter(names))
    record = Record(
        **identity.model_dump(),
        entity_type=entity_type,
        formation_date=field(row, "filingdate", "formationdate", "effectivedate", "effectdate"),
        principal_address=field(row, "principaladdress", "address"),
        registered_agent=agent,
    )
    return identity, record


async def run(ctx: Context) -> Result:
    try:
        await ctx.page.goto(SEARCH_URL, wait_until="domcontentloaded", timeout=45_000)
    except Exception as exc:
        # A security redirect may replace the document while navigation settles.
        # Do not resubmit: assert the actual search UI on the same navigation.
        if "inspected target navigated or closed" not in str(exc).casefold():
            raise
        await asyncio.sleep(1)
    await poll_expression(
        ctx, "Boolean(document.querySelector('#bSearch')?.getClientRects().length)", 45
    )
    ctx.proof = Proof.ACCESSED
    await ctx.capture("frontend")
    configuration = await fetch_json(ctx, SEARCH_URL + "ajax/endPoints.json")
    ctx.evidence_dir.mkdir(parents=True, exist_ok=True)
    (ctx.evidence_dir / "endpoint-configuration.json").write_text(
        json.dumps(configuration, indent=2)
    )
    search_url = endpoint(configuration, "NS") + quote(ctx.target.legal_name, safe="") + "_X"
    search = await fetch_json(ctx, search_url)
    (ctx.evidence_dir / "search-response.json").write_text(json.dumps(search, indent=2))
    candidates = []
    for row in rows(search):
        identity = identity_from(row)
        candidates.append(Candidate(**identity.model_dump(), href=""))
    ctx.proof = Proof.SEARCHED
    outcome, selected = select_candidate(ctx.target, candidates)
    if not selected:
        return Result(
            target=ctx.target,
            outcome=outcome,  # type: ignore[arg-type]
            proof_level=ctx.proof,
            source_url=SEARCH_URL,
        )
    ctx.proof = Proof.RESULT_FOUND
    detail_url = endpoint(configuration, "VD") + quote(selected.entity_id, safe="")
    detail = await fetch_json(ctx, detail_url, retry_transient=True)
    (ctx.evidence_dir / "detail-response.json").write_text(json.dumps(detail, indent=2))
    ctx.proof = Proof.DETAIL_OPENED
    identity, record = normalized_detail(detail, ctx.target, selected.entity_id)
    ctx.proof = Proof.EXTRACTED
    return Result(
        target=ctx.target,
        outcome="success",
        proof_level=ctx.proof,
        record=record,
        identity_evidence=identity,
        source_url=SEARCH_URL,
    )
