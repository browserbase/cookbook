import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('record_validation',Path(__file__).resolve().parents[1]/'record_validation.py')
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)

class RecordTests(unittest.TestCase):
    def record(self,**changes):return {'dba_name':'Fixture & Sons','business_account_number':'001234','source_url':v.business_query_url('Fixture & Sons'),**changes}
    def test_matching_name_case_whitespace_and_encoded_query(self):
        v.validate_record(self.record(dba_name='  FIXTURE   & SONS  '),'Fixture & Sons')
        self.assertIn('%26',v.business_query_url('Fixture & Sons'))
        self.assertNotIn('& Sons',v.business_query_url('Fixture & Sons'))
    def test_wrong_identity_blank_identifier_and_near_matches_fail(self):
        for changes in [{'dba_name':'Fixture & Sons LLC'},{'dba_name':'Fixture Sons'},{'dba_name':None},{'business_account_number':''},{'business_account_number':None}]:
            with self.subTest(changes=changes):
                with self.assertRaises(ValueError):v.validate_record(self.record(**changes),'Fixture & Sons')
    def test_source_origin_dataset_query_and_credentials_are_checked(self):
        source=v.business_query_url('Fixture & Sons')
        for bad in [source.replace('https:','http:'),source.replace('data.sfgov.org','data.sfgov.org.evil.invalid'),source.replace('data.sfgov.org','user@data.sfgov.org'),source.replace('g8m3-pdis','wrong-data'),source+'&$where=1=1',source+'&$q=Other',source+'#other',v.business_query_url('Different Company'),None]:
            with self.subTest(source=bad):
                with self.assertRaises(ValueError):v.validate_record(self.record(source_url=bad),'Fixture & Sons')
    def test_blank_request_rejected(self):
        for name in ['', '   ', None]:
            with self.assertRaises(ValueError):v.business_query_url(name)

class CallerTests(unittest.TestCase):
    def test_actual_main_validates_before_printing_and_closes_session(self):
        import ast, asyncio, contextlib, io, json
        from types import SimpleNamespace as NS
        tree=ast.parse((Path(__file__).resolve().parents[1]/'main.py').read_text())
        main=next(n for n in tree.body if getattr(n,'name',None)=='main')
        for changes in [{},{'dba_name':'Different Company'},{'source_url':'https://example.com/'},{'business_account_number':''}]:
            with self.subTest(changes=changes):
                closed=[];record={'dba_name':'Fixture & Sons','business_account_number':'001234','source_url':v.business_query_url('Fixture & Sons'),**changes}
                class Session:
                    async def __aenter__(self):return object()
                    async def __aexit__(self,*args):closed.append(True)
                async def load_tools(*args):return []
                async def invoke(*args,**kwargs):return {'structured_response':record}
                class Model:
                    @staticmethod
                    def model_validate(value):return NS(model_dump=lambda:value,model_dump_json=lambda **kwargs:json.dumps(value))
                scope={'BUSINESS_NAME':'Fixture & Sons','SERVER_NAME':'fixture','BROWSER_INSTRUCTIONS':'fixture',
                       'business_query_url':v.business_query_url,'validate_record':v.validate_record,'BusinessInfo':Model,
                       'create_stagehand_client':lambda:NS(session=lambda _:Session()),'load_mcp_tools':load_tools,
                       'create_gateway_model':lambda _:None,'create_deep_agent':lambda **kwargs:NS(ainvoke=invoke)}
                exec(compile(ast.Module(body=[main],type_ignores=[]),'actual main','exec'),scope)
                out=io.StringIO()
                with contextlib.redirect_stdout(out):
                    if changes:
                        with self.assertRaises(ValueError):asyncio.run(scope['main']())
                    else:asyncio.run(scope['main']())
                self.assertEqual(closed,[True]);self.assertEqual('Business research with matching DBA' in out.getvalue(),not bool(changes))

if __name__=='__main__':unittest.main()
