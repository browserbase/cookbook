const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
function source(name){return stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../src',name),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'')}
function fixture(fail,closeFail){
 const counts={browser:0,stagehand:0},timers=new Set();let seen;
 const page={title:async()=>'',evaluate:async()=>'',url:async()=>{await Promise.resolve();return 'https://synthetic.invalid/cf-chl/'},goto:async()=>{if(fail==='goto')throw new Error('navigation failed');if(fail==='goto-forbidden')throw new Error('Forbidden by synthetic target website')}};
 const browser={sessionId:'synthetic',context:{activePage:async()=>page},close:async()=>{counts.browser++;if(closeFail==='browser')throw new Error('browser close failed')}};
 const context={process:{env:{}},z:require('zod').z,
  StagehandCreateOptionsSchema:{parse:input=>{if(fail==='schema')throw new Error('schema failed');return input}},
  browserbase:{launch:async()=>{if(fail==='launch')throw new Error('launch failed');return browser}},
  Stagehand:{create:async()=>{if(fail==='create')throw new Error('create failed');return {browser,extract:async()=>({data:{success:true,blocked:false}}),close:async()=>{counts.stagehand++;if(closeFail==='stagehand')throw new Error('stagehand close failed')}}}},
  effectiveFeatures:()=>({advancedStealth:false}),resolveModelKey:()=>({key:'synthetic'}),runBrowserTask:async()=>{},URL,
  setTimeout(fn,ms){const timer=setTimeout(fn,ms);timers.add(timer);return timer},clearTimeout(timer){timers.delete(timer);clearTimeout(timer)}};
 vm.runInNewContext(source('classify.ts')+'\n'+source('runner.ts'),context);
 const classify=context.classify;context.classify=input=>{seen=input.signals;return classify(input)};
 return {context,counts,timers,get signals(){return seen},run:()=>context.runAttempt({url:'https://synthetic.invalid',task:'read fixture'},{model:'synthetic',region:'synthetic',features:{},maxSteps:1,timeoutMs:100},1)};
}
test('actual classifier receives resolved URL and detects its signature; both resources close',async()=>{
 const f=fixture();const result=await f.run();assert.equal(result.success,true);
 assert.equal(result.detected,'Cloudflare');assert.equal(typeof f.signals.url,'string');
 assert.deepEqual(f.counts,{browser:1,stagehand:1});assert.equal(f.timers.size,0);
});
test('allocation, schema, initialization and navigation failures clean every allocated handle',async()=>{
 for(const failure of ['launch','schema','create','goto']){
  const f=fixture(failure);const result=await f.run();assert.equal(result.outcome,'error');
  assert.deepEqual(f.counts,{browser:failure==='launch'?0:1,stagehand:failure==='goto'?1:0});assert.equal(f.timers.size,0);
 }
});
test('post-allocation failures retain replay identity and are not mislabeled as plan errors',async()=>{
 const f=fixture('goto-forbidden');
 // Exercise the generic forbidden wording at the navigation stage.
 const result=await f.run();
 assert.equal(result.sessionId,'synthetic');
 assert.match(result.replayUrl,/synthetic$/);
 assert.equal(result.failureStage,'navigation');
 assert.doesNotMatch(result.reason,/Enterprise|Scale-plan/);
});
test('each failing close leaves independent cleanup attempted and preserves operation failure',async()=>{
 for(const close of ['stagehand','browser']){
  const f=fixture('goto',close);
  await assert.rejects(f.run(),error=>{assert.equal(error.message,'Attempt cleanup failed');assert.equal(error.errors.length,2);assert.match(error.errors[0].message,/navigation/);return true});
  assert.deepEqual(f.counts,{browser:1,stagehand:1});assert.equal(f.timers.size,0);
 }
});
test('URL rejection or invalid value never puts a promise or non-string into signals',async()=>{
 const f=fixture();
 for(const url of [async()=>42,async()=>{throw new Error('url unavailable')}]){
  assert.equal(await f.context.captureSignals({title:async()=>'',evaluate:async()=>'',url}),undefined);
 }
});
