import ast
import os
import re
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
import unittest
import stripe

SOURCE=Path(__file__).resolve().parents[1]/'python/get_card.py'
def obj(data):return stripe.StripeObject.construct_from(data,'sk_test_fixture')
def fixture(card=None,holder=None,second=None):
    calls={'retrieve':[],'logs':[]}
    owner={'id':'ich_fixture123','livemode':False,'status':'active','requirements':{'disabled_reason':None,'past_due':[]},'name':'Fixture Person','email':'fixture@example.invalid','phone_number':'+15555550100','billing':{'address':{'line1':'Fixture','city':'Fixture','state':'CA','postal_code':'00000','country':'US'}},**(holder or {})}
    base={'id':'ic_fixture123','livemode':False,'status':'active','cardholder':owner,'number':'4000000000000000','cvc':'123','exp_month':1,'exp_year':2030,'last4':'0000','brand':'Visa','currency':'usd',**(card or {})}
    def retrieve(*a,**kw):calls['retrieve'].append((a,kw));return obj({**base,**(second or {})} if len(calls['retrieve'])>1 else base)
    fake=SimpleNamespace(issuing=SimpleNamespace(Card=SimpleNamespace(retrieve=retrieve),Cardholder=SimpleNamespace(retrieve=lambda id,**kw:obj(owner))))
    tree=ast.parse(Path(os.environ.get('COOKBOOK_R158_PY_RETRIEVAL_BASELINE',SOURCE)).read_text());tree.body=[n for n in tree.body if isinstance(n,ast.FunctionDef)]
    ns={'os':os,'re':re,'stripe':fake,'print':lambda *x:calls['logs'].append(x)};exec(compile(tree,str(SOURCE),'exec'),ns)
    return ns,calls
class Retrieval(unittest.TestCase):
    def setUp(self):self.env=patch.dict(os.environ,{'STRIPE_API_KEY':'sk_test_fixture','STRIPE_CARDHOLDER_ID':'ich_fixture123'});self.env.start()
    def tearDown(self):self.env.stop()
    def test_checked_expansion_does_not_log_payment_fields(self):
        ns,calls=fixture();result=ns['getCard']('ic_fixture123');self.assertEqual(result['id'],'ic_fixture123');self.assertEqual(result['card_number'],'4000000000000000');self.assertEqual(len(calls['retrieve']),2);self.assertNotIn('number',str(calls['retrieve'][0]));self.assertFalse(calls['logs'])
    def test_invalid_card_prevents_expansion(self):
        for card in [{'livemode':True},{'status':'inactive'},{'id':'ic_other'},{'cardholder':'ich_other'}]:
            ns,calls=fixture(card=card)
            with self.assertRaises(ValueError):ns['getCard']('ic_fixture123')
            self.assertEqual(len(calls['retrieve']),1)
    def test_invalid_holder_prevents_expansion(self):
        for holder in [{'status':'inactive'},{'livemode':True},{'requirements':{'disabled_reason':'past_due','past_due':['name']}}]:
            ns,calls=fixture(holder=holder)
            with self.assertRaises(ValueError):ns['getCard']('ic_fixture123')
            self.assertEqual(len(calls['retrieve']),1)
    def test_changed_card_rejects(self):
        ns,_=fixture(second={'status':'inactive'})
        with self.assertRaises(ValueError):ns['getCard']('ic_fixture123')
    def test_live_key_prevents_request(self):
        os.environ['STRIPE_API_KEY']='sk_live_fixture';ns,calls=fixture()
        with self.assertRaises(ValueError):ns['getCard']('ic_fixture123')
        self.assertFalse(calls['retrieve'])
if __name__=='__main__':unittest.main()
