import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const { z }=createRequire(import.meta.url)('zod/v4');
const source=stripTypeScriptTypes(readFileSync(new URL('../stagehand/complete_task/contactForm.ts',import.meta.url),'utf8')).replace(/^import .*$/gm,'');
const input={CONTACT_NAME:' Fixture Name ',CONTACT_EMAIL:' fixture@example.invalid ',CONTACT_PHONE:' +15550102030 ',CONTACT_MESSAGE:' Synthetic contact message '};
async function run(change={}) {
 const calls=[],closed=[],logs=[];let launches=0;
 const page={goto:async()=>{if(change.navigation)throw Error('synthetic navigation');},waitForTimeout:async()=>{}};
 const stagehand={act:async(instruction,options)=>{calls.push({instruction,options});if(change.actThrows)throw Error('synthetic action');return change.result??{data:{success:true}};},observe:async()=>({data:[]}),close:async()=>{closed.push('stagehand');if(change.closeThrows)throw Error('synthetic close');}};
 const browser={context:{pages:async()=>[page]},close:async()=>closed.push('browser'),sessionId:'fixture'};
 const context=vm.createContext({z,Error,process:{env:{...input,...change.env}},console:{log:(...s)=>logs.push(s.join(' ')),error:(...s)=>logs.push(s.join(' '))},boxen:x=>x,chalk:{blue:x=>x},
 browserbase:{launch:async()=>{launches++;return browser;}},Stagehand:{create:async()=>{if(change.init)throw Error('synthetic init');return stagehand;}}});
 const start=source.lastIndexOf('\nmain(');assert.ok(start>=0);
 vm.runInContext(source.slice(0,start)+'\nglobalThis.done='+source.slice(start+1),context);
 try{await context.done;}catch(e){logs.push(e.message);}
 return {calls,closed,logs,launches,page,exit:context.process.exitCode};
}
for(const field of Object.keys(input))test(`${field} required before browser allocation`,async()=>{const r=await run({env:{[field]:'  '}});assert.equal(r.launches,0);assert.equal(r.exit,1);});
test('invalid email rejected before browser allocation',async()=>{const r=await run({env:{CONTACT_EMAIL:'not-an-email'}});assert.equal(r.launches,0);assert.equal(r.exit,1);});
test('all placeholder values bound to owned page without submitting',async()=>{const r=await run();assert.equal(r.calls.length,1);assert.equal(r.calls[0].options.page,r.page);assert.deepEqual(JSON.parse(JSON.stringify(r.calls[0].options.variables)),{name:'Fixture Name',email:'fixture@example.invalid',phone:'+15550102030',message:'Synthetic contact message'});for(const key of ['name','email','phone','message'])assert.ok(r.calls[0].instruction.includes(`%${key}%`));assert.match(r.calls[0].instruction,/do not submit/i);assert.deepEqual(r.closed,['stagehand','browser']);assert.notEqual(r.exit,1);assert.ok(r.logs.some(x=>/reported form preparation/i.test(x)));});
for(const change of [{result:{data:{success:false}}},{result:{data:{}}},{actThrows:true},{navigation:true},{init:true},{closeThrows:true}])test(`failure exits nonzero with owned cleanup ${JSON.stringify(change)}`,async()=>{const r=await run(change);assert.equal(r.exit,1);assert.deepEqual(r.closed,change.init?['browser']:['stagehand','browser']);assert.equal(r.logs.some(x=>/reported form preparation/i.test(x)),false);});
