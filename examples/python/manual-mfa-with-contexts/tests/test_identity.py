import ast
import asyncio
import contextlib
import io
import os
from pathlib import Path
from types import SimpleNamespace as NS
import unittest
from urllib.parse import urlsplit, quote

ROOT = Path(__file__).resolve().parents[1]

class IdentityTests(unittest.TestCase):
    def fixture(self, mode='ok'):
        events = []
        output = io.StringIO()
        count = [0]
        class Page:
            current = 'https://github.com/'
            async def goto(self, url, **kwargs): self.current = 'https://github.com/login' if mode == 'redirect' and 'settings' in url else url
            async def url(self): return self.current if 'settings' in self.current or mode == 'redirect' else 'https://github.com/'
        class Browser:
            def __init__(self):
                self.session_id = 'owned-fixture'
                self.page = Page()
                async def pages(): return [self.page]
                self.context = NS(pages=pages)
            async def close(self):
                events.append('browser-close')
                if mode == 'browser-close': raise RuntimeError('close')
        class Stagehand:
            @staticmethod
            async def create(browser):
                if mode == 'init': raise RuntimeError('init')
                return Stagehand()
            async def close(self):
                events.append('stagehand-close')
                if mode == 'stagehand-close': raise RuntimeError('close')
            async def act(self, *args, **kwargs): pass
            async def extract(self, prompt, schema, **kwargs):
                if prompt.startswith('Is a'): return NS(data=NS(mfa_required=mode in ['mfa', 'timeout']))
                username = '' if mode == 'empty' or (mode == 'reuse-empty' and count[0] == 2) else 'other' if mode == 'wrong' else 'FixtureUser'
                return NS(data=NS(authenticated=mode != 'false', username=username))
        async def launch(**kwargs):
            count[0] += 1
            events.append('launch')
            return Browser()
        class Api:
            def __init__(self, **kwargs): self.contexts = self
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
            async def create(self): events.append('context-create'); return NS(id='fixture-context')
            async def delete(self, *args, **kwargs):
                events.append('context-delete')
                if mode == 'delete': raise RuntimeError('delete')
        async def sleep(*args): pass
        env = {'GITHUB_USERNAME': 'fixtureuser', 'GITHUB_PASSWORD': 'fixture-password', 'BROWSERBASE_API_KEY': 'fixture-key'}
        scope = {'os': NS(environ=env), 'asyncio': NS(sleep=sleep), 'time': NS(monotonic=iter([0, 121]).__next__) if mode == 'timeout' else __import__('time'), 'urlsplit': urlsplit, 'quote': quote,
                 'Stagehand': Stagehand, 'browserbase': NS(launch=launch), 'AsyncBrowserbase': Api, 'AuthenticationState': NS, 'MFAStatus': NS}
        tree = ast.parse((ROOT / 'main.py').read_text())
        nodes = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
        exec(compile(ast.Module(body=nodes, type_ignores=[]), 'main.py', 'exec'), scope)
        return scope, events, output

    def test_success_and_owned_mfa_handoff(self):
        for mode in ['ok', 'mfa']:
            with self.subTest(mode=mode):
                s, events, output = self.fixture(mode)
                with contextlib.redirect_stdout(output): asyncio.run(s['main']())
                self.assertEqual(events, ['context-create', 'launch', 'stagehand-close', 'browser-close', 'launch', 'stagehand-close', 'browser-close', 'context-delete'])
                self.assertIn('second session verified', output.getvalue())
                if mode in ['mfa', 'timeout']: self.assertIn('/sessions/owned-fixture', output.getvalue())
                self.assertNotIn('Logged-in username:', output.getvalue())

    def test_identity_and_cleanup_failures_never_claim_reuse(self):
        for mode in ['empty', 'wrong', 'false', 'redirect', 'reuse-empty', 'init', 'stagehand-close', 'browser-close', 'delete', 'timeout']:
            with self.subTest(mode=mode):
                s, events, output = self.fixture(mode)
                with contextlib.redirect_stdout(output), self.assertRaises(Exception): asyncio.run(s['main']())
                self.assertIn('browser-close', events)
                self.assertEqual(events[-1], 'context-delete')
                self.assertNotIn('second session verified', output.getvalue())

if __name__ == '__main__': unittest.main()
