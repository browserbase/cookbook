import ast
import asyncio
from pathlib import Path
from types import SimpleNamespace
import unittest

base = Path(__file__).resolve().parents[1] / 'src/retail_demo/stagehand_tools'
def load(name, function):
    tree = ast.parse((base / name).read_text())
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == function)
    async def pause(*args): pass
    ns = dict(Stagehand=object, RunState=object, Config=object, Any=object,
        tool=lambda *a: lambda fn: fn, create_sdk_mcp_server=lambda **kw: {fn.__name__: fn for fn in kw['tools']},
        make_inject_signals_tool=lambda *a: (lambda: None), SERVER_NAME='synthetic', _BATCH_DESCRIPTION='synthetic',
        log=SimpleNamespace(tool_call=lambda *a: None, short_url=lambda u: u, pause=pause),
        text_result=lambda x: x, error_result=lambda x: {'error': x})
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(base / name), 'exec'), ns)
    return ns[function]

class InvocationTests(unittest.TestCase):
    def test_one_open_wrapper_can_call_three_sdk_methods(self):
        calls=[]
        async def goto(url): calls.append('goto')
        async def url(): calls.append('url'); return 'https://synthetic.invalid'
        page=SimpleNamespace(goto=goto,url=url)
        async def active_page(): calls.append('active_page'); return page
        state=SimpleNamespace(page=None,stagehand_tool_invocations=0)
        stagehand=SimpleNamespace(browser=SimpleNamespace(context=SimpleNamespace(active_page=active_page)))
        tools=load('mcp.py','create_stagehand_server')(stagehand,state,SimpleNamespace())
        asyncio.run(tools['browser_open_page']({'url':'https://synthetic.invalid'}))
        self.assertEqual(calls,['active_page','goto','url'])
        self.assertEqual(state.stagehand_tool_invocations,1)
        async def fail(url): raise RuntimeError('synthetic failure')
        page.goto=fail
        with self.assertRaises(RuntimeError): asyncio.run(tools['browser_open_page']({'url':'https://synthetic.invalid'}))
        self.assertEqual(state.stagehand_tool_invocations,2)

    def test_batch_attempts_count_once_each_even_on_failure(self):
        state=SimpleNamespace(stagehand_tool_invocations=0)
        async def batch(*args,**kwargs): return {'synthetic':True}
        stagehand=SimpleNamespace(experimental_batch=batch)
        tools=load('batch.py','create_batch_server')(stagehand,state,SimpleNamespace(action_delay_ms=0))
        asyncio.run(tools['stagehand_batch']({'source':'synthetic'}))
        self.assertEqual(state.stagehand_tool_invocations,1)
        async def fail(*args,**kwargs): raise RuntimeError('synthetic failure')
        stagehand.experimental_batch=fail
        self.assertIn('error',asyncio.run(tools['stagehand_batch']({'source':'synthetic'})))
        self.assertEqual(state.stagehand_tool_invocations,2)

if __name__ == '__main__': unittest.main()
