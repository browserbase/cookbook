import ast
import asyncio
import contextlib
import __future__
import io
from pathlib import Path
from types import SimpleNamespace as NS
import unittest
from urllib.parse import urlsplit

SOURCE = Path(__file__).resolve().parents[1] / 'main.py'

class SubmissionTests(unittest.TestCase):
    def run_case(self, **change):
        tree = ast.parse(SOURCE.read_text())
        names = {'checked_act', 'application_state', 'validate_job_url', 'close_session', 'apply_to_job'}
        nodes = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name in names]
        calls = []; closed = []; uploaded = []; waits = []
        url = 'https://agent-job-board.vercel.app/jobs/1'
        job = NS(url=change.get('job_url', url), title='Synthetic Role')
        async def act(instruction, **options):
            self.assertIs(options['page'], page)
            calls.append(instruction)
            return NS(data=NS(success=len(calls) != change.get('fail_action')))
        async def observe(*args, **kwargs):
            return NS(data=[NS(selector='#resume')] * change.get('observed', 1))
        async def count(): return change.get('input_count', 1)
        async def upload(payload): uploaded.append(payload)
        async def current_url(): return change.get('result_url', url)
        async def evaluate(script):
            if len(calls) < 5:
                state = dict(name='fixture-agent', email='fixture@example.com', region='us-west-2',
                    resume={'name':'Agent Resume.pdf','size':len(b'%PDFfixture'),'type':'application/pdf'},
                    multiRegion=True, formCount=1, headings=[], paragraphs=[])
                state.update(change.get('before', {})); return state
            state = dict(formCount=0, headings=['Deployment Request Submitted!'],
                paragraphs=['Your application for Synthetic Role at Example has been received. Deployment protocols will be initiated soon.'])
            state.update(change.get('after', {})); return state
        async def goto(*args, **kwargs): pass
        async def wait(ms): waits.append(ms)
        async def close_browser(): closed.append('browser')
        async def close_stagehand():
            closed.append('stagehand')
            if change.get('close_error'): raise RuntimeError('synthetic close error')
        page = NS(goto=goto, locator=lambda _: NS(count=count, set_input_files=upload), url=current_url, evaluate=evaluate, wait_for_timeout=wait)
        async def pages(): return [page]
        browser = NS(context=NS(pages=pages), close=close_browser)
        async def launch(**kwargs): return browser
        async def create(**kwargs):
            if change.get('init_error'): raise RuntimeError('synthetic init error')
            return NS(act=act, observe=observe, close=close_stagehand)
        scope = dict(urlsplit=urlsplit, Stagehand=NS(create=create), browserbase=NS(launch=launch),
            require_env=lambda _: 'synthetic', generate_agent_id=lambda: 'fixture-agent',
            generate_random_email=lambda: 'fixture@example.com', FilePayload=lambda **kwargs: kwargs)
        exec(compile(ast.Module(body=nodes,type_ignores=[]), str(SOURCE), 'exec', flags=__future__.annotations.compiler_flag), scope)
        async def invoke():
            sem = asyncio.Semaphore(1)
            try: return await scope['apply_to_job'](job, b'%PDFfixture', sem)
            finally: self.assertEqual(sem._value, 1)
        error = None; result = None; output = io.StringIO()
        with contextlib.redirect_stdout(output):
            try: result = asyncio.run(invoke())
            except Exception as exc: error = exc
        return NS(error=error,result=result,calls=calls,closed=closed,output=output.getvalue(),waits=waits)

    def test_confirmed_demo(self):
        r = self.run_case()
        self.assertIsNone(r.error); self.assertEqual(r.result,'Synthetic Role')
        self.assertEqual(r.closed,['stagehand','browser']); self.assertIn('Demo submission confirmed locally',r.output)
        self.assertEqual(len(r.calls),5)

    def test_each_failed_action_stops_completion(self):
        for i in range(1,6):
            with self.subTest(action=i):
                r = self.run_case(fail_action=i)
                self.assertIsNotNone(r.error); self.assertEqual(len(r.calls),i)
                self.assertNotIn('confirmed locally',r.output); self.assertEqual(r.closed,['stagehand','browser'])

    def test_missing_or_wrong_fields_upload_and_confirmation(self):
        cases = [dict(observed=0),dict(observed=2),dict(input_count=2),
            *[dict(before={key: value}) for key,value in [('name','other'),('email','other'),('region','other'),('resume',None),('multiRegion',False),('formCount',0),('headings',['Deployment Request Submitted!'])]],
            dict(after={'headings':[]}),dict(after={'formCount':1}),dict(after={'paragraphs':['Your application for Other Role at Example has been received. Deployment protocols will be initiated soon.']}),dict(result_url='https://elsewhere.invalid/')]
        for change in cases:
            with self.subTest(change=change):
                r=self.run_case(**change);self.assertIsNotNone(r.error);self.assertIsNone(r.result)
                self.assertNotIn('confirmed locally',r.output);self.assertEqual(r.closed,['stagehand','browser'])
                self.assertLessEqual(len(r.waits),20)

    def test_initialization_cleanup_and_url_validation(self):
        for change,expected in [(dict(init_error=True),['browser']),(dict(close_error=True),['stagehand','browser']),(dict(job_url='https://elsewhere.invalid/jobs/1'),[])]:
            with self.subTest(change=change):
                r=self.run_case(**change);self.assertIsNotNone(r.error);self.assertEqual(r.closed,expected)
                self.assertNotIn('confirmed locally',r.output)

if __name__ == '__main__': unittest.main()
