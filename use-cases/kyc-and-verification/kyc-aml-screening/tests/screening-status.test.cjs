const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../src/pep-sanctions-check.ts'),'utf8'));
function fixture(responses){
 let id=0;
 const stagehand={browser:{sessionId:'synthetic',context:{activePage:async()=>({goto:async()=>{},waitForLoadState:async()=>{}})},close:async()=>{}},close:async()=>{},act:async()=>{},extract:async()=>{const value=responses.shift();if(value instanceof Error)throw value;return {data:value}}};
 const context={Stagehand:{create:async()=>stagehand},browserbase:{launch:async()=>stagehand.browser},StagehandCreateOptionsSchema:{parse:v=>v},z:require('zod').z,
  process:{env:{}},console:{log(){}},log:new Proxy({},{get:()=>()=>{}}),wait:async()=>{},
  createAuditEntry:(_action,source)=>({id:String(++id),source,success:false}),finalizeAuditEntry:(audit,success)=>({...audit,success})};
 vm.runInNewContext(source.slice(source.indexOf('async function checkOFACSanctions'),source.indexOf('// Run standalone')).replace('export async function','async function'),context);
 return context;
}
const empty=()=>({searchCompleted:true,hasMatches:false,matches:[]});
test('failed, incomplete and inconsistent sanctions results remain failed checks',async()=>{
 for(const value of [new Error('synthetic unavailable'),{...empty(),searchCompleted:false},{...empty(),hasMatches:true}]){
  const c=fixture([value,empty()]);const result=await c.screenPEPSanctions({name:'Synthetic Entity',jurisdiction:'Fixture'});
  assert.equal(result.checks[0].status,'failed');assert.equal(result.checks[1].status,'completed');
  assert.equal(result.sanctionsResults.length,0);assert.equal(result.sourcesChecked.length,1);
 }
});
test('completed empty checks and failed PEP are distinct; repeated names retain separate checks',async()=>{
 const c=fixture([empty(),empty(),new Error('synthetic PEP failure'),empty(),{subjectVerified:false},empty()]);
 const result=await c.screenPEPSanctions({name:'Synthetic Entity'},[{name:'Synthetic Owner'},{name:'Synthetic Owner'}]);
 assert.equal(result.pepResults.length,0);
 assert.deepEqual(Array.from(result.checks,c=>c.status),['completed','completed','failed','completed','failed','completed']);
 assert.equal(new Set(result.checks.map(c=>c.auditId)).size,6);
});
test('matched sanctions retain results with a completed source status',async()=>{
 const c=fixture([{searchCompleted:true,hasMatches:true,matches:[{entityName:'Synthetic Match',listingDate:null,program:null,identifiers:[]}]},empty()]);
 const result=await c.screenPEPSanctions({name:'Synthetic Entity'});
 assert.equal(result.sanctionsResults.length,1);assert.equal(result.checks[0].status,'completed');
});
test('interrupted screening retains not-run status for every unvisited source',async()=>{
 const c=fixture([empty()]);c.wait=async()=>{throw new Error('synthetic interruption')};
 const result=await c.screenPEPSanctions({name:'Synthetic Entity'},[{name:'Synthetic Owner'}]);
 assert.deepEqual(Array.from(result.checks,c=>c.status),['failed','not_run','not_run','not_run']);
 assert.equal(result.sourcesChecked.length,0);
});
