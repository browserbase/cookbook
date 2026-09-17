import ast
import asyncio
import io
import math
import stat
import os
from pathlib import Path
import tempfile
import time
import types
import unittest
import zipfile
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / 'playwright/download/download_save.py'

def module():
    tree = ast.parse(SOURCE.read_text())
    tree.body = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))]
    ns = dict(math=math,stat=stat,asyncio=asyncio, os=os, io=io, BytesIO=io.BytesIO, time=time, zipfile=zipfile, ZipFile=zipfile.ZipFile, BadZipFile=zipfile.BadZipFile, Page=object, requests=types.SimpleNamespace(), print=lambda *a: None)
    exec(compile(tree, str(SOURCE), 'exec'), ns)
    return ns

def archive(name='fixture.txt'):
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w') as z:
        if name:
            z.writestr(name, b'synthetic download')
    return data.getvalue()

class Downloads(unittest.IsolatedAsyncioTestCase):
    async def test_completion_is_awaited(self):
        for failure in [None, 'canceled']:
            with self.subTest(failure=failure):
                ns = module(); events=[]; done=asyncio.Event()
                class Download:
                    async def failure(self):
                        events.append('wait-completion'); await done.wait(); events.append('completed'); return failure
                class Expect:
                    async def __aenter__(self): events.append('listening'); return self
                    async def __aexit__(self, *args): return False
                    @property
                    def value(self):
                        async def get(): return Download()
                        return get()
                class Page:
                    async def goto(self, *a, **kw): pass
                    def expect_download(self, **kw): return Expect()
                    def get_by_role(self, *a, **kw): return self
                    async def click(self, **kw): events.append('click')
                task=asyncio.create_task(ns['run'](Page()))
                for _ in range(5): await asyncio.sleep(0)
                self.assertFalse(task.done()); self.assertEqual(events[:2], ['listening','click']); done.set()
                if failure:
                    with self.assertRaises(Exception): await task
                else: await task
                self.assertIn('completed', events)

    async def test_completion_has_a_timeout(self):
        ns=module(); limits=[]
        async def wait_for(awaitable, timeout):
            limits.append(timeout); awaitable.close(); raise TimeoutError('synthetic completion timeout')
        ns['asyncio']=types.SimpleNamespace(wait_for=wait_for)
        class Download:
            async def failure(self): return None
        class Expect:
            async def __aenter__(self): return self
            async def __aexit__(self,*a): return False
            @property
            def value(self):
                async def get(): return Download()
                return get()
        class Page:
            async def goto(self,*a,**kw): pass
            def expect_download(self,**kw): return Expect()
            def get_by_role(self,*a,**kw): return self
            async def click(self,**kw): pass
        with self.assertRaises(TimeoutError): await ns['run'](Page())
        self.assertEqual(limits,[30])

class Archives(unittest.TestCase):
    def fetch(self, bodies, status=200):
        ns=module(); now=[0]; calls=[]
        def get(url, **kw):
            calls.append((url,kw)); body=bodies[min(len(calls)-1,len(bodies)-1)]
            def check():
                if status>=400: raise RuntimeError('synthetic HTTP error')
            return types.SimpleNamespace(content=body,raise_for_status=check)
        ns['requests']=types.SimpleNamespace(get=get)
        ns['time']=types.SimpleNamespace(monotonic=lambda:now[0],sleep=lambda n:now.__setitem__(0,now[0]+n))
        ns['API_KEY']='fixture-key'
        with patch.dict(os.environ, {'BROWSERBASE_API_KEY':'fixture-key'}):
            value=ns['get_zipped_downloads']('fixture-session',timeout_seconds=3)
        return value,calls
    def test_empty_readiness_retries(self):
        expected=archive(); actual,calls=self.fetch([b'',archive(None),expected]);self.assertEqual(actual,expected);self.assertEqual(len(calls),3);self.assertTrue(all(c[0].startswith('https://api.browserbase.com/') and 'timeout' in c[1] for c in calls))
    def test_empty_deadline(self):
        with self.assertRaises(TimeoutError): self.fetch([b''])
    def test_invalid_responses(self):
        corrupt=bytearray(archive());corrupt[30+len('fixture.txt')] ^= 1
        for bodies,status in [([b'{}'],401),([b'{}'],200),([archive()[:35]],200),([bytes(corrupt)],200)]:
            with self.subTest(status=status,bytes=len(bodies[0])):
                with self.assertRaises(Exception): self.fetch(bodies,status)



