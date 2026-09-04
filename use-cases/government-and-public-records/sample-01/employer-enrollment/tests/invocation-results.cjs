const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../src/orchestrator.ts'),'utf8'));
const actual=source.slice(source.indexOf('async function runAutobrowse('),source.indexOf('function requireAccountCreationOptIn('));
const result=phase=>({success:true,phase:String(phase),reason:phase===1?'awaiting_email_verification':'dashboard_reached',stopped_at_step:'synthetic boundary',stopped_at_url:'https://synthetic.invalid/'});
const summary=(value,status='completed (end_turn)')=>`# synthetic — Run run-001 Summary\n\n**Status:** ${status}\n\n## Agent Final Output\n\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\`\n`;
function fixture(t, write){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cookbook-edd-result-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const task=path.join(root,'tasks','synthetic');fs.mkdirSync(task,{recursive:true});
 for(const name of ['task.md','strategy.md'])fs.writeFileSync(path.join(task,name),`synthetic ${name}`);
 const old=path.join(root,'traces','synthetic','run-999');fs.mkdirSync(old,{recursive:true});fs.writeFileSync(path.join(old,'summary.md'),summary(result(1)));
 const launches=[];
 const c={...fs,path,TASK_NAME:'synthetic',EVALUATE_ADAPTER:'/synthetic/adapter',EVALUATE_MJS:'/synthetic/evaluate',process:{env:{},execPath:'/synthetic/node'},console:{log(){}},execFileSync(){},
 spawn(command,args,options){const invocation=args[args.indexOf('--workspace')+1];launches.push(invocation);
  assert.equal(options.cwd,invocation);assert.notEqual(invocation,root);
  assert.equal(fs.readFileSync(path.join(invocation,'tasks/synthetic/task.md'),'utf8'),'synthetic task.md');
  const dir=path.join(invocation,'traces/synthetic/run-001');fs.mkdirSync(dir,{recursive:true});
  write?.(path.join(dir,'summary.md'),invocation);
  return {on(event,handler){if(event==='exit')queueMicrotask(()=>handler(0))}};
 }};
 vm.runInNewContext(actual,c);return {c,root,launches};
}
test('successful child without fresh output cannot consume existing older-account summary',async t=>{
 const {c,root}=fixture(t);await assert.rejects(c.runAutobrowse(root,'synthetic-session','wss://synthetic.invalid',1),/output could not be read/);
});
test('each simultaneous invocation consumes only its own exact run and copied task',async t=>{
 const {c,root,launches}=fixture(t,(file,invocation)=>{const phase=path.basename(invocation).startsWith('phase-1-')?1:2;fs.writeFileSync(file,summary(result(phase)));
  const other=path.join(path.dirname(path.dirname(file)),'run-999');fs.mkdirSync(other);fs.writeFileSync(path.join(other,'summary.md'),summary(result(3)));
 });
 const outputs=await Promise.all([c.runAutobrowse(root,'session-a','wss://a.invalid',1),c.runAutobrowse(root,'session-b','wss://b.invalid',2)]);
 assert.notEqual(launches[0],launches[1]);assert.deepEqual(outputs.map(x=>x.phase),['1','2']);
});
for(const [name,value,status] of [
 ['wrong phase',result(2)],['false success',{...result(1),success:false}],['string success',{...result(1),success:'true'}],
 ['unexpected boundary',{...result(1),reason:'error'}],['missing observed URL',{...result(1),stopped_at_url:''}],['array',[]],['null',null],
 ['max turns',result(1),'max_turns'],['truncated',result(1),'truncated (max_tokens)'],
])test(`rejects ${name}`,async t=>{
 const {c,root}=fixture(t,file=>fs.writeFileSync(file,summary(value,status)));
 await assert.rejects(c.runAutobrowse(root,'synthetic-session','wss://synthetic.invalid',1),/output could not be read/);
});
for(const [name,content] of [['malformed','{'],['decision-log-only',summary(result(1)).replace('## Agent Final Output','## Decision Log')],['ambiguous',summary(result(1))+'\n```json\n{}\n```']])test(`rejects ${name} summary`,async t=>{
 const {c,root}=fixture(t,file=>fs.writeFileSync(file,content));await assert.rejects(c.runAutobrowse(root,'synthetic-session','wss://synthetic.invalid',1));
});

for(const failure of ['phase1','phase2','phase3','activation-link','otp','session-check','inactive-session','preflight','check-only',null])test(`actual orchestration propagates ${failure||'successful phase completion'} and releases its session`,async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cookbook-edd-main-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 let released=0,calls=0;
 const c={...fs,path,REPO_ROOT:root,TASK_NAME:'synthetic',EVALUATE_ADAPTER:'/synthetic/adapter',EVALUATE_MJS:'/synthetic/evaluate',tmpdir:()=>root,
  process:{env:{},argv:failure==='check-only'?['--check']:[],execPath:'/synthetic/node'},console:{log(){},error(){}},requireAccountCreationOptIn(){},preflightInputs:()=>{if(failure==='preflight')throw new Error('synthetic missing config');return {TEST_FIRST_NAME:'synthetic'}},
  createInbox:async()=>{assert.ok(!['preflight','check-only'].includes(failure));return {inboxId:'synthetic@example.invalid'}},createBrowserbaseSession:()=>({sessionId:'synthetic',wssUrl:'wss://synthetic.invalid'}),
  releaseBrowserbaseSession(){released++},substituteFile(){},copyFileSync(){},
  execFileSync(_command,args){if(args.includes('--check'))return '';if(failure==='session-check')throw new Error('synthetic');return JSON.stringify({status:failure==='inactive-session'?'COMPLETED':'RUNNING'})},
  runAutobrowse:async(_ws,_session,_url,phase)=>{calls++;if(failure===`phase${phase}`)throw new Error('synthetic evaluator failed');return {...result(phase),reason:phase===1?'awaiting_email_verification':phase===2?'awaiting_email_otp':'dashboard_reached'}},
  waitForMessage:async()=>({messageId:'synthetic-message',subject:'synthetic'}),extractConfirmationLink:()=>failure==='activation-link'?null:'https://synthetic.invalid/activate',extractOtpCode:()=>failure==='otp'?null:'000000',
  connect:async()=>({page:{goto:async()=>{},waitForLoadState:async()=>{},waitForTimeout:async()=>{},screenshot:async()=>{},url:()=> 'https://synthetic.invalid/',title:async()=> 'synthetic'}})
 };
 vm.runInNewContext(source.slice(source.indexOf('async function main()'),source.indexOf('async function runAutobrowse(')),c);
 if(failure && failure!=='check-only')await assert.rejects(c.main());else{await c.main();assert.equal(calls,failure==='check-only'?0:3)}
 assert.equal(released,['preflight','check-only'].includes(failure)?0:1);
});
