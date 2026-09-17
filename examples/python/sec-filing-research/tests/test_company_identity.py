import ast
import asyncio
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sys
from types import SimpleNamespace as NS
import unittest

BASE=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('sec_company_identity',BASE/'company_identity.py')
v=importlib.util.module_from_spec(spec);sys.modules[spec.name]=v;spec.loader.exec_module(v)

class IdentityTests(unittest.TestCase):
    def test_normalized_cik_and_one_company_configuration(self):
        t=v.CompanyTarget('Fixture Corp','123456',search_query='FXTR')
        self.assertEqual(t.cik,'0000123456');self.assertEqual(t.query,'FXTR');self.assertIn('CIK=0000123456',t.browse_url)
        self.assertEqual(v.validate_company_identity('FIXTURE CORP','123456',t),t.cik)
        v.validate_company_page(t.browse_url,t)
    def test_invalid_configuration_missing_or_wrong_identity(self):
        for cik in ['', '0', '12A3', '-123', '12345678901', None]:
            with self.subTest(cik=cik):
                with self.assertRaises(ValueError):v.CompanyTarget('Fixture',cik)
        t=v.CompanyTarget('Fixture','123456')
        for name,cik in [('',t.cik),('Other','654321'),('Fixture','')]:
            with self.assertRaises(ValueError):v.validate_company_identity(name,cik,t)
    def test_wrong_page_and_duplicate_identifiers_rejected(self):
        t=v.CompanyTarget('Fixture','123456')
        for url in [t.browse_url.replace('123456','654321'),t.browse_url+'&CIK=123456',t.browse_url.replace('www.sec.gov','www.sec.gov.evil.invalid'),t.browse_url.replace('https:','http:'),'https://www.sec.gov/edgar/browse/']:
            with self.subTest(url=url):
                with self.assertRaises(ValueError):v.validate_company_page(url,t)

class CallerTests(unittest.TestCase):
    def run_case(self,**change):
        t=v.CompanyTarget('Synthetic Fixture Corp','123456',search_query='FXTR')
        closed=[];actions=[];urls=[];extracts=[];current=['']
        async def goto(url,**kwargs):current[0]=url;urls.append(url)
        async def url():return current[0]
        page=NS(goto=goto,url=url)
        async def pages():return [page]
        async def active():return page
        async def close_browser():closed.append('browser')
        browser=NS(context=NS(pages=pages,active_page=active),close=close_browser)
        async def launch(**kwargs):return browser
        async def act(instruction,**kwargs):
            actions.append((instruction,kwargs))
            if change.get('navigation_failure'):raise RuntimeError('synthetic navigation')
            if 'view its filings' in instruction:current[0]=change.get('page_url',t.browse_url)
            return NS(data=NS(success=True))
        async def extract(instruction,schema,**kwargs):
            extracts.append(instruction)
            if len(extracts)==1:return NS(data=NS(company_name='Synthetic Fixture Corp',cik=change.get('cik','123456')))
            filing=NS(description=None,accession_number=None,file_number=None,model_dump=lambda:{'type':'10-Q','date':'2026-01-01'})
            return NS(data=NS(filings=[filing]))
        async def close_stagehand():closed.append('stagehand')
        async def create(**kwargs):return NS(act=act,extract=extract,close=close_stagehand)
        main=next(n for n in ast.parse((BASE/'main.py').read_text()).body if getattr(n,'name',None)=='main')
        scope=dict(TARGET_COMPANY=t,NUM_FILINGS=1,os=NS(environ={'BROWSERBASE_API_KEY':'synthetic'}),browserbase=NS(launch=launch),Stagehand=NS(create=create),CompanyInfo=object,Filings=object,json=json,validate_company_page=v.validate_company_page,validate_company_identity=v.validate_company_identity)
        exec(compile(ast.Module(body=[main],type_ignores=[]),'actual SEC main','exec'),scope)
        error=None;output=io.StringIO()
        with contextlib.redirect_stdout(output):
            try:asyncio.run(scope['main']())
            except Exception as exc:error=exc
        return NS(error=error,closed=closed,actions=actions,urls=urls,extracts=extracts,output=output.getvalue(),target=t)
    def test_custom_company_drives_search_navigation_and_output(self):
        r=self.run_case();self.assertIsNone(r.error);self.assertEqual(len(r.extracts),2)
        self.assertTrue(any('Synthetic Fixture Corp' in instruction for instruction,_ in r.actions))
        self.assertTrue(any(options.get('variables',{}).get('query')=='FXTR' for _,options in r.actions))
        self.assertNotIn('Apple',r.output);self.assertIn('0000123456',r.output);self.assertEqual(r.closed,['stagehand','browser'])
    def test_wrong_or_missing_cik_stops_before_filings(self):
        for changes in [dict(cik=''),dict(cik='320193'),dict(page_url='https://www.sec.gov/edgar/browse/?CIK=320193')]:
            with self.subTest(changes=changes):
                r=self.run_case(**changes);self.assertIsInstance(r.error,ValueError);self.assertLessEqual(len(r.extracts),1)
                self.assertNotIn('"filings"',r.output);self.assertEqual(r.closed,['stagehand','browser'])
    def test_navigation_fallback_uses_same_configured_cik_and_is_explicit(self):
        r=self.run_case(navigation_failure=True);self.assertIsNone(r.error);self.assertEqual(r.urls[-1],r.target.browse_url)
        self.assertIn('Opening the configured company directly by CIK 0000123456',r.output)

if __name__=='__main__':unittest.main()
