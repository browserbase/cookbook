"""Synthetic offline checks. No credentials, public sites, or browser sessions."""

from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, patch

from pydantic import ValidationError
from stagehand import Action

from browser_helpers import Context, detail_identity, ready, reviewed_detail_click
from matching import normalize_name, official_url, select_candidate, validate_identity
from models import Candidate, Identity, Proof, Record, Result, Target, WorkflowError
from registries import ohio, wyoming
from runtime import close_handles, failure_for, run_batch, run_target, safe_message

NAME = "Example Commerce, LLC"


def target(state: str = "CO") -> Target:
    return Target(state=state, legal_name=NAME, entity_id="123", expected_status="Active")  # type: ignore[arg-type]


def identity(**changes: str) -> Identity:
    return Identity(**({"legal_name": NAME, "entity_id": "123", "status": "Active"} | changes))


def record(**changes: str | None) -> Record:
    return Record(
        **(
            {
                **identity().model_dump(),
                "entity_type": None,
                "formation_date": None,
                "principal_address": None,
                "registered_agent": None,
            }
            | changes
        )
    )


class MatchingTests(unittest.TestCase):
    def test_exact_normalization(self) -> None:
        self.assertEqual(normalize_name(NAME), normalize_name("EXAMPLE COMMERCE LLC"))
        self.assertNotEqual(normalize_name(NAME), normalize_name("Example Commerce Inc."))

    def test_near_match_not_found(self) -> None:
        self.assertEqual(
            select_candidate(
                target(),
                [Candidate(legal_name="Example Commerce West LLC", entity_id="123", href="x")],
            )[0],
            "not_found",
        )

    def test_duplicate_records_ambiguous(self) -> None:
        query = Target(state="CO", legal_name=NAME)
        self.assertEqual(
            select_candidate(
                query, [Candidate(legal_name=NAME, entity_id=s, href="x") for s in ("1", "2")]
            )[0],
            "ambiguous",
        )

    def test_duplicate_rows_same_id(self) -> None:
        row = Candidate(legal_name=NAME, entity_id="123", status="Active", href="x")
        self.assertEqual(select_candidate(target(), [row, row])[0], "matched")

    def test_inactive_filtered(self) -> None:
        row = Candidate(legal_name=NAME, entity_id="123", status="Inactive", href="x")
        self.assertEqual(select_candidate(target(), [row])[0], "not_found")

    def test_unknown_result_status_checked_on_detail(self) -> None:
        self.assertEqual(
            select_candidate(target(), [Candidate(legal_name=NAME, entity_id="123", href="x")])[0],
            "matched",
        )
        with self.assertRaises(ValueError):
            validate_identity(target(), identity(status="Inactive"))

    def test_wrong_identifier(self) -> None:
        with self.assertRaises(ValueError):
            validate_identity(target(), identity(entity_id="456"))

    def test_empty_identity_fields(self) -> None:
        with self.assertRaises(ValueError):
            validate_identity(target(), identity(status=""))

    def test_model_cannot_change_identity(self) -> None:
        with self.assertRaises(ValueError):
            validate_identity(target(), identity(), record(legal_name="Different LLC"))

    def test_success_requires_evidence(self) -> None:
        with self.assertRaises(ValidationError):
            Result(target=target(), outcome="success", proof_level=Proof.EXTRACTED, record=record())

    def test_partial_cannot_be_success(self) -> None:
        with self.assertRaises(ValidationError):
            Result(
                target=target(),
                outcome="success",
                proof_level=Proof.SEARCHED,
                record=record(),
                identity_evidence=identity(),
                source_url="https://www.sos.state.co.us/detail",
            )

    def test_success_official_origin(self) -> None:
        with self.assertRaises(WorkflowError):
            Result(
                target=target(),
                outcome="success",
                proof_level=Proof.EXTRACTED,
                record=record(),
                identity_evidence=identity(),
                source_url="https://example.org/detail",
            )

    def test_relative_url_and_hostile_url(self) -> None:
        self.assertEqual(
            official_url("CO", "https://www.sos.state.co.us/biz/search", "detail"),
            "https://www.sos.state.co.us/biz/detail",
        )
        for href in (
            "http://www.sos.state.co.us/detail",
            "https://www.sos.state.co.us.evil.invalid/detail",
            "//evil.invalid",
            "https://user@www.sos.state.co.us/detail",
        ):
            with self.assertRaises(WorkflowError):
                official_url("CO", "https://www.sos.state.co.us", href)

    def test_detail_name_not_registered_agent(self) -> None:
        snapshot = {
            "rows": [
                {"cells": ["Name", NAME]},
                {"cells": ["ID number", "123", "Status", "Active"]},
                {"cells": ["Name", "Different Agent"]},
            ]
        }
        self.assertEqual(detail_identity(snapshot, "123"), identity())

    def test_missing_detail_fields_fail(self) -> None:
        with self.assertRaises(WorkflowError):
            detail_identity({"rows": []}, "123")

    def test_ohio_public_endpoint_required(self) -> None:
        self.assertEqual(
            ohio.endpoint({"data": [{"public": ohio.API_ORIGIN + "/NS_"}]}, "NS"),
            ohio.API_ORIGIN + "/NS_",
        )
        with self.assertRaises(WorkflowError):
            ohio.endpoint({"data": [{"public": "https://example.org/NS_"}]}, "NS")

    def test_ohio_schema_drift_fail_closed(self) -> None:
        with self.assertRaises(WorkflowError):
            ohio.identity_from({"guessed": "field"})
        with self.assertRaises(WorkflowError):
            ohio.rows({"error": "maintenance"})

    def test_ohio_detail_panel_and_agent(self) -> None:
        data = {
            "data": [
                {
                    "registrant": [
                        {
                            "charter_num": "123",
                            "status": "Active",
                            "contact_name": "Example Agent LLC",
                        }
                    ]
                },
                {
                    "firstpanel": [
                        {
                            "business_name": NAME,
                            "charter_num": "123",
                            "status": "Active",
                            "business_type": "CORPORATION FOR PROFIT",
                            "effect_date": "01/01/2000",
                        }
                    ]
                },
            ]
        }
        evidence, normalized = ohio.normalized_detail(data, target("OH"), "123")
        self.assertEqual(evidence, identity())
        self.assertEqual(normalized.formation_date, "01/01/2000")
        self.assertEqual(normalized.registered_agent, "Example Agent LLC")
        self.assertIsNone(normalized.principal_address)

    def test_ohio_empty_or_wrong_detail_panel(self) -> None:
        cases: list[dict[str, Any]] = [
            {"data": [{"firstpanel": []}]},
            {
                "data": [
                    {
                        "firstpanel": [
                            {"business_name": NAME, "charter_num": "456", "status": "Active"}
                        ]
                    }
                ]
            },
        ]
        for payload in cases:
            with self.assertRaises(WorkflowError):
                ohio.normalized_detail(payload, target("OH"), "123")

    def test_wyoming_detail_labels_without_table(self) -> None:
        snapshot = {
            "rows": [],
            "text": f"Name\n{NAME}\nFiling ID\n123\nStatus\nActive\nSub Status\nCurrent",
        }
        self.assertEqual(detail_identity(snapshot, "123"), identity())

    def test_failure_classification_and_redaction(self) -> None:
        self.assertTrue(failure_for(RuntimeError("ERR_HTTP2_PROTOCOL_ERROR")).retryable)
        self.assertFalse(failure_for(TimeoutError()).retryable)
        self.assertEqual(failure_for(ValueError("identity mismatch")).category, "record_matching")
        with patch.dict("os.environ", {"BROWSERBASE_API_KEY": "dummy-key"}):
            self.assertNotIn("dummy-key", safe_message(ValueError("dummy-key Bearer token")))
            self.assertNotIn("token", failure_for(RuntimeError("Bearer token")).message)


class AsyncTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name)

    def context(self, page: object | None = None) -> Context:
        return Context(AsyncMock(), page or AsyncMock(), target(), self.path)  # type: ignore[arg-type]

    async def test_checked_wait(self) -> None:
        page = AsyncMock()
        page.wait_for_selector.return_value = False
        page.evaluate.return_value = {
            "text": "ordinary application",
            "url": "https://www.sos.state.co.us",
        }
        with self.assertRaises(WorkflowError) as raised:
            await ready(self.context(page), "#missing", 10)
        self.assertEqual(raised.exception.category, "wait_selector")

    async def test_wait_refreshes_after_security_redirect(self) -> None:
        page = AsyncMock()
        page.wait_for_selector.side_effect = [
            RuntimeError("Inspected target navigated or closed"),
            True,
        ]
        ctx = self.context(page)
        ctx.refresh_page = AsyncMock(return_value=page)
        await ready(ctx, "#real-input", 500)
        self.assertEqual(page.wait_for_selector.await_count, 2)

    async def test_challenge_wait_classification(self) -> None:
        page = AsyncMock()
        page.wait_for_selector.return_value = False
        page.evaluate.return_value = {
            "text": "Verify you are human",
            "url": "https://www.sos.state.co.us",
        }
        with self.assertRaises(WorkflowError) as raised:
            await ready(self.context(page), "#missing", 10)
        self.assertEqual(raised.exception.category, "challenge")

    async def test_challenge_limit_is_attempt_wide(self) -> None:
        locator = AsyncMock()
        locator.count.return_value = 1
        page = SimpleNamespace(locator=lambda _: locator)
        ctx = self.context(page)
        ctx.challenges = 3
        with self.assertRaises(WorkflowError):
            await wyoming.finish_challenges(ctx)
        self.assertEqual(ctx.challenges, 3)
        locator.click.assert_not_awaited()

    async def test_unreviewed_action_never_clicked(self) -> None:
        ctx = self.context(SimpleNamespace(locator=lambda _: AsyncMock()))
        sdk = AsyncMock()
        ctx.stagehand = sdk
        sdk.observe.return_value = SimpleNamespace(
            data=[
                Action(selector="#wrong", description="submit", method="fill", arguments=["value"])
            ]
        )
        with self.assertRaises(WorkflowError):
            await reviewed_detail_click(ctx, "detail")
        sdk.act.assert_not_awaited()

    async def test_reviewed_action_checked_against_href(self) -> None:
        locator = AsyncMock()
        locator.count.return_value = 1
        page = SimpleNamespace(locator=lambda _: locator, evaluate=AsyncMock(return_value="detail"))
        ctx = self.context(page)
        sdk = AsyncMock()
        ctx.stagehand = sdk
        action = Action(selector="#detail", description="Open detail", method="click")
        sdk.observe.return_value = SimpleNamespace(data=[action])
        await reviewed_detail_click(ctx, "detail")
        sdk.act.assert_awaited_once_with(action, page=page, cache=False, timeout=25_000)

    async def test_detail_503_one_read_retry(self) -> None:
        page = AsyncMock()
        page.evaluate.side_effect = [
            {"status": 503, "text": "maintenance"},
            {"status": 200, "text": '{"data":[]}'},
        ]
        with patch("registries.ohio.asyncio.sleep", new=AsyncMock()):
            self.assertEqual(
                await ohio.fetch_json(
                    self.context(page), ohio.API_ORIGIN + "/VD_123", retry_transient=True
                ),
                {"data": []},
            )
        self.assertEqual(page.evaluate.await_count, 2)

    async def test_detail_503_stops_after_two(self) -> None:
        page = AsyncMock()
        page.evaluate.return_value = {"status": 503, "text": "maintenance"}
        with patch("registries.ohio.asyncio.sleep", new=AsyncMock()):
            with self.assertRaises(WorkflowError):
                await ohio.fetch_json(
                    self.context(page), ohio.API_ORIGIN + "/VD_123", retry_transient=True
                )
        self.assertEqual(page.evaluate.await_count, 2)

    async def test_cleanup_both_handles(self) -> None:
        stagehand, browser = AsyncMock(), AsyncMock()
        stagehand.close.side_effect = RuntimeError("closed")
        self.assertEqual(
            await close_handles([("Stagehand", stagehand), ("Browserbase", browser)]),
            ["Stagehand cleanup did not complete"],
        )
        browser.close.assert_awaited_once()

    async def test_global_and_per_registry_concurrency(self) -> None:
        active = peak = 0
        by_state: dict[str, int] = {}

        async def worker(t: Target, _: Path) -> Result:
            nonlocal active, peak
            active += 1
            peak = max(active, peak)
            by_state[t.state] = by_state.get(t.state, 0) + 1
            self.assertEqual(by_state[t.state], 1)
            await asyncio.sleep(0.01)
            active -= 1
            by_state[t.state] -= 1
            return Result(target=t, outcome="partial")

        results, summary = await run_batch(
            [target(s) for s in ("CO", "CO", "OH", "WY", "OH")], self.path, 2, worker
        )
        self.assertEqual(len(results), 5)
        self.assertEqual(peak, 2)
        self.assertEqual(summary["max_active_jobs"], 2)
        with self.assertRaises(ValueError):
            await run_batch([], self.path, 4, worker)

    async def test_worker_failure_does_not_abort_batch(self) -> None:
        async def worker(t: Target, _: Path) -> Result:
            if t.state == "CO":
                raise RuntimeError("failure")
            return Result(target=t, outcome="partial")

        results, _ = await run_batch([target(), target("WY")], self.path, 2, worker)
        self.assertEqual([r.outcome for r in results], ["error", "partial"])

    def session_mocks(self) -> tuple[SimpleNamespace, AsyncMock]:
        browser = SimpleNamespace(
            context=SimpleNamespace(active_page=AsyncMock(return_value=AsyncMock())),
            session_id=None,
            close=AsyncMock(),
        )
        return browser, AsyncMock()

    async def test_one_fresh_transient_retry(self) -> None:
        browser, sdk = self.session_mocks()
        workflow = AsyncMock(
            side_effect=[
                WorkflowError("transient_network", "temporary", retryable=True),
                Result(target=target(), outcome="partial"),
            ]
        )
        with (
            patch.dict("os.environ", {"BROWSERBASE_API_KEY": "dummy-key"}),
            patch("runtime.browserbase.launch", new=AsyncMock(return_value=browser)) as launch,
            patch("runtime.Stagehand.create", new=AsyncMock(return_value=sdk)),
            patch.dict("runtime.WORKFLOWS", {"CO": workflow}),
        ):
            result = await run_target(target(), self.path)
        self.assertEqual(launch.await_count, 2)
        self.assertEqual(len(result.attempts), 2)
        self.assertEqual(browser.close.await_count, 2)
        self.assertEqual(sdk.close.await_count, 2)

    async def test_challenge_never_fresh_retried(self) -> None:
        browser, sdk = self.session_mocks()
        with (
            patch.dict("os.environ", {"BROWSERBASE_API_KEY": "dummy-key"}),
            patch("runtime.browserbase.launch", new=AsyncMock(return_value=browser)) as launch,
            patch("runtime.Stagehand.create", new=AsyncMock(return_value=sdk)),
            patch.dict(
                "runtime.WORKFLOWS",
                {"CO": AsyncMock(side_effect=WorkflowError("challenge", "stop", retryable=True))},
            ),
        ):
            result = await run_target(target(), self.path)
        self.assertEqual(launch.await_count, 1)
        self.assertEqual(result.outcome, "blocked")

    async def test_deadline_cleans_up(self) -> None:
        browser, sdk = self.session_mocks()

        async def slow(_: Context) -> Result:
            await asyncio.sleep(1)
            raise AssertionError("unreachable")

        with (
            patch.dict("os.environ", {"BROWSERBASE_API_KEY": "dummy-key"}),
            patch("runtime.browserbase.launch", new=AsyncMock(return_value=browser)),
            patch("runtime.Stagehand.create", new=AsyncMock(return_value=sdk)),
            patch.dict("runtime.WORKFLOWS", {"CO": slow}),
        ):
            result = await run_target(target(), self.path, deadline=0.05)
        self.assertEqual(result.outcome, "partial")
        browser.close.assert_awaited_once()
        sdk.close.assert_awaited_once()

    async def test_external_cancellation_cleans_up_and_propagates(self) -> None:
        browser, sdk = self.session_mocks()
        entered = asyncio.Event()

        async def slow(_: Context) -> Result:
            entered.set()
            await asyncio.sleep(10)
            raise AssertionError("unreachable")

        with (
            patch.dict("os.environ", {"BROWSERBASE_API_KEY": "dummy-key"}),
            patch("runtime.browserbase.launch", new=AsyncMock(return_value=browser)),
            patch("runtime.Stagehand.create", new=AsyncMock(return_value=sdk)),
            patch.dict("runtime.WORKFLOWS", {"CO": slow}),
        ):
            task = asyncio.create_task(run_target(target(), self.path))
            await entered.wait()
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
        browser.close.assert_awaited_once()
        sdk.close.assert_awaited_once()
        self.assertFalse((self.path / "result.json").exists())


if __name__ == "__main__":
    unittest.main()
