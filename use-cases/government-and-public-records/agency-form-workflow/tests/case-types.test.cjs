const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../src/main.ts'),'utf8');
const start=source.indexOf('async function setLeeCriminalCaseTypes(');const end=source.indexOf('\nfunction buildAssessment(',start);assert(start>=0&&end>start);
const descriptions=['Adult - Felony','CriminalTraffic','Misdemeanor','County Ordinance','Municipal Ordinance','Civil'];
for(const failure of [null,'missing','ambiguous','unknown','setter','reverted','added-control']) {
 test(`Lee verifies the complete case-type scope: ${failure}`,async()=>{
  const controls=descriptions.map((description,i)=>({id:`cs_CaseTypes_${i}__CaseTypeChecked`,description,checked:i===5}));
  if(failure==='missing')controls.shift();
  if(failure==='ambiguous')controls.push({...controls[0],id:'cs_CaseTypes_9__CaseTypeChecked'});
  if(failure==='unknown')controls[5].description='';
  const set=vm.runInNewContext(stripTypeScriptTypes(source.slice(start,end))+';setLeeCriminalCaseTypes',{
   document:{querySelectorAll:()=>controls},
   setCheckedIfPresent:async(_page,selector,checked)=>{if(failure==='setter')return false;controls.find(c=>'#'+c.id===selector).checked=checked;return true;},
  });
  const page={evaluate:async(fn,arg)=>{
   if(typeof fn==='string')return controls.map(c=>({...c}));
   if(failure==='reverted')controls[0].checked=false;
   if(failure==='added-control')controls.push({id:'unexpected',checked:true});
   return fn(arg);
  }};
  if(failure)await assert.rejects(set(page));else{await set(page);assert.deepEqual(controls.map(c=>c.checked),[true,true,true,true,true,false]);}
 });
}
