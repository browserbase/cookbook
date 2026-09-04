import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const {z}=createRequire(import.meta.url)('zod/v4');
const source=stripTypeScriptTypes(readFileSync(new URL('../stagehand/complete_task/workday.ts',import.meta.url),'utf8')).replace(/^import .*$/gm,'').replace(/^export default .*$/gm,'');
const base={WORKDAY_LOGIN_URL:'https://example.invalid/login',WORKDAY_AUTHENTICATED_URL:'https://example.invalid/account',WORKDAY_ACCOUNT_SELECTOR:'#signed-in-user',WORKDAY_USERNAME:'fixture-user',WORKDAY_PASSWORD:'synthetic-password-marker'};
async function run(change={}){
 let launches=0,url;const acts=[],fills=[],closed=[],logs=[],exits=[],navigations=[];
 const account={count:async()=>change.count??1,isVisible:async()=>change.visible??true,innerText:async()=>change.username??'fixture-user',waitFor:async()=>{},textContent:async()=>change.username??'fixture-user'};
 const page=change.page??{goto:async value=>{navigations.push(value);url=change.landed??value;if(change.navigation)throw Error('navigation');return change.noResponse?null:{ok:()=>!change.httpError};},url:async()=>url,waitForTimeout:async()=>{},waitForSelector:async()=>!change.waitFails,locator:selector=>selector==='#signed-in-user'?account:{fill:async value=>{fills.push(value);if(change.fillThrows)throw Error('fill');},count:async()=>1}};
 const stagehand={act:async(action,options)=>{acts.push({action,options});return change.failAt===acts.length?{data:{success:false}}:{data:{success:true}};},close:async()=>{closed.push('stagehand');if(change.closeThrows)throw Error('close');}};
 const context=vm.createContext({z,URL,Error,AggregateError,Date,process:{env:{...base,...change.env},exit:code=>exits.push(code)},console:{log:(...v)=>logs.push(v.join(' ')),error:(...v)=>logs.push(v.join(' '))},dotenv:{config(){}},browserbase:{launch:async()=>{launches++;if(change.launchThrows)throw Error('launch');return {context:{pages:async()=>[page]},close:async()=>closed.push('browser')};}},Stagehand:{create:async()=>{if(change.init)throw Error('init');return stagehand;}}});
 const start=source.lastIndexOf('\nrunWorkflow()');assert.ok(start>=0);vm.runInContext(source.slice(0,start)+'\nglobalThis.done='+source.slice(start+1),context);await context.done;
 return {launches,acts,fills,closed,logs,exits,exit:context.process.exitCode,navigations,page};
}
const failed=r=>assert.equal(r.exits[0]??r.exit,1);
for(const field of Object.keys(base))test(`requires ${field} before allocation`,async()=>{const r=await run({env:{[field]:''}});failed(r);assert.equal(r.launches,0);});
for(const env of [{WORKDAY_AUTHENTICATED_URL:base.WORKDAY_LOGIN_URL},{WORKDAY_AUTHENTICATED_URL:'https://other.invalid/account'},{WORKDAY_LOGIN_URL:'javascript:alert(1)'}])test(`rejects invalid target ${JSON.stringify(env)}`,async()=>{const r=await run({env});failed(r);assert.equal(r.launches,0);});
test('checks account identity and never puts credentials in model actions',async()=>{const r=await run();assert.equal(r.exits[0]??r.exit??0,0);assert.deepEqual(r.fills,['fixture-user','synthetic-password-marker']);assert.equal(r.navigations.at(-1),base.WORKDAY_AUTHENTICATED_URL);for(const a of r.acts)assert.equal(a.options.page,r.page);assert.doesNotMatch(JSON.stringify(r.acts)+r.logs.join(' '),/synthetic-password-marker/);assert.deepEqual(r.closed,['stagehand','browser']);});
test('context still requires actual configured account state',async()=>{const r=await run({env:{BROWSERBASE_CONTEXT_ID:'fixture-context',WORKDAY_PASSWORD:''}});assert.equal(r.exits[0]??r.exit??0,0);assert.equal(r.acts.length,0);assert.equal(r.fills.length,0);assert.deepEqual(r.navigations,[base.WORKDAY_AUTHENTICATED_URL]);});
for(const change of [{failAt:1},{failAt:2},{username:'different-user'},{count:0},{count:2},{visible:false},{landed:base.WORKDAY_LOGIN_URL},{fillThrows:true},{init:true},{navigation:true},{closeThrows:true},{launchThrows:true},{httpError:true},{noResponse:true},{waitFails:true}])test(`fails instead of reporting workflow success ${JSON.stringify(change)}`,async()=>{const r=await run(change);failed(r);assert.deepEqual(r.closed,change.launchThrows?[]:change.init?['browser']:['stagehand','browser']);});

for(const name of ['fixture-user','wrong-user','delayed-user'])test(`local DOM account check ${name}`, {skip:!process.env.COOKBOOK_CHROME},async()=>{
 const {chromium}=createRequire(import.meta.url)('playwright-core');const browser=await chromium.launch({executablePath:process.env.COOKBOOK_CHROME,headless:true});
 try{const context=await browser.newContext();await context.route('**/*',route=>route.fulfill({status:200,contentType:'text/html',body:name==='delayed-user'?'<span id="signed-in-user" hidden>fixture-user</span><script>setTimeout(()=>document.querySelector("span").hidden=false,100)</script>':`<span id="signed-in-user">${name}</span>`}));const raw=await context.newPage();
 const page={goto:(...args)=>raw.goto(...args),url:()=>raw.url(),locator:selector=>raw.locator(selector),waitForSelector:async(...args)=>Boolean(await raw.waitForSelector(...args))};
 const r=await run({page,env:{BROWSERBASE_CONTEXT_ID:'fixture-context',WORKDAY_PASSWORD:''}});assert.equal(r.exits[0]??r.exit??0,name==='wrong-user'?1:0);
 }finally{await browser.close();}
});
