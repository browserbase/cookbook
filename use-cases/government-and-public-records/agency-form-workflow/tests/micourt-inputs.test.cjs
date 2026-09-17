const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../src/main.ts'),'utf8');
const names=['recordSearchDispatch','fillRequiredField','fillMiCourtDeterministicFields','verifyMiCourtCriteria','searchMiCourt'];
const code=names.map(name=>{const a=source.indexOf(`async function ${name}(`);const b=source.indexOf('\nasync function ',a+1);assert(a>=0&&b>a);return stripTypeScriptTypes(source.slice(a,b));}).join('\n');
for(const failure of [null,'#first-name-input-id','#last-name-input-id','#filed-from-date-input-id','#filed-to-date-input-id','unchecked','changed-during-wait','duplicate','missing-submit']) {
 test(`MiCOURT submits only verified requested criteria: ${failure}`,async()=>{
  const values=new Map();let submitted=0;let acts=0;
  const criteria={firstName:'Configured',lastName:'Fixture',fromDate:'01/01/2026',toDate:'01/02/2026'};
  const search=vm.runInNewContext(code+';searchMiCourt',{
   searchCriteria:criteria,
   fillIfPresent:async(_page,selector,value)=>{if(selector===failure)return false;values.set(selector,value);return true;},
   selectorCount:async()=>failure==='duplicate'?2:1,
   selectorValue:async(_page,selector)=>values.get(selector),
   setCheckedIfPresent:async()=>true,
   clickFirstMatchingButton:async(_page,buttons)=>{if(buttons[0]==='Show Filter')return false;if(failure==='missing-submit')return false;submitted++;return true;},
   waitForHCaptchaToken:async()=>{if(failure==='changed-during-wait')values.set('#filed-to-date-input-id','changed');},
  });
  const page={evaluate:async()=>failure!=='unchecked',waitForTimeout:async()=>{}};
  const attempts=[];
  const promise=search({act:async()=>{acts++;}},page,[],attempts);
  if(failure)await assert.rejects(promise);else await promise;
  assert.equal(submitted,failure?0:1);assert.equal(acts,0);
  assert.equal(attempts.length,!failure||failure==='missing-submit'?1:0);
  if(attempts.length)assert.equal(attempts[0].dispatch,failure?'error':'acknowledged');
  if(!failure)assert.equal(values.get('#first-name-input-id'),'Configured');
 });
}
