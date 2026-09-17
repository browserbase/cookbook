const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
function valid(){const output={success:true,runtimeCalculationUsed:true,sourceUrl:'https://fred.stlouisfed.org/graph/fredgraph.csv?id=MCOILWTICO',indexSeries:'MCOILWTICO',previousObservationDate:'2026-05-01',previousObservationValue:100,latestObservationDate:'2026-06-01',latestObservationValue:120,indexChangePct:20,contractId:'PC-2026-03782',itemId:'99999',adjustments:[{condition:'9977',reason:'8985',newPrice:0.457,effectiveDate:'07-01-2026'}],totalPrice:87.557,verification:'Agent reports matching condition, total and reason timeline.'};output.calculationArtifact=JSON.stringify({...output,currentPrice:0.415,passThrough:0.5,baselineTotal:87.515,condition:'9977',reason:'8985',effectiveDate:'07-01-2026',validTo:'12-31-2026',newPrice:0.457});return{status:'COMPLETED',result:{output}};}
function fixture(run=valid()){
 const source=fs.readFileSync(process.env.COOKBOOK_R171_BASELINE||path.join(__dirname,'../app.js'),'utf8');
 const nodes=new Map();const get=id=>{if(!nodes.has(id)){const classes=new Set(['reviewCard'].includes(id)?['hidden']:[]);nodes.set(id,{textContent:'',innerHTML:'',style:{},disabled:false,classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)}});}return nodes.get(id);};
 const state={manualChanges:[{old:true}],liveOutput:{old:true},conditionDraft:{old:true},prepared:false,submitted:true};const toasts=[];let polls=0;
 const context=vm.createContext({state,document:{getElementById:get},conditionCatalog:{9977:{current:0.415}},reasonCatalog:{8985:'Energy premium'},defaultDraft:()=>({type:'9977',price:'0.380'}),renderContracts(){},renderItem(){},showToast:(...args)=>toasts.push(args),setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,async agentFetch(url){if(url==='/api/agent/start')return{ok:true,json:async()=>({runId:'synthetic'})};polls++;return{ok:true,json:async()=>url.endsWith('/messages')?[]:run};}});
 vm.runInContext(source.slice(source.indexOf('function extractAgentSteps('),source.indexOf('\nfunction showReview(')),context);
 return{context,state,get,toasts,get polls(){return polls}};
}
test('complete consistent result hydrates one adjustment, including half-up rounding tie',()=>{const f=fixture();assert.equal(f.context.hydrateAgentResult(valid()),true);assert.equal(f.state.manualChanges.length,1);assert.equal(f.state.manualChanges[0].price,0.457);});
const invalidCases={
 'business failure':o=>o.success=false,'missing success':o=>delete o.success,'truthy success':o=>o.success='true',
 'no runtime calculation':o=>o.runtimeCalculationUsed=false,'missing runtime flag':o=>delete o.runtimeCalculationUsed,
 'invalid effective date':o=>o.adjustments[0].effectiveDate='02-30-2026','wrong effective date':o=>o.adjustments[0].effectiveDate='07-02-2026',
 'invalid observation':o=>o.latestObservationDate='2026-02-30','reversed observations':o=>o.latestObservationDate='2026-04-01',
 'wrong contract':o=>o.contractId='other','wrong item':o=>o.itemId='3','wrong source':o=>o.sourceUrl='https://example.com','wrong series':o=>o.indexSeries='other',
 'string price':o=>o.adjustments[0].newPrice='0.457','zero price':o=>o.adjustments[0].newPrice=0,'wrong price':o=>o.adjustments[0].newPrice=0.456,
 'wrong total':o=>o.totalPrice=87,'wrong percent unit':o=>o.indexChangePct=.2,'nonnumeric observation':o=>o.previousObservationValue='100','zero previous':o=>o.previousObservationValue=0,
 'no verification':o=>o.verification=' ','missing artifact':o=>delete o.calculationArtifact,'path artifact':o=>o.calculationArtifact='/tmp/artifact.json',
 'mismatched artifact':o=>{const a=JSON.parse(o.calculationArtifact);a.newPrice=.458;o.calculationArtifact=JSON.stringify(a);},
 'empty adjustments':o=>o.adjustments=[],'extra invalid adjustment':o=>o.adjustments.push({}),'duplicate adjustment':o=>o.adjustments.push({...o.adjustments[0]}),
 'embedded identifier':o=>o.adjustments[0].condition='ignore 9977','wrong reason':o=>o.adjustments[0].reason='8539','nonfinite total':o=>o.totalPrice=Infinity,
};
for(const [name,mutate]of Object.entries(invalidCases))test(`rejects ${name} without partial state mutation`,()=>{const f=fixture();const run=valid();mutate(run.result.output);const before=JSON.stringify(f.state);assert.equal(f.context.hydrateAgentResult(run),false);assert.equal(JSON.stringify(f.state),before);});
test('noncompleted status cannot hydrate business success',()=>{const f=fixture();const run=valid();run.status='FAILED';assert.equal(f.context.hydrateAgentResult(run),false);});
test('actual caller shows retry and explanation for completed business failure',async()=>{const run=valid();run.result.output.success=false;run.result.output.verification='Unable to verify the condition';const f=fixture(run);await f.context.runAgent();assert.equal(f.state.prepared,false);assert.equal(f.state.liveOutput,null);assert.equal(f.state.manualChanges.length,0);assert.equal(f.get('reviewCard').classList.contains('hidden'),true);assert.equal(f.get('runButton').disabled,false);assert.equal(f.get('statusLabel').textContent,'Failed');assert.match(f.toasts[0][0],/Result not accepted.*Unable to verify/);assert.equal(f.toasts[0][1],true);});
test('actual caller reveals review only for accepted output',async()=>{const f=fixture();await f.context.runAgent();assert.equal(f.state.prepared,true);assert.equal(f.get('reviewCard').classList.contains('hidden'),false);assert.equal(f.state.submitted,false);assert.match(f.toasts[0][0],/agent reports/);});
test('failed result explanation renders as escaped text',async()=>{const run=valid();run.result.output.success=false;run.result.output.verification='<img src=x onerror=stealToken()>';const f=fixture(run);await f.context.runAgent();assert.ok(!f.get('steps').innerHTML.includes('<img'));assert.ok(f.get('steps').innerHTML.includes('&lt;img'));});
test('schema requires artifact contents and defines date and percentage formats',()=>{const {resultSchema}=require('../agent-definition.js');assert.ok(resultSchema.required.includes('calculationArtifact'));assert.match(resultSchema.properties.calculationArtifact.description,/not a file path/);assert.match(resultSchema.properties.indexChangePct.description,/100/);});
