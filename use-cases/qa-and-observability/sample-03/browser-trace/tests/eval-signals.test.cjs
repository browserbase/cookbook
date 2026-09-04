const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../eval/run-eval.mjs'),'utf8');
async function fixture(pages){
 const {CASES,dataUrlFor}=await import('../eval/cases.mjs');
 const context={CASES:structuredClone(CASES),dataUrlFor,BT:'/synthetic',RUN:'synthetic',O11Y:'/synthetic/',
  rmSync(){},sh:cmd=>cmd.startsWith('browse cloud sessions get')?JSON.stringify({connectUrl:'ws://synthetic.invalid'}):'',
  readFileSync:p=>JSON.stringify(p.endsWith('manifest.json')?{browserbase:{session_id:'synthetic'}}:{pages:pages(CASES,dataUrlFor),totalEvents:2}),
  lines:p=>p.endsWith('console/logs.jsonl')?[{params:{type:'error',args:[{value:'unrelated console event'}]}}]:[],
  esc:s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))};
 vm.runInNewContext(source.slice(source.indexOf('function tracePass('),source.indexOf("\nconsole.log('A)")),context);
 return context;
}
test('exact URL mapping preserves missing/reordered/extra cases and all signal categories',async()=>{
 const c=await fixture((cases,url)=>[
  {pageId:9,url:url(cases[4])},{pageId:1,url:'data:text/html,unrelated'},
  {pageId:2,url:url(cases[1])}]);
 const tr=c.tracePass();
 assert.equal(tr.out.c1.state,'missing');assert.equal(tr.out.c2.state,'captured');
 assert.equal(tr.out.c5.state,'captured');assert.equal(tr.mapped,2);assert.equal(tr.unexpected,1);
 for(const id of ['c2','c5']){
  assert.equal(tr.out[id].signalCount,1);assert.match(tr.out[id].detail,/console: unrelated/);
  assert.equal(tr.out[id].root,undefined);
 }
 const before=JSON.stringify(tr.out);
 for(const item of c.CASES)item.truth.signal='different';
 assert.equal(JSON.stringify(c.tracePass().out),before);
 const html=c.report({},tr);
 assert.ok(html.includes('2/2'));assert.ok(html.includes('4 cases unavailable'));assert.ok(html.includes('1 unexpected data pages excluded'));
 assert.ok(html.includes('No diagnosis or repair was verified'));
 assert.ok(html.includes('Supplied fixture ground truth:'));
 assert.doesNotMatch(html,/surfaced the root cause|agent is blind|root cause<\/span>/);
});
test('duplicate matches are ambiguous and empty mapped captures stay empty',async()=>{
 const c=await fixture((cases,url)=>[{pageId:1,url:url(cases[0])},{pageId:2,url:url(cases[0])},{pageId:3,url:url(cases[1])}]);
 c.lines=()=>[];
 const tr=c.tracePass();assert.equal(tr.out.c1.state,'ambiguous');assert.equal(tr.out.c1.captured,null);
 assert.equal(tr.out.c2.signalCount,0);assert.equal(tr.mapped,1);
 const html=c.report({c2:{pass:true,msg:'observed pass'}},tr);
 assert.ok(html.includes('0/1'));assert.ok(html.includes('5 cases unavailable'));
 assert.ok(html.includes('Assertion passed'));assert.ok(html.includes('No error signals recorded'));
});
