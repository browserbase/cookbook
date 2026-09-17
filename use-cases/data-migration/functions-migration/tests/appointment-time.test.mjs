import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import test from 'node:test';
const root=new URL('../',import.meta.url);
const source=fs.readFileSync(process.env.COOKBOOK_R181_BASELINE||new URL('shared/schema.ts',root),'utf8').replace(/^export /gm,'');
const ctx=vm.createContext({});vm.runInContext(stripTypeScriptTypes(source),ctx);
function row(start,end=start){return {dateStart:start,dateEnd:end,serviceNames:['Synthetic service'],clientName:'Synthetic Client',staffNames:['Synthetic Provider'],totalMoney:{amount:100}};}
function cells(start,end){return ctx.parseCsv(ctx.appointmentsCsv([row(start,end)]))[1];}
for(const [start,expected] of [
 ['2026-09-05T10:00:00-07:00','2026-09-05 17:00 GMT'],
 ['2026-09-05T10:00:00Z','2026-09-05 10:00 GMT'],
 ['2026-09-05T10:00+00:00','2026-09-05 10:00 GMT'],
 ['2026-01-01T00:15:00+05:30','2025-12-31 18:45 GMT'],
 ['2026-12-31T23:45:00-02:00','2027-01-01 01:45 GMT'],
 ['2024-03-01T00:00:00+01:00','2024-02-29 23:00 GMT'],
 ['2026-09-05T10:00:59.123456789+05:45','2026-09-05 04:15 GMT'],
 ['0099-01-01T00:00:00Z','0099-01-01 00:00 GMT'],
])test(`UTC conversion ${start}`,()=>{assert.equal(cells(start)[0],expected);});
for(const start of ['',undefined,null,123,'2026-09-05','2026-09-05T10:00:00','2026-02-29T10:00:00Z','2026-04-31T10:00:00Z','2026-09-05T24:00:00Z','2026-09-05T10:60:00Z','2026-09-05T10:00:60Z','2026-09-05T10:00:00+24:00','2026-09-05T10:00:00+01:60','2026-09-05T10:00:00-00:00',' 2026-09-05T10:00:00Z','2026-09-05T10:00:00Ztrailing'])test(`reject invalid or ambiguous timestamp ${String(start)}`,()=>{assert.throws(()=>cells(start));});
test('DST fallback offsets preserve actual elapsed duration',()=>{const value=cells('2026-11-01T01:30:00-07:00','2026-11-01T01:30:00-08:00');assert.equal(value[0],'2026-11-01 08:30 GMT');assert.equal(value[7],'60 minutes');assert.equal(value.length,11);});
test('invalid end date rejects the export',()=>{assert.throws(()=>cells('2026-09-05T10:00:00Z','2026-09-05T11:00:00'));});
test('mixed valid and invalid rows do not return a partial CSV',()=>{assert.throws(()=>ctx.appointmentsCsv([row('2026-09-05T10:00:00Z'),row('bad')]));});
test('actual appointments handler does not deliver invalid timestamp data and closes session',async()=>{let handler,delivered=0,closed=0;const context=vm.createContext({defineFn:(_,fn)=>handler=fn,workflowParams:{},EXTRACT_APPOINTMENTS:'synthetic',openPlatformASession:async()=>({page:{evaluate:async()=>({rows:[row('2026-09-05T10:00:00')]})},sessionId:'synthetic',close:async()=>{closed++;}}),appointmentsCsv:ctx.appointmentsCsv,deliverCsv:async()=>{delivered++;},ok:value=>({success:true,...value}),fail:()=>({success:false})});const code=fs.readFileSync(new URL('functions/appointments-list.ts',root),'utf8').replace(/^import .*;\n/gm,'');vm.runInContext(stripTypeScriptTypes(code),context);assert.equal((await handler({})).success,false);assert.equal(delivered,0);assert.equal(closed,1);});
