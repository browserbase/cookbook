const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../src/main.ts'),'utf8');const a=source.indexOf('async function verifyHillsboroughCriteria(');const b=source.indexOf('\nasync function ',a+1);assert(a>=0&&b>a);
for(const failure of [null,'name','date','category','hidden-category','type','hidden-type','duplicate','ambiguous-option','substring-option','missing-hidden']) {
 test(`Hillsborough validates form and hidden criteria: ${failure}`,async()=>{
  const criteria={firstName:'Chosen',lastName:'Fixture',fromDate:'01/01/2026',toDate:'01/02/2026'};
  const fields={'#spFirstName':{value:criteria.firstName},'#spLastName':{value:criteria.lastName},'#spDateFiledAfter':{value:criteria.fromDate},'#spDateFiledBefore':{value:criteria.toDate},'#spCaseCategory':{value:'CR',options:[{text:'Criminal',value:'CR'}]},'#selectedCaseCategory':{value:'CR'},'#spCaseTypes':{value:'ALL'},'#selectedCaseType':{value:'ALL'}};
  const changed={name:'#spFirstName',date:'#spDateFiledBefore',category:'#spCaseCategory','hidden-category':'#selectedCaseCategory',type:'#spCaseTypes','hidden-type':'#selectedCaseType'};
  if(changed[failure])fields[changed[failure]].value='changed';
  if(failure==='ambiguous-option')fields['#spCaseCategory'].options.push({text:'Criminal',value:'CR2'});
  if(failure==='substring-option')fields['#spCaseCategory'].options[0].text='Noncriminal';
  if(failure==='missing-hidden')delete fields['#selectedCaseCategory'];
  const verify=vm.runInNewContext(stripTypeScriptTypes(source.slice(a,b))+';verifyHillsboroughCriteria',{
   searchCriteria:criteria,env:{HILLSBOROUGH_FIRST_NAME_FALLBACK:'Fallback',HILLSBOROUGH_CASE_CATEGORY:'Criminal'},
   document:{querySelectorAll:selector=>!fields[selector]?[]:failure==='duplicate'?[fields[selector],fields[selector]]:[fields[selector]]},
  });
  const promise=verify({evaluate:async(fn,arg)=>fn(arg)});
  if(failure)await assert.rejects(promise);else assert.equal((await promise).firstName,'Chosen');
 });
}
