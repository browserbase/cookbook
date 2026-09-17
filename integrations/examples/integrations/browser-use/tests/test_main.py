import asyncio
import contextlib
import importlib.util
import io
import os
from pathlib import Path
from types import ModuleType, SimpleNamespace
from urllib.parse import unquote
import unittest
from unittest.mock import AsyncMock, Mock, patch

SOURCE = Path(__file__).resolve().parents[1] / "main.py"

class Lifecycle(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.result = SimpleNamespace(is_successful=Mock(return_value=True), final_result=Mock(return_value="Synthetic schedule"))
        self.browser = SimpleNamespace(stop=AsyncMock())
        self.agent = SimpleNamespace(run=AsyncMock(return_value=self.result))
        self.client = SimpleNamespace(sessions=SimpleNamespace(create=Mock(return_value=SimpleNamespace(id="synthetic-session", connect_url="wss://synthetic.invalid")), update=Mock()), close=Mock())
        self.bb = Mock(return_value=self.client)
        self.model = Mock(return_value=object())
        self.browser_ctor = Mock(return_value=self.browser)
        self.agent_ctor = Mock(return_value=self.agent)
        self.profile = Mock(side_effect=lambda **kwargs: kwargs)
        self.dotenv = Mock()
        modules = {}
        for name, values in {
            "dotenv": {"load_dotenv": self.dotenv},
            "browserbase": {"Browserbase": self.bb},
            "browser_use": {"Agent": self.agent_ctor, "Browser": self.browser_ctor, "BrowserProfile": self.profile, "ChatAnthropic": self.model},
        }.items():
            module = ModuleType(name)
            module.__dict__.update(values)
            modules[name] = module
        spec = importlib.util.spec_from_file_location("synthetic_browser_use_recipe", SOURCE)
        self.module = importlib.util.module_from_spec(spec)
        with patch.dict("sys.modules", modules):
            spec.loader.exec_module(self.module)
        self.dotenv.assert_not_called()
        self.environment = patch.dict(os.environ, {name: "synthetic" for name in ["BROWSERBASE_API_KEY", "ANTHROPIC_API_KEY"]}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)

    async def run_recipe(self):
        with contextlib.redirect_stdout(io.StringIO()):
            return await self.module.main()

    async def test_missing_model_key_before_allocation(self):
        del os.environ["ANTHROPIC_API_KEY"]
        with self.assertRaisesRegex(RuntimeError, "ANTHROPIC_API_KEY"):
            await self.run_recipe()
        self.bb.assert_not_called()

    async def test_invalid_model_before_allocation(self):
        self.model.side_effect = ValueError("model configuration")
        with self.assertRaises(ValueError):
            await self.run_recipe()
        self.bb.assert_not_called()

    async def test_owned_read_only_fixture_and_release(self):
        await self.run_recipe()
        kwargs = self.agent_ctor.call_args.kwargs
        url = kwargs["initial_actions"][0]["navigate"]["url"]
        self.assertTrue(url.startswith("data:text/html"))
        html = unquote(url.split(",", 1)[1])
        self.assertEqual(html, SOURCE.with_name("fixture.html").read_text())
        for tag in ("<form", "<input", "<script", "<a "):
            self.assertNotIn(tag, html)
        self.assertIn("form-action 'none'", html)
        self.assertEqual(self.profile.call_args.kwargs["allowed_domains"], ["cookbook.invalid"])
        self.agent.run.assert_awaited_once_with(max_steps=5)
        self.browser.stop.assert_awaited_once()
        self.client.sessions.update.assert_called_once_with("synthetic-session", status="REQUEST_RELEASE")
        self.client.close.assert_called_once()

    async def test_constructor_failure_after_allocation_releases(self):
        self.browser_ctor.side_effect = RuntimeError("browser construction")
        with self.assertRaisesRegex(RuntimeError, "browser construction"):
            await self.run_recipe()
        self.client.sessions.update.assert_called_once()
        self.client.close.assert_called_once()

    async def test_create_failure_does_not_invent_release(self):
        self.client.sessions.create.side_effect = RuntimeError("create")
        with self.assertRaisesRegex(RuntimeError, "create"):
            await self.run_recipe()
        self.client.sessions.update.assert_not_called()
        self.client.close.assert_called_once()

    async def test_run_failure_and_both_cleanup_failures_preserved(self):
        errors = [RuntimeError("run"), RuntimeError("stop"), RuntimeError("release")]
        self.agent.run.side_effect = errors[0]
        self.browser.stop.side_effect = errors[1]
        self.client.sessions.update.side_effect = errors[2]
        with self.assertRaises(BaseExceptionGroup) as caught:
            await self.run_recipe()
        self.assertEqual(list(caught.exception.exceptions), errors)
        self.client.close.assert_called_once()

    async def test_cancellation_releases(self):
        self.agent.run.side_effect = asyncio.CancelledError()
        with self.assertRaises(asyncio.CancelledError):
            await self.run_recipe()
        self.browser.stop.assert_awaited_once()
        self.client.sessions.update.assert_called_once()

    async def test_incomplete_result_is_failure_with_cleanup(self):
        self.result.is_successful.return_value = False
        with self.assertRaisesRegex(RuntimeError, "completed result"):
            await self.run_recipe()
        self.browser.stop.assert_awaited_once()
        self.client.sessions.update.assert_called_once()

if __name__ == "__main__":
    unittest.main()
