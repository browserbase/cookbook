"""Exact identity checks are ordinary Python, not a model judgment."""

from __future__ import annotations

import re
from urllib.parse import urljoin, urlsplit

from models import Candidate, Identity, Record, Target, WorkflowError

ORIGINS = {
    "CO": "https://www.sos.state.co.us",
    "OH": "https://businesssearch.ohiosos.gov",
    "WY": "https://wyobiz.wyo.gov",
}


def normalize_name(value: str) -> str:
    # Ignore formatting, never remove legal suffixes or use substring matching.
    return " ".join(re.sub(r"[^\w\s]", " ", value.casefold()).split())


def normalize_status(value: str) -> str:
    return " ".join(value.casefold().split())


def official_url(state: str, base: str, href: str) -> str:
    value = urljoin(base, href)
    parsed = urlsplit(value)
    if (
        parsed.scheme != "https"
        or parsed.netloc != urlsplit(ORIGINS[state]).netloc
        or parsed.username
        or parsed.password
    ):
        raise WorkflowError("navigation", "record link left the approved official origin")
    return value


def select_candidate(target: Target, candidates: list[Candidate]) -> tuple[str, Candidate | None]:
    matches = [
        c for c in candidates if normalize_name(c.legal_name) == normalize_name(target.legal_name)
    ]
    if target.entity_id:
        matches = [c for c in matches if c.entity_id == target.entity_id]
    if target.expected_status:
        # Unknown result status can be resolved on detail, but a known mismatch cannot.
        matches = [
            c
            for c in matches
            if not c.status
            or normalize_status(c.status) == normalize_status(target.expected_status)
        ]
    unique = {(c.entity_id, normalize_name(c.legal_name)): c for c in matches}
    if not unique:
        return "not_found", None
    if len(unique) > 1:
        return "ambiguous", None
    return "matched", next(iter(unique.values()))


def validate_identity(target: Target, identity: Identity, record: Record | None = None) -> None:
    if normalize_name(identity.legal_name) != normalize_name(target.legal_name):
        raise ValueError("official detail legal name does not match the requested name")
    if not identity.entity_id or not identity.status:
        raise ValueError("official detail identity fields are empty")
    if target.entity_id and identity.entity_id != target.entity_id:
        raise ValueError("official detail identifier does not match the requested identifier")
    if target.expected_status and normalize_status(identity.status) != normalize_status(
        target.expected_status
    ):
        raise ValueError("official detail status does not match the requested status")
    if record and (
        normalize_name(record.legal_name) != normalize_name(identity.legal_name)
        or record.entity_id != identity.entity_id
        or normalize_status(record.status) != normalize_status(identity.status)
    ):
        raise ValueError("extracted identity does not agree with official detail evidence")
