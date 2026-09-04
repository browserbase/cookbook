// Node 24: node --test tests/page-health.test.mjs
// Browser checks: set PLAYWRIGHT_MODULE_PATH to an installed playwright-core module or directory.
// Optional CHROME_EXECUTABLE_PATH overrides the macOS system Chrome default. No browser download occurs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire, stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {createServer} from 'node:http';
const root=new URL('../',import.meta.url);
const healthSource=stripTypeScriptTypes(fs.readFileSync(new URL('src/page-health.ts',root),'utf8').replace(/export /g,''));
function healthContext(values={}){const scope=vm.createContext(values);vm.runInContext(healthSource+'\nglobalThis.install=installPageHealth;globalThis.read=readPageHealth;',scope);return scope;}
const functions=healthContext();
const install=functions.install,read=functions.read;
for(const status of [undefined,0,NaN,Infinity,-1,600,200.5])test(`unavailable or invalid navigation status ${status} stays unknown`,()=>{const scope=healthContext({window:{},location:{href:'about:blank'},document:{title:''},performance:{getEntriesByType:()=>[{responseStatus:status,domInteractive:0}]}});const r=scope.read();assert.equal(r.statusCode,null);assert.equal(r.domInteractiveTime,null);assert.equal(r.errors,null);assert.equal(r.errorsTruncated,null);assert.equal(r.errorCoverage,'unavailable');});
test('known navigation status and collector snapshot preserve facts without sharing array',()=>{const state={errors:['runtime-error'],truncated:false};const scope=healthContext({window:{__cookbookPageHealth:state},location:{href:'http://127.0.0.1/synthetic'},document:{title:'Synthetic'},performance:{getEntriesByType:()=>[{responseStatus:404,domInteractive:123.5}]}});const r=scope.read();assert.equal(r.statusCode,404);assert.equal(r.domInteractiveTime,123.5);assert.equal(r.errorCoverage,'document-start');r.errors.push('synthetic mutation');assert.equal(state.errors.length,1);});
function automation(){const source=fs.readFileSync(new URL('src/automation.ts',root),'utf8').replace(/^import [\s\S]*?;\n/gm,'').replace('export class','class');const scope=vm.createContext({readPageHealth:read,installPageHealth:install,console:{warn:()=>{}},config:{automation:{metricsPollingInterval:1000}}});vm.runInContext(stripTypeScriptTypes(source)+'\nglobalThis.Automation=WorkAppTestAutomation;',scope);return scope.Automation;}
test('actual broadcaster reads one page once and retains unknown values',async()=>{let selected=0,evaluated=0;const emitted=[];const Actual=automation();const instance=new Actual(undefined,value=>emitted.push(value));instance.stagehand={browser:{context:{activePage:async()=>{selected++;return {evaluate:async fn=>{evaluated++;assert.equal(fn,read);return {pageUrl:'synthetic',pageTitle:'Synthetic',statusCode:null,errors:null,errorsTruncated:null,errorCoverage:'unavailable',domInteractiveTime:null};}};}}}};await instance.broadcastPerformanceMetrics();assert.equal(selected,1);assert.equal(evaluated,1);assert.equal(emitted.length,1);assert.equal(emitted[0].pageHealth.statusCode,null);assert.equal(emitted[0].pageHealth.errors,null);assert.equal(emitted[0].performanceMetrics.domInteractiveTime,null);assert.equal(emitted[0].performanceMetrics.postSubmitWaitTime,null);assert.equal(emitted[0].performanceMetrics.totalLoginFlowTime,null);assert.ok(!('redirectTime' in emitted[0].performanceMetrics));assert.ok(!('timeToInteractive' in emitted[0].performanceMetrics));});
test('actual broadcaster forwards observed errors and zero measured custom timer',async()=>{const emitted=[];const Actual=automation();const instance=new Actual(undefined,value=>emitted.push(value));instance.customTimers.set('postSubmitWait',0);instance.stagehand={browser:{context:{activePage:async()=>({evaluate:async()=>({statusCode:404,errors:['runtime-error'],errorsTruncated:true,errorCoverage:'document-start',domInteractiveTime:45})})}}};await instance.broadcastPerformanceMetrics();assert.equal(emitted[0].pageHealth.statusCode,404);assert.equal(emitted[0].pageHealth.errors[0],'runtime-error');assert.equal(emitted[0].pageHealth.errorsTruncated,true);assert.equal(emitted[0].performanceMetrics.postSubmitWaitTime,0);});
test('actual broadcaster does not invent success after an evaluation failure',async()=>{const emitted=[];const Actual=automation();const instance=new Actual(undefined,value=>emitted.push(value));instance.stagehand={browser:{context:{activePage:async()=>({evaluate:async()=>{throw Error('synthetic collector failure');}})}}};await instance.broadcastPerformanceMetrics();assert.equal(emitted.length,0);});
test('actual UI shows unknown timing as a dash and genuine zero as zero',()=>{const html=fs.readFileSync(new URL('public/index.html',root),'utf8');const start=html.indexOf('    function updateMetricsUI('),end=html.indexOf('    function updateMetricsChart(',start);assert.ok(start>=0&&end>start);const nodes={};const scope=vm.createContext({document:{getElementById:id=>nodes[id]??={textContent:''}}});vm.runInContext(html.slice(start,end),scope);scope.updateMetricsUI({performanceMetrics:{domInteractiveTime:null,postSubmitWaitTime:0,totalLoginFlowTime:null},pageHealth:{pageUrl:null,pageTitle:null}});assert.equal(nodes['dom-interactive-time'].textContent,'—');assert.equal(nodes['post-submit-wait-time'].textContent,'0ms');assert.equal(nodes['total-flow-time'].textContent,'—');});
const require=createRequire(import.meta.url);
let playwrightPath=process.env.PLAYWRIGHT_MODULE_PATH;
if(!playwrightPath){try{playwrightPath=require.resolve('playwright-core');}catch{}}
const chrome=process.env.CHROME_EXECUTABLE_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browserAvailable=Boolean(playwrightPath&&fs.existsSync(chrome));
test('local Chrome runs the exact collector on loopback documents',{skip:!browserAvailable?'Set PLAYWRIGHT_MODULE_PATH and an existing CHROME_EXECUTABLE_PATH to run browser coverage':false},async t=>{
 const {chromium}=require(playwrightPath);
 const server=createServer((req,res)=>{
  if(req.url==='/redirect'){res.writeHead(302,{location:'/ok'});res.end();return;}
  res.writeHead(req.url==='/404'||req.url==='/missing.png'?404:200,{'content-type':'text/html'});
  const scripts={
   '/runtime':'throw new Error("PRIVATE_SYNTHETIC_MESSAGE")',
   '/rejection':'Promise.reject(new Error("PRIVATE_SYNTHETIC_REJECTION"))',
   '/burst':'for(let i=0;i<105;i++)window.dispatchEvent(new ErrorEvent("error",{message:"PRIVATE_SYNTHETIC_BURST"}))',
  };
  res.end('<!doctype html><title>Synthetic health</title>'+(req.url==='/resource'?'<img src="/missing.png">':'')+(scripts[req.url]?'<script>'+scripts[req.url]+'</script>':''));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 let browser;
 try{
  browser=await chromium.launch({executablePath:chrome,headless:true});
  const page=await browser.newPage();await page.addInitScript(install);
  for(const [route,status] of [['/ok',200],['/404',404],['/redirect',200]])await t.test(`${route} reports final document HTTP status`,async()=>{await page.goto(origin+route,{waitUntil:'load'});const value=await page.evaluate(read);assert.equal(value.statusCode,status);assert.equal(value.errorCoverage,'document-start');assert.ok(value.domInteractiveTime>0);assert.equal(value.errors.length,0);if(route==='/redirect')assert.equal(value.pageUrl,origin+'/ok');});
  for(const [route,category] of [['/runtime','runtime-error'],['/resource','resource-error'],['/rejection','unhandled-rejection']])await t.test(`${category} is observed without payload`,async()=>{await page.goto(origin+route,{waitUntil:'load'});await page.waitForFunction(category=>window.__cookbookPageHealth?.errors.includes(category),category);const value=await page.evaluate(read);assert.ok(value.errors.includes(category));assert.ok(value.errors.every(v=>['runtime-error','resource-error','unhandled-rejection'].includes(v)));assert.ok(!JSON.stringify(value).includes('PRIVATE_SYNTHETIC'));});
  await t.test('errors cap at 100 and reset with a new document',async()=>{await page.goto(origin+'/burst');const full=await page.evaluate(read);assert.equal(full.errors.length,100);assert.equal(full.errorsTruncated,true);await page.goto(origin+'/ok');const clean=await page.evaluate(read);assert.equal(clean.errors.length,0);assert.equal(clean.errorsTruncated,false);});
  await t.test('an uninstrumented blank document remains unknown',async()=>{const blank=await browser.newPage();const value=await blank.evaluate(read);assert.equal(value.statusCode,null);assert.ok(value.domInteractiveTime===null||value.domInteractiveTime>0);assert.equal(value.errors,null);assert.equal(value.errorCoverage,'unavailable');await blank.close();});
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
