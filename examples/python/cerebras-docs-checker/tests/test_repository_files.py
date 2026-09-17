import ast
import contextlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

BASE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE))
from repository_files import read_repository_file


class RepositoryFileTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'clone'
        self.root.mkdir()
        (self.root / 'src').mkdir()
        (self.root / 'src' / 'owned.txt').write_text('INSIDE_FIXTURE')
        self.outside = self.base / 'outside.txt'
        self.outside.write_text('OUTSIDE_PRIVATE_FIXTURE')

    def test_relative_read_and_limit(self):
        self.assertEqual(read_repository_file(self.root, './src/owned.txt'), 'INSIDE_FIXTURE')
        (self.root / 'long.txt').write_text('x' * 20000)
        self.assertEqual(read_repository_file(self.root, 'long.txt'), 'x' * 8000)

    def test_invalid_paths_and_nonfiles(self):
        for requested in [str(self.outside), '../outside.txt', 'src/../../outside.txt', 'src/../src/owned.txt', 'C:\\outside.txt', 'C:outside.txt', None, 1, {}, '', '.', 'src', 'missing', 'bad\0name']:
            with self.subTest(requested=requested):
                result = read_repository_file(self.root, requested)
                self.assertNotIn('OUTSIDE_PRIVATE_FIXTURE', result)
                self.assertNotEqual(result, 'INSIDE_FIXTURE')
        (self.root / 'binary').write_bytes(b'\xff\xfe')
        self.assertIn('Unable to read', read_repository_file(self.root, 'binary'))

    def test_file_directory_and_root_symlinks_are_refused(self):
        (self.root / 'file-link').symlink_to(self.outside)
        (self.root / 'dir-link').symlink_to(self.base, target_is_directory=True)
        (self.root / 'internal-link').symlink_to(self.root / 'src' / 'owned.txt')
        alias = self.base / 'clone-alias'
        alias.symlink_to(self.root, target_is_directory=True)
        for root, requested in [(self.root, 'file-link'), (self.root, 'dir-link/outside.txt'), (self.root, 'internal-link'), (alias, 'src/owned.txt')]:
            self.assertIn('Unable to read', read_repository_file(root, requested))

    def test_hidden_and_credential_files_are_denied(self):
        for name in ['.env', '.env.local', '.npmrc', 'credentials.json', 'secrets.json', 'private.pem', 'private.key']:
            with self.subTest(name=name):
                (self.root / name).write_text('SYNTHETIC_CREDENTIAL_MARKER')
                self.assertNotIn('SYNTHETIC_CREDENTIAL_MARKER', read_repository_file(self.root, name))
        (self.root / '.git').mkdir()
        (self.root / '.git' / 'config').write_text('SYNTHETIC_CREDENTIAL_MARKER')
        self.assertNotIn('SYNTHETIC_CREDENTIAL_MARKER', read_repository_file(self.root, '.git/config'))

    def test_fifo_is_not_opened_as_blocking_text(self):
        os.mkfifo(self.root / 'pipe')
        self.assertIn('regular repository file', read_repository_file(self.root, 'pipe'))

    def test_directory_swap_cannot_redirect_an_open_descriptor(self):
        original = os.open
        def swap(path, flags, *args, **kwargs):
            fd = original(path, flags, *args, **kwargs)
            if path == 'src':
                (self.root / 'src').rename(self.root / 'original-src')
                (self.root / 'src').symlink_to(self.base, target_is_directory=True)
            return fd
        with patch('os.open', swap), patch('os.supports_dir_fd', os.supports_dir_fd | {swap}):
            self.assertEqual(read_repository_file(self.root, 'src/owned.txt'), 'INSIDE_FIXTURE')

    def test_final_file_replaced_by_symlink_before_open_is_refused(self):
        original = os.open
        def swap(path, flags, *args, **kwargs):
            if path == 'owned.txt':
                (self.root / 'src' / 'owned.txt').unlink()
                (self.root / 'src' / 'owned.txt').symlink_to(self.outside)
            return original(path, flags, *args, **kwargs)
        with patch('os.open', swap), patch('os.supports_dir_fd', os.supports_dir_fd | {swap}):
            self.assertIn('Unable to read', read_repository_file(self.root, 'src/owned.txt'))

    def test_actual_tool_and_model_followup_never_receive_outside_bytes(self):
        source = ast.parse((BASE / 'main.py').read_text())
        names = {'_execute_verification_tool', 'verify_page', '_crawl_findings'}
        nodes = [node for node in source.body if isinstance(node, ast.FunctionDef) and node.name in names]
        scope = {'Path': Path, 'Page': SimpleNamespace, 'OpenAI': SimpleNamespace, 'Issue': SimpleNamespace, 'json': json,
                 'read_repository_file': read_repository_file, 'VERIFICATION_SYSTEM_PROMPT': 'fixture',
                 'VERIFICATION_TOOLS': [], 'CEREBRAS_MODEL': 'fixture', '_parse_verification_response': lambda *_: []}
        exec(compile(ast.Module(body=nodes, type_ignores=[]), 'main.py', 'exec'), scope)
        calls = []
        def completion(**kwargs):
            calls.append(json.loads(json.dumps(kwargs['messages'], default=vars)))
            tool = SimpleNamespace(id='fixture', function=SimpleNamespace(name='read_file', arguments=json.dumps({'path': '../outside.txt'})))
            message = SimpleNamespace(tool_calls=[tool] if len(calls) == 1 else [], content='{"issues":[]}')
            return SimpleNamespace(choices=[SimpleNamespace(message=message)])
        llm = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=completion)))
        page = SimpleNamespace(url='https://example.invalid/docs', title='Fixture', content='Fixture', broken_links=[], broken_anchors=[])
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(scope['verify_page'](page, llm, self.root, 'src/owned.txt', 1, 1), [])
        self.assertEqual(len(calls), 2)
        self.assertNotIn('OUTSIDE_PRIVATE_FIXTURE', json.dumps(calls))
        self.assertTrue(any(m.get('role') == 'tool' and 'parent traversal' in m['content'] for m in calls[1]))


if __name__ == '__main__':
    unittest.main()
