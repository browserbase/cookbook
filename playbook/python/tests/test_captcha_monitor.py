import ast
import math
import os
from pathlib import Path
import time
import types
import unittest
from unittest.mock import patch

SOURCE=Path(__file__).resolve().parents[1]/'selenium/stealth/captcha_listening.py'
START='browserbase-solving-started'
END='browserbase-solving-finished'
def event(text,timestamp=0,level='INFO'):return {'level':level,'message':f'console-api 1:2 "{text}"','timestamp':timestamp}
def module():
    tree=ast.parse(SOURCE.read_text());tree.body=[n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))]
    ns=dict(math=math,os=os,time=time,WebDriver=object,RemoteConnection=object,Command=types.SimpleNamespace(GET_LOG='getLog'),print=lambda *a:None)
    exec(compile(tree,str(SOURCE),'exec'),ns);return ns
class Driver:
    name='fixture';caps={'browserVersion':'fixture'};current_url='https://fixture.invalid';title='fixture'
    def __init__(self,batches,stale=None):self.batches=list(batches);self.before=True;self.stale=stale or [];self.quit_called=False;self.calls=[]
    def execute(self,command,params):
        assert command == "getLog"
        return {"value": self.get_log(params["type"])}
    def get_log(self,kind):
        self.calls.append(('logs',kind))
        if self.before:return self.stale
        return self.batches.pop(0) if self.batches else []
    def get(self,url):self.before=False;self.calls.append(('navigate',url))
    def set_page_load_timeout(self,timeout):self.calls.append(('page_timeout',timeout))
    def quit(self):self.quit_called=True
class Monitor(unittest.TestCase):
    def run_case(self,batches,stale=None):
        ns=module();clock=[0];ns['time']=types.SimpleNamespace(monotonic=lambda:clock[0],sleep=lambda n:clock.__setitem__(0,clock[0]+n))
        driver=Driver(batches,stale);result=ns['run'](driver,timeout_seconds=2);return result,driver,clock[0]
    def test_completed_cycle(self):
        for batches in [[[event(START,0),event(END,50)]],[[event(START,0)],[],[event(END,300)]]]:
            with self.subTest(batches=batches):
                r,d,_=self.run_case(batches);self.assertEqual(r['status'],'solved');self.assertEqual(r['pending'],0);self.assertEqual(r['completed'],1);self.assertLess(d.calls.index(('logs','browser')),next(i for i,c in enumerate(d.calls) if c[0]=='navigate'))
    def test_pending_or_partial_cycle_times_out(self):
        for batches in [[[event(START,0)]],[[event(START,1),event(START,2),event(END,3)]]]:
            with self.subTest(batches=batches):
                with self.assertRaises(TimeoutError):self.run_case(batches)
    def test_no_event_means_only_not_observed(self):
        r,_,elapsed=self.run_case([[]]);self.assertEqual(r['status'],'no_challenge_observed');self.assertGreaterEqual(elapsed,2);self.assertEqual(r['started'],0)
    def test_stale_logs_are_discarded(self):
        r,_,_=self.run_case([[]],[event(START,1),event(END,2)]);self.assertEqual(r['status'],'no_challenge_observed')
    def test_multiple_starts_require_multiple_finishes(self):
        r,_,_=self.run_case([[event(START,0),event(START,1),event(END,2),event(END,3)]]);self.assertEqual(r['completed'],2);self.assertEqual(r['pending'],0)
    def test_orphan_backwards_and_malformed_events_fail(self):
        for batch in [[event(END,1)],[event(START,10),event(END,9)],[event(START,float('nan'))],[event(START,'bad')]]:
            with self.subTest(batch=batch):
                with self.assertRaises(ValueError):self.run_case([batch])
    def test_late_log_response_cannot_succeed(self):
        ns=module();clock=[0];ns["time"]=types.SimpleNamespace(monotonic=lambda:clock[0],sleep=lambda n:clock.__setitem__(0,clock[0]+n))
        driver=Driver([])
        def execute(command,params):
            if driver.before:return {"value": []}
            clock[0]=3
            return {"value": [event(START,0),event(END,1)]}
        driver.execute=execute
        with self.assertRaises(TimeoutError):ns["run"](driver,timeout_seconds=2)
    def test_invalid_timeout(self):
        for timeout in [0,-1,float('inf'),float('nan')]:
            with self.assertRaises(ValueError):module()['run'](Driver([]),timeout_seconds=timeout)
    def test_installed_remote_logging_contract(self):
        try:
            from selenium import webdriver
            from selenium.webdriver.remote.command import Command
            from selenium.webdriver.remote.remote_connection import RemoteConnection
        except ImportError:
            self.skipTest("Run with the recipe Selenium dependency installed")
        calls=[]
        class Executor:
            def execute(self,command,params):
                calls.append((command,params))
                if command == Command.NEW_SESSION:
                    return {"value":{"sessionId":"fixture","capabilities":{"browserName":"chrome"}}}
                return {"value":[event(START,0),event(END,1)]}
            def close(self):pass
        driver=webdriver.Remote(command_executor=Executor(),options=webdriver.ChromeOptions())
        entries=driver.execute(Command.GET_LOG,{"type":"browser"})["value"]
        self.assertEqual(len(entries),2)
        self.assertEqual(calls[-1],(Command.GET_LOG,{"type":"browser","sessionId":"fixture"}))
        connection=RemoteConnection("http://127.0.0.1:9")
        try:self.assertEqual(connection.get_command(Command.GET_LOG),("POST","/session/$sessionId/se/log"))
        finally:connection.close()
    def test_instances_do_not_share_state(self):
        ns=module();one=ns['SolveState']();one.handle_console(event(START,1));two=ns['SolveState']();self.assertEqual(two.started,0)
    def test_main_propagates_monitor_failure_and_quits(self):
        for fail in [True,False]:
            ns=module();driver=Driver([]);allocated=[]
            class Options:
                def set_capability(self,name,value):self.cap=(name,value)
            def remote(connection,options):
                self.assertEqual(options.cap,('goog:loggingPrefs',{'browser':'ALL'}));allocated.append(1);return driver
            ns['BrowserbaseConnection']=lambda *a,**k:object();ns['webdriver']=types.SimpleNamespace(ChromeOptions=Options,Remote=remote)
            def run(*a,**k):
                if fail:raise TimeoutError('synthetic pending challenge')
                return {'status':'no_challenge_observed','started':0,'completed':0,'pending':0}
            ns['run']=run
            with patch.dict(os.environ,{'CAPTCHA_TIMEOUT_SECONDS':'2','BROWSERBASE_API_KEY':'fixture','BROWSERBASE_PROJECT_ID':'fixture'}):
                if fail:
                    with self.assertRaises(TimeoutError):ns['main']()
                else:ns['main']()
            self.assertTrue(driver.quit_called);self.assertEqual(len(allocated),1)
if __name__=='__main__':unittest.main()
