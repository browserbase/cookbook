const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../uc1-llc-formation.ts'),'utf8'));
const actual=source.slice(source.indexOf('const TRANSIENT_RE'),source.indexOf('function loadPayload('))+source.slice(source.indexOf('function validateSavedDraft('),source.indexOf('if (process.argv[1]')).replace('export async function','async function');
const evidence={saved:true,confirmationText:'Draft successfully saved.',draftReference:'SYNTHETIC-123',llcName:'Synthetic LLC'};
async function run({firstActionFailure=false,saveFailure=false,saveThrows=false,data=evidence,before='Review and Signature',after='Draft successfully saved. SYNTHETIC-123 Synthetic LLC'}={}){
 const calls=[];let stagehandClosed=0,browserClosed=0,evaluations=0;
 const address={street:'Synthetic street',city:'Synthetic city',state:'CA',zip:'00000'};
 const payload={llc:{name:'Synthetic LLC'},addresses:{principal:address,mailing:{sameAsPrincipal:true}},agentForServiceOfProcess:{individual:{...address,fullName:'Synthetic Person'}},management:{structure:'one_manager'},billing:{filerName:'Synthetic',filerEmail:'synthetic@example.invalid',filerPhone:'0000000000'}};
 const page={goto:async()=>{},evaluate:async fn=>String(fn).includes("document.body.innerText") ? (++evaluations===1?before:after) : undefined};
 const browser={sessionId:'synthetic',context:{pages:async()=>[page]},close:async()=>browserClosed++};
 const stagehand={browser,act:async instruction=>{calls.push(instruction);if(saveThrows&&instruction.includes('Save Draft'))throw new Error('Gateway 503');return {data:{success:!(firstActionFailure||saveFailure&&instruction.includes('Save Draft'))}}},extract:async()=>({data}),close:async()=>stagehandClosed++};
 const scalar={describe(){return this}};const z={object:()=>({}),boolean:()=>scalar,string:()=>scalar};
 const c={loadPayload:()=>payload,requireEnv:()=> 'synthetic',Stagehand:{create:async()=>stagehand},StagehandCreateOptionsSchema:{parse:x=>x},browserbase:{launch:async()=>browser},process:{env:{}},MODEL:'synthetic',Browserbase:class{sessions={debug:async()=>({debuggerFullscreenUrl:'https://synthetic.invalid/live'})}},console:{log(){}},POST_ADVANCE_WAIT_MS:0,setTimeout:fn=>{fn();return 0},z};
 vm.runInNewContext(actual,c);
 let output,error;try{output=await c.runUc1()}catch(e){error=e}
 assert.equal(stagehandClosed,1);assert.equal(browserClosed,1);
 return {output,error,calls};
}
test('unsuccessful action stops before advancing or saving',async()=>{const r=await run({firstActionFailure:true});assert.match(r.error.message,/action did not succeed/);assert.equal(r.calls.length,1);assert.equal(r.output,undefined)});
for(const flag of ['saveFailure','saveThrows'])test(`${flag} produces no saved result and is not retried`,async()=>{const r=await run({[flag]:true});assert.ok(r.error);assert.equal(r.output,undefined);assert.equal(r.calls.filter(s=>s.includes('Save Draft')).length,1)});
for(const [name,options] of [
 ['earlier wizard step',{data:{saved:false,confirmationText:'',draftReference:'',llcName:''},after:'Step 2: Submitter; no draft saved'}],
 ['missing reference',{data:{...evidence,draftReference:''}}],['other LLC',{data:{...evidence,llcName:'Different LLC'},after:'Draft successfully saved. SYNTHETIC-123 Different LLC'}],
 ['invented confirmation',{data:{...evidence,confirmationText:'Invented confirmation'}}],['missing visible reference',{after:'Draft successfully saved. Synthetic LLC'}],
 ['stale confirmation',{before:'Review and Signature Draft successfully saved. SYNTHETIC-123 Synthetic LLC'}],['string saved flag',{data:{...evidence,saved:'true'}}],
])test(`does not claim saved for ${name}`,async()=>{const r=await run(options);assert.match(r.error.message,/could not be confirmed/);assert.equal(r.output,undefined)});
test('new visible save confirmation returns draft reference and reopen instructions, not closed live URL',async()=>{const r=await run();assert.equal(r.error,undefined);assert.equal(r.output.status,'draft_saved_for_human_signature');assert.equal(r.output.draft.reference,evidence.draftReference);assert.equal(r.output.liveViewUrl,undefined);assert.match(r.output.handoff,/reopen/);assert.equal(r.output.draft.portalUrl,'https://bizfileonline.sos.ca.gov/');assert.ok(!r.calls.some(s=>/Processing Fees|File Document/.test(s)))});

test('earlier wizard step cannot trigger Save Draft even with a later synthetic confirmation',async()=>{const r=await run({before:'Step 2: Submitter'});assert.match(r.error.message,/step was not observed/);assert.equal(r.calls.filter(s=>s.includes('Save Draft')).length,0)});
