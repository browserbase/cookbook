"""Actual submission helper with synthetic Page/Stagehand boundaries."""
import ast
import asyncio
from dataclasses import dataclass
from enum import Enum
import json
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock

class Log:
    def __getattr__(self, name):
        return lambda *args, **kwargs: None

source = Path(__file__).resolve().parents[1] / "stagehand_form_filler.py"
tree = ast.parse(source.read_text())
tree.body = [node for node in tree.body if isinstance(node, ast.ClassDef)]
namespace = dict(globals(), Stagehand=object, StagehandBrowser=object, Page=object, logger=Log())
exec(compile(tree, str(source), "exec"), namespace)
Filler = namespace["StagehandFormFiller"]

class Submission(unittest.IsolatedAsyncioTestCase):
    def filler(self, states):
        filler = Filler("https://example.com", success_selector="#confirmation", success_text="Application received")
        filler.page = SimpleNamespace(evaluate=AsyncMock(side_effect=states))
        filler.stagehand = SimpleNamespace(act=AsyncMock(return_value=SimpleNamespace(data=SimpleNamespace(success=True))))
        return filler

    async def test_click_without_confirmation_is_not_success(self):
        filler = self.filler([{"confirmed": False, "invalid": False}])
        # Exhaustion simulates a failed subsequent observation, never success.
        self.assertFalse(await filler.submit_form())
        self.assertEqual(filler.submission_state, "unconfirmed")
        self.assertFalse(await filler.submit_form())
        filler.stagehand.act.assert_awaited_once()

    async def test_delayed_confirmation_and_no_duplicate_click(self):
        filler = self.filler([{"confirmed": False, "invalid": False}] * 2 + [{"confirmed": True, "invalid": False}])
        self.assertTrue(await filler.submit_form())
        self.assertTrue(await filler.submit_form())
        self.assertEqual(filler.submission_state, "confirmed")
        filler.stagehand.act.assert_awaited_once()

    async def test_validation_takes_precedence_and_can_retry_after_correction(self):
        filler = self.filler([{"confirmed": False, "invalid": False}, {"confirmed": True, "invalid": True}])
        self.assertFalse(await filler.submit_form())
        self.assertEqual(filler.submission_state, "validation_failed")
        filler.page.evaluate.side_effect = [{"confirmed": False, "invalid": False}, {"confirmed": True, "invalid": False}]
        self.assertTrue(await filler.submit_form())

    async def test_preexisting_confirmation_does_not_prove_new_submission(self):
        filler = self.filler([{"confirmed": True, "invalid": False}])
        self.assertFalse(await filler.submit_form())
        filler.stagehand.act.assert_not_awaited()

    async def test_missing_config_prevents_click(self):
        filler = self.filler([])
        filler.success_text = " "
        self.assertFalse(await filler.submit_form())
        filler.stagehand.act.assert_not_awaited()

    async def test_rejected_click_and_malformed_observation(self):
        filler = self.filler([{"confirmed": False, "invalid": False}])
        filler.stagehand.act.return_value.data.success = False
        self.assertFalse(await filler.submit_form())
        self.assertEqual(filler.page.evaluate.await_count, 1)
        filler = self.filler([{"confirmed": "true", "invalid": False}])
        self.assertFalse(await filler.submit_form())
        filler.stagehand.act.assert_not_awaited()

    async def test_observation_timeout_remains_unknown(self):
        filler = self.filler([])
        async def evaluate(expression):
            if filler.page.evaluate.await_count == 1:
                return {"confirmed": False, "invalid": False}
            raise asyncio.TimeoutError()
        filler.page.evaluate.side_effect = evaluate
        self.assertFalse(await filler.submit_form())
        self.assertEqual(filler.submission_state, "unconfirmed")

    async def test_actual_node_announces_only_confirmed_submission(self):
        from test_fill_lifecycle import namespace as node_namespace, Question
        async def end_call(args):
            yield SimpleNamespace(content=args.goodbye_message)
        node_namespace["end_call"] = end_call
        node_namespace["EndCallArgs"] = SimpleNamespace
        for confirmed in (False, True):
            with self.subTest(confirmed=confirmed):
                filler = self.filler([{"confirmed": False, "invalid": False}, {"confirmed": confirmed, "invalid": False}])
                filler.stagehand.close = AsyncMock()
                node = node_namespace["FormFillingNode"]("synthetic", None, "https://example.com")
                node.questions = [Question("name", "Name?")]
                node.current_question_index = 1
                node.collected_data = {"name": "Synthetic"}
                node.filled_data = dict(node.collected_data)
                node.stagehand_filler = filler
                output = [event async for event in node.process_context(SimpleNamespace(events=[object()]))]
                self.assertEqual(node.form_submitted, confirmed)
                self.assertIn("I've submitted" if confirmed else "could not confirm", output[-1].content)
                filler.stagehand.act.assert_awaited_once()

if __name__ == "__main__":
    unittest.main()
