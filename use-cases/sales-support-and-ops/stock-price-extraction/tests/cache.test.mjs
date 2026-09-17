// Node24: ZOD_MODULE_PATH=/path/to/installed/zod node --test tests/cache.test.mjs
// Filesystem access is redirected to a fresh synthetic temp directory for every test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {z}=require(process.env.ZOD_MODULE_PATH??'zod');
const raw=readFileSync(new URL('../utils.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
const source=stripTypeScriptTypes(raw);
const action={selector:'#synthetic',description:'Synthetic fill',method:'fill',arguments:['Synthetic']};
const fresh={...action,selector:'#fresh'};
const success={data:{success:true}},failed={data:{success:false}};
async function fixture(t,initial){
 const dir=mkdtempSync(path.join(tmpdir(),'cookbook-r191-cache-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 if(initial!==undefined)await fs.writeFile(path.join(dir,'cache.json'),typeof initial==='string'?initial:JSON.stringify(initial));
 const calls=[],warnings=[];const faults={write:false,rename:false};
 const mapped=name=>{assert.match(name,/^cache\.json(?:\.[0-9a-f-]+\.tmp)?$/);return path.join(dir,name);};
 const proxy={
  readFile:async(name,...args)=>{calls.push(['read',name]);return fs.readFile(mapped(name),...args);},
  writeFile:async(name,...args)=>{calls.push(['write',name]);if(faults.write)throw Error('PRIVATE_WRITE_DETAIL');return fs.writeFile(mapped(name),...args);},
  rename:async(from,to)=>{calls.push(['rename',from,to]);if(faults.rename)throw Error('PRIVATE_RENAME_DETAIL');return fs.rename(mapped(from),mapped(to));},
  unlink:async name=>{calls.push(['unlink',name]);return fs.unlink(mapped(name));},
 };
 const scope=vm.createContext({fs:proxy,z,randomUUID,console:{log:()=>{},warn:(...args)=>warnings.push(args.join(' '))},boxen:x=>x,chalk:new Proxy({},{get:()=>x=>x})});
 vm.runInContext(source+'\nglobalThis.api={readCache,simpleCache,actWithCache};',scope);
 const page={};
 const sdk=(acts=[success],observed=[fresh])=>{let count=0;return {act:async(value,options)=>{assert.equal(options.page,page);calls.push(['act',value.selector]);const r=acts[count++];if(r instanceof Error)throw r;if(typeof r==='function')return r();return r;},observe:async(instruction,options)=>{assert.equal(options.page,page);calls.push(['observe',instruction]);if(observed instanceof Error)throw observed;return {data:observed};}};};
 return {api:scope.api,calls,warnings,faults,page,sdk,dir,document:async()=>JSON.parse(await fs.readFile(path.join(dir,'cache.json'),'utf8'))};
}
test('cache hit success executes once without observing or writing',async t=>{const f=await fixture(t,{synthetic:action});await f.api.actWithCache(f.sdk(),f.page,'synthetic');assert.deepEqual(f.calls.filter(c=>['act','observe','write'].includes(c[0])).map(c=>c[0]),['act']);});
test('explicit cached failure evicts before one fresh observation and writes only after success',async t=>{const f=await fixture(t,{synthetic:action,other:action});await f.api.actWithCache(f.sdk([failed,success]),f.page,'synthetic');const steps=f.calls.filter(c=>['act','observe','rename'].includes(c[0]));assert.deepEqual(steps.map(c=>c[0]),['act','rename','observe','act','rename']);const cache=await f.document();assert.equal(cache.synthetic.selector,'#fresh');assert.equal(cache.other.selector,'#synthetic');});
for(const [name,value] of [['throw',Error('PRIVATE_PROVIDER_DETAIL')],['missing success',{data:{}}],['missing data',{}]])test(`cached ${name} evicts and stops without duplicate execution`,async t=>{const f=await fixture(t,{synthetic:action});await assert.rejects(f.api.actWithCache(f.sdk([value]),f.page,'synthetic'),e=>!e.message.includes('PRIVATE'));assert.equal(f.calls.filter(c=>c[0]==='act').length,1);assert.equal(f.calls.filter(c=>c[0]==='observe').length,0);assert.equal((await f.document()).synthetic,undefined);});
test('invalid cached shape is evicted without execution, then replaced',async t=>{const f=await fixture(t,{synthetic:{...action,arguments:[1]}});await f.api.actWithCache(f.sdk(),f.page,'synthetic');assert.deepEqual(f.calls.filter(c=>c[0]==='act').map(c=>c[1]),['#fresh']);assert.equal((await f.document()).synthetic.selector,'#fresh');});
for(const [name,value] of [['empty',[]],['null',null],['malformed',[{}]],['bad selector',[{...fresh,selector:'  '}]],['empty XPath',[{...fresh,selector:'xpath='}]],['bad arguments',[{...fresh,arguments:[1]}]],['extra fields',[{...fresh,extra:true}]],['bad method',[{...fresh,method:42}]],['second invalid',[fresh,{}]],['throw',Error('PRIVATE_OBSERVE_DETAIL')]])test(`fresh observation ${name} cannot execute or cache`,async t=>{const f=await fixture(t);await assert.rejects(f.api.actWithCache(f.sdk([success],value),f.page,'synthetic'),e=>!e.message.includes('PRIVATE'));assert.equal(f.calls.filter(c=>c[0]==='act'||c[0]==='write').length,0);});
for(const [name,value] of [['false',failed],['throw',Error('PRIVATE_ACT_DETAIL')],['unknown',{}]])test(`fresh action ${name} fails without writing`,async t=>{const f=await fixture(t);await assert.rejects(f.api.actWithCache(f.sdk([value]),f.page,'synthetic'),e=>!e.message.includes('PRIVATE'));assert.equal(f.calls.filter(c=>c[0]==='write').length,0);assert.equal(f.calls.filter(c=>c[0]==='act').length,1);});
test('failed recovery never performs a third action or second observation',async t=>{const f=await fixture(t,{synthetic:action});await assert.rejects(f.api.actWithCache(f.sdk([failed,failed]),f.page,'synthetic'));assert.equal(f.calls.filter(c=>c[0]==='act').length,2);assert.equal(f.calls.filter(c=>c[0]==='observe').length,1);assert.equal((await f.document()).synthetic,undefined);});
test('atomic cache replacement preserves other instructions and creates private file',async t=>{const f=await fixture(t,{other:action});await f.api.simpleCache('synthetic',fresh);assert.equal((await f.document()).other.selector,action.selector);assert.equal((await fs.stat(path.join(f.dir,'cache.json'))).mode&0o777,0o600);assert.deepEqual(await fs.readdir(f.dir),['cache.json']);assert.ok(f.calls.find(c=>c[0]==='rename'));});
test('failed rename leaves original unchanged and removes temp file',async t=>{const f=await fixture(t,{other:action});f.faults.rename=true;await assert.rejects(f.api.simpleCache('synthetic',fresh));assert.deepEqual(await f.document(),{other:action});assert.deepEqual(await fs.readdir(f.dir),['cache.json']);});
test('queued writes merge latest state and recover after an earlier failure',async t=>{const f=await fixture(t);f.faults.write=true;await assert.rejects(f.api.simpleCache('failed',action));f.faults.write=false;await Promise.all([f.api.simpleCache('first',action),f.api.simpleCache('second',fresh)]);assert.deepEqual(Object.keys(await f.document()).sort(),['first','second']);});
test('invalid JSON fails explicitly before any execution or overwrite',async t=>{const f=await fixture(t,'PRIVATE_INVALID_JSON');await assert.rejects(f.api.actWithCache(f.sdk(),f.page,'synthetic'),/Invalid action cache JSON/);assert.equal(f.calls.filter(c=>['act','observe','write'].includes(c[0])).length,0);assert.equal(await fs.readFile(path.join(f.dir,'cache.json'),'utf8'),'PRIVATE_INVALID_JSON');});
test('successful action with a failed cache save does not repeat or report failed execution',async t=>{const f=await fixture(t);await f.api.actWithCache(f.sdk([()=>{f.faults.write=true;return success;}]),f.page,'synthetic');assert.equal(f.calls.filter(c=>c[0]==='act').length,1);assert.equal(f.calls.filter(c=>c[0]==='observe').length,1);assert.ok(f.warnings.length);assert.ok(!f.warnings.join(' ').includes('PRIVATE'));});
