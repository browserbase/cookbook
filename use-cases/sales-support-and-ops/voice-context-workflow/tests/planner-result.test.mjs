import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),{z}=require(process.env.ZOD_MODULE_PATH || 'zod');
const raw=readFileSync(process.env.PLANNER_SOURCE || new URL('../lib/demo-controller.ts',import.meta.url),'utf8');
const between=(a,b)=>raw.slice(raw.indexOf(a),raw.indexOf(b,raw.indexOf(a)));
const code=between('const plannerDecisionSchema','const globalStore')+between('function getSessionId','function normalizeStringRecord')+between('function formatRecentEvents','async function waitForBrowseToSettle');
const decision={action:{type:'click',ref:'@0-5'},reason:'Synthetic visible button',spokenUpdate:'Clicking the button.'};
const assistant={type:'assistant',message:{content:[{type:'text',text:JSON.stringify(decision)}]}};
const success=(extra={})=>({type:'result',subtype:'success',is_error:false,result:JSON.stringify(decision),...extra});
async function run(messages,onEnd=()=>{},controller=new AbortController()){
 const scope=vm.createContext({z,process:{env:{}},PLANNER_MODEL:'synthetic',MAX_SNAPSHOT_LINES:140,MAX_LINK_TARGETS:40,getAnthropicApiKey:()=>null,
 query:async function*(){for(const message of messages)yield message;onEnd();}});
 vm.runInContext(stripTypeScriptTypes(code)+'\nglobalThis.plan=planNextStep;',scope);
 return scope.plan({events:[]},'synthetic instruction',{pages:[],tree:'',urlMap:{},pageText:''},controller);
}
for(const subtype of ['error_max_turns','error_during_execution','error_max_budget_usd','error_max_structured_output_retries']){
 test(`${subtype} discards prior assistant decision`,async()=>{
  await assert.rejects(run([assistant,{type:'result',subtype,is_error:true,errors:['synthetic failure']}]),/did not complete successfully/);
 });
}
test('missing terminal result discards provisional assistant JSON',async()=>{await assert.rejects(run([assistant]),/without a successful terminal/);});
test('successful final result supplies validated action',async()=>{assert.deepEqual(JSON.parse(JSON.stringify(await run([assistant,success()]))),decision);});
test('final result overrides provisional action',async()=>{
 const final={...decision,action:{type:'blocked',reason:'Need clarification'}};
 assert.equal((await run([assistant,success({result:JSON.stringify(final)})])).action.type,'blocked');
});
for(const extra of [{is_error:true},{is_error:undefined},{terminal_reason:'hook_stopped'},{stop_reason:'max_tokens'},{stop_reason:'tool_deferred'}]){
 test(`incomplete success envelope ${JSON.stringify(extra)} is rejected`,async()=>{await assert.rejects(run([assistant,success(extra)]),/did not complete successfully/);});
}
test('empty success result cannot fall back to assistant text',async()=>{await assert.rejects(run([assistant,success({result:''})]),/without a final decision/);});
test('invalid final action is rejected by actual Zod schema',async()=>{await assert.rejects(run([success({result:JSON.stringify({...decision,action:{type:'click',ref:''}})})]));});
test('stream failure after success prevents returning action',async()=>{await assert.rejects(run([success()],()=>{throw Error('synthetic stream failure');}),/stream failure/);});
test('abort at stream end prevents returning action',async()=>{const controller=new AbortController();await assert.rejects(run([success()],()=>controller.abort(),controller),/abort/i);});
test('multiple terminal results rejected',async()=>{await assert.rejects(run([success(),success()]),/multiple terminal/);});
