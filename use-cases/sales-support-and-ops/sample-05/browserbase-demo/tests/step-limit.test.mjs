import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const source=readFileSync(process.env.STEP_SOURCE || new URL('../lib/demo-controller.ts',import.meta.url),'utf8');
const client=readFileSync(new URL('../app/demo-client.tsx',import.meta.url),'utf8');
const slice=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
const code=slice(source,'function markRunComplete','function queueFollowUpInstruction')+slice(source,'async function runInstructionLoop','async function executeInstruction');
const voices=vm.createContext({});vm.runInContext(stripTypeScriptTypes(slice(client,'function buildVoiceContext','function mergeConversation'))+'\nglobalThis.context=buildVoiceContext;globalThis.guidance=buildToolVoiceGuidance;globalThis.speak=buildToolSpeakableUpdate;',voices);
async function fixture(terminal,fail=false){
 let steps=0,actions=0;const session={activeRunId:'synthetic',abortController:new AbortController(),pendingQueue:[],busy:true};
 const scope=vm.createContext({MAX_STEP_COUNT:8,getDirectNavigationUrl:()=>null,ensureBrowserRuntime:async()=>{},inspectBrowser:async()=>({}),
 planNextStep:async()=>({action:++steps===8 && terminal?terminal:{type:'back'},reason:'Synthetic step',spokenUpdate:'Synthetic update'}),
 executeBrowserAction:async()=>{actions++;if(fail)throw Error('synthetic failure');return {};},assertNavigationSucceeded(){},syncPageState:async()=>{},
 pushEvent(){},publishSession(){},describeBrowserAction:()=>'',setControlOutcome:(s,outcome,message)=>{s.lastControlOutcome=outcome;s.lastControlMessage=message;}});
 vm.runInContext(stripTypeScriptTypes(code)+'\nglobalThis.run=runInstructionLoop;',scope);await scope.run(session,{instruction:'synthetic'});return {session,steps,actions};
}
test('eight nonterminal actions produce incomplete state, heading and voice guidance',async()=>{
 const {session,steps,actions}=await fixture();assert.equal(steps,8);assert.equal(actions,8);
 assert.equal(session.status,'incomplete');assert.equal(session.lastControlOutcome,'incomplete');assert.equal(session.busy,false);
 assert.match(session.currentStep,/Incomplete/);assert.match(session.lastSummary,/without confirming/);
 assert.match(voices.context(session).key,/^incomplete:/);assert.match(voices.guidance(session),/ask whether to continue/);assert.equal(voices.speak(session),session.lastSummary);
});
test('repeated browser failures cannot become completed at limit',async()=>{const {session}=await fixture(null,true);assert.equal(session.lastControlOutcome,'incomplete');});
for(const action of [{type:'done',summary:'Synthetic completion'},{type:'answer',answer:'Synthetic answer',evidence:['Synthetic evidence']}]){
 test(`${action.type} at final allowed step retains completed outcome`,async()=>{
 const {session,actions}=await fixture(action);assert.equal(actions,7);assert.equal(session.lastControlOutcome,'completed');assert.equal(session.status,'ready');assert.match(voices.context(session).key,/^completed:/);
 });
}
test('explicit planner block retains blocked outcome',async()=>{const {session}=await fixture({type:'blocked',reason:'Need input',question:'Which item?'});assert.equal(session.lastControlOutcome,'blocked');});
