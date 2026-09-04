// Node24: node --test tests/benchmark-date.test.mjs. All clocks are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const source=stripTypeScriptTypes(fs.readFileSync(new URL('../benchmark-date.ts',import.meta.url),'utf8'));
const {departureDate,validateDepartureDate}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
for(const [clock,expected] of [['2024-01-31T23:59:59.999Z','2024-03-01'],['2024-02-01T00:00:00Z','2024-03-02'],['2023-02-01T00:00:00Z','2023-03-03'],['2026-12-20T12:00:00Z','2027-01-19'],['2026-03-01T23:30:00-08:00','2026-04-01'],['0099-12-20T12:00:00Z','0100-01-19']])test(`default adds exactly 30 UTC days from ${clock}`,()=>{assert.equal(departureDate(undefined,new Date(clock)),expected);});
test('explicit future leap day is accepted unchanged',()=>{const now=new Date('2024-02-01T12:00:00Z');assert.equal(departureDate('2024-02-29',now),'2024-02-29');assert.equal(validateDepartureDate('2024-02-29',now),'2024-02-29');});
for(const value of ['', ' ', ' 2024-03-01','2024-03-01 ','2024-3-01','2024-03-1','24-03-01','2024/03/01','2024-03-01T00:00:00Z','2024-02-30','2023-02-29','2100-02-29','2024-13-01','2024-00-01','2024-01-00','2024-04-31','2024-02-01','2024-01-31','+010000-01-01'])test(`rejects malformed, impossible, or nonfuture date ${JSON.stringify(value)}`,()=>{const now=new Date('2024-02-01T23:59:59Z');assert.throws(()=>departureDate(value,now));assert.throws(()=>validateDepartureDate(value,now));});
test('tomorrow is future even when less than 24 hours away',()=>{assert.equal(departureDate('2024-02-02',new Date('2024-02-01T23:59:59Z')),'2024-02-02');});
test('calendar comparison uses UTC rather than the clock offset',()=>{assert.throws(()=>validateDepartureDate('2024-02-02',new Date('2024-02-01T23:30:00-08:00')));});
test('invalid clock rejects explicit and default requests',()=>{assert.throws(()=>departureDate(undefined,new Date(NaN)));assert.throws(()=>departureDate('2030-01-01',new Date(NaN)));assert.throws(()=>validateDepartureDate('2030-01-01',new Date(NaN)));});
test('Date overflow and expanded default years reject',()=>{assert.throws(()=>departureDate(undefined,new Date(8640000000000000)));assert.throws(()=>departureDate(undefined,new Date('9999-12-31T00:00:00Z')));});
test('input clock is not mutated',()=>{const now=new Date('2024-02-01T12:34:56Z'),before=now.getTime();departureDate(undefined,now);assert.equal(now.getTime(),before);});
