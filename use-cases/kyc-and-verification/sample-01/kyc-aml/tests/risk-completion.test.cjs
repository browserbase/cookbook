const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
function read(name){return stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../src',name),'utf8')).replace(/^import [\s\S]*?;\n/gm,'').replace(/^export /gm,'')}
function fixture(){
 const output=[];const chalk=new Proxy(text=>String(text),{get:()=>chalk});
 const c={chalk,config(){},console:{log:(...args)=>output.push(args.join(' '))}};
 vm.runInNewContext(read('utils.ts')+'\n'+read('risk-scoring-engine.ts'),c);
 return {c,output};
}
const company={name:'Synthetic Entity',jurisdiction:'Fixture'};
const owners=[{name:'Synthetic Owner',nationality:'Fixture'}];
const complete=()=>[
 {entity:company.name,source:'OFAC',kind:'sanctions',status:'completed',auditId:'1'},
 {entity:company.name,source:'UK',kind:'sanctions',status:'completed',auditId:'2'},
 {entity:owners[0].name,source:'Public PEP',kind:'pep',status:'completed',auditId:'3'},
 {entity:owners[0].name,source:'OFAC',kind:'sanctions',status:'completed',auditId:'4'}];
function assess(f,checks,hits=[]){return f.c.calculateRiskAssessment(company,[],[],hits,owners,0,null,'synthetic-audit',checks)}
test('failed, not-run, missing and reused-audit screening cannot produce a numeric overall score',()=>{
 for(const variant of ['missing','failed','not_run','audit','pep']){
  const f=fixture(),checks=complete();
  if(variant==='missing')checks.splice(0,1);
  else if(variant==='audit')checks[1].auditId=checks[0].auditId;
  else checks[variant==='pep'?2:0].status=variant==='pep'?'failed':variant;
  const assessment=assess(f,checks),json=JSON.parse(JSON.stringify(assessment));
  assert.equal(json.overallRiskScore,null);assert.equal(json.riskLevel,'incomplete');
  assert.equal(json.components[variant==='pep'?'pepExposure':'sanctionsExposure'].score,null);
  assert.ok(json.recommendations.some(s=>/incomplete/.test(s)));
  assert.ok(json.requiredActions.some(s=>/STOP/.test(s)));
  assert.doesNotMatch(json.recommendations.join(' '),/Standard due diligence|Proceed with periodic/);
  assert.match(f.output.join('\n'),/Risk Score: UNAVAILABLE/);assert.doesNotMatch(f.output.join('\n'),/null\/100/);
 }
});
test('complete empty checks report limited no-hit evidence with actual sources',()=>{
 const f=fixture(),result=assess(f,complete());
 assert.equal(typeof result.overallRiskScore,'number');assert.equal(result.components.sanctionsExposure.score,0);
 assert.deepEqual(Array.from(result.components.sanctionsExposure.sources),['OFAC','UK']);
 assert.match(result.components.sanctionsExposure.findings[0],/completed configured checks/);
 assert.equal(result.screeningChecks.length,4);
});
test('partial screening preserves known matches and their escalation',()=>{
 const f=fixture(),checks=complete();checks[1].status='failed';
 const result=assess(f,checks,[{entityName:'Synthetic Match',sanctionsList:'Fixture list',sanctionsBody:'Fixture source',matchScore:95}]);
 assert.equal(result.overallRiskScore,null);assert.equal(result.components.sanctionsExposure.observedScore,50);
 assert.match(result.components.sanctionsExposure.findings.join(' '),/Synthetic Match/);
 assert.ok(result.recommendations.some(s=>/Potential sanctions match/.test(s)));
 assert.ok(result.requiredActions.some(s=>/Manual review/.test(s)));
});
test('legacy callers without completion evidence stay incomplete',()=>{
 assert.equal(assess(fixture(),undefined).overallRiskScore,null);
});
test('actual workflow passes screening states into saved JSON and final console output',async()=>{
 for(const failed of [false,true]){
  const f=fixture(),checks=complete();if(failed)checks[0].status='failed';let saved;
  Object.assign(f.c,{
   displayBanner(){},path:require('node:path'),
   fs:{existsSync:()=>true,writeFileSync:(_path,data)=>{saved=JSON.parse(data)}},
   researchCompanyRegistry:async()=>({data:null,auditTrail:[]}),
   extractBeneficialOwnership:async()=>({owners,coverage:{status:'completed',pagesRead:1,hasMore:false,reason:'synthetic'},complexityScore:0,ownershipStructure:'synthetic',auditTrail:[]}),
   screenAdverseMedia:async()=>({results:[],sources:[],auditTrail:[]}),
   screenPEPSanctions:async()=>({pepResults:[],sanctionsResults:[],checks,sourcesChecked:[],auditTrail:[]})
  });
  const index=read('index.ts');vm.runInNewContext(index.slice(index.indexOf('function saveReport('),index.indexOf('async function main(')),f.c);
  const report=await f.c.runFullKYCWorkflow({company,outputFormat:'json'});
  assert.equal(saved.riskAssessment.riskLevel,report.riskAssessment.riskLevel);
  assert.equal(saved.riskAssessment.screeningChecks[0].status,failed?'failed':'completed');
  assert.equal(report.dataCompleteness,failed?40:60);
  if(failed){assert.equal(saved.riskAssessment.overallRiskScore,null);assert.match(f.output.join('\n'),/KYC SCREENING INCOMPLETE/)}
 }
});

test('actual workflow preserves partial ownership coverage in saved report and incomplete aggregate',async()=>{
 const f=fixture();let saved;const coverage={status:'incomplete',pagesRead:1,hasMore:true,reason:'Synthetic next page unavailable'};
 Object.assign(f.c,{displayBanner(){},path:require('node:path'),fs:{existsSync:()=>true,writeFileSync:(_p,data)=>{saved=JSON.parse(data)}},
 researchCompanyRegistry:async()=>({data:null,auditTrail:[]}),
 extractBeneficialOwnership:async()=>({owners,coverage,complexityScore:0,ownershipStructure:'Partial synthetic records',auditTrail:[]}),
 screenAdverseMedia:async()=>({results:[],sources:[],auditTrail:[]}),
 screenPEPSanctions:async()=>({pepResults:[],sanctionsResults:[],checks:complete(),sourcesChecked:[],auditTrail:[]})});
 const index=read('index.ts');vm.runInNewContext(index.slice(index.indexOf('function saveReport('),index.indexOf('async function main(')),f.c);
 await f.c.runFullKYCWorkflow({company,outputFormat:'json'});
 assert.equal(saved.ownershipCoverage.status,'incomplete');assert.equal(saved.beneficialOwners.length,1);
 assert.equal(saved.riskAssessment.components.ownershipComplexity.score,null);assert.equal(saved.riskAssessment.overallRiskScore,null);
 assert.equal(saved.riskAssessment.riskLevel,'incomplete');assert.equal(saved.dataCompleteness,40);
});
