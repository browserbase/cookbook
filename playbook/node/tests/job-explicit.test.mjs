import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { readFile, stat, open } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const {z}=createRequire(import.meta.url)('zod/v4');
const source=stripTypeScriptTypes(readFileSync(new URL('../stagehand/complete_task/jobAppExplicit.ts',import.meta.url),'utf8')).replace(/^import .*$/gm,'');
const profile={JOB_URL:'https://example.invalid/job',JOB_FIRST_NAME:' Fixture ',JOB_LAST_NAME:' Candidate ',JOB_EMAIL:' fixture@example.invalid ',JOB_HEADLINE:' Engineer ',JOB_PHONE:' +15550102030 ',JOB_ADDRESS:' Fixture City ',JOB_SALARY_EXPECTATIONS:' 100000 USD annually '};
async function run(change={}){
 const dir=mkdtempSync(join(tmpdir(),'r146-job-'));const file=join(dir,'resume.pdf');const bytes=change.bytes??Buffer.from('%PDF-1.7\nsynthetic fixture\n%%EOF');writeFileSync(file,bytes);
 const calls=[],closed=[],uploads=[],logs=[],urls=[];let launches=0;
 const page=change.page??{goto:async url=>{urls.push(url);if(change.navigation)throw Error('navigation');},locator:()=>({count:async()=>change.count??1,setInputFiles:async payload=>{if(change.uploadThrows)throw Error('upload');uploads.push(payload);}}),
 evaluate:async()=>('metadata' in change)?change.metadata:{name:uploads[0]?.name,size:uploads[0]?.buffer.length,type:'application/pdf'}};
 const stagehand={act:async(instruction,options)=>{calls.push({instruction,options});if(change.failAt===calls.length)return {data:{success:false}};return {data:{success:true}};},close:async()=>{closed.push('stagehand');if(change.closeThrows)throw Error('close');}};
 const context=vm.createContext({z,Buffer,URL,Error,readFile,stat,open,basename,resolve,process:{env:{...profile,JOB_RESUME_PATH:file,...change.env}},console:{log:(...x)=>logs.push(x.join(' ')),error:(...x)=>logs.push(x.join(' '))},
 browserbase:{launch:async()=>{launches++;return {context:{pages:async()=>[page]},close:async()=>closed.push('browser')};}},Stagehand:{create:async()=>{if(change.init)throw Error('init');return stagehand;}}});
 let start=source.lastIndexOf('\nmain(');let script;
 if(start>=0)script=source.slice(0,start)+'\nglobalThis.done='+source.slice(start+1);
 else {start=source.lastIndexOf('(async () =>');script=source.slice(0,start)+'globalThis.done='+source.slice(start);}
 try{vm.runInContext(script,context);try{await context.done;}catch{}return {calls,closed,uploads,logs,urls,launches,page,bytes,exit:context.process.exitCode};}finally{rmSync(dir,{recursive:true,force:true});}
}
for(const field of [...Object.keys(profile),'JOB_RESUME_PATH'])test(`${field} required before allocation`,async()=>{const r=await run({env:{[field]:' '}});assert.equal(r.launches,0);assert.equal(r.exit,1);});
for(const env of [{JOB_EMAIL:'bad-email'},{JOB_URL:'javascript:alert(1)'},{JOB_RESUME_PATH:'/nonexistent/r146-resume.pdf'}])test(`invalid input preflight ${JSON.stringify(env)}`,async()=>{const r=await run({env});assert.equal(r.launches,0);assert.equal(r.exit,1);});
for(const bytes of [Buffer.from('not a PDF'),Buffer.concat([Buffer.from('%PDF-'),Buffer.alloc(5*1024*1024)])])test(`invalid PDF bytes ${bytes.length}`,async()=>{const r=await run({bytes});assert.equal(r.launches,0);assert.equal(r.exit,1);});
test('explicit fields bind and actual upload payload contains local bytes',async()=>{const r=await run();assert.notEqual(r.exit,1);assert.deepEqual(r.urls,[profile.JOB_URL]);assert.equal(r.uploads.length,1);assert.deepEqual(r.uploads[0].buffer,r.bytes);assert.equal(r.uploads[0].mimeType,'application/pdf');const values=new Set(r.calls.flatMap(c=>Object.values(c.options?.variables??{})));for(const [key,value] of Object.entries(profile).filter(([k])=>k!=='JOB_URL'))assert.ok(values.has(value.trim()),key);for(const c of r.calls){assert.equal(c.options.page,r.page);for(const [,key] of c.instruction.matchAll(/%([^%]+)%/g))assert.ok(key in c.options.variables,key);}assert.deepEqual(r.closed,['stagehand','browser']);});
for(const count of [0,2])test(`requires unique file input ${count}`,async()=>{const r=await run({count});assert.equal(r.exit,1);assert.equal(r.uploads.length,0);assert.deepEqual(r.closed,['stagehand','browser']);});
for(const change of [{uploadThrows:true},{metadata:null},{metadata:{name:'wrong.pdf',size:1,type:'application/pdf'}},{init:true},{navigation:true},{closeThrows:true},...Array.from({length:9},(_,i)=>({failAt:i+1}))])test(`fails without claiming preparation ${JSON.stringify(change)}`,async()=>{const r=await run(change);assert.equal(r.exit,1);assert.deepEqual(r.closed,change.init?['browser']:['stagehand','browser']);assert.equal(r.logs.some(l=>/reported.*prepar|preparation completed/i.test(l)),false);});

test('actual local browser receives the PDF and runs the DOM metadata reader', {skip:!process.env.COOKBOOK_CHROME}, async()=>{
 const {chromium}=createRequire(import.meta.url)('playwright-core');
 const browser=await chromium.launch({executablePath:process.env.COOKBOOK_CHROME,headless:true});
 try {
  const context=await browser.newContext();
  await context.route('**/*',route=>route.fulfill({status:200,contentType:'text/html',body:'<form><input type="file" accept="application/pdf"></form>'}));
  const page=await context.newPage();const r=await run({page});
  assert.notEqual(r.exit,1);assert.equal(r.calls.length,9);
  const metadata=await page.locator('input').evaluate(input=>({name:input.files[0].name,size:input.files[0].size,type:input.files[0].type}));
  assert.deepEqual(metadata,{name:'resume.pdf',size:r.bytes.length,type:'application/pdf'});
 } finally {await browser.close();}
});
