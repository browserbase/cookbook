import ast
import os
import re
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import stripe

SOURCE=Path(__file__).resolve().parents[1]/'python/create_card.py'
HOLDER='ich_fixture123'
def obj(values):return stripe.StripeObject.construct_from(values,'sk_test_fixture')
def fixture(activate=False,holder=None,active=None):
    calls={'create':[],'update':[],'retrieve':[]}
    base={'id':'ic_fixture123','cardholder':HOLDER,'livemode':False,'status':'inactive'}
    holder_value=obj({'id':HOLDER,'livemode':False,'status':'active','requirements':{'disabled_reason':None,'past_due':[]},**(holder or {})})
    def create(**kw):calls['create'].append(kw);return obj(base)
    def modify(id,**kw):calls['update'].append((id,kw));return obj({**base,'status':'active'})
    def retrieve(id):calls['retrieve'].append(id);return obj({**base,'status':'active',**(active or {})})
    fake=SimpleNamespace(issuing=SimpleNamespace(Cardholder=SimpleNamespace(retrieve=lambda id:holder_value),Card=SimpleNamespace(create=create,modify=modify,retrieve=retrieve)))
    tree=ast.parse(SOURCE.read_text());tree.body=[n for n in tree.body if isinstance(n,ast.FunctionDef)]
    ns={'os':os,'re':re,'stripe':fake,'print':lambda *args:None}
    exec(compile(tree,str(SOURCE),'exec'),ns)
    return ns,calls
class Lifecycle(unittest.TestCase):
    def setUp(self):self.env=patch.dict(os.environ,{'STRIPE_API_KEY':'sk_test_fixture','STRIPE_CARDHOLDER_ID':HOLDER,'STRIPE_ACTIVATE_TEST_CARD':'false'});self.env.start()
    def tearDown(self):self.env.stop()
    def test_inactive_creation(self):
        ns,calls=fixture();card=ns['create_card']();self.assertEqual(card['status'],'inactive');self.assertEqual(calls['create'][0]['status'],'inactive');self.assertFalse(calls['update'])
    def test_activation_retrieves_card(self):
        os.environ['STRIPE_ACTIVATE_TEST_CARD']='true';ns,calls=fixture();card=ns['create_card']();self.assertEqual(card['status'],'active');self.assertEqual(calls['retrieve'],['ic_fixture123']);self.assertEqual(calls['update'],[('ic_fixture123',{'status':'active'})])
    def test_holder_failures_prevent_creation(self):
        for holder in [{'livemode':True},{'id':'ich_other'},{'status':'inactive'},{'requirements':{'disabled_reason':'requirements.past_due','past_due':['name']}}]:
            ns,calls=fixture(holder=holder)
            with self.assertRaises(ValueError):ns['create_card']()
            self.assertFalse(calls['create'])
    def test_activation_response_must_match(self):
        os.environ['STRIPE_ACTIVATE_TEST_CARD']='true'
        for active in [{'livemode':True},{'id':'ic_other'},{'status':'inactive'},{'cardholder':'ich_other'}]:
            ns,_=fixture(active=active)
            with self.assertRaises(ValueError):ns['create_card']()
    def test_live_key_prevents_creation(self):
        os.environ['STRIPE_API_KEY']='sk_live_fixture';ns,calls=fixture()
        with self.assertRaises(ValueError):ns['create_card']()
        self.assertFalse(calls['create'])
if __name__=='__main__':unittest.main()
