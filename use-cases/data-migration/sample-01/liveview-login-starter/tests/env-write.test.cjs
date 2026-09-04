const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../lib/browserbase.js'),'utf8');
const write=source.slice(source.indexOf('export async function upsertEnv')).replace('export ','');
test('actual env writer rejects assignment injection and preserves valid updates',async()=>{
 const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'cookbook-env-fixture-'));
 try {
  const target=path.join(directory,'fixture.env');
  const baseline='UNCHANGED=fixture\nCONTEXT_ID=old\n';
  await fsp.writeFile(target,baseline);
  const context=vm.createContext({existsSync:fs.existsSync,readFile:fsp.readFile,writeFile:fsp.writeFile});
  vm.runInContext(write,context);
  for(const value of ['id\nINJECTED=yes','id\rINJECTED=yes','id\0','id # comment','$(fixture)',{},null]) {
   await assert.rejects(context.upsertEnv(target,'CONTEXT_ID',value));
   assert.equal(await fsp.readFile(target,'utf8'),baseline);
  }
  await assert.rejects(context.upsertEnv(target,'BAD\nKEY','valid'));
  await context.upsertEnv(target,'CONTEXT_ID','context-123');
  await context.upsertEnv(target,'CONTEXT_ID','context-456');
  assert.equal(await fsp.readFile(target,'utf8'),'UNCHANGED=fixture\nCONTEXT_ID=context-456\n');
 } finally {await fsp.rm(directory,{recursive:true,force:true});}
});

test('finish handler validates identifiers and session capability before effects',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const block=source.slice(source.indexOf('app.post("/api/finish"'),source.indexOf('/** Open a URL'));
 let handler,calls=0;
 const sessions=new Map([['session-1',{contextId:'context-1',finishToken:'fixture-token',finishing:false}]]);
 const context=vm.createContext({app:{post:(route,fn)=>handler=fn},sessions,makeBrowserbase:()=>{calls++;return {};},releaseSession:async()=>{},waitUntilReleased:async()=>{},upsertEnv:async()=>{},ENV_PATH:'synthetic',console:{error:()=>{}}});
 vm.runInContext(block,context);
 async function run(body){const res={code:200,status(n){this.code=n;return this;},json(data){this.data=data;return this;}};await handler({body},res);return res;}
 for(const body of [{sessionId:'session-1',contextId:'bad\nINJECTED=yes'},{sessionId:'session-1',contextId:'context-2',finishToken:'fixture-token'},{sessionId:'session-1',contextId:'context-1',finishToken:'wrong'}]) assert.ok((await run(body)).code>=400);
 assert.equal(calls,0);
 const valid={sessionId:'session-1',contextId:'context-1',finishToken:'fixture-token'};
 assert.equal((await run(valid)).code,200);
 assert.equal(calls,1);
 assert.equal((await run(valid)).code,403);
 assert.equal(calls,1);
});

test('local host and origin gate rejects foreign browser requests',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const block=source.slice(source.indexOf('app.use((req'),source.indexOf('app.use(express.json'));
 let gate;vm.runInNewContext(block,{PORT:3000,app:{use:fn=>gate=fn}});
 for(const [host,origin,allowed] of [['localhost:3000',undefined,true],['127.0.0.1:3000','http://127.0.0.1:3000',true],['attacker.invalid:3000',undefined,false],['localhost:3000','https://attacker.invalid',false],['localhost:3000','null',false]]) {
  let next=false,code=200;
  gate({get:key=>key==='host'?host:origin},{status(n){code=n;return this;},json(){}},()=>next=true);
  assert.equal(next,allowed);assert.equal(code,allowed?200:403);
 }
});

test('created capability binds finish, rejects overlap, and permits retry after failure',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const block=source.slice(source.indexOf('app.post("/api/session"'),source.indexOf('/** Open a URL'));
 const handlers={},sessions=new Map();let release,fail=true,saves=0,calls=0;
 const context=vm.createContext({app:{post:(route,fn)=>handlers[route]=fn},sessions,randomBytes:require('node:crypto').randomBytes,makeBrowserbase:()=>({}),createContext:async()=> 'ctx-1',createLoginSession:async()=>({sessionId:'sid-1',connectUrl:'synthetic'}),preNavigate:async()=>{},liveViewUrl:async()=> 'synthetic',START_URL:'synthetic',releaseSession:async()=>{calls++;await new Promise(resolve=>release=resolve);if(fail)throw new Error('fixture failure');},waitUntilReleased:async()=>{},upsertEnv:async()=>{saves++;},ENV_PATH:'synthetic',console:{error:()=>{},warn:()=>{}}});
 vm.runInContext(block,context);
 function response(){return {code:200,status(n){this.code=n;return this;},json(data){this.data=data;}};}
 const created=response();await handlers['/api/session']({},created);
 assert.match(created.data.finishToken,/^[a-f0-9]{64}$/);
 const body={sessionId:created.data.sessionId,contextId:created.data.contextId,finishToken:created.data.finishToken};
 const first=response();const pending=handlers['/api/finish']({body},first);
 const overlap=response();await handlers['/api/finish']({body},overlap);assert.equal(overlap.code,409);assert.equal(calls,1);
 release();await pending;assert.equal(first.code,500);assert.equal(saves,0);assert.equal(sessions.get('sid-1').finishing,false);
 fail=false;const retry=response();const retried=handlers['/api/finish']({body},retry);release();await retried;
 assert.equal(retry.code,200);assert.equal(saves,1);assert.equal(sessions.has('sid-1'),false);
});

test('release poll succeeds only on COMPLETED and rejects timeout/failure',async()=>{
 const block=source.slice(source.indexOf('export async function waitUntilReleased'),source.indexOf('/**\n * Upsert')).replace('export ','');
 async function poll(statuses) {
  let clock=0,index=0;
  const context=vm.createContext({Date:{now:()=>clock},setTimeout:fn=>{clock+=10;fn();}});
  vm.runInContext(block,context);
  return context.waitUntilReleased({sessions:{retrieve:async()=>({status:statuses[Math.min(index++,statuses.length-1)]})}},'fixture',{timeoutMs:25,intervalMs:10});
 }
 await poll(['PENDING','RUNNING','COMPLETED']);
 await assert.rejects(poll(['RUNNING']),/Timed out/);
 for(const status of ['ERROR','TIMED_OUT','UNKNOWN']) await assert.rejects(poll([status]));
});
test('finish endpoint never saves when real poll times out',async()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const polling=source.slice(source.indexOf('export async function waitUntilReleased'),source.indexOf('/**\n * Upsert')).replace('export ','');
 let handler,clock=0,saves=0;
 const sessions=new Map([['sid',{contextId:'ctx',finishToken:'token',finishing:false}]]);
 const context=vm.createContext({app:{post:(route,fn)=>handler=fn},sessions,Date:{now:()=>clock},setTimeout:fn=>{clock+=10000;fn();},makeBrowserbase:()=>({sessions:{retrieve:async()=>({status:'RUNNING'})}}),releaseSession:async()=>{},upsertEnv:async()=>saves++,ENV_PATH:'synthetic',console:{error:()=>{}}});
 vm.runInContext(polling+'\n'+server.slice(server.indexOf('app.post("/api/finish"'),server.indexOf('/** Open a URL')),context);
 const res={status(n){this.code=n;return this;},json(data){this.data=data;}};
 await handler({body:{sessionId:'sid',contextId:'ctx',finishToken:'token'}},res);
 assert.equal(res.code,500);assert.match(res.data.error,/Timed out/);assert.equal(saves,0);assert.equal(sessions.get('sid').finishing,false);
});
