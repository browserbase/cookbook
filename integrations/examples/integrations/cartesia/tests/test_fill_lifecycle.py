"""Run the actual node class with external voice/browser imports stubbed."""
import ast
import asyncio
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import AsyncGenerator, Dict, List, Optional, Union
import unittest
from unittest.mock import AsyncMock

class Base:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)
    def clear_context(self):
        pass
    @classmethod
    def model_json_schema(cls):
        return {}

class Log:
    def __getattr__(self, name):
        return lambda *args, **kwargs: None

source = Path(__file__).resolve().parents[1] / "form_filling_node.py"
tree = ast.parse(source.read_text())
tree.body = [node for node in tree.body if isinstance(node, ast.ClassDef)]
namespace = dict(globals(), ReasoningNode=Base, BaseModel=Base, Field=lambda **kw: None,
    DEFAULT_MODEL_ID="synthetic", DEFAULT_TEMPERATURE=0, logger=Log(),
    StagehandFormFiller=Base, ConversationContext=Base, AgentResponse=Base, EndCall=Base,
    gemini_types=SimpleNamespace(**{name: lambda **kw: SimpleNamespace(**kw) for name in
        ["Tool", "FunctionDeclaration", "GenerateContentConfig", "ThinkingConfig"]}))
exec(compile(tree, str(source), "exec"), namespace)
Node, Question = namespace["FormFillingNode"], namespace["FormQuestion"]

class Lifecycle(unittest.IsolatedAsyncioTestCase):
    def node(self):
        node = Node("synthetic", None, "https://example.com")
        node.questions = [Question("name", "Name?")]
        node.stagehand_filler = SimpleNamespace(fill_field=AsyncMock(return_value=True), submit_form=AsyncMock(return_value=True), cleanup=AsyncMock())
        return node

    async def test_submission_waits_for_last_fill(self):
        node = self.node()
        started, finish = asyncio.Event(), asyncio.Event()
        async def fill(*args):
            started.set()
            await finish.wait()
            return True
        node.stagehand_filler.fill_field.side_effect = fill
        node._queue_field_fill("name", "Synthetic")
        await started.wait()
        submitting = asyncio.create_task(node._submit_form())
        await asyncio.sleep(0)
        node.stagehand_filler.submit_form.assert_not_awaited()
        finish.set()
        self.assertTrue(await submitting)
        self.assertEqual(node.filled_data, {"name": "Synthetic"})

    async def test_failure_is_retryable(self):
        node = self.node()
        node.stagehand_filler.fill_field.side_effect = [False, True]
        node._queue_field_fill("name", "Synthetic")
        self.assertFalse(await node._submit_form())
        self.assertIn("name", node.fill_failures)
        node.stagehand_filler.submit_form.assert_not_awaited()
        node._queue_field_fill("name", "Corrected")
        self.assertTrue(await node._submit_form())
        self.assertFalse(node.fill_failures)

    async def test_early_call_end_skips_incomplete_form(self):
        node = self.node()
        await node.cleanup_and_submit()
        node.stagehand_filler.submit_form.assert_not_awaited()
        node.stagehand_filler.cleanup.assert_awaited_once()
        with self.assertRaises(RuntimeError):
            node._queue_field_fill("name", "Late")

    async def test_cleanup_waits_and_duplicate_end_is_safe(self):
        node = self.node()
        started, finish = asyncio.Event(), asyncio.Event()
        async def fill(*args):
            started.set()
            await finish.wait()
            return True
        node.stagehand_filler.fill_field.side_effect = fill
        node._queue_field_fill("name", "Synthetic")
        await started.wait()
        closing = asyncio.create_task(node.cleanup_and_submit())
        await asyncio.sleep(0)
        node.stagehand_filler.cleanup.assert_not_awaited()
        finish.set()
        await asyncio.gather(closing, node.cleanup_and_submit())
        node.stagehand_filler.submit_form.assert_awaited_once()
        node.stagehand_filler.cleanup.assert_awaited_once()

    async def test_repeated_field_updates_are_serialized(self):
        node = self.node()
        started, finish = asyncio.Event(), asyncio.Event()
        calls = []
        async def fill(field, value):
            calls.append(value)
            if value == "First":
                started.set()
                await finish.wait()
            return True
        node.stagehand_filler.fill_field.side_effect = fill
        node._queue_field_fill("name", "First")
        await started.wait()
        node._queue_field_fill("name", "Second")
        await asyncio.sleep(0)
        self.assertEqual(calls, ["First"])
        finish.set()
        self.assertTrue(await node._submit_form())
        self.assertEqual(calls, ["First", "Second"])
        self.assertEqual(node.filled_data["name"], "Second")

    async def test_initialization_failure_prevents_submit_and_still_cleans(self):
        node = self.node()
        async def fail():
            raise RuntimeError("synthetic init failure")
        node.browser_init_task = asyncio.create_task(fail())
        node._queue_field_fill("name", "Synthetic")
        await node.cleanup_and_submit()
        node.stagehand_filler.submit_form.assert_not_awaited()
        node.stagehand_filler.cleanup.assert_awaited_once()

    async def test_final_answer_failure_returns_to_retry_question(self):
        node = self.node()
        node.current_question_index = len(node.questions)
        node.stagehand_filler.fill_field.return_value = False
        node._queue_field_fill("name", "Synthetic")
        output = [event async for event in node.process_context(SimpleNamespace(events=[object()]))]
        self.assertEqual(node.current_question_index, 0)
        self.assertIn("try again", output[0].content)
        self.assertFalse(node._closed)
        node.stagehand_filler.submit_form.assert_not_awaited()
        node._queue_field_fill("name", "Corrected")
        node.stagehand_filler.fill_field.return_value = True
        self.assertTrue(await node._submit_form())

    async def test_cleanup_does_not_retry_uncertain_submit(self):
        node = self.node()
        node.stagehand_filler.submit_form.return_value = False
        node._queue_field_fill("name", "Synthetic")
        self.assertFalse(await node._submit_form())
        self.assertFalse(node.form_submitted)
        await node.cleanup_and_submit()
        node.stagehand_filler.submit_form.assert_awaited_once()

    async def test_cancelled_cleanup_drains_fills_before_browser_close(self):
        node = self.node()
        started = asyncio.Event()
        async def fill(*args):
            started.set()
            await asyncio.Event().wait()
        node.stagehand_filler.fill_field.side_effect = fill
        node._queue_field_fill("name", "Synthetic")
        await started.wait()
        closing = asyncio.create_task(node.cleanup_and_submit())
        await asyncio.sleep(0)
        closing.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await closing
        self.assertFalse(node._fill_tasks)
        node.stagehand_filler.cleanup.assert_awaited_once()
        node.stagehand_filler.submit_form.assert_not_awaited()

if __name__ == "__main__":
    unittest.main()
