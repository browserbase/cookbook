const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../src/main.ts'),'utf8');
const marker='SYNTHETIC_PRIVATE_CASE_PERSON_123';
function assessment() {
 return {searchAttempts:[{criteria:{firstName:marker},dispatch:'acknowledged'}],site:'hillsborough',status:'results_with_records',label:marker,url:marker,finalUrl:marker,title:marker,blocker:marker,evidence:[marker],notes:[marker],screenshotPath:marker,controls:[{id:marker,text:marker,options:[marker]}],resultSummary:{recordCount:2,tables:[{index:0,rowCount:2,headers:[marker],sampleRows:[[marker]]}],links:[{text:marker,href:marker}],visibleText:marker,proofText:[marker],extracted:{visibleCaseRows:[{name:marker,caseNumber:marker}]}}};
}
for(const redact of [true,false]) {
 test(`actual runner writes final JSON with redact=${redact}`,async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'court-report-test-'));
  const saved=[];const logs=[];let closed=0;
  try {
   const start=source.indexOf('async function run()');
   const end=source.indexOf('\nasync function resolveBrowserbaseContextId',start);
   assert(start>=0&&end>start);
   const browser={close:async()=>{closed++;}};
   const stagehand={browser,close:async()=>{closed++;}};
   const input=assessment();
   const run=vm.runInNewContext(stripTypeScriptTypes(source.slice(start,end))+';run',{
    env:new Proxy({USE_BROWSERBASE:'false',REDACT_OUTPUT:String(redact)},{get:(obj,key)=>obj[key]??'false'}),
    StagehandCreateOptionsSchema:{parse:value=>value},
    Stagehand:{create:async()=>stagehand},localBrowser:{launch:async()=>browser},
    getActivePage:async()=>({}),assessSite:async()=>input,
    siteOrder:['hillsborough'],targetSites:{hillsborough:{label:'Fixture court'}},
    searchCriteria:{firstName:marker,lastName:marker},browserbaseProxyConfig:()=>({password:marker}),
    console:{log:message=>logs.push(message)},path,
    mkdirSync:directory=>fs.mkdirSync(path.join(dir,directory),{recursive:true}),
    writeFileSync:(filename,body)=>{const destination=path.join(dir,filename);fs.writeFileSync(destination,body);saved.push(destination);},
   });
   await run();
   assert.equal(saved.length,1);assert.equal(closed,2);
   const text=fs.readFileSync(saved[0],'utf8');const report=JSON.parse(text);
   assert.equal(text.includes(marker),!redact);
   assert.equal(report.privacy.mode,redact?'redacted':'unredacted');
   if(redact) {
    assert.deepEqual(report.assessments,[{site:'hillsborough',status:'results_with_records',controlCount:1,resultSummary:{recordCount:2,tableCount:1,linkCount:1}}]);
    assert.equal(report.searchCriteria,undefined);assert.equal(report.browserbase,undefined);
    // The final summary must also omit arbitrary blocker descriptions.
    assert(!logs.find(line=>line.startsWith('- ')).includes(marker));
   } else {assert.equal(report.searchCriteria.firstName,marker);assert.equal(report.assessments[0].resultSummary.visibleText,marker);}
   assert.equal(input.resultSummary.visibleText,marker);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
 });
}
