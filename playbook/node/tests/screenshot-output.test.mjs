import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import vm from 'node:vm';
const source=stripTypeScriptTypes(readFileSync(new URL('../playwright/_tools/download/local-screenshot.ts',import.meta.url),'utf8')).replace(/^import .*$/gm,'');
async function run(change={}){
 const dir=mkdtempSync(join(tmpdir(),'r149-shot-')),calls=[],closed=[];const buffer=Buffer.from([255,216,255,224,0,0,255,217]);
 const page=change.page??{goto:async()=>{if(change.navigation)throw Error('navigation');},screenshot:async options=>{calls.push(options);if(change.capture)throw Error('capture');return buffer;},close:async()=>{closed.push('page');if(change.close)throw Error('close');}};
 const context=vm.createContext({process:{env:{}},console:{log(){},error(){}},dotenv:{config(){}},Browserbase:class{sessions={create:async()=>({connectUrl:'fixture'})};},chromium:{connectOverCDP:async()=>({contexts:()=>[{pages:()=>change.noPage?[]:[page]}],close:async()=>closed.push('browser')})},mkdirSync:(p,o)=>mkdirSync(join(dir,p),o),writeFileSync:(p,b)=>{if(change.write)throw Error('write');writeFileSync(join(dir,p),b);}});
 let start=source.lastIndexOf('\nmain(');if(start<0)start=source.lastIndexOf('(async () =>');vm.runInContext(source.slice(0,start)+'\nglobalThis.done='+source.slice(start).trim(),context);await context.done;
 const path=join(dir,'downloads/files/screenshot.jpeg');const data=existsSync(path)?readFileSync(path):null;rmSync(dir,{recursive:true,force:true});return {calls,closed,data,exit:context.process.exitCode};
}
test('creates missing destination and explicitly requests JPEG',async()=>{const r=await run();assert.notEqual(r.exit,1);assert.equal(r.calls[0].type,'jpeg');assert.equal(r.calls[0].timeout,30000);assert.ok(r.data);assert.deepEqual(r.closed,['page','browser']);});
for(const change of [{navigation:true},{capture:true},{write:true},{close:true},{noPage:true}])test(`failure closes owned handles ${JSON.stringify(change)}`,async()=>{const r=await run(change);assert.equal(r.exit,1);assert.deepEqual(r.closed,change.noPage?['browser']:['page','browser']);});
test('actual Chrome JPEG bytes match the output extension',{skip:!process.env.COOKBOOK_CHROME},async()=>{const {chromium}=createRequire(import.meta.url)('playwright-core');const browser=await chromium.launch({headless:true,executablePath:process.env.COOKBOOK_CHROME});try{const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({status:200,contentType:'text/html',body:'<h1>Synthetic screenshot</h1>'}));const r=await run({page});assert.notEqual(r.exit,1);assert.equal(r.data[0],255);assert.equal(r.data[1],216);assert.equal(r.data.at(-2),255);assert.equal(r.data.at(-1),217);}finally{await browser.close();}});
