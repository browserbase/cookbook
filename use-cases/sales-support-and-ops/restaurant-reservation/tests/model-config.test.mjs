import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire,stripTypeScriptTypes} from 'node:module';import vm from 'node:vm';
const require=createRequire(import.meta.url),{z}=require(process.env.ZOD_MODULE_PATH || 'zod');
const root=new URL('../',import.meta.url);
const helper=readFileSync(new URL('browser-task.ts',root),'utf8');
const resolveSource=helper.slice(helper.indexOf('export function resolveBrowserAgentModel'),helper.indexOf('export async function runBrowserTask')).replace('export ','');
function resolver(env={}){const built=[];const scope=vm.createContext({process:{env},createOpenAI:options=>id=>{const model={id,options};built.push(model);return model;}});vm.runInContext(stripTypeScriptTypes(resolveSource)+'\nglobalThis.resolve=resolveBrowserAgentModel;',scope);return {resolve:scope.resolve,built};}
for(const apiKey of ['', ' ', undefined])test(`missing outer key rejects: ${JSON.stringify(apiKey)}`,()=>{const {resolve,built}=resolver();assert.throws(()=>resolve({apiKey}));assert.equal(built.length,0);});
for(const model of ['', ' ', 'openai/gpt-5.4-mini',' gpt-5.4-mini'])test(`invalid outer ID rejects: ${JSON.stringify(model)}`,()=>{const {resolve,built}=resolver();assert.throws(()=>resolve({apiKey:'synthetic',model}));assert.equal(built.length,0);});
test('explicit outer config overrides ambient credentials and chooses the actual provider model',()=>{const {resolve}=resolver({OPENAI_API_KEY:'ambient',AGENT_MODEL:'ambient-model'});const model=resolve({apiKey:'synthetic',model:'gpt-5.4-mini'});assert.equal(model.id,'gpt-5.4-mini');assert.equal(model.options.apiKey,'synthetic');});
function booking(){let handler,attached=0,agentModel,primitive;const {resolve,built}=resolver();
 const page={goto:async()=>{},waitForTimeout:async()=>{}};
 const scope=vm.createContext({z,defineFn:(_name,fn)=>handler=fn,resolveBrowserAgentModel:resolve,
  chromium:{connectOverCDP:async()=>{attached++;return {contexts:()=>[{pages:()=>[page]}]};}},
  localBrowser:{connect:async()=>({})},StagehandCreateOptionsSchema:{parse:v=>v},
  Stagehand:{create:async config=>{primitive=config.model;return {};}},
  runBrowserTask:async(_stagehand,_task,options)=>{agentModel=options.model;throw Error('Synthetic stop before booking');},
  formatPhoneNumber:v=>v,console:{log(){},error(){}}});
 const source=readFileSync(new URL('index.ts',root),'utf8').replace(/^import .*;\n/gm,'');
 vm.runInContext(stripTypeScriptTypes(source),scope);
 return {run:params=>handler({session:{id:'synthetic',connectUrl:'synthetic'}},params),attached:()=>attached,model:()=>agentModel,primitive:()=>primitive,built};
}
const params={restaurantName:'Synthetic',date:'2099-01-01',time:'19:00',partySize:2,guestFirstName:'Synthetic',guestLastName:'Fixture',guestEmail:'fixture@example.invalid',guestPhoneNumber:'5550000000',apiKey:'primitive-key',agentApiKey:'outer-key'};
test('booking rejects missing outer credential before CDP attachment',async()=>{const f=booking();const input={...params};delete input.agentApiKey;await assert.rejects(f.run(input));assert.equal(f.attached(),0);});
test('booking rejects invalid outer model before CDP attachment',async()=>{const f=booking();const result=await f.run({...params,agentModel:'anthropic/example'});assert.equal(result.success,false);assert.equal(f.attached(),0);});
test('booking passes separate intended credentials to primitive and outer models',async()=>{const f=booking();await f.run({...params,agentModel:'gpt-5.4-mini'});assert.equal(f.attached(),1);assert.equal(f.primitive().apiKey,'primitive-key');assert.equal(f.model().options.apiKey,'outer-key');assert.equal(f.model().id,'gpt-5.4-mini');});
