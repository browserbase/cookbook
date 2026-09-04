import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const helperSource = stripTypeScriptTypes(readFileSync(new URL('src/app/browse-stream.ts', root), 'utf8'), {mode:'transform'});
const helper = await import('data:text/javascript;base64,' + Buffer.from(helperSource).toString('base64'));
const page = readFileSync(new URL('src/app/page.tsx', root), 'utf8');
const start = page.indexOf('  const handleSubmit = async () => {');
const source = page.slice(start, page.indexOf('\n  return (', start));
const encode = entry => `data: ${JSON.stringify(entry)}\n\n`;
async function submit(response, fetchError) {
  const state = {running:false, logs:[], listings:[], outcome:'idle'};
  const scope = vm.createContext({prompt:'Synthetic search',isRunning:false,
    consumeBrowseStream:helper.consumeBrowseStream,BrowseStreamError:helper.BrowseStreamError,
    fetch:async()=>{if(fetchError)throw fetchError;return response;},
    setIsRunning:v=>state.running=v,setRunOutcome:v=>state.outcome=v,
    setLogs:v=>state.logs=typeof v==='function'?v(state.logs):v,
    setListings:v=>state.listings=v,setSessionId:v=>state.session=v,
    setDebugUrl(){},setShowLiveView(){}});
  vm.runInContext(stripTypeScriptTypes(source) + '\nglobalThis.submit = handleSubmit;', scope);
  await scope.submit(); return state;
}
function stream(...entries) {return new Response(entries.map(encode).join(''), {headers:{'content-type':'text/event-stream'}});}
test('actual submit shows HTTP failure and enables retry', async()=>{
  const state=await submit(new Response('{"error":"PRIVATE_SYNTHETIC"}',{status:500}));
  assert.equal(state.running,false);assert.equal(state.outcome,'error');
  assert.ok(state.logs.some(e=>e.type==='error'&&e.message.includes('500')));
  assert.ok(!JSON.stringify(state.logs).includes('PRIVATE_SYNTHETIC'));
});
test('actual submit treats EOF after session as interrupted, not completed',async()=>{
  const state=await submit(stream({type:'session',message:'Synthetic session',sessionId:'synthetic'}));
  assert.equal(state.session,'synthetic');assert.equal(state.outcome,'interrupted');
  assert.equal(state.running,false);assert.ok(state.logs.some(e=>e.type==='error'));
});
test('actual submit preserves partial listings and reports interruption',async()=>{
  const listing={address:'Synthetic',price:'1',beds:'1',baths:'1',sqft:'1',link:'https://example.invalid',details:'Synthetic'};
  const state=await submit(stream({type:'result',message:'Partial',data:[listing]}));
  assert.equal(state.listings.length,1);assert.equal(state.outcome,'interrupted');assert.equal(state.running,false);
});
for(const outcome of ['completed','error','incomplete'])test(`actual submit retains explicit ${outcome} outcome`,async()=>{
  const state=await submit(stream({type:'done',message:'Synthetic finish',outcome}));
  assert.equal(state.outcome,outcome==='incomplete'?'interrupted':outcome);assert.equal(state.running,false);
  assert.equal(state.logs.some(e=>e.type==='error'),outcome!=='completed');
});
test('earlier error is never overwritten by done completed',async()=>{
  const state=await submit(stream({type:'error',message:'Synthetic error'},{type:'done',message:'Synthetic done',outcome:'completed'}));
  assert.equal(state.outcome,'error');assert.equal(state.running,false);
});
test('fetch rejection enables retry without exposing transport error payload',async()=>{
  const state=await submit(null,new Error('PRIVATE_SYNTHETIC'));
  assert.equal(state.outcome,'interrupted');assert.equal(state.running,false);
  assert.ok(!JSON.stringify(state.logs).includes('PRIVATE_SYNTHETIC'));
});
for(const result of [{completed:true,output:{listings:[]}}, {completed:false,message:'Synthetic incomplete',output:{listings:[]}}, null]) {
  test(`actual route terminal contract roundtrips through client: ${result?.completed ?? 'error'}`,async()=>{
    const schema={describe(){return this;}};
    let closed=0;
    const scope=vm.createContext({ReadableStream,Response,TextEncoder,process:{env:{}},
      z:{object:()=>schema,array:()=>schema,string:()=>schema},
      StagehandCreateOptionsSchema:{parse:value=>value},browserbase:{launch:async()=>({})},
      Stagehand:{create:async()=>({browser:{sessionId:'synthetic',close:async()=>closed++},close:async()=>closed++})},
      Browserbase:class {sessions={debug:async()=>({debuggerFullscreenUrl:'https://example.invalid'})};},
      runBrowserTask:async()=>{if(!result)throw Error('Synthetic failure');return result;}});
    const route=readFileSync(new URL('src/app/api/browse/route.ts',root),'utf8')
      .replace(/^import [\s\S]*?;\n/gm,'').replace(/export /g,'');
    vm.runInContext(stripTypeScriptTypes(route)+'\nglobalThis.post=POST;',scope);
    const response=await scope.post({json:async()=>({prompt:'Synthetic'})});
    const state=await submit(response);
    assert.equal(state.outcome,result===null?'error':result.completed?'completed':'interrupted');
    assert.equal(state.running,false);assert.equal(closed,2);
  });
}
