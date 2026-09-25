import ast
import asyncio
from collections import Counter
import contextlib
from datetime import datetime
import io
import json
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest

BASE = Path(__file__).resolve().parents[1]


def page(url='https://example.invalid/docs'):
    return SimpleNamespace(url=url, title='Fixture', content='Fixture', broken_links=[], broken_anchors=[], analysis_status='not_started', analysis_mode='content')


def response(content):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content, tool_calls=[]))])


def scope():
    names = {'_parse_verification_response', '_crawl_findings', '_analysis_failure', 'analysis_coverage', 'analysis_complete',
             'verify_page', 'verify_all', 'analyze_page', 'analyze_all_parallel', 'print_summary', 'print_issues', 'export_markdown', 'main'}
    tree = ast.parse((BASE / 'main.py').read_text())
    nodes = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names]
    values = {'Page': SimpleNamespace, 'Issue': lambda **kwargs: SimpleNamespace(**{'context': '', **kwargs}),
              'OpenAI': SimpleNamespace, 'AsyncOpenAI': SimpleNamespace, 'Path': Path, 'Counter': Counter,
              'json': json, 'asyncio': asyncio, 'datetime': datetime, 'CEREBRAS_MODEL': 'fixture', 'CEREBRAS_API_KEY': 'synthetic',
              'ANALYSIS_PROMPT': '{url} {title} {content} {current_datetime}', 'VERIFICATION_SYSTEM_PROMPT': 'fixture',
              'VERIFICATION_TOOLS': [], '_get_codebase_listing': lambda _: 'fixture.py'}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), 'main.py', 'exec'), values)
    return values


class AnalysisStatusTests(unittest.TestCase):
    def setUp(self):
        self.s = scope()
        self.output = io.StringIO()
        self.redirect = contextlib.redirect_stdout(self.output)
        self.redirect.__enter__()
        self.addCleanup(self.redirect.__exit__, None, None, None)

    def test_parser_requires_valid_complete_issues_array(self):
        parse = self.s['_parse_verification_response']
        self.assertEqual(parse('{"issues":[]}', 'fixture'), [])
        self.assertEqual(parse('```json\n{"issues":[]}\n```', 'fixture'), [])
        for value in [None, '', 'not JSON', '{"issues":', '{}', '[]', '{"issues":null}', '{"issues":{}}', '{"issues":[{}]}', '{"issues":[{"severity":"unknown"}]}']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                parse(value, 'fixture')
        issue = {'type': 'unclear', 'severity': 'low', 'description': 'Fixture issue', 'suggestion': 'Fixture fix'}
        result = parse(json.dumps({'issues': [issue]}), 'https://example.invalid')
        self.assertEqual(result[0].url, 'https://example.invalid')

    def test_content_analysis_distinguishes_empty_invalid_and_provider_failure(self):
        for mode in ['valid', 'invalid', 'provider']:
            with self.subTest(mode=mode):
                pg = page()
                pg.broken_anchors = ['fixture-anchor']
                async def complete(**kwargs):
                    if mode == 'provider':
                        raise RuntimeError('PRIVATE_PROVIDER_MARKER')
                    return response('{"issues":[]}' if mode == 'valid' else 'invalid')
                llm = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=complete)))
                result = asyncio.run(self.s['analyze_page'](pg, llm, 1, 1, 'fixture'))
                self.assertEqual(pg.analysis_status, 'complete' if mode == 'valid' else 'failed')
                self.assertIn('broken_anchor', [issue.type for issue in result])
                self.assertEqual('analysis_error' in [issue.type for issue in result], mode != 'valid')
        self.assertNotIn('PRIVATE_PROVIDER_MARKER', self.output.getvalue())

    def test_source_verification_failure_does_not_hide_other_pages_or_crawl_findings(self):
        pages = [page('https://example.invalid/failed'), page('https://example.invalid/good')]
        pages[0].broken_anchors = ['fixture']
        def complete(**kwargs):
            if '/failed' in kwargs['messages'][1]['content']:
                raise RuntimeError('provider unavailable')
            return response('{"issues":[]}')
        self.s['OpenAI'] = lambda **kwargs: SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=complete)))
        result = self.s['verify_all'](pages, Path('/synthetic'))
        self.assertEqual([pg.analysis_status for pg in pages], ['failed', 'complete'])
        self.assertEqual({issue.type for issue in result}, {'analysis_error', 'broken_anchor'})

    def test_parallel_unexpected_exception_is_not_discarded(self):
        pages = [page()]
        async def fail(*args):
            raise RuntimeError('PRIVATE_PROVIDER_MARKER')
        self.s['analyze_page'] = fail
        self.s['AsyncOpenAI'] = lambda **kwargs: None
        issues = asyncio.run(self.s['analyze_all_parallel'](pages))
        self.assertEqual(pages[0].analysis_status, 'failed')
        self.assertEqual(issues[0].type, 'analysis_error')
        self.assertNotIn('PRIVATE_PROVIDER_MARKER', self.output.getvalue())

    def test_report_and_filtered_terminal_preserve_incompleteness(self):
        pages = [page()]
        issues = [self.s['_analysis_failure'](pages[0])]
        self.s['print_summary'](pages, issues, 'fixture')
        self.s['print_issues'](issues, severity_filter='low', pages=pages)
        self.assertIn('INCOMPLETE', self.output.getvalue())
        self.assertNotIn('No issues found', self.output.getvalue())
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'report.md'
            report = self.s['export_markdown'](pages, issues, 'fixture', str(target))
            self.assertEqual(target.read_text(), report)
            self.assertIn('**Analysis status:** INCOMPLETE', report)
            self.assertIn('failed (content)', report)
        self.assertFalse(self.s['analysis_complete']([]))
        self.assertFalse(self.s['analysis_complete']([page()]))

    def test_valid_empty_result_produces_complete_report(self):
        pg = page()
        pg.analysis_status = 'complete'
        with tempfile.TemporaryDirectory() as directory:
            report = self.s['export_markdown']([pg], [], 'fixture', str(Path(directory) / 'report.md'))
        self.assertIn('**Analysis status:** COMPLETE', report)
        self.assertNotIn('INCOMPLETE', report)
        self.s['print_issues']([], pages=[pg])
        self.assertIn('No issues found in completed analysis.', self.output.getvalue())

    def test_main_writes_incomplete_report_then_fails(self):
        pages = [page()]
        async def crawl(*args, **kwargs): return pages
        async def discover(*args): return None
        async def analyze(*args, **kwargs): return [self.s['_analysis_failure'](pages[0])]
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'report.md'
            export = self.s['export_markdown']
            self.s.update({'sys': SimpleNamespace(argv=['main.py']), 'DEFAULT_URL': 'fixture', 'MAX_PAGES': 1, 'MAX_DEPTH': 1, 'MAX_CRAWL_WORKERS': 1,
                           'crawl': crawl, 'discover_repo_from_pages': lambda _: None, 'discover_repo_with_agent': discover, 'analyze_all_parallel': analyze,
                           'export_markdown': lambda pages, issues, url: export(pages, issues, url, str(target))})
            with self.assertRaisesRegex(RuntimeError, 'incomplete'):
                asyncio.run(self.s['main']())
            self.assertIn('INCOMPLETE', target.read_text())


if __name__ == '__main__':
    unittest.main()
