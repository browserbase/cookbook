const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');const {stripTypeScriptTypes}=require('node:module');
async function fixture(states,url='https://authenticationtest.com/totpChallenge/') {
 const logs=[],waits=[];let attempts=0,closed=0;
 const state=()=>states[Math.min(Math.max(attempts-1,0),states.length-1)];
 const page={url:()=>url,goto:async()=>{},waitForLoadState:async()=>{},waitForTimeout:async ms=>waits.push(ms),getByRole:(role,opts)=>{
  assert.equal(role,'heading');assert.equal(opts.exact,true);const n=state()[opts.name==='Login Success'?'success':'failure']||0;const l={count:async()=>n,isVisible:async()=>!state().hidden,first:()=>l};return l;
 },locator:()=>{const l={innerText:async()=>state().body||'',fill:async()=>{},waitFor:async()=>{},click:async()=>{attempts++},first:()=>l,nth:()=>l};return l;}};
 const browser={contexts:()=>[{pages:()=>[page]}],close:async()=>{closed++}};
 const context=vm.createContext({process:{env:{BROWSERBASE_API_KEY:'fixture'}},URL,Date,Buffer,console:{log:(...args)=>logs.push(args.join(' ')),error:()=>{}},setTimeout});
 const synthetic=exports=>new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v]of Object.entries(exports))this.setExport(k,v)},{context});
 const source=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../index.ts'),'utf8')).split('main().catch(')[0]+'\nexport {main,checkLoginResult};';
 const mod=new vm.SourceTextModule(source,{context});await mod.link(spec=>{
  if(spec==='dotenv/config')return synthetic({});if(spec==='crypto')return synthetic({default:require('node:crypto')});
  if(spec==='playwright-core')return synthetic({chromium:{connectOverCDP:async()=>browser}});
  if(spec==='@browserbasehq/sdk')return synthetic({default:class{sessions={create:async()=>({id:'fixture',connectUrl:'fixture'})}}});throw Error(spec);
 });await mod.evaluate();return{run:mod.namespace.main,check:()=>mod.namespace.checkLoginResult(page),logs,waits,stats:()=>({attempts,closed})};
}
for(const[state,success]of [[{success:1},true],[{body:'Authentication unsuccessful'},false],[{body:'Sorry -- You have not successfully logged in'},false],[{body:'success'},false],[{success:1,failure:1},false],[{success:1,body:'Login failed'},false],[{success:2},false],[{success:1,hidden:true},false],[{},false]])test('result '+JSON.stringify(state),async()=>{const f=await fixture([state]);assert.equal((await f.check()).success,success)});
test('wrong origin rejected',async()=>{assert.equal((await(await fixture([{success:1}],'https://elsewhere.invalid/')).check()).success,false)});
for(const states of [[{success:1}],[{},{success:1}],[{},{}],[{body:'Authentication unsuccessful'},{failure:1}]])test('actual caller '+JSON.stringify(states),async()=>{
 const f=await fixture(states);const success=states.at(-1).success===1;if(success)await f.run();else await assert.rejects(f.run(),/two attempts/);
 assert.deepEqual(f.stats(),{attempts:states.length,closed:1});assert.equal(f.logs.join('\n').includes('MFA handling completed'),success);assert.equal(f.waits.length,states.length-1);if(f.waits.length)assert(f.waits[0]>0&&f.waits[0]<=30050);
});
