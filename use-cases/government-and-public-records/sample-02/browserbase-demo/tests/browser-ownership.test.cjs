const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../src/main.ts'),'utf8');const a=source.indexOf('async function run()');const b=source.indexOf('\nasync function resolveBrowserbaseContextId',a);assert(a>=0&&b>a);
for(const mode of ['success','schema','init','page','stagehand-close','browser-close','operation-and-both-closes']) {
 test(`runner owns browser through ${mode}`,async()=>{
  const calls=[];let writes=0;
  const original=new Error('synthetic operation');const stagehandClose=new Error('synthetic stagehand close');const browserClose=new Error('synthetic browser close');
  const browser={close:async()=>{calls.push('browser');if(['browser-close','operation-and-both-closes'].includes(mode))throw browserClose;}};
  const stagehand={browser,close:async()=>{calls.push('stagehand');if(['stagehand-close','operation-and-both-closes'].includes(mode))throw stagehandClose;}};
  const run=vm.runInNewContext(stripTypeScriptTypes(source.slice(a,b))+';run',{
   env:new Proxy({USE_BROWSERBASE:'false',REDACT_OUTPUT:'true'},{get:(obj,key)=>obj[key]??'false'}),
   StagehandCreateOptionsSchema:{parse:v=>{if(mode==='schema')throw original;return v;}},
   Stagehand:{create:async()=>{if(mode==='init')throw original;return stagehand;}},localBrowser:{launch:async()=>browser},
   getActivePage:async()=>{if(['page','operation-and-both-closes'].includes(mode))throw original;return {};},
   siteOrder:[],searchCriteria:{},browserbaseProxyConfig:()=>false,console:{log:()=>{}},path,
   mkdirSync:()=>{},writeFileSync:()=>{writes++;},
  });
  if(mode==='success')await run();
  else await assert.rejects(run(),error=>{
   if(mode==='operation-and-both-closes'){assert.deepEqual(Array.from(error.errors),[original,stagehandClose,browserClose]);return true;}
   return error===(mode==='stagehand-close'?stagehandClose:mode==='browser-close'?browserClose:original);
  });
  assert.deepEqual(calls,['schema','init'].includes(mode)?['browser']:['stagehand','browser']);
  assert.equal(writes,mode==='success'?1:0);
 });
}
