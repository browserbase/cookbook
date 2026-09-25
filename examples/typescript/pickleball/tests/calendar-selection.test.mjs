import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectCalendarDate} from '../calendar-selection.ts';

async function run(target='2026-10-30',change={}) {
 let month=change.month??'2026-09',selected,open=false;const clicks=[],keys=[];
 const page={evaluate:async()=>({months:open?Array(change.months??1).fill(month):[],selected:selected?[selected]:[]}),
  waitForTimeout:async()=>{}, keyPress:async key=>keys.push(key),
  locator:selector=>({count:async()=>selector.includes('data-day')?(change.cells??1):1,isVisible:async()=>true,
   click:async()=>{clicks.push(selector);if(selector.includes('data-day')){selected=change.wrong??target;open=!change.autoClose}
    else if(!change.stuck){const[y,m]=month.split('-').map(Number);const delta=selector.includes('next')?1:-1;month=new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7)}}})};
 const stagehand={act:async(_,{page:p})=>{assert.equal(p,page);open=true;return{data:{success:!change.openFail}}}};
 let error;try{await selectCalendarDate(stagehand,page,target)}catch(e){error=e}
 return{error,clicks,keys};
}
for(const [month,target,dir]of [['2026-09','2026-10-30','next'],['2026-12','2027-01-01','next'],['2026-10','2026-09-30','previous']])test(`selects ${target}`,async()=>{
 const r=await run(target,{month,autoClose:true});assert.equal(r.error,undefined);assert.ok(r.clicks[0].includes(dir));assert.ok(r.clicks[1].includes(target));assert.deepEqual(r.keys,['Escape']);
});
for(const change of [{openFail:true},{months:0},{months:2},{cells:0},{cells:2},{wrong:'2026-09-30'},{stuck:true}])test(`rejects ${JSON.stringify(change)}`,async()=>{
 const r=await run('2026-10-30',change);assert.ok(r.error);assert.deepEqual(r.keys,[]);if(change.stuck)assert.equal(r.clicks.length,1);
});
test('invalid calendar dates fail before actions',async()=>{for(const value of ['2026-02-30','20260930','2026-9-30']){const r=await run(value);assert.ok(r.error);assert.equal(r.clicks.length,0)}});
