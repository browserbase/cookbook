import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
const env={STRIPE_API_KEY:'sk_test_fixture',STRIPE_CARD_ID:'ic_fixture',STRIPE_CARDHOLDER_ID:'ich_fixture',BROWSERBASE_API_KEY:'fixture',BROWSERBASE_PROJECT_ID:'fixture',STRIPE_TEST_AUTHORIZATION_KEY:'fixture-order-1',OPENAI_API_KEY:'fixture-model'};
function fixture({failure,receipt={},authorization={},realBrowser}={}){
 const calls={launch:0,release:0,close:[],authorize:[],act:[],logs:[]};
 const holder={id:'ich_fixture',livemode:false,status:'active',requirements:{disabled_reason:null,past_due:[]}};
 class Stripe {constructor(){this.issuing={cards:{retrieve:async()=>({id:'ic_fixture',cardholder:holder.id,livemode:false,status:failure==='card'?'inactive':'active'})},cardholders:{retrieve:async()=>holder}};this.testHelpers={issuing:{authorizations:{create:async(...args)=>{calls.authorize.push(args);return{id:'iauth_fixture',card:'ic_fixture',cardholder:holder.id,livemode:false,approved:true,status:'pending',amount:1000,currency:'usd',...authorization};}}}};}}
 class Browserbase {constructor(){this.sessions={update:async()=>{calls.release++;if(failure==='release')throw Error('release failed');}};}}
 const response=()=>({amount:'1000',currency:'usd',nonce:'fixture-nonce',text:'Test order confirmed',...receipt});
 const page={goto:async url=>{assert.ok(url.startsWith('data:text/html'));},evaluate:async()=>response(),locator:()=>({evaluate:async()=>response()})};
 const browser={sessionId:'session-fixture',context:{newPage:async()=>realBrowser?await realBrowser.newPage():page},close:async()=>{calls.close.push('browser');if(realBrowser)await realBrowser.close();if(failure==='browserClose')throw Error('browser close failed');}};
 const browserbase={launch:async options=>{calls.launch++;assert.equal(options.api_timeout,300);return browser;}};
 const stagehand={act:async(...args)=>{calls.act.push(args);assert.ok(args[1].page);if(realBrowser)await args[1].page.locator('#confirm').click();return{data:{success:failure!=='act'}};},close:async()=>{calls.close.push('stagehand');if(failure==='stagehandClose')throw Error('stagehand close failed');}};
 const Stagehand={create:async()=>{if(failure==='create')throw Error('create failed');return stagehand;}};
 const globals={Stripe,Browserbase,browserbase,Stagehand,randomUUID:()=> 'fixture-nonce',process:{env:{...env},argv:[]},console:{log:(...x)=>calls.logs.push(x),error(){}}};
 const context=vm.createContext(globals);
 for(const filename of ['4-make-payment.ts','index.ts']){
  const source=readFileSync(new URL(`../stagehand/${filename}`,import.meta.url),'utf8').replace(/^import[\s\S]*?;\s*$/gm,'').replace(/^export /gm,'').replace(/\nif \(process\.argv\[1\][\s\S]*$/,'');
  vm.runInContext(stripTypeScriptTypes(source),context);
 }
 return{context,calls};
}
test('checked owned-page action and receipt precede sandbox authorization',async()=>{const{context,calls}=fixture();await context.run();assert.equal(calls.authorize.length,1);assert.equal(calls.act.length,1);assert.equal(calls.authorize[0][1].idempotencyKey,env.STRIPE_TEST_AUTHORIZATION_KEY);assert.deepEqual(calls.close,['stagehand','browser']);assert.equal(calls.release,1);assert.equal(calls.logs.length,1);});
for(const name of Object.keys(env))test(`preflight requires ${name}`,async()=>{const{context,calls}=fixture();delete context.process.env[name];await assert.rejects(context.run());assert.equal(calls.launch,0);});
for(const failure of ['act','create','card'])test(`${failure} failure prevents authorization`,async()=>{const{context,calls}=fixture({failure});await assert.rejects(context.run());assert.equal(calls.authorize.length,0);assert.equal(calls.release,failure==='card'?0:1);});
for(const receipt of [{nonce:'stale'},{amount:'2000'},{text:'unconfirmed'}])test(`receipt mismatch blocks authorization ${JSON.stringify(receipt)}`,async()=>{const{context,calls}=fixture({receipt});await assert.rejects(context.run());assert.equal(calls.authorize.length,0);assert.equal(calls.release,1);});
for(const authorization of [{approved:false},{livemode:true},{status:'closed'},{card:'ic_other'},{amount:999}])test(`invalid authorization fails ${JSON.stringify(authorization)}`,async()=>{const{context,calls}=fixture({authorization});await assert.rejects(context.run());assert.equal(calls.logs.length,0);assert.equal(calls.release,1);});
for(const failure of ['stagehandClose','browserClose','release'])test(`independent cleanup after ${failure}`,async()=>{const{context,calls}=fixture({failure});await assert.rejects(context.run());assert.deepEqual(calls.close,['stagehand','browser']);assert.equal(calls.release,1);assert.equal(calls.logs.length,0);});
test('real local browser confirms fixture through the action adapter', {skip:!process.env.COOKBOOK_PLAYWRIGHT_MODULE},async()=>{const{chromium}=await import(process.env.COOKBOOK_PLAYWRIGHT_MODULE);const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{const{context,calls}=fixture({realBrowser:browser});await context.run();assert.equal(calls.authorize.length,1);}finally{await browser.close();}});
