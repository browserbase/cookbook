import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { calendarDateOptions, courtToday, formatCalendarDate, parseCalendarDate } from '../calendar-dates.ts';

for (const [instant,today] of [
 ['2026-01-01T00:30:00Z','2025-12-31'],
 ['2026-01-01T08:30:00Z','2026-01-01'],
 ['2026-03-08T09:30:00Z','2026-03-08'],
 ['2026-11-01T08:30:00Z','2026-11-01'],
 ['2028-02-28T20:00:00Z','2028-02-28'],
])test(`court date at ${instant}`,()=>{
 const options=calendarDateOptions(new Date(instant));
 assert.equal(courtToday(new Date(instant)),today);assert.equal(options[0].value,today);assert.equal(options.length,7);
 assert.equal(new Set(options.map(x=>x.value)).size,7);
 options.forEach((o,i)=>{assert.ok(o.name.startsWith(formatCalendarDate(o.value)));if(i)assert.equal(parseCalendarDate(o.value)-parseCalendarDate(options[i-1].value),86400000)});
});
test('leap and year boundaries retain full calendar date',()=>{
 assert.equal(calendarDateOptions(new Date('2028-02-28T20:00:00Z'))[1].value,'2028-02-29');
 assert.equal(calendarDateOptions(new Date('2026-01-01T00:30:00Z'))[1].value,'2026-01-01');
});
test('invalid or normalized dates are rejected',()=>{
 for(const value of ['2026-02-29','2026-04-31','2026-13-01','2026-9-01','2026-09-01T00:00:00Z'])assert.throws(()=>parseCalendarDate(value));
});
test('menu labels and values are independent of machine timezone',()=>{
 const moduleUrl=new URL('../calendar-dates.ts',import.meta.url).href;
 const code=`import {calendarDateOptions} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(calendarDateOptions(new Date('2026-01-01T00:30:00Z'))));`;
 const outputs=['UTC','Pacific/Kiritimati','America/Los_Angeles','Asia/Tokyo'].map(TZ=>execFileSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,TZ},encoding:'utf8'}));
 assert.equal(new Set(outputs).size,1);
});

test('actual selection prompt returns the date represented by its label', async()=>{
 const {readFileSync}=await import('node:fs');const {stripTypeScriptTypes}=await import('node:module');const vm=await import('node:vm');
 const source=readFileSync(new URL('../index.ts',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('async function selectDate()'),source.indexOf('async function bookTennisPaddleCourt()'));
 let choices;const logs=[];
 const context=vm.createContext({calendarDateOptions:()=>calendarDateOptions(new Date('2026-01-01T00:30:00Z')),formatCalendarDate,
  inquirer:{prompt:async questions=>{choices=questions[0].choices;return {selectedDate:choices[1].value}}},console:{log:text=>logs.push(text)}});
 vm.runInContext(stripTypeScriptTypes(fn)+'\nglobalThis.select=selectDate;',context);
 assert.equal(await context.select(),'2026-01-01');assert.ok(choices[1].name.includes('January 1, 2026'));
 assert.equal(logs[0],'Selected: Thursday, January 1, 2026 (San Francisco)');
});
