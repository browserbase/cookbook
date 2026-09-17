const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
for(const file of ['capture.mjs','capture-trace.mjs'])test(`${file} reports observed evidence without claiming diagnosis`,()=>{
 const source=fs.readFileSync(path.join(__dirname,'../runtime-demo',file),'utf8');
 const start=source.indexOf('function report('),end=source.indexOf('\nconsole.log(',start);
 const context={esc:s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])),cleanStack:String,SOURCE:'supplied fixture',BUG_LINE:1};
 vm.runInNewContext(source.slice(start,end),context);
 for(const present of [false,true])for(const pass of [false,true]){
  const tr={exceptions:present?[{text:'UnrelatedError: synthetic',title:'UnrelatedError: synthetic'}]:[],failures:[],events:0};
  const html=context.report({result:{pass,detail:pass?'task appeared':'timed out'},shot:''},tr);
  assert.doesNotMatch(html,/Root cause captured|one-shot fix|The runtime root cause/);
  assert.ok(html.includes(present?'1 exception(s), 0 network observation(s)':'No exception or network observations recorded'));
  assert.ok(html.includes('Fixture source and planted line (supplied ground truth)'));
  assert.ok(html.includes(pass?'UI assertion passed':'UI assertion failed'));
  assert.ok(html.includes('No diagnosis or repair was verified'));
 }
});
