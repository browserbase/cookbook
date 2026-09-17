import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInterface as realCreateInterface} from 'node:readline';
import {PassThrough} from 'node:stream';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';
const source=stripTypeScriptTypes(readFileSync(new URL('../stagehand/complete_task/sfTicketAgent.ts',import.meta.url),'utf8')).replace(/^import .*$/gm,'');
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(setImmediate);};
async function run(change={}){
 const input=new PassThrough(),output=new PassThrough();input.isTTY=change.tty??true;let launches=0;
 const calls=[],closed=[],logs=[],interfaces=[],timers=new Map();let next=0;
 const page={goto:async()=>{if(change.navigation)throw Error('navigation');}};
 const stagehand={act:async(instruction,options)=>{calls.push({instruction,options});return change.result??{data:{success:true}};},close:async()=>{closed.push('stagehand');if(change.closeThrows)throw Error('close');}};
 const context=vm.createContext({Error,URL,encodeURIComponent,process:Object.assign(new EventEmitter(),{env:{SF_PLATE:' TEST123 ',CARD_NUMBER:'synthetic-card-marker',CVV:'synthetic-cvv-marker',...change.env},stdin:input,stdout:output}),stdin:input,stdout:output,
 createInterface:options=>{const rl=realCreateInterface(options);interfaces.push(rl);return rl;},
 setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
 console:{log:(...v)=>logs.push(v.join(' ')),error:(...v)=>logs.push(v.join(' '))},dotenv:{config(){}},boxen:x=>x,chalk:{yellow:x=>x,blue:x=>x,green:x=>x},
 browserbase:{launch:async()=>{launches++;return {provider:'browserbase',sessionId:change.sessionId??'owned/session',context:{pages:async()=>[page]},close:async()=>closed.push('browser')};}},Stagehand:{create:async()=>{if(change.init)throw Error('init');return stagehand;}}});
 let start=source.lastIndexOf('\nmain(');if(start<0)start=source.lastIndexOf('(async () =>');
 const prefix=source.slice(0,start),suffix=source.slice(start).trim();vm.runInContext(prefix+'\nglobalThis.done='+suffix,context);
 let settled=false;context.done.then(()=>settled=true,()=>settled=true);await flush();
 return {context,calls,closed,logs,interfaces,timers,input,output,page,get launches(){return launches;},get settled(){return settled;},async finish(kind='line'){if(kind==='line')input.write('\n');else if(kind==='eof')input.end();else if(kind==='timeout')for(const {fn} of [...timers.values()])fn();else interfaces[0]?.emit(kind,Error('synthetic input'));await flush();},cleanup(){input.destroy();output.destroy();}};
}
for(const change of [{env:{SF_PLATE:''}},{env:{SF_PLATE:'bad<script>'}},{tty:false}])test(`preflight rejects ${JSON.stringify(change)}`,async()=>{const r=await run(change);try{assert.equal(r.launches,0);assert.equal(r.context.process.exitCode,1);}finally{r.cleanup();}});
test('owned live handoff stays open; only plate search reaches the model',async()=>{const r=await run();try{assert.equal(r.calls.length,1);assert.equal(r.calls[0].options.page,r.page);assert.deepEqual(JSON.parse(JSON.stringify(r.calls[0].options.variables)),{plate:'TEST123'});assert.ok(r.logs.some(l=>l.includes('owned%2Fsession')));assert.equal(r.settled,false);assert.deepEqual(r.closed,[]);assert.equal(r.timers.size,1);assert.equal([...r.timers.values()][0].ms,300000);assert.doesNotMatch(JSON.stringify(r.calls),/synthetic-card-marker|synthetic-cvv-marker|%cardNumber%|%cvv%/);await r.finish();assert.equal(r.settled,true);assert.notEqual(r.context.process.exitCode,1);assert.deepEqual(r.closed,['stagehand','browser']);assert.equal(r.calls.length,1);assert.equal(r.timers.size,0);assert.ok(r.logs.some(l=>/not verif|not confirm/i.test(l)));}finally{r.cleanup();}});
for(const kind of ['eof','timeout','SIGINT','error'])test(`handoff ${kind} fails and closes owned resources`,async()=>{const r=await run();try{await r.finish(kind);assert.equal(r.context.process.exitCode,1);assert.deepEqual(r.closed,['stagehand','browser']);assert.equal(r.timers.size,0);assert.equal(r.settled,true);assert.equal(r.interfaces[0].listenerCount('line'),0);assert.equal(r.interfaces[0].listenerCount('SIGINT'),0);}finally{r.cleanup();}});
for(const change of [{result:{data:{success:false}}},{result:{data:{}}},{init:true},{navigation:true},{sessionId:''}])test(`failure does not enter handoff ${JSON.stringify(change)}`,async()=>{const r=await run(change);try{assert.equal(r.context.process.exitCode,1);assert.equal(r.interfaces.length,0);assert.deepEqual(r.closed,(change.init||change.sessionId==='')?['browser']:['stagehand','browser']);}finally{r.cleanup();}});
test('cleanup failure exits nonzero',async()=>{const r=await run({closeThrows:true});try{await r.finish();assert.equal(r.context.process.exitCode,1);assert.deepEqual(r.closed,['stagehand','browser']);}finally{r.cleanup();}});
