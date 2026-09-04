const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const {stripTypeScriptTypes}=require('node:module');
const read=name=>stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../src',name),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
const actual=read('shared/stagehand-init.ts')+'\n'+read('approach-a/run.ts');
for(const failure of ['none','launch','create','headers','tools','generate','stageclose','browserclose'])test('actual QA CLI exit and cleanup: '+failure,()=>{
 const prelude=`
 const failure=${JSON.stringify(failure)},counts={browser:0,stagehand:0};
 const reject=step=>{if(failure===step)throw new Error('synthetic '+step)};
 const browser={context:{activePage:async()=>({setExtraHTTPHeaders:async()=>reject('headers')})},close:async()=>{counts.browser++;reject('browserclose')}};
 const stagehand={browser,close:async()=>{counts.stagehand++;reject('stageclose')}};
 const browserbase={launch:async()=>{reject('launch');return browser}};
 const Stagehand={create:async()=>{reject('create');return stagehand}};
 const StagehandCreateOptionsSchema={parse:v=>v};
 const createTools=async()=>{reject('tools');return {}};
 const generateText=async()=>{reject('generate');return {text:'synthetic',steps:[]}};
 const anthropic=()=>({}),stepCountIs=()=>({});
 process.on('beforeExit',()=>console.log('CLEANUP '+JSON.stringify(counts)));
 `;
 const child=spawnSync(process.execPath,['--input-type=commonjs'],{input:prelude+actual,encoding:'utf8',env:{},timeout:5000});
 assert.equal(child.error,undefined);assert.equal(child.status,failure==='none'?0:1,child.stderr);
 const counts=JSON.parse(child.stdout.match(/CLEANUP (.*)/)[1]);
 assert.deepEqual(counts,{browser:failure==='launch'?0:1,stagehand:['launch','create'].includes(failure)?0:1});
 if(failure!=='none')assert.match(child.stderr,new RegExp('synthetic '+failure));
});
