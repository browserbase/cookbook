const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const {stripTypeScriptTypes}=require('node:module');
const actual=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../src/02-agent-cache-test.ts'),'utf8')).replace(/^import .*;\n/gm,'');
for(const failure of ['launch','navigate'])test('actual repeated-agent CLI exits nonzero: '+failure,()=>{
 const prelude=`
 const counts={browser:0,stagehand:0};
 const browser={context:{pages:async()=>[{goto:async()=>{throw new Error('synthetic navigation failure')}}]},close:async()=>{counts.browser++}};
 const localBrowser={launch:async()=>{${failure==='launch'?"throw new Error('synthetic launch failure')":"return browser"}}};
 const Stagehand={create:async()=>({browser,close:async()=>{counts.stagehand++}})};
 const StagehandCreateOptionsSchema={parse:v=>v};
 process.on('beforeExit',()=>console.log('CLEANUP '+JSON.stringify(counts)));
 `;
 const child=spawnSync(process.execPath,['--input-type=commonjs'],{input:prelude+actual,encoding:'utf8',env:{},timeout:5000});
 assert.equal(child.error,undefined);assert.equal(child.status,1,child.stderr);assert.match(child.stderr,/synthetic .* failure/);
 const counts=JSON.parse(child.stdout.match(/CLEANUP (.*)/)[1]);assert.deepEqual(counts,{browser:failure==='launch'?0:1,stagehand:failure==='launch'?0:1});
});
