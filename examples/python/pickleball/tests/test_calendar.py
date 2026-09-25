import asyncio
import importlib.util
from pathlib import Path
import re
from types import SimpleNamespace as NS
import unittest

spec=importlib.util.spec_from_file_location('calendar_selection',Path(__file__).resolve().parents[1]/'calendar_selection.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class CalendarTests(unittest.TestCase):
    def run_case(self,target='2026-10-30',**change):
        state={'month':change.get('month','2026-09'),'selected':None,'open':False};clicks=[];actions=[];keys=[]
        async def act(instruction,**options):
            actions.append(instruction);state['open']=True
            return NS(data=NS(success=not change.get('open_fail')))
        async def evaluate(script):
            return {'months':([state['month']] * change.get('months',1)) if state['open'] else [],'selected':[state['selected']] if state['selected'] else []}
        def locator(selector):
            async def count():return change.get('cells',1) if 'data-day' in selector else change.get('nav',1)
            async def visible():return True
            async def click():
                clicks.append(selector)
                if 'data-day' in selector:
                    state['selected']=change.get('wrong_selected',re.search(r'data-day="([^"]+)"',selector).group(1))
                    state['open']=not change.get('autoclose',False)
                elif not change.get('stuck'):
                    y,m=map(int,state['month'].split('-'));n=y*12+m-1+(1 if 'next' in selector else -1)
                    state['month']=f'{n//12:04}-{n%12+1:02}'
            return NS(count=count,is_visible=visible,click=click)
        async def key_press(key):keys.append(key)
        async def wait(ms): pass
        page=NS(evaluate=evaluate,locator=locator,key_press=key_press,wait_for_timeout=wait)
        error=None
        try:asyncio.run(module.select_calendar_date(NS(act=act),page,target))
        except Exception as exc:error=exc
        return error,clicks,actions,keys

    def test_full_month_year_navigation_and_selected_date(self):
        for target,start,direction in [('2026-10-30','2026-09','next'),('2027-01-01','2026-12','next'),('2026-09-30','2026-10','previous')]:
            with self.subTest(target=target):
                error,clicks,_,keys=self.run_case(target,month=start)
                self.assertIsNone(error);self.assertIn(direction,clicks[0]);self.assertIn(f'data-day="{target}"',clicks[-1]);self.assertEqual(keys,['Escape'])

    def test_reopens_closed_calendar_to_read_selected_state(self):
        error,_,actions,_=self.run_case(autoclose=True)
        self.assertIsNone(error);self.assertEqual(len(actions),2)

    def test_unknown_disabled_stale_or_failed_controls_reject(self):
        for change in [dict(open_fail=True),dict(months=0),dict(months=2),dict(cells=0),dict(cells=2),dict(nav=0),dict(wrong_selected='2026-09-30')]:
            with self.subTest(change=change):
                error,_,_,keys=self.run_case(**change);self.assertIsNotNone(error);self.assertEqual(keys,[])

    def test_navigation_bound_and_invalid_dates(self):
        error,clicks,_,_=self.run_case(stuck=True);self.assertIsNotNone(error);self.assertEqual(len(clicks),1)
        for invalid in ['2026-02-30','2026-9-30','20260930']:
            error,clicks,actions,_=self.run_case(invalid);self.assertIsNotNone(error);self.assertEqual(clicks,[]);self.assertEqual(actions,[])

if __name__=='__main__':unittest.main()
