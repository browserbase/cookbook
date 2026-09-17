const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../src/demo.ts'),'utf8'));
const actual=source.slice(source.indexOf('const ResultSchema'));
for(const failure of [null,'launch','config','create','pages','goto','agent','incomplete','success-false','completed-false','string-success','missing-output','invalid-output','cart-failed','stagehand-close','browser-close','agent-and-close'])test(`actual CLI: ${failure||'success'}`,()=>{
 const fixture=`const vm=require('node:vm'),{z}=require('zod');const failure=${JSON.stringify(failure)},events=[];const error=label=>new Error('synthetic-'+label);
 const browser={sessionId:'synthetic',context:{pages:async()=>{if(failure==='pages')throw error('pages');return [{goto:async()=>{if(failure==='goto')throw error('goto')},waitForTimeout:async()=>{}}]}},close:async()=>{events.push('browser-close');if(failure==='browser-close')throw error('browser-close')}};
 const stagehand={browser,close:async()=>{events.push('stagehand-close');if(['stagehand-close','agent-and-close'].includes(failure))throw error('stagehand-close')}};
 const ctx={z,process:{env:{},exit:code=>{process.exitCode=code}},console:{log:(...args)=>events.push(args.join(' ')),error:(...args)=>events.push(args.map(x=>x?.errors?x.errors.map(e=>e.message).join(','):x?.message||x).join(' '))},
 browserbase:{launch:async()=>{events.push('launch');if(failure==='launch')throw error('launch');return browser}},StagehandCreateOptionsSchema:{parse:x=>{if(failure==='config')throw error('config');return x}},Stagehand:{create:async()=>{if(failure==='create')throw error('create');return stagehand}},
 runBrowserTask:async()=>{if(['agent','agent-and-close'].includes(failure))throw error('agent');return {success:failure==='string-success'?'true':!['incomplete','success-false'].includes(failure),completed:!['incomplete','completed-false'].includes(failure),usage:{},output:failure==='missing-output'?undefined:failure==='invalid-output'?{recommendations:[]}:{magicApronResponse:'Synthetic recommendation',recommendations:[{name:'Synthetic shovel'}],addedToCart:{success:failure!=='cart-failed',productName:'Synthetic shovel'}}}}
 };vm.runInNewContext(${JSON.stringify(actual)},ctx);process.on('beforeExit',()=>console.log(JSON.stringify(events)));`;
 const child=cp.spawnSync(process.execPath,['-e',fixture],{encoding:'utf8',timeout:5000});
 assert.equal(child.status,failure?1:0,child.stderr+child.stdout);
 const events=JSON.parse(child.stdout.trim());
 assert.equal(events.filter(x=>x==='browser-close').length,failure==='launch'?0:1);
 assert.equal(events.filter(x=>x==='stagehand-close').length,['launch','config','create'].includes(failure)?0:1);
 assert.equal(events.some(x=>x.includes('✅ Done')),failure===null);
 if(!failure)assert.ok(events.findIndex(x=>x.includes('✅ Done'))>events.indexOf('browser-close'));
 if(failure==='agent-and-close'){assert.ok(events.some(x=>x.includes('synthetic-agent')));assert.ok(events.some(x=>x.includes('synthetic-stagehand-close')))}
});
