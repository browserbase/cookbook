const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../src/main.ts'),'utf8');
function code(name){const start=source.indexOf(`async function ${name}(`);const end=source.indexOf('\nasync function ',start+1);assert(start>=0&&end>start);return stripTypeScriptTypes(source.slice(start,end));}
const criteria={firstName:'Chosen',lastName:'Fixture',fromDate:'01/01/2026',toDate:'01/02/2026'};
for(const failSelector of [null,'#cs_FirstName','#cs_LastName','#cs_DateFrom','#cs_DateTo']) {
 test(`Lee preserves configured first name and gates submit: ${failSelector}`,async()=>{
  const fills=[];let submits=0;
  const run=vm.runInNewContext(code('fillRequiredField')+code('assessLee')+';assessLee',{
   env:{LEE_FIRST_NAME_FALLBACK:'Fallback*'},searchCriteria:criteria,targetSites:{lee:{}},
   fillIfPresent:async(_page,selector,value)=>{fills.push([selector,value]);return selector!==failSelector;},
   gotoPage:async()=>{},maybeWaitForBrowserbaseCaptcha:async()=>{},getPageSignals:async()=>({}),extractControlShape:async()=>[],classifyBlocker:()=>undefined,
   setLeeCriminalCaseTypes:async()=>{},getLeeFieldSnapshot:async()=>({}),submitLeeSearch:async()=>{submits++;},
   extractResultSummary:async()=>({}),completionStatus:()=> 'results_reached',
   buildAssessment:(_site,_target,_signals,status)=>({status}),errorAssessment:(_site,_target,error)=>({status:'error',message:error.message}),
  });
  const result=await run({waitForTimeout:async()=>{}});
  assert.equal(submits,failSelector?0:1);
  assert.equal(result.status,failSelector?'error':'results_reached');
  assert.equal(fills[0][1],'Chosen');
  if(failSelector)assert(result.message.includes(failSelector));
  else assert.deepEqual(fills,[['#cs_FirstName','Chosen'],['#cs_LastName','Fixture'],['#cs_DateFrom',criteria.fromDate],['#cs_DateTo',criteria.toDate]]);
 });
}
for(const explicit of [true,false]) {
 test(`Lee validation retry cannot replace an explicit name: ${explicit}`,async()=>{
  let retry=0;const fills=[];
  const submit=vm.runInNewContext(code('fillRequiredField')+code('submitLeeSearch')+';submitLeeSearch',{
   env:{LEE_FIRST_NAME_FALLBACK:'Fallback*'},searchCriteria:{...criteria,firstName:explicit?'Chosen':''},
   clickLeeSubmit:async()=>{},maybeWaitForBrowserbaseCaptcha:async()=>{},getPageSignals:async()=>({text:'First name is required if last name is specified',title:'',html:''}),selectorCount:async()=>1,
   fillIfPresent:async(_page,selector,value)=>{fills.push(value);return true;},getLeeFieldSnapshot:async()=>({}),submitLeeSearchNatively:async()=>{retry++;},
  });
  const page={waitForTimeout:async()=>{},waitForLoadState:async()=>{}};
  if(explicit)await assert.rejects(submit(page,[]),/not broadened/);else await submit(page,[]);
  assert.equal(retry,explicit?0:1);assert.deepEqual(fills,explicit?[]:['Fallback*']);
 });
}
test('a first-name field label alone is not validation failure',async()=>{
 const submit=vm.runInNewContext(code('submitLeeSearch')+';submitLeeSearch',{
  searchCriteria:criteria,clickLeeSubmit:async()=>{},maybeWaitForBrowserbaseCaptcha:async()=>{},getPageSignals:async()=>({text:'First name Last name Search',title:'',html:''}),selectorCount:async()=>1,
 });
 await submit({waitForTimeout:async()=>{}},[]);
});
for(const failSelector of ['#spFirstName','#spLastName','#spDateFiledAfter','#spDateFiledBefore']) {
 test(`Hillsborough stops before submission when ${failSelector} is unverified`,async()=>{
  const fills=[];let proceeded=false;
  const assess=vm.runInNewContext(code('fillRequiredField')+code('assessHillsborough')+';assessHillsborough',{
   env:{HILLSBOROUGH_FIRST_NAME_FALLBACK:'',HILLSBOROUGH_CASE_CATEGORY:'Criminal'},searchCriteria:{...criteria,firstName:''},targetSites:{hillsborough:{}},
   gotoDocumentReady:async()=>true,maybeWaitForBrowserbaseCaptcha:async()=>{},navigateToHillsboroughPartySearch:async()=>{},waitForHillsboroughWarmup:async()=>{},
   getPageSignals:async()=>({}),extractControlShape:async()=>[],classifyBlocker:()=>undefined,
   fillIfPresent:async(_page,selector,value)=>{fills.push([selector,value]);return selector!==failSelector;},setHillsboroughCaseCategoryWithoutAjax:async()=>true,
   simulateHillsboroughHumanSignals:async()=>{proceeded=true;},errorAssessment:(_site,_target,error)=>({status:'error',message:error.message}),
  });
  const result=await assess({waitForTimeout:async()=>{}});
  assert.equal(result.status,'error');assert(result.message.includes(failSelector));assert.equal(proceeded,false);
  assert.deepEqual(fills[0],['#spFirstName','']);
 });
}
