import ast
import asyncio
import json
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from model_config import model_options, require_browserbase_key


def functions(filename, names, scope):
    tree = ast.parse((ROOT / filename).read_text())
    nodes = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names]
    assert len(nodes) == len(names)
    exec(compile(ast.Module(body=nodes, type_ignores=[]), filename, 'exec'), scope)


class ModelConfigurationTests(unittest.TestCase):
    def test_credentials_and_endpoint_precedence(self):
        cases = [
            ({'OPENAI_API_KEY': 'openai-fixture'}, 'openai-fixture', None),
            ({'BROWSERBASE_API_KEY': 'bb-fixture', 'DEEPAGENT_BASE_URL': 'https://gateway.invalid/v1'}, 'bb-fixture', 'https://gateway.invalid/v1'),
            ({'BROWSERBASE_API_KEY': 'bb-fixture', 'OPENAI_BASE_URL': 'https://gateway.invalid/v1'}, 'bb-fixture', 'https://gateway.invalid/v1'),
            ({'BROWSERBASE_API_KEY': 'bb-fixture', 'OPENAI_API_KEY': 'openai-fixture', 'DEEPAGENT_BASE_URL': 'https://primary.invalid/v1', 'OPENAI_BASE_URL': 'https://secondary.invalid/v1'}, 'openai-fixture', 'https://primary.invalid/v1'),
        ]
        for env, key, url in cases:
            with self.subTest(env_names=list(env)):
                result = model_options('openai:gpt-fixture', env)
                self.assertEqual(result['model'], 'gpt-fixture')
                self.assertEqual(result['api_key'], key)
                self.assertEqual(result.get('base_url'), url)

    def test_invalid_configuration(self):
        for env in [{}, {'BROWSERBASE_API_KEY': 'fixture'}, {'OPENAI_API_KEY': ' '}, {'DEEPAGENT_BASE_URL': 'https://gateway.invalid'}]:
            with self.subTest(env_names=list(env)), self.assertRaises(ValueError):
                model_options('fixture', env)
        for url in ['ftp://gateway.invalid', 'https://', 'https://user:secret@gateway.invalid', 'https://gateway.invalid?key=secret', 'https://gateway.invalid/#secret', 'https://gateway.invalid:99999']:
            with self.subTest(url=url), self.assertRaises(ValueError) as result:
                model_options('fixture', {'OPENAI_API_KEY': 'secret', 'DEEPAGENT_BASE_URL': url})
            self.assertNotIn('secret', str(result.exception))
        with self.assertRaises(ValueError):
            model_options('openai: ', {'OPENAI_API_KEY': 'fixture'})

    def caller_scope(self):
        captured = {'models': [], 'clients': 0, 'sessions': 0, 'closed': 0, 'invocations': 0}
        def chat(**kwargs):
            captured['models'].append(kwargs)
            return kwargs
        class Session:
            async def __aenter__(self):
                captured['sessions'] += 1
                return self
            async def __aexit__(self, *args):
                captured['closed'] += 1
        class Client:
            def session(self, name):
                assert name == 'fixture-server'
                return Session()
        def create_client():
            require_browserbase_key()
            captured['clients'] += 1
            return Client()
        async def load_tools(session):
            return ['fixture-tool']
        async def invoke(*args, **kwargs):
            captured['invocations'] += 1
            return {'messages': [SimpleNamespace(content='fixture result')]}
        scope = {'os': os, 'Any': Any, 'ChatOpenAI': chat, 'model_options': model_options,
                 'require_browserbase_key': require_browserbase_key,
                 'create_stagehand_client': create_client, 'DEFAULT_STAGEHAND_AGENT_MODEL': 'openai:gpt-fixture',
                 'SERVER_NAME': 'fixture-server', 'BROWSER_INSTRUCTIONS': 'fixture',
                 'load_mcp_tools': load_tools, '_json': json.dumps,
                 'create_deep_agent': lambda **kwargs: SimpleNamespace(ainvoke=invoke),
                 'browserbase_search': None, 'browserbase_fetch': None,
                 'BROWSER_SUBAGENT': {}, 'SYSTEM_PROMPT': 'fixture', 'MemorySaver': lambda: None}
        functions('main.py', {'build_model', 'build_agent'}, scope)
        functions('browser_tools.py', {'_browserbase_interactive_task_async'}, scope)
        return scope, captured

    def test_actual_outer_and_interactive_callers_share_options(self):
        for env in [
            {'BROWSERBASE_API_KEY': 'bb-fixture', 'DEEPAGENT_BASE_URL': 'https://gateway.invalid/v1'},
            {'BROWSERBASE_API_KEY': 'bb-fixture', 'OPENAI_API_KEY': 'openai-fixture'},
            {'BROWSERBASE_API_KEY': 'bb-fixture', 'OPENAI_API_KEY': 'openai-fixture', 'OPENAI_BASE_URL': 'https://gateway.invalid/v1'},
        ]:
            with self.subTest(env_names=list(env)), patch.dict(os.environ, env, clear=True):
                scope, calls = self.caller_scope()
                os.environ['STAGEHAND_AGENT_MODEL'] = 'openai:gpt-fixture'
                scope['build_model']('openai:gpt-fixture')
                result = asyncio.run(scope['_browserbase_interactive_task_async']('https://example.invalid', 'fixture'))
                self.assertEqual(calls['models'][0], calls['models'][1])
                self.assertIn('fixture result', result)
                self.assertEqual((calls['clients'], calls['sessions'], calls['closed'], calls['invocations']), (1, 1, 1, 1))

    def test_invalid_model_never_creates_interactive_client(self):
        with patch.dict(os.environ, {'BROWSERBASE_API_KEY': 'fixture'}, clear=True):
            scope, calls = self.caller_scope()
            with self.assertRaises(ValueError):
                asyncio.run(scope['_browserbase_interactive_task_async']('https://example.invalid', 'fixture'))
            self.assertEqual(calls['clients'], 0)
            self.assertEqual(calls['models'], [])

    def test_actual_mcp_client_uses_validated_browserbase_key(self):
        scope = {'os': os, 'MultiServerMCPClient': lambda config: config,
                 'require_browserbase_key': require_browserbase_key,
                 'SERVER_NAME': 'fixture', 'STAGEHAND_DEEPAGENTS_SOURCE': 'fixture-source'}
        functions('agent_runtime.py', {'create_stagehand_client'}, scope)
        with patch.dict(os.environ, {'BROWSERBASE_API_KEY': '  fixture-key  '}, clear=True):
            config = scope['create_stagehand_client']()
            self.assertEqual(config['fixture']['env']['BROWSERBASE_API_KEY'], 'fixture-key')
        with patch.dict(os.environ, {'BROWSERBASE_API_KEY': '  '}, clear=True):
            with self.assertRaises(ValueError):
                scope['create_stagehand_client']()

    def test_agent_startup_requires_browserbase_before_model(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'fixture'}, clear=True):
            scope, calls = self.caller_scope()
            with self.assertRaises(ValueError):
                scope['build_agent']('fixture')
            self.assertEqual(calls['models'], [])


if __name__ == '__main__':
    unittest.main()
