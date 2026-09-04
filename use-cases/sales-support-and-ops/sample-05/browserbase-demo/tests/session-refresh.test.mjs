import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes,createRequire} from 'node:module';import vm from 'node:vm';
const require=createRequire(import.meta.url),{z}=require(process.env.ZOD_MODULE_PATH || 'zod');
const raw=readFileSync(new URL('../app/demo-client.tsx',import.meta.url),'utf8');
const schema=readFileSync(new URL('../lib/session-snapshot.ts',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');
const code=raw.slice(raw.indexOf('  const acceptSnapshot ='),raw.indexOf('  const voiceContext ='));
const empty=raw.slice(raw.indexOf('const EMPTY_SESSION:'),raw.indexOf('type TranscriptLine'));
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture(fetcher){let snapshot,error='waiting',mount,interval,timeout,source,calls=0;
 const scope=vm.createContext({z,Error,AbortController,demoId:'synthetic',syncRef:{current:{active:true,revision:0,stale:true,request:null}},
 useCallback:f=>f,useEffect:f=>{mount=f;},setSession:s=>snapshot=s,setSyncError:e=>error=e,
 setTimeout:f=>{timeout=f;return 1;},clearTimeout:()=>{timeout=null;},setInterval:f=>{interval=f;return 2;},clearInterval:()=>{interval=null;},
 EventSource:class{constructor(){source=this;}addEventListener(_n,f){this.listener=f;}removeEventListener(){}close(){this.closed=true;}},
 fetch:async(...args)=>{calls++;return fetcher(...args);}});
 vm.runInContext(stripTypeScriptTypes(schema+empty+code)+'\nglobalThis.refresh=refreshSession;globalThis.accept=acceptSnapshot;',scope);
 return {scope,refresh:()=>scope.refresh(),accept:v=>scope.accept(v),valid:()=>({...scope.EMPTY_SESSION,...vm.runInContext('EMPTY_SESSION',scope),demoId:'synthetic'}),get error(){return error},get snapshot(){return snapshot},get calls(){return calls},mount:()=>mount(),retry:()=>interval?.(),get interval(){return interval},get source(){return source},timeout:()=>timeout?.()};
}
for(const [name,fetcher] of [['HTTP',async()=>({ok:false,status:503})],['network',async()=>{throw Error('offline');}],['JSON',async()=>({ok:true,json:async()=>{throw Error('bad JSON');}})],['shape',async()=>({ok:true,json:async()=>({status:'ready'})})]])test(name+' refresh failure is caught and marks stale',async()=>{const f=fixture(fetcher);await f.refresh();assert.ok(f.error);assert.equal(f.scope.syncRef.current.stale,true);assert.equal(f.snapshot,undefined);});
test('valid same-demo snapshot clears stale state',async()=>{let value;const f=fixture(async()=>({ok:true,json:async()=>value}));value=f.valid();await f.refresh();assert.equal(f.error,null);assert.equal(f.snapshot.demoId,'synthetic');});
test('different demo snapshot cannot clear stale state',async()=>{let value;const f=fixture(async()=>({ok:true,json:async()=>value}));value={...f.valid(),demoId:'other'};await f.refresh();assert.ok(f.error);assert.equal(f.snapshot,undefined);});
test('newer stream snapshot supersedes delayed HTTP result or error',async()=>{for(const fail of [false,true]){let finish;const f=fixture(()=>new Promise(r=>finish=r));const pending=f.refresh();f.accept({...f.valid(),currentStep:'Newer'});finish(fail?{ok:false,status:503}:{ok:true,json:async()=>({...f.valid(),currentStep:'Older'})});await pending;assert.equal(f.snapshot.currentStep,'Newer');assert.equal(f.error,null);}});
test('single flight and timeout abort',async()=>{const f=fixture((_url,{signal})=>new Promise((_r,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout')))));const pending=f.refresh();await f.refresh();assert.equal(f.calls,1);f.timeout();await pending;assert.match(f.error,/timeout/);assert.equal(f.scope.syncRef.current.request,null);});
test('SSE failure retries, valid snapshot stops retries, cleanup closes source',async()=>{const f=fixture(async()=>({ok:false,status:503}));const cleanup=f.mount();await flush();f.retry();await flush();assert.equal(f.calls,2);f.source.listener({data:JSON.stringify(f.valid())});assert.equal(f.error,null);f.retry();assert.equal(f.calls,2);f.source.onerror();await flush();assert.ok(f.error);cleanup();assert.equal(f.source.closed,true);assert.equal(f.interval,null);});
test('invalid stream event is caught and cannot update session',async()=>{const f=fixture(async()=>({ok:false,status:503}));const cleanup=f.mount();await flush();f.source.listener({data:'invalid'});await flush();assert.ok(f.error);assert.equal(f.snapshot,undefined);cleanup();});
test('cleanup aborts pending request without late state updates',async()=>{const f=fixture((_url,{signal})=>new Promise((_r,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')))));const cleanup=f.mount();cleanup();await flush();assert.equal(f.error,'waiting');assert.equal(f.snapshot,undefined);});
