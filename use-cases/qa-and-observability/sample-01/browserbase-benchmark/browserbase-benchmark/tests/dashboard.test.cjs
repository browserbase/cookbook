const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const path=require('node:path');
const test=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'../dist/server.js'),'utf8');
const start=source.indexOf('function dashboardHtml(');
const end=source.indexOf('async function handler(', start);
assert.ok(start >= 0 && end > start);
const generator={process:{env:{}}};
vm.runInNewContext(source.slice(start,end),generator);
const script=generator.dashboardHtml([],'idle').match(/<script>([\s\S]*?)<\/script>/)[1];
async function trial(states){
 const elements=new Map();let submit,reloads=0,interval;
 const context={document:{getElementById(id){if(!elements.has(id))elements.set(id,{style:{},value:id==='runs'?'1':'https://example.invalid',checked:true,addEventListener(event,fn){submit=fn;}});return elements.get(id);}},fetch:async url=>url==='/run'?{ok:true}:{json:async()=>({state:states.shift()})},setInterval(fn){interval=fn;return 1;},clearInterval(){},location:{reload(){reloads++;}}};
 vm.runInNewContext(script,context);
 await new Promise(resolve=>setImmediate(resolve));
 await submit({preventDefault(){}});
 await interval();
 if(states.length)await interval();
 return {reloads,badge:elements.get('status-badge').textContent,buttonDisabled:elements.get('start-btn').disabled};
}
test('refreshes reports when the accepted run completes before the first poll', async()=>{
 const result=await trial(['idle','done']);
 assert.equal(result.reloads,1);
 assert.equal(result.badge,'● Complete');
 assert.equal(result.buttonDisabled,false);
});
test('refreshes reports after observing a running run', async()=>{
 const result=await trial(['idle','running','done']);
 assert.equal(result.reloads,1);
});
