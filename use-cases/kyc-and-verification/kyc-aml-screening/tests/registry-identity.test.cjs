const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');const {z}=require(process.env.ZOD_MODULE_PATH || 'zod');
const raw=fs.readFileSync(process.env.REGISTRY_SOURCE || path.join(__dirname,'../src/company-registry-research.ts'),'utf8');
const start=raw.includes('function normalizedIdentity')?'function normalizedIdentity':'async function searchCompaniesHouse';
const code=stripTypeScriptTypes(raw.slice(raw.indexOf(start),raw.indexOf('// Run standalone')).replace('export async function','async function'));
const company={name:'Synthetic Holdings Ltd',jurisdiction:'gb',registrationNumber:'00123456'};
const candidate={registeredName:company.name,registrationNumber:'00123456',jurisdiction:'gb',status:'Active',incorporationDate:null,registeredAddress:null,companyType:null,sicCodes:[],lastFilingDate:null};
function fixture(data=candidate,url='https://opencorporates.com/companies/gb/00123456'){
 let goto;const page={goto:async u=>goto=u,waitForLoadState:async()=>{},url:async()=>url};
 const stagehand={browser:{sessionId:'synthetic',close:async()=>{},context:{activePage:async()=>page}},close:async()=>{},act:async()=>({data:{success:true}}),extract:async(_p,schema)=>({data:schema.parse(data)})};
 const c={URL,z,process:{env:{}},StagehandCreateOptionsSchema:{parse:x=>x},browserbase:{launch:async()=>stagehand.browser},Stagehand:{create:async()=>stagehand},
 log:new Proxy({},{get:()=>()=>{}}),createAuditEntry:()=>({}),finalizeAuditEntry:(_a,success,details,_t,error)=>({success,details,error}),sanitizeCompanyName:x=>x,wait:async()=>{}};
 vm.runInNewContext(code,c);return {c,stagehand,search:(input=company)=>c.searchOpenCorporates(stagehand,input,'synthetic'),goto:()=>goto};
}
test('unrelated extracted entity remains candidate with unsuccessful identity audit',async()=>{
 const f=fixture({...candidate,registeredName:'Unrelated Ltd',registrationNumber:'999',jurisdiction:'us_de'});const r=await f.search();
 assert.equal(r.data,null);assert.equal(r.audit.success,false);assert.equal(r.candidate.registeredName,'Unrelated Ltd');
});
for(const change of [{registrationNumber:'999'},{jurisdiction:'us_de'},{registeredName:'Synthetic Holdings PLC'}])test('mismatched candidate field '+JSON.stringify(change),async()=>{const r=await fixture({...candidate,...change}).search();assert.equal(r.data,null);});
test('missing requested registration keeps name-only search inconclusive',async()=>{const r=await fixture().search({...company,registrationNumber:undefined});assert.equal(r.data,null);assert.ok(r.candidate);});
test('matching extracted fields on search page cannot verify identity',async()=>{const r=await fixture(candidate,'https://opencorporates.com/companies?q=Synthetic').search();assert.equal(r.data,null);});
test('matching extracted fields at different registry ID cannot verify identity',async()=>{const r=await fixture(candidate,'https://opencorporates.com/companies/gb/999').search();assert.equal(r.data,null);});
test('all supplied fields and registry URL agree; jurisdiction filter and output retained',async()=>{const f=fixture();const r=await f.search();assert.equal(r.data.registrationNumber,'00123456');assert.equal(r.data.jurisdiction,'gb');assert.equal(r.audit.success,true);assert.equal(new URL(f.goto()).searchParams.get('jurisdiction_code'),'gb');});
test('explicit approved alias may agree but substring does not',async()=>{const r=await fixture({...candidate,registeredName:'Approved Alias Ltd'}).search({...company,alternateNames:['Approved Alias Ltd']});assert.ok(r.data);});
test('Companies House applies the same supplied identity gate',async()=>{const f=fixture({...candidate,registeredName:'Unrelated Ltd'},'https://find-and-update.company-information.service.gov.uk/company/00123456');const r=await f.c.searchCompaniesHouse(f.stagehand,company,'synthetic');assert.equal(r.data,null);});
test('matching Companies House fields and canonical URL are accepted',async()=>{const f=fixture(candidate,'https://find-and-update.company-information.service.gov.uk/company/00123456');const r=await f.c.searchCompaniesHouse(f.stagehand,company,'synthetic');assert.ok(r.data);assert.equal(r.data.jurisdiction,'gb');});
test('top-level registry research retains inconclusive candidates and returns no matched data',async()=>{const f=fixture({...candidate,registeredName:'Unrelated Ltd'});const r=await f.c.researchCompanyRegistry({...company,jurisdiction:'United Kingdom'});assert.equal(r.data,null);assert.equal(r.candidates.length,2);assert.ok(r.auditTrail.every(a=>!a.success));});
test('actual workflow does not forward an inconclusive candidate number or claim company verified',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/index.ts'),'utf8');
 const part=source.slice(source.indexOf('  const registryResult = await researchCompanyRegistry'),source.indexOf('  // PHASE 3:'));
 let number='unset';const c={config:{company},auditTrail:[],dataSources:[],analysisNotes:[],console:{log(){}},log:{info(){}},
 researchCompanyRegistry:async()=>({data:null,candidates:[candidate],auditTrail:[],sourceRegistry:''}),
 extractBeneficialOwnership:async(_company,n)=>{number=n;return {owners:[],auditTrail:[],ownershipStructure:'Synthetic'};}};
 await vm.runInNewContext('(async()=>{'+stripTypeScriptTypes(part)+'})()',c);
 assert.equal(number,undefined);assert.ok(c.analysisNotes.some(n=>n.includes('identity inconclusive')));assert.ok(c.analysisNotes.every(n=>!n.includes('Company verified')));
});
