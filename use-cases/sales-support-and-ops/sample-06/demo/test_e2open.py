import asyncio
import importlib.util
import os
import sys
import types
import unittest
from unittest.mock import patch


class Sessions:
    def __init__(self):
        self.calls = 0

    def create(self, **kwargs):
        self.calls += 1
        return types.SimpleNamespace(connect_url="wss://fixture.invalid", id="fixture")


sessions = Sessions()
browserbase_module = types.ModuleType("browserbase")
browserbase_module.Browserbase = lambda **kwargs: types.SimpleNamespace(sessions=sessions)
dotenv_module = types.ModuleType("dotenv")
dotenv_module.load_dotenv = lambda: None
playwright_module = types.ModuleType("playwright")
playwright_async = types.ModuleType("playwright.async_api")
playwright_async.async_playwright = lambda: None
sys.modules.update({
    "browserbase": browserbase_module,
    "dotenv": dotenv_module,
    "playwright": playwright_module,
    "playwright.async_api": playwright_async,
})

spec = importlib.util.spec_from_file_location("e2open_fixture", os.path.join(os.path.dirname(__file__), "e2open.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PortalLifecycleTests(unittest.TestCase):
    def setUp(self):
        sessions.calls = 0

    def test_missing_credentials_fail_before_session_allocation(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "E2OPEN_USERNAME"):
                asyncio.run(module.main())
        self.assertEqual(sessions.calls, 0)


if __name__ == "__main__":
    unittest.main()
