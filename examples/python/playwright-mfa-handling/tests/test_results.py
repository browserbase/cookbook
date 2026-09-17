import ast
import asyncio
import contextlib
import io
from pathlib import Path
import re
import time
from types import SimpleNamespace as NS
import unittest
from urllib.parse import urlsplit

BASE = Path(__file__).resolve().parents[1]
DEMO = 'https://authenticationtest.com/totpChallenge/'

class Page:
    def __init__(self, states, url=DEMO): self.states=states; self.attempt=0; self.url=url; self.waits=[]
    def get_by_role(self, role, *, name, exact):
        assert role == 'heading' and exact
        state=self.states[min(self.attempt,len(self.states)-1)]
        n=state.get('success' if name == 'Login Success' else 'failure',0)
        async def count(): return n
        async def visible(): return not state.get('hidden',False)
        locator=NS(count=count,is_visible=visible);locator.first=locator;return locator
    def locator(self, selector):
        async def text(): return self.states[min(self.attempt,len(self.states)-1)].get('body','')
        return NS(inner_text=text)
    async def goto(self,*args,**kwargs): pass
    async def wait_for_timeout(self,ms): self.waits.append(ms)

class ResultTests(unittest.TestCase):
    def scope(self):
        tree=ast.parse((BASE/'main.py').read_text())
        nodes=[n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name in {'check_login_result','main'}]
        s={'Page':Page,'urlsplit':urlsplit,'re':re,'DEMO_URL':DEMO,'time':time,'TEST_CREDENTIALS':{'email':'fixture','password':'fixture','totp_secret':'fixture'},'generate_totp':lambda _: '123456'}
        exec(compile(ast.Module(body=nodes,type_ignores=[]),'main.py','exec'),s);return s
    def test_positive_negative_unknown_and_ambiguous_dom_states(self):
        cases=[({'success':1},True),({'body':'Authentication unsuccessful'},False),({'body':'Sorry -- You have not successfully logged in'},False),({'body':'success'},False),({'success':1,'failure':1},False),({'success':1,'body':'Login failed'},False),({'success':2},False),({'success':1,'hidden':True},False),({},False)]
        for state,expected in cases:
            with self.subTest(state=state): self.assertEqual(asyncio.run(self.scope()['check_login_result'](Page([state])))['success'],expected)
        self.assertFalse(asyncio.run(self.scope()['check_login_result'](Page([{'success':1}], 'https://elsewhere.invalid/')))['success'])
    def test_actual_main_retries_then_fails_or_confirms_and_closes(self):
        for states in [[{'success':1}],[{}, {'success':1}],[{},{}],[{'body':'Authentication unsuccessful'},{'failure':1}]]:
            with self.subTest(states=states):
                s=self.scope();page=Page(states);closed=[];submissions=[]
                async def close(): closed.append(True)
                async def create():return NS(close=close),None,page,'fixture'
                async def fill(*args):pass
                async def submit(*args):page.attempt=len(submissions);submissions.append(True)
                s.update(create_browserbase_session=create,fill_login_form=fill,submit_form=submit)
                output=io.StringIO();success=states[-1].get('success')==1
                with contextlib.redirect_stdout(output),contextlib.redirect_stderr(io.StringIO()):
                    if success: asyncio.run(s['main']())
                    else:
                        with self.assertRaisesRegex(RuntimeError,'two attempts'):asyncio.run(s['main']())
                self.assertEqual(closed,[True]);self.assertEqual(len(submissions),len(states))
                self.assertEqual('MFA handling completed' in output.getvalue(),success)
                self.assertEqual(len(page.waits),len(states)-1)
                if page.waits:self.assertTrue(0<page.waits[0]<=30050)

if __name__=='__main__':unittest.main()