class BrowserDownload(unittest.IsolatedAsyncioTestCase):
    @unittest.skipUnless(os.environ.get('COOKBOOK_CHROME'), 'Set COOKBOOK_CHROME for local browser fixture')
    async def test_real_delayed_download(self):
        from playwright.async_api import async_playwright
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
        import threading
        started, release = threading.Event(), threading.Event()
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args): pass
            def do_GET(self):
                self.send_response(200)
                self.send_header('Content-Disposition', 'attachment; filename="fixture.mp3"')
                self.send_header('Content-Length', '12')
                self.end_headers(); self.wfile.write(b'first-'); self.wfile.flush(); started.set()
                if release.wait(5): self.wfile.write(b'second'); self.wfile.flush()
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        threading.Thread(target=server.serve_forever,daemon=True).start()
        try:
            async with async_playwright() as p:
                browser=await p.chromium.launch(executable_path=os.environ['COOKBOOK_CHROME'])
                try:
                    page=await browser.new_page(accept_downloads=True)
                    async def route_handler(route):
                        if route.request.url.startswith(f'http://127.0.0.1:{server.server_port}/'):
                            await route.continue_()
                        else:
                            await route.fulfill(status=200,content_type='text/html',body=f'<a href="http://127.0.0.1:{server.server_port}/file">Download File</a>')
                    await page.route('**/*',route_handler)
                    task=asyncio.create_task(module()['run'](page))
                    self.assertTrue(await asyncio.to_thread(started.wait,3))
                    await asyncio.sleep(.1); self.assertFalse(task.done())
                    release.set(); await asyncio.wait_for(task,5)
                finally: await browser.close()
        finally:
            release.set(); await asyncio.to_thread(server.shutdown); server.server_close()



class MainFlow(unittest.IsolatedAsyncioTestCase):
    async def test_order_failure_and_existing_output(self):
        for scenario in ['success','run_failure','page_close_failure','existing_output']:
            with self.subTest(scenario=scenario):
                ns=module(); events=[]; payload=archive()
                class Page:
                    async def close(self):
                        events.append('page-close')
                        if scenario=='page_close_failure': raise RuntimeError('close')
                class Session:
                    async def send(self,*args): pass
                class Browser:
                    browser_type=types.SimpleNamespace(name='fixture'); version='fixture'
                    contexts=[types.SimpleNamespace(pages=[Page()])]
                    async def new_browser_cdp_session(self): return Session()
                    async def close(self): events.append('browser-close')
                class Manager:
                    async def __aenter__(self): return types.SimpleNamespace(chromium=self)
                    async def __aexit__(self,*args): return False
                    async def connect_over_cdp(self,*args): return Browser()
                async def run(page):
                    events.append('download-complete')
                    if scenario=='run_failure': raise RuntimeError('download')
                def retrieve(session):
                    self.assertEqual(events,['download-complete','page-close','browser-close'])
                    events.append('retrieve'); return payload
                ns.update(load_dotenv=lambda:None,create_session=lambda:'fixture-session',async_playwright=Manager,run=run,get_zipped_downloads=retrieve)
                previous=os.getcwd()
                with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ,{'BROWSERBASE_API_KEY':'fixture-key'}):
                    try:
                        os.chdir(directory)
                        if scenario=='existing_output': Path('downloads.zip').write_bytes(b'existing')
                        if scenario=='success':
                            await ns['main'](); self.assertEqual(Path('downloads.zip').read_bytes(),payload)
                        else:
                            with self.assertRaises(Exception): await ns['main']()
                            if scenario=='existing_output': self.assertEqual(Path('downloads.zip').read_bytes(),b'existing')
                            else: self.assertFalse(Path('downloads.zip').exists())
                        self.assertIn('browser-close',events)
                    finally: os.chdir(previous)

if __name__=='__main__': unittest.main()
