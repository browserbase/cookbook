const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');const {z}=require(process.env.ZOD_MODULE_PATH || 'zod');
const raw=fs.readFileSync(process.env.OWNERSHIP_SOURCE || path.join(__dirname,'../src/beneficial-ownership.ts'),'utf8');
const code=stripTypeScriptTypes(raw.slice(raw.indexOf('async function extractUKPSC'),raw.indexOf('// Run standalone')).replace('export async function','async function'));
const base='https://find-and-update.company-information.service.gov.uk/company/00123456/persons-with-significant-control';
const person=name=>({name,nationality:null,dateOfBirth:null,ownershipPercentage:null,natureOfControl:null,appointmentDate:null,address:null,isIndividual:true});
function fixture(pages){let index=0,current=base,calls=0;const page={url:async()=>current,waitForLoadState:async()=>{},goto:async url=>{current=url;index=Number(new URL(url).searchParams.get('page') || 1)-1;},evaluate:async fn=>{
 const links=pages[index]?.next || [];
 return vm.runInNewContext('('+fn.toString()+')()', {document:{querySelectorAll:()=>links.map(href=>({href,textContent:'Next',rel:'next',getClientRects:()=>[{}]}))},getComputedStyle:()=>({visibility:'visible'})});
 }};
 const browser={sessionId:'synthetic',close:async()=>{},context:{activePage:async()=>page}};
 const stagehand={browser,close:async()=>{},act:async()=>({data:{success:true}}),extract:async(_p,schema)=>{calls++;if(pages[index]?.fail)throw Error('synthetic page failure');return {data:schema.parse({persons:pages[index].names.map(person),hasMorePSCs:pages[index].more})};}};
 const c={URL,z,process:{env:{}},StagehandCreateOptionsSchema:{parse:v=>v},browserbase:{launch:async()=>browser},Stagehand:{create:async()=>stagehand},log:new Proxy({},{get:()=>()=>{}}),console:{log(){}},createAuditEntry:()=>({}),finalizeAuditEntry:(_a,success,details,_t,error)=>({success,details,error}),sanitizeCompanyName:x=>x,wait:async()=>{}};
 vm.runInNewContext(code,c);const company={name:'Synthetic Ltd',jurisdiction:'United Kingdom'};
 return {c,run:()=>c.extractUKPSC(stagehand,company,'00123456','synthetic'),top:()=>c.extractBeneficialOwnership(company,'00123456'),calls:()=>calls};
}
test('empty page with more records but no next link stays incomplete',async()=>{const r=await fixture([{names:[],more:true}]).run();assert.equal(r.audit.success,false);assert.equal(r.coverage.status,'incomplete');assert.equal(r.coverage.hasMore,true);});
test('follows next page, collects all observed records and marks end',async()=>{const r=await fixture([{names:['Synthetic A'],more:true,next:[base+'?page=2']},{names:['Synthetic B'],more:false}]).run();assert.equal(r.owners.length,2);assert.equal(r.coverage.pagesRead,2);assert.equal(r.coverage.status,'completed');assert.equal(r.audit.success,true);});
test('visible next link overrides false model hasMore flag',async()=>{const r=await fixture([{names:['Synthetic A'],more:false,next:[base+'?page=2']},{names:['Synthetic B'],more:false}]).run();assert.equal(r.owners.length,2);});
test('later page failure retains earlier records as partial',async()=>{const r=await fixture([{names:['Synthetic A'],more:true,next:[base+'?page=2']},{fail:true}]).run();assert.equal(r.owners.length,1);assert.equal(r.coverage.status,'incomplete');assert.equal(r.audit.success,false);});
test('five page bound preserves incomplete state with more records',async()=>{const r=await fixture(Array.from({length:6},(_,i)=>({names:['Synthetic '+i],more:true,next:[base+'?page='+(i+2)]}))).run();assert.equal(r.owners.length,5);assert.equal(r.coverage.pagesRead,5);assert.equal(r.coverage.hasMore,true);assert.equal(r.coverage.status,'incomplete');});
for(const next of [base,base.replace('00123456','99999999')+'?page=2','https://other.invalid/?page=2'])test('unsafe or repeated next URL remains partial: '+next,async()=>{const r=await fixture([{names:['Synthetic A'],more:true,next:[next]}]).run();assert.equal(r.coverage.status,'incomplete');assert.equal(r.owners.length,1);});
test('repeated page contents cannot count as finished pagination',async()=>{const r=await fixture([{names:['Synthetic A'],more:true,next:[base+'?page=2']},{names:['Synthetic A'],more:false}]).run();assert.equal(r.owners.length,1);assert.equal(r.coverage.status,'incomplete');});
test('top-level does not erase partial UK coverage with unrelated fallback',async()=>{const f=fixture([{names:[],more:true}]);const r=await f.top();assert.equal(f.calls(),1);assert.equal(r.coverage.status,'incomplete');assert.match(r.ownershipStructure,/Partial/);});
