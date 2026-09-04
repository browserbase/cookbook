const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {stripTypeScriptTypes} = require('node:module');
const source = stripTypeScriptTypes(fs.readFileSync(require('node:path').join(__dirname,'../src/01-act-cache-with-variables.ts'),'utf8'));
const body = source.slice(source.indexOf('async function inspectCacheContents'),source.lastIndexOf('main().catch'));
for (const scenario of ['missing','empty','exposed','clean']) {
  test('actual inspector and main summarize '+scenario+' evidence',async()=>{
    const output=[];
    const context = vm.createContext({
      console:{log:(...a)=>output.push(a.join(' ')),error:(...a)=>output.push(a.join(' '))},
      process:{argv:[],exitCode:0},CACHE_DIR:'synthetic',TEST_USERNAMES:['fixture-one','fixture-two','fixture-three'],
      path:{join:(...a)=>a.join('/')},
      fs:{existsSync:()=>scenario!=='missing',readdirSync:()=>scenario==='empty'?[]:['fixture.json'],readFileSync:()=>JSON.stringify({instruction:scenario==='exposed'?'fixture-one':'%username%',actions:[]})},
      runWithVariables:async(username)=>({username,elapsed:1000,cacheHit:false}),
    });
    await vm.runInContext(body+'\nmain();',context);
    const text=output.join('\n');
    assert.doesNotMatch(text,/PRIVACY PRESERVED|All subsequent runs: Cache hit/);
    assert.match(text,/0 of 4 runs/);
    assert.equal(context.process.exitCode,scenario==='exposed'?1:0);
    assert.match(text,scenario==='exposed'?/PRIVACY CHECK FAILED/:scenario==='clean'?/Test values absent/:/PRIVACY UNVERIFIED/);
  });
}
test('agent main never infers cache replay from fast failed runs',async()=>{
 const agentSource=stripTypeScriptTypes(fs.readFileSync(require('node:path').join(__dirname,'../src/02-agent-cache-test.ts'),'utf8'));
 const main=agentSource.slice(agentSource.indexOf('async function main'),agentSource.lastIndexOf('main().catch'));
 const output=[];
 const context=vm.createContext({console:{log:(...a)=>output.push(a.join(' '))},setTimeout:fn=>fn(),runAgentTask:async runNumber=>({runNumber,elapsed:100,stepCount:0,success:false,cacheHit:null})});
 await vm.runInContext(main+'\nmain();',context);
 assert.match(output.join('\n'),/UNVERIFIED/);
 assert.doesNotMatch(output.join('\n'),/Expected cache HIT|faster with cache|Caching supported/);
});
for(const success of [false,true]) test('actual agent runner reports unknown cache for fast success='+success,async()=>{
 const agentSource=stripTypeScriptTypes(fs.readFileSync(require('node:path').join(__dirname,'../src/02-agent-cache-test.ts'),'utf8'));
 const runner=agentSource.slice(agentSource.indexOf('async function runAgentTask'),agentSource.indexOf('async function main'));
 let clock=0,closes=0;
 const page={goto:async()=>{},waitForLoadState:async()=>{}};
 const stagehand={browser:{context:{pages:async()=>[page]},close:async()=>{closes++;}},close:async()=>{closes++;}};
 const context=vm.createContext({console:{log:()=>{},error:()=>{}},Date:{now:()=>clock+=100},Stagehand:{create:async()=>stagehand},StagehandCreateOptionsSchema:{parse:v=>v},localBrowser:{launch:async()=>({})},runBrowserTask:async()=>({success,actions:[]})});
 const result=await vm.runInContext(runner+'\nrunAgentTask(1);',context);
 assert.equal(result.cacheHit,null);
 assert.equal(result.success,success);
 assert.equal(closes,2);
});
