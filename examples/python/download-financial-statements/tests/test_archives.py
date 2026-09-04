import ast
import asyncio
import contextlib
import hashlib
import importlib.util
import io
from pathlib import Path
import tempfile
from types import SimpleNamespace as NS
import unittest
import zipfile

BASE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('archive_validation', BASE/'archive_validation.py')
validation = importlib.util.module_from_spec(spec); spec.loader.exec_module(validation)
PDFS = {str(q): f'%PDF-1.7\nsynthetic quarter {q}\n%%EOF'.encode() for q in range(1,5)}
EXPECTED = {q: {'sha256':hashlib.sha256(data).hexdigest()} for q,data in PDFS.items()}

def archive(quarters=(), extras=()):
    stream=io.BytesIO()
    with zipfile.ZipFile(stream,'w',zipfile.ZIP_DEFLATED) as z:
        for i,q in enumerate(quarters): z.writestr(f'quarter-{i}-1719265797164.pdf',PDFS[q])
        for name,data in extras: z.writestr(name,data)
    return stream.getvalue()

class ArchiveTests(unittest.TestCase):
    def test_empty_and_partial_are_not_complete(self):
        for quarters in [(),('1',),('4','2','3')]:
            self.assertEqual(validation.inspect_archive(archive(quarters),EXPECTED),set(quarters))
        self.assertEqual(validation.inspect_archive(b'',EXPECTED),set())

    def test_four_exact_contents_ignore_storage_renaming(self):
        self.assertEqual(validation.inspect_archive(archive(('4','1','3','2')),EXPECTED),set(PDFS))

    def test_duplicate_unknown_nonpdf_unsafe_and_corrupt_rejected(self):
        cases=[archive(('1','1','2','3')),archive(('1',), [('unknown.pdf',b'%PDF-1.7 changed')]),
               archive((), [('bad.pdf',b'<html>Error</html>')]),archive((),[('../escape.pdf',PDFS['1'])]),
               b'not zip',archive(('1','2','3','4'))[:-25]]
        for payload in cases:
            with self.subTest(size=len(payload)):
                with self.assertRaises(ValueError):validation.inspect_archive(payload,EXPECTED)

    def test_four_distinct_expected_urls_required_and_ordered(self):
        urls=[validation.STATEMENTS[str(q)]['url'] for q in range(1,5)]
        self.assertEqual(validation.validate_statement_urls(urls),list(reversed(urls)))
        for bad in [[],urls[:3],urls+[urls[0]],[urls[0]]*4]:
            with self.assertRaises(ValueError):validation.validate_statement_urls(bad)

    def test_apple_aliases_preserve_quarter_identity(self):
        urls=[validation.STATEMENTS[str(q)]['url'].replace('www.apple.com','images.apple.com')+'?download=1' for q in range(1,5)]
        self.assertEqual(validation.validate_statement_urls(urls),list(reversed(urls)))
        for bad in ['https://www.apple.com.evil.invalid/FY25_Q1_Consolidated_Financial_Statements.pdf',
                    urls[0].replace('https:','http:'),urls[0].replace('Q1','Q2')]:
            with self.assertRaises(ValueError):validation.validate_statement_urls([bad,*urls[1:]])

    def poll(self,payloads,late=False):
        tree=ast.parse((BASE/'main.py').read_text());node=next(n for n in tree.body if getattr(n,'name',None)=='save_downloads_with_retry')
        clock=[0];calls=[];writes=[];out=io.StringIO()
        async def to_thread(fn,*args):return fn(*args)
        async def sleep(t):clock[0]+=t
        def read():
            if late:clock[0]=100
            return payloads[min(len(calls)-1,len(payloads)-1)]
        def listing(_):calls.append(True);return NS(read=read)
        scope={'Browserbase':object,'time':NS(monotonic=lambda:clock[0]),'asyncio':NS(to_thread=to_thread,sleep=sleep),
            'Path':lambda _:NS(write_bytes=lambda data:writes.append(data)),
            'inspect_archive':lambda data:validation.inspect_archive(data,EXPECTED)}
        exec(compile(ast.Module(body=[node],type_ignores=[]),'main.py','exec'),scope)
        error=None;result=None
        with contextlib.redirect_stdout(out):
            try:result=asyncio.run(scope['save_downloads_with_retry'](NS(sessions=NS(downloads=NS(list=listing))),'fixture',5))
            except Exception as exc:error=exc
        return error,result,writes,calls,out.getvalue()

    def test_actual_poll_waits_for_complete_snapshot(self):
        full=archive(('1','2','3','4'));error,result,writes,calls,output=self.poll([archive(),archive(('1','2')),full])
        self.assertIsNone(error);self.assertEqual(writes,[full]);self.assertEqual(result,len(full));self.assertEqual(len(calls),3)
        self.assertIn('2/4',output)

    def test_partial_timeout_and_late_response_do_not_write(self):
        for payloads,late in [([archive(('1','2'))],False),([archive(('1','2','3','4'))],True)]:
            error,result,writes,_,_=self.poll(payloads,late)
            self.assertIsInstance(error,TimeoutError);self.assertIsNone(result);self.assertEqual(writes,[])

if __name__=='__main__':unittest.main()
