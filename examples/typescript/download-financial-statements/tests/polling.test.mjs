import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

async function run(states, mode='normal') {
 const source=readFileSync(new URL('../index.ts',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('async function saveDownloadsWithRetry'),source.indexOf('async function main'));
 let now=0,calls=0;const writes=[];let aborted=false;
 const context=vm.createContext({Buffer,AbortController,Set,Number,Math,performance:{now:()=>now},
   console:{log:()=>{}},fs:{writeFileSync:(_,bytes)=>writes.push(bytes)},
   inspectArchive:bytes=>new Set(JSON.parse(bytes.toString())),
   sleep:async ms=>{now+=ms},
   setTimeout:(fn,ms)=>setTimeout(fn,mode==='abort'?1:ms),clearTimeout,
 });
 vm.runInContext(stripTypeScriptTypes(fn)+'\nglobalThis.poll=saveDownloadsWithRetry;',context);
 const bb={sessions:{downloads:{list:async(id,options)=>{
   calls++;assert.equal(options.maxRetries,0);assert.ok(options.timeout>0);
   return {arrayBuffer:async()=>{
     if(mode==='abort')return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{aborted=true;reject(new Error('synthetic abort'))}));
     if(mode==='late')now=6000;
     return Buffer.from(JSON.stringify(states[Math.min(calls-1,states.length-1)]));
   }};
 }}}};
 let error,result;try{result=await context.poll(bb,'fixture',5)}catch(e){error=e}
 return {error,result,writes,calls,aborted};
}
test('serialized empty/partial/complete snapshots write only complete result',async()=>{
 const r=await run([[],['1','2'],['1','2','3','4']]);assert.equal(r.error,undefined);assert.equal(r.calls,3);assert.equal(r.writes.length,1);
});
test('partial timeout does not write',async()=>{const r=await run([['1']]);assert.ok(r.error);assert.equal(r.writes.length,0)});
test('late complete response does not write',async()=>{const r=await run([['1','2','3','4']],'late');assert.ok(r.error);assert.equal(r.writes.length,0)});
test('deadline aborts pending body and prevents another request',async()=>{const r=await run([[]],'abort');assert.ok(r.error);assert.equal(r.aborted,true);assert.equal(r.calls,1);assert.equal(r.writes.length,0)});
