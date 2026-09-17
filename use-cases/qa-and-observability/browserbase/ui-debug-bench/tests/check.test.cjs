const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../src/check.ts'),'utf8'))
 .replace(/^import .*;\n/gm,'').replace(/export async function/g,'async function');
async function run(raw){
 const calls=[];
 class StagehandHarness {
  async init(){calls.push('init')}
  async goto(){calls.push('goto')}
  async setViewportSize(){calls.push('viewport')}
  async evaluate(){calls.push('evaluate');return raw}
  async close(){calls.push('close')}
 }
 const context={StagehandHarness};vm.runInNewContext(source,context);
 const report=await context.runCheck({check:{expression:'synthetic',viewport:{width:800,height:600}},url:'https://synthetic.invalid'});
 assert.deepEqual(calls,['init','goto','viewport','evaluate','close']);
 return report;
}
test('genuine pass and fail preserve diagnostics',async()=>{
 for(const passed of [true,false]){
  const raw={passed,passCondition:'visible result',instructionToFixer:'check layout',measurements:{width:42}};
  const report=await run(raw);assert.equal(report.ok,passed);assert.equal(report.error,undefined);
  assert.equal(JSON.stringify(report.result),JSON.stringify(raw));
 }
});
test('malformed oracle values are errors, never successful checks',async()=>{
 for(const raw of [{passed:'false',passCondition:'visible'},null,undefined,[],true,'false',{},
  ...['false','true',0,1,null,{},[]].map(passed=>({passed,passCondition:'visible'})),
  {passed:true},{passed:true,passCondition:0},{passed:true,passCondition:'visible',instructionToFixer:3}]){
  const report=await run(raw);assert.equal(report.ok,false,JSON.stringify(raw));
  assert.equal(report.result,undefined);assert.match(report.error,/Invalid check result/);
 }
});
