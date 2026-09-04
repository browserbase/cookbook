import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { invokeCompanyNews } from '../invoke.mjs';
const {z} = await import(process.env.COOKBOOK_ZOD_MODULE || 'zod');
const root = new URL('../', import.meta.url);
const news = () => ({summary:'Synthetic observed news.', topLinks:[{title:'Synthetic announcement',url:'https://example.com/news',source:'Example publisher'}]});
function fixture(options={}) {
  const calls={connect:0,stageClose:0,browserClose:0,keys:[],models:[],extract:0,logs:[]};
  let handler, schema;
  const browser={context:{async activePage(){return {async goto(){if(options.navigationError)throw Error('PRIVATE_NAVIGATION_DETAIL');}}}},async close(){calls.browserClose++;}};
  const stagehand={browser,async close(){calls.stageClose++;if(options.closeError)throw Error('PRIVATE_CLOSE_DETAIL');},async extract(){calls.extract++;throw Error('Unexpected final-page extraction');}};
  const context=vm.createContext({z,URL,Buffer,Date,setTimeout,process:{env:{}},console:{log:()=>{},warn:msg=>calls.logs.push(msg),error:msg=>calls.logs.push(msg)},
    defineFn(name,fn,config){assert.equal(name,'company-news-finder');handler=fn;schema=config.parametersSchema;},
    StagehandCreateOptionsSchema:{parse:v=>v},Stagehand:{async create(config){calls.keys.push(config.model.apiKey);calls.models.push(config.model.modelName);if(options.createError)throw Error('PRIVATE_CREATE_DETAIL');return stagehand;}},
    localBrowser:{async connect(){calls.connect++;return browser;}},createOpenAI:({apiKey})=>model=>{calls.keys.push(apiKey);calls.models.push(model);return {syntheticModel:true};},
    stepCountIs:count=>count,tool:config=>config,
    async generateText(config){if(options.agentError)throw Error('PRIVATE_MODEL_DETAIL');if(!options.noFinish){const finish={success:options.success??true,message:'Synthetic completion',output:options.output===undefined?news():options.output};if(options.missingOutput)delete finish.output;const parsed=config.tools.finish.inputSchema.parse(finish);await config.tools.finish.execute(parsed);}return {steps:[{screenshot:'PRIVATE_SCREENSHOT'}],text:'PRIVATE_RAW_TEXT',totalUsage:{}};},
  });
  for(const [name,override] of [['browser-task.ts',process.env.COOKBOOK_R177_HELPER_BASELINE],['index.ts',process.env.COOKBOOK_R177_BASELINE]]) {
    const source=fs.readFileSync(override||new URL(name,root),'utf8').replace(/^import[\s\S]*?from\s+["'][^"']+["'];\s*/gm,'').replace(/^export /gm,'');
    vm.runInContext(stripTypeScriptTypes(source),context);
  }
  const invoke=(params={companyName:'Synthetic Company',apiKey:'SYNTHETIC_MODEL_KEY'})=>handler({session:{id:'synthetic-session',connectUrl:'ws://synthetic.invalid'}},params);
  return {calls,invoke,get schema(){return schema;}};
}
test('handler and structured finish return the documented news contract',async()=>{const f=fixture();const result=await f.invoke();assert.equal(result.success,true);assert.deepEqual(JSON.parse(JSON.stringify(result.topLinks)),news().topLinks);assert.equal(result.summary,news().summary);assert.equal(result.metadata.totalLinks,1);assert.equal(result.metadata.sessionReplayUrl,'https://www.browserbase.com/sessions/synthetic-session');assert.equal(f.calls.extract,0);assert.deepEqual(f.calls.keys,['SYNTHETIC_MODEL_KEY','SYNTHETIC_MODEL_KEY']);assert.deepEqual(f.calls.models,['openai/gpt-5.4-mini','gpt-5.4-mini']);assert.equal(f.calls.stageClose,1);assert.equal(f.calls.browserClose,1);assert.ok(!JSON.stringify(result).includes('PRIVATE'));assert.ok(!JSON.stringify(result).includes('SYNTHETIC_MODEL_KEY'));});
for(const [label,output] of [['empty',{}],['blank summary',{...news(),summary:' '}],['no links',{...news(),topLinks:[]}],['bad URL',{...news(),topLinks:[{...news().topLinks[0],url:'javascript:alert(1)'}]}],['credentials URL',{...news(),topLinks:[{...news().topLinks[0],url:'https://user:pass@example.com'}]}],['missing source',{...news(),topLinks:[{title:'a',url:'https://example.com'}]}],['oversized summary',{...news(),summary:'x'.repeat(6001)}],['too many links',{...news(),topLinks:Array(8).fill(news().topLinks[0])}]])test(`rejects ${label} structured output`,async()=>{const f=fixture({output});const result=await f.invoke();assert.equal(result.success,false);assert.equal(result.summary,null);assert.equal(result.topLinks.length,0);assert.equal(f.calls.browserClose,1);});
for(const flag of ['noFinish','agentError','navigationError','createError'])test(`handles ${flag} with stable failure and cleanup`,async()=>{const f=fixture({[flag]:true});const result=await f.invoke();assert.equal(result.success,false);assert.ok(!JSON.stringify(result).includes('PRIVATE'));assert.equal(f.calls.browserClose,1);assert.equal(f.calls.stageClose,flag==='createError'?0:1);});
test('explicit unsuccessful completion is not a news result',async()=>{assert.equal((await fixture({success:false}).invoke()).success,false);});
test('Stagehand cleanup failure still disconnects browser',async()=>{const f=fixture({closeError:true});assert.equal((await f.invoke()).success,true);assert.equal(f.calls.browserClose,1);assert.ok(!f.calls.logs.join().includes('PRIVATE'));});
for(const params of [{companyName:'x'}, {companyName:' ',apiKey:'x'}, {companyName:'x',apiKey:' '}, {companyName:'x',apiKey:'x',model:'google/gemini'}, {companyName:'x',apiKey:'x',maxSteps:0}, {companyName:'x',apiKey:'x',maxSteps:1.5}, {companyName:'x',apiKey:'x',maxSteps:101}])test(`invalid input rejected before connection ${JSON.stringify(params)}`,async()=>{const f=fixture();await assert.rejects(f.invoke(params));assert.equal(f.calls.connect,0);});
test('dashboard JSON is accepted by exact parameter schema',()=>{const readme=fs.readFileSync(new URL('README.md',root),'utf8');const params=JSON.parse(readme.match(/```json\n([\s\S]*?)\n```/)[1]);assert.equal(fixture().schema.parse(params).companyName,'Example Company');});
const clientParams={browserbaseApiKey:'SYNTHETIC_BB',apiKey:'SYNTHETIC_MODEL_KEY',functionId:'synthetic-function',companyName:'Synthetic Company'};
function transport(polls){let count=0,sleeps=0;return {get sleeps(){return sleeps;},fetchImpl:async(url,options)=>{assert.equal(options.headers['x-bb-api-key'],'SYNTHETIC_BB');if(options.method==='POST'){const body=JSON.parse(options.body);assert.equal(body.params.apiKey,'SYNTHETIC_MODEL_KEY');fixture().schema.parse(body.params);assert.equal(url,'https://api.browserbase.com/v1/functions/synthetic-function/invoke');return {ok:true,json:async()=>({id:'synthetic-invocation'})};}assert.equal(url,'https://api.browserbase.com/v1/functions/invocations/synthetic-invocation');return {ok:true,json:async()=>polls[Math.min(count++,polls.length-1)]};},sleep:async()=>{sleeps++;}};}
test('actual caller consumes actual handler through pending and running states',async()=>{const result=await fixture().invoke();const t=transport([{status:'PENDING'},{status:'RUNNING'},{status:'COMPLETED',results:result}]);assert.equal((await invokeCompanyNews(clientParams,t)).summary,news().summary);assert.equal(t.sleeps,2);});
for(const poll of [{status:'FAILED'},{status:'OTHER'},{status:'COMPLETED',results:{success:true}},{status:'COMPLETED',results:{success:false,summary:null,topLinks:[]}}])test(`caller rejects unusable result ${JSON.stringify(poll)}`,async()=>{await assert.rejects(invokeCompanyNews(clientParams,transport([poll])));});
test('caller terminates polling without claiming remote cancellation',async()=>{const t=transport([{status:'PENDING'}]);await assert.rejects(invokeCompanyNews(clientParams,t),/may still be running/);assert.equal(t.sleeps,300);});
test('caller rejects HTTP failure without exposing provider body',async()=>{await assert.rejects(invokeCompanyNews(clientParams,{fetchImpl:async()=>({ok:false,status:403,json:async()=>{throw Error('PRIVATE_HTTP_BODY');}})}),/HTTP 403/);});

test('successful finish requires structured output',async()=>{assert.equal((await fixture({missingOutput:true}).invoke()).success,false);});
test('UTF-8 byte budget rejects an otherwise valid oversized result',async()=>{const output={summary:'字'.repeat(6000),topLinks:Array.from({length:7},()=>({title:'字'.repeat(300),source:'字'.repeat(200),url:'https://example.com/'+ '字'.repeat(1900)}))};assert.equal((await fixture({output}).invoke()).success,false);});
