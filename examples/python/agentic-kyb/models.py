"""Small application-owned contracts; these are not KYB policy decisions."""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Proof(StrEnum):
    NONE = "none"
    ACCESSED = "accessed"
    SEARCHED = "searched"
    RESULT_FOUND = "result_found"
    DETAIL_OPENED = "detail_opened"
    EXTRACTED = "extracted"


class Target(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    state: Literal["CO", "OH", "WY"]
    legal_name: str = Field(min_length=1, max_length=300)
    entity_id: str | None = None
    expected_status: str | None = None


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid")
    legal_name: str
    entity_id: str
    status: str
    entity_type: str | None
    formation_date: str | None
    principal_address: str | None
    registered_agent: str | None


class Candidate(BaseModel):
    legal_name: str
    entity_id: str
    status: str | None = None
    href: str


class Identity(BaseModel):
    legal_name: str
    entity_id: str
    status: str


class Failure(BaseModel):
    category: Literal[
        "access",
        "challenge",
        "navigation",
        "wait_selector",
        "record_matching",
        "parsing",
        "transient_network",
        "unknown",
    ]
    message: str
    retryable: bool = False


class Attempt(BaseModel):
    number: int
    duration_ms: int
    session_reference: str | None = None
    failure: Failure | None = None
    cleanup_errors: list[str] = Field(default_factory=list)


class Result(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target: Target
    outcome: Literal["success", "not_found", "ambiguous", "partial", "blocked", "error"]
    proof_level: Proof = Proof.NONE
    record: Record | None = None
    source_url: str | None = None
    identity_evidence: Identity | None = None
    duration_ms: int = 0
    attempts: list[Attempt] = Field(default_factory=list)
    failure: Failure | None = None

    @model_validator(mode="after")
    def require_success_evidence(self) -> Result:
        if self.outcome == "success":
            if (
                self.proof_level != Proof.EXTRACTED
                or not self.record
                or not self.identity_evidence
                or not self.source_url
            ):
                raise ValueError(
                    "success requires extracted detail, identity evidence, and official URL"
                )
            from matching import official_url, validate_identity

            official_url(self.target.state, self.source_url, self.source_url)
            validate_identity(self.target, self.identity_evidence, self.record)
        return self


class WorkflowError(Exception):
    def __init__(self, category: str, message: str, *, retryable: bool = False) -> None:
        super().__init__(message)
        self.category = category
        self.retryable = retryable
