const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../src/main.ts'),'utf8');const a=source.indexOf('async function maybeWaitForBrowserbaseCaptcha(');const b=source.indexOf('\nasync function ',a+1);assert(a>=0&&b>a);
for(const [remote,solver,delay] of [[true,true,20],[true,true,0],[true,false,20],[false,true,20]])test(`actual solver settling: remote=${remote}, solver=${solver}, delay=${delay}`,async()=>{
 const calls=[];const notes=[];
 const wait=vm.runInNewContext(stripTypeScriptTypes(source.slice(a,b))+';maybeWaitForBrowserbaseCaptcha',{env:{USE_BROWSERBASE:String(remote),BROWSERBASE_SOLVE_CAPTCHAS:String(solver),BROWSERBASE_CAPTCHA_SETTLE_MS:delay}});
 await wait({waitForTimeout:async ms=>calls.push(ms)},notes,'fixture');
 assert.deepEqual(calls,remote&&solver&&delay?[delay]:[]);
 assert.equal(notes.length,remote&&solver?1:0);if(notes.length)assert(notes[0].includes('completion is not confirmed'));
});
test('failed timed wait propagates without a completion note',async()=>{
 const wait=vm.runInNewContext(stripTypeScriptTypes(source.slice(a,b))+';maybeWaitForBrowserbaseCaptcha',{env:{USE_BROWSERBASE:'true',BROWSERBASE_SOLVE_CAPTCHAS:'true',BROWSERBASE_CAPTCHA_SETTLE_MS:20}});const notes=[];
 await assert.rejects(wait({waitForTimeout:async()=>{throw new Error('fixture failure');}},notes,'fixture'),/fixture failure/);assert.equal(notes.length,0);
});
