import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const JSZip = createRequire(import.meta.url)('jszip');
const source = stripTypeScriptTypes(readFileSync(new URL('../playwright/_tools/download/cloud-download-save.ts', import.meta.url), 'utf8')).replace(/^import .*;$/gm, '');
const declarations = source.slice(0, source.indexOf('(async () =>'));
const flush = async () => { for (let i=0;i<8;i++) await new Promise(setImmediate); };
async function archive(name='fixture.txt') { const zip=new JSZip(); if(name) zip.file(name, 'synthetic download'); return zip.generateAsync({type:'nodebuffer',compression:'STORE'}); }
const response = (body, status=200) => ({ok:status>=200&&status<300,status,arrayBuffer:async()=>body});
function harness(fetcher, parser=JSZip) {
  const directory=mkdtempSync(join(tmpdir(),'r145-fixture-')), file=join(directory,'downloads.zip');
  const timers=new Map(); let now=0, next=0, calls=0, signal, state='pending', error;
  const timer=(fn,delay,repeat=false)=>{const id=++next;timers.set(id,{fn,at:now+delay,delay,repeat});return id;};
  const context=vm.createContext({JSZip:parser,Buffer,AbortController,Number,Error,
    Date:class extends Date {static now(){return now;}},performance:{now:()=>now},
    process:{env:{}},console:{log(){},error(){}},
    setTimeout:(f,d)=>timer(f,d),clearTimeout:id=>timers.delete(id),setInterval:(f,d)=>timer(f,d,true),clearInterval:id=>timers.delete(id),
    writeFileSync:(path,bytes,options)=>{assert.equal(path,'downloads.zip');writeFileSync(file,bytes,options);},
    fetch:async(url,options)=>{calls++;signal=options.signal;return fetcher(calls,options);},
  });
  vm.runInContext(declarations+'\nglobalThis.save=saveDownloadsOnDisk;',context);
  return {context,file,timers,get calls(){return calls;},get signal(){return signal;},get state(){return state;},get error(){return error;},
    start(ms=5000){context.save('fixture-session',ms).then(()=>state='resolved',e=>{state='rejected';error=e;});},
    async advance(ms){const until=now+ms;await flush();while(true){const due=[...timers.entries()].filter(([,v])=>v.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;const [id,v]=due;now=v.at;if(v.repeat)v.at+=v.delay;else timers.delete(id);v.fn();await flush();}now=until;await flush();},
    cleanup(){rmSync(directory,{recursive:true,force:true});},
  };
}
for(const kind of ['empty','hung-fetch','hung-body'])test(`deadline rejects ${kind} and clears timers`,async()=>{
  const h=harness(()=>kind==='empty'?response(Buffer.alloc(0)):kind==='hung-fetch'?new Promise(()=>{}):{ok:true,status:200,arrayBuffer:()=>new Promise(()=>{})});
  try{h.start();await h.advance(5000);assert.equal(h.state,'rejected');assert.match(h.error.message,/within 5000ms/);assert.equal(h.timers.size,0);assert.equal(existsSync(h.file),false);if(kind!=='empty')assert.equal(h.signal.aborted,true);}finally{h.cleanup();}
});
for(const status of [401,500])test(`HTTP ${status} is rejected without writing`,async()=>{const h=harness(()=>response(Buffer.from('{"error":"synthetic"}'),status));try{h.start();await h.advance(2000);assert.equal(h.state,'rejected');assert.match(h.error.message,new RegExp(String(status)));assert.equal(existsSync(h.file),false);assert.equal(h.timers.size,0);}finally{h.cleanup();}});
for(const kind of ['json','truncated','crc'])test(`invalid ZIP ${kind} never writes`,async()=>{let bytes=kind==='json'?Buffer.from('{}'):await archive();if(kind==='truncated')bytes=bytes.subarray(0,35);if(kind==='crc'){bytes=Buffer.from(bytes);bytes[30+Buffer.byteLength('fixture.txt')]^=1;}const h=harness(()=>response(bytes));try{h.start();await h.advance(2000);assert.equal(h.state,'rejected');assert.equal(existsSync(h.file),false);assert.equal(h.timers.size,0);}finally{h.cleanup();}});
test('valid archive is saved byte for byte',async()=>{const bytes=await archive('nested/fixture.txt');const h=harness(()=>response(bytes));try{h.start();await h.advance(2000);assert.equal(h.state,'resolved');assert.deepEqual(readFileSync(h.file),bytes);assert.equal(h.calls,1);assert.equal(h.timers.size,0);}finally{h.cleanup();}});
test('empty archive retries until a file is available',async()=>{const empty=await archive(null),bytes=await archive();const h=harness(n=>response(n===1?empty:bytes));try{h.start();await h.advance(4000);assert.equal(h.state,'resolved');assert.equal(h.calls,2);assert.deepEqual(readFileSync(h.file),bytes);}finally{h.cleanup();}});
test('an existing output is preserved',async()=>{const bytes=await archive();const h=harness(()=>response(bytes));try{writeFileSync(h.file,'existing fixture');h.start();await h.advance(2000);assert.equal(h.state,'rejected');assert.equal(readFileSync(h.file,'utf8'),'existing fixture');}finally{h.cleanup();}});
for(const stage of ['fetch','body','parser'])test(`late ${stage} completion cannot write or start overlapping polls`,async()=>{const bytes=await archive();let release;const deferred=new Promise(r=>release=r);const parser=stage==='parser'?{loadAsync:()=>deferred}:JSZip;const h=harness(()=>stage==='fetch'?deferred:stage==='body'?{ok:true,status:200,arrayBuffer:()=>deferred}:response(bytes),parser);try{h.start();await h.advance(4999);assert.equal(h.calls,1);await h.advance(1);assert.equal(h.state,'rejected');release(stage==='fetch'?response(bytes):stage==='body'?bytes:await JSZip.loadAsync(bytes));await flush();assert.equal(existsSync(h.file),false);assert.equal(h.timers.size,0);assert.equal(h.calls,1);}finally{h.cleanup();}});

test('actual CLI reports retrieval failure with nonzero exit status', async()=>{
 const h=harness(()=>response(Buffer.from('{}'),401));
 try {
  const page={goto:async()=>{},waitForEvent:async()=>({failure:async()=>null}),locator:()=>({click:async()=>{}}),close:async()=>{}};
  h.context.chromium={connectOverCDP:async()=>({contexts:()=>[{pages:()=>[page],newCDPSession:async()=>({send:async()=>{}})}],close:async()=>{}})};
  vm.runInContext('createSession=async()=>({id:"fixture"});',h.context);
  vm.runInContext('globalThis.done='+source.slice(source.indexOf('(async () =>')),h.context);
  await h.advance(2000);
  await h.context.done;
  assert.equal(h.context.process.exitCode,1);assert.equal(existsSync(h.file),false);assert.equal(h.timers.size,0);
 } finally {h.cleanup();}
});
