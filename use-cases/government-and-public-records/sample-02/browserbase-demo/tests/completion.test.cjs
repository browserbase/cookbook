const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../src/main.ts'),'utf8');
const a=source.indexOf('function completionStatus(');const b=source.indexOf('\nasync function ',a);
assert(a>=0&&b>a);
const classify=vm.runInNewContext(stripTypeScriptTypes(source.slice(a,b))+';completionStatus');
const base={tables:[],links:[],visibleText:''};
for(const [name,summary,expected] of [
 ['missing',undefined,'form_reached'],
 ['layout table',{...base,tables:[{headers:['Navigation'],rowCount:1}]},'form_reached'],
 ['empty table shell',{...base,tables:[{headers:['Case number'],rowCount:0}]},'form_reached'],
 ['model rows only',{...base,extracted:{visibleCaseRows:[{caseNumber:'fixture'}]}},'form_reached'],
 ['heading and navigation link',{...base,visibleText:'Search results',links:[{text:'View case search',href:'/case-search'}]},'form_reached'],
 ['positive observed count',{...base,recordCount:3},'results_with_records'],
 ['zero observed count',{...base,recordCount:0},'results_reached'],
 ['explicit empty',{...base,visibleText:'No matching records were found'},'results_reached'],
 ['loading with stale count',{...base,visibleText:'Results are loading',recordCount:3},'form_reached'],
 ['busy with stale zero',{...base,visibleText:'Search is in progress',recordCount:0},'form_reached'],
 ...[-1,NaN,Infinity,0.5,Number.MAX_SAFE_INTEGER+1].map(value=>[`invalid count ${value}`,{...base,recordCount:value},'form_reached']),
]) test(name,()=>assert.equal(classify(summary),expected));
