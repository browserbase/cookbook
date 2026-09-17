const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../src/main.ts'),'utf8');
function code(name){const a=source.indexOf(`async function ${name}(`);const b=source.indexOf('\nasync function ',a+1);assert(a>=0&&b>a);return stripTypeScriptTypes(source.slice(a,b));}
for(const method of ['clickLeeSubmit','submitLeeSearchNatively'])for(const failure of [null,'name','date','filter','duplicate','missing-submit']) {
 test(`${method} checks current criteria before submission: ${failure}`,async()=>{
  let submitted=0;const criteria={firstName:'Chosen',lastName:'Fixture',fromDate:'01/01/2026',toDate:'01/02/2026'};
  const fields={'#cs_FirstName':criteria.firstName,'#cs_LastName':criteria.lastName,'#cs_DateFrom':criteria.fromDate,'#cs_DateTo':criteria.toDate};
  if(failure==='name')fields['#cs_FirstName']='Changed';if(failure==='date')fields['#cs_DateTo']='Changed';
  const labels=['Adult - Felony','CriminalTraffic','Misdemeanor','County Ordinance','Municipal Ordinance','Civil'];
  const controls=labels.map((label,i)=>({id:`cs_CaseTypes_${i}__CaseTypeChecked`,checked:i<5,parentElement:{textContent:label}}));
  if(failure==='filter')controls[5].checked=true;
  const document={
   querySelectorAll:selector=>selector in fields?Array.from({length:failure==='duplicate'?2:1},()=>({value:fields[selector]})):controls,
   getElementById:id=>({value:labels[Number(id.match(/_(\d+)__/)[1])]}),
   querySelector:()=>failure==='missing-submit'?null:{closest:()=>({requestSubmit:()=>{submitted++;}})},
  };
  const invoke=vm.runInNewContext(code('recordSearchDispatch')+code('verifyLeeCriteria')+code(method)+`;${method}`,{
   document,searchCriteria:criteria,env:{LEE_FIRST_NAME_FALLBACK:'Fallback'},
   clickIfPresent:async()=>{if(failure==='missing-submit')return false;submitted++;return true;},
  });
  const page={evaluate:async(fn,arg)=>fn(arg),waitForTimeout:async()=>{},waitForLoadState:async()=>{}};
  const attempts=[];
  if(failure)await assert.rejects(invoke(page,attempts));else await invoke(page,attempts);
  assert.equal(attempts.length,!failure||failure==='missing-submit'?1:0);
  if(attempts.length)assert.equal(attempts[0].dispatch,failure?'error':'acknowledged');
  assert.equal(submitted,failure?0:1);
 });
}
