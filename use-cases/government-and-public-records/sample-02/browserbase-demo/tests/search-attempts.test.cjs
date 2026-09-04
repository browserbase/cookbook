const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../src/main.ts'),'utf8');
function code(name){const a=source.indexOf(`async function ${name}(`);const b=source.indexOf('\nasync function ',a+1);assert(a>=0&&b>a);return stripTypeScriptTypes(source.slice(a,b));}
const record=vm.runInNewContext(code('recordSearchDispatch')+';recordSearchDispatch');
test('records pending, acknowledgement and error separately with immutable criteria',async()=>{
 const attempts=[];const criteria={firstName:'Fixture',caseTypes:['Criminal']};
 await record(attempts,criteria,async()=>{assert.equal(attempts[0].dispatch,'pending');criteria.firstName='changed';criteria.caseTypes.push('Civil');});
 const error=new Error('synthetic transport failure');
 await assert.rejects(record(attempts,criteria,async()=>{throw error;}),e=>e===error);
 assert.deepEqual(attempts.map(a=>a.dispatch),['acknowledged','error']);
 assert.equal(attempts[0].criteria.firstName,'Fixture');assert.equal(attempts[0].criteria.caseTypes.length,1);
});
for(const site of ['hillsborough','lee','miwayne'])test(`site assessment retains isolated attempt history: ${site}`,async()=>{
 const handler=async(_page,attempts)=>{await record(attempts,{firstName:'Fixture'},async()=>{});return {status:'error'};};
 const assess=vm.runInNewContext(code('assessSite')+';assessSite',{assessHillsborough:handler,assessLee:handler,assessMiCourt:async(_stagehand,page,attempts)=>handler(page,attempts)});
 const first=await assess({}, {}, site);const second=await assess({}, {}, site);
 assert.equal(first.status,'error');assert.equal(first.searchAttempts.length,1);assert.equal(second.searchAttempts.length,1);assert.notEqual(first.searchAttempts,second.searchAttempts);
});
for(const dispatches of [[],['pending'],['error'],['acknowledged','error'],['acknowledged']])for(const status of ['results_with_records','results_reached']) {
 test(`result status requires acknowledged latest attempt: ${status}, ${dispatches}`,async()=>{
  const handler=async(_page,attempts)=>{attempts.push(...dispatches.map(dispatch=>({dispatch})));return {status,notes:[]};};
  const assess=vm.runInNewContext(code('assessSite')+';assessSite',{assessLee:handler});
  const result=await assess({}, {}, 'lee');
  assert.equal(result.status,dispatches.at(-1)==='acknowledged'?status:dispatches.length?'error':'form_reached');
  assert.equal(result.searchAttempts.length,dispatches.length);
 });
}
