const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const read=name=>stripTypeScriptTypes(fs.readFileSync(name,'utf8')).replace(/^import [\s\S]*?;\n/gm,'').replace(/^export /gm,'');
const base=path.join(__dirname,'../src');const raw=read(process.env.FILING_SOURCE || path.join(base,'risk-scoring-engine.ts'));
const now=Date.UTC(2026,8,7,12);class Clock extends Date{static now(){return now}}
const chalk=new Proxy(String,{get:()=>chalk});const c={Date:Clock,chalk,config(){},console:{log(){}}};
vm.runInNewContext(read(path.join(base,'utils.ts'))+'\n'+raw,c);
const registry=date=>({status:'active',sourceRegistry:'Synthetic',lastFilingDate:date});
for(const date of ['not-a-date','2026-02-30','2025-02-29','2026-13-01','2026-00-01','09/07/2026','2026-09','7 Sept 2026','2026-09-08',null,''])test('unknown filing recency: '+date,()=>{
 const r=c.calculateRegulatoryScore(registry(date));assert.equal(r.score,null);assert.equal(r.status,'incomplete');assert.match(r.findings.join(' '),/recency unknown/);assert.doesNotMatch(r.findings.join(' '),/Recent filing activity confirmed/);
});
for(const date of ['2026-09-07','7 September 2026','2026-01-31'])test('valid nonfuture reported filing: '+date,()=>{const r=c.calculateRegulatoryScore(registry(date));assert.equal(r.score,0);assert.equal(r.status,'completed');});
test('valid leap day and old filing retain aging score',()=>{const r=c.calculateRegulatoryScore(registry('2024-02-29'));assert.equal(r.score,25);});
test('unknown date preserves observed adverse company status',()=>{const r=c.calculateRegulatoryScore({...registry('invalid'),status:'dissolved'});assert.equal(r.score,null);assert.equal(r.observedScore,80);assert.match(r.findings.join(' '),/dissolved/);});
test('invalid recency propagates incomplete overall result even with completed screening',()=>{
 const company={name:'Synthetic',jurisdiction:'Fixture'};
 const checks=['OFAC','UK'].map((source,i)=>({entity:company.name,kind:'sanctions',source,status:'completed',auditId:String(i)}));
 const r=c.calculateRiskAssessment(company,[],[],[],[],0,registry('invalid'),'synthetic',checks);
 assert.equal(r.overallRiskScore,null);assert.equal(r.riskLevel,'incomplete');assert.ok(r.requiredActions.some(a=>a.includes('filing date')));
});
