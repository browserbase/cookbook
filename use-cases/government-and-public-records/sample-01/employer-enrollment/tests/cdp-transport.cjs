const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const cp=require('node:child_process');
const connection='wss://synthetic.invalid/connect?signingKey=synthetic-cdp-secret&sessionId=synthetic';

test('real child receives credential in memory; OS argv and evaluator output stay redacted',async()=>{
 const {installBrowseTransport,CONNECTION_MARKER}=await import('../scripts/cdp-transport.mjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cookbook-cdp-transport-'));
 const entry=path.join(dir,'synthetic-browse.mjs');
 fs.writeFileSync(entry,`import {execFileSync} from 'node:child_process';
 const osArgs=execFileSync('/bin/ps',['-p',String(process.pid),'-o','command='],{encoding:'utf8'});
 console.log(JSON.stringify({received:process.argv[process.argv.indexOf('--cdp')+1]===${JSON.stringify(connection)},osArgs,secretEnvRemoved:!process.env.CA_EDD_CDP_URL,endpoint:process.argv[process.argv.indexOf('--cdp')+1]}));
 if(process.argv.includes('fail')){console.error('synthetic-cdp-secret');process.exitCode=1;}`);
 const native=cp.execFileSync;let launched;
 const restore=installBrowseTransport({connection,browseEntry:entry,execFileSync:(command,args,options)=>{launched={command,args};return native(command,args,options)}});
 try{
  const output=cp.execFileSync('browse',['snapshot','--cdp',CONNECTION_MARKER],{encoding:'utf8'});
  const observed=JSON.parse(output);assert.equal(observed.received,true);assert.equal(observed.secretEnvRemoved,true);
  assert.ok(!JSON.stringify(launched).includes('synthetic-cdp-secret'));
  assert.ok(!observed.osArgs.includes('synthetic-cdp-secret'));assert.ok(!output.includes('synthetic-cdp-secret'));
  assert.equal(observed.endpoint,'[REDACTED]');
  assert.throws(()=>cp.execFileSync('browse',['fail','--cdp',CONNECTION_MARKER],{encoding:'utf8'}),error=>{
   assert.equal(error.message,'Browse command failed');assert.equal(error.status,1);
   assert.ok(!JSON.stringify(error).includes('synthetic-cdp-secret'));return true;
  });
  assert.throws(()=>cp.execFileSync('browse',['snapshot','--cdp','wss://other.invalid']),/owned CDP/);
 }finally{restore();fs.rmSync(dir,{recursive:true,force:true})}
});

test('installed evaluator command path uses marker and sanitizes browser errors before returning trace data',async()=>{
 const {installBrowseTransport,CONNECTION_MARKER}=await import('../scripts/cdp-transport.mjs');
 const installed=(process.env.CA_EDD_EVALUATOR_PATH || path.join(os.homedir(),'.claude/skills/autobrowse/scripts/evaluate.mjs'));
 const source=fs.readFileSync(installed,'utf8');
 const start=source.indexOf('const PAGE_DRIVING_VERBS');
 const end=source.indexOf('function buildSystemPrompt',start);
 assert.ok(start>=0&&end>start);
 const seen=[];
 const restore=installBrowseTransport({connection,browseEntry:'/synthetic/browse.mjs',execFileSync:(file,args)=>{seen.push(args);throw Object.assign(new Error(connection),{stderr:'failed synthetic-cdp-secret',status:1})}});
 try{
  const c={crypto:require('node:crypto'),execFileSync:cp.execFileSync,parseCommand:()=>({args:['browse','snapshot']}),ALLOWED_COMMAND:'browse',EXEC_TIMEOUT_MS:1000};
  vm.runInNewContext(source.slice(start,end),c);
  const result=c.executeCommand('browse snapshot',CONNECTION_MARKER);
  assert.equal(result.error,true);assert.equal(result.output,'failed [REDACTED]');
  assert.ok(!JSON.stringify(seen).includes('synthetic-cdp-secret'));
  assert.ok(seen[0].includes(CONNECTION_MARKER));assert.ok(seen[0].includes('--session'));
 }finally{restore()}
});

test('installed daemon launcher also keeps credential out of daemon OS argv',async()=>{
 const {installBrowseTransport,CONNECTION_MARKER}=await import('../scripts/cdp-transport.mjs');
 const executable=(process.env.PATH||'').split(path.delimiter).filter(Boolean).map(dir=>path.join(dir,'browse')).find(file=>fs.existsSync(file));
 assert.ok(executable,'Install the compatible browse CLI before running transport tests');
 const root=path.dirname(path.dirname(fs.realpathSync(executable)));
 const installed=fs.readFileSync(path.join(root,'dist/lib/driver/daemon/client.js'),'utf8');
 const actual=installed.slice(installed.indexOf('function spawnDaemon('),installed.indexOf('async function waitForSocketReady('));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cookbook-daemon-transport-'));
 const entry=path.join(dir,'browse.mjs'),resultPath=path.join(dir,'result.json');
 fs.writeFileSync(entry,`import {spawn,execFileSync} from 'node:child_process';import fs from 'node:fs';
 const resultPath=${JSON.stringify(resultPath)};
 ${actual}
 if(process.argv[2]==='daemon'){
  const target=JSON.parse(process.argv[process.argv.indexOf('--target')+1]);
  const osArgs=execFileSync('/bin/ps',['-p',String(process.pid),'-o','command='],{encoding:'utf8'});
  fs.writeFileSync(resultPath,JSON.stringify({received:target.endpoint===${JSON.stringify(connection)},osArgs,envRemoved:!process.env.CA_EDD_CDP_URL}));
 }else{
  spawnDaemon('synthetic',{kind:'cdp',endpoint:process.argv[process.argv.indexOf('--cdp')+1]});
  const deadline=Date.now()+3000;while(!fs.existsSync(resultPath)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
  console.log(fs.readFileSync(resultPath,'utf8'));
 }`);
 const restore=installBrowseTransport({connection,browseEntry:entry});
 try{
  const output=JSON.parse(cp.execFileSync('browse',['snapshot','--cdp',CONNECTION_MARKER],{encoding:'utf8',timeout:5000}));
  assert.equal(output.received,true);assert.equal(output.envRemoved,true);
  // Read the synthetic fixture directly as well, so redaction cannot hide a leak.
  const raw=JSON.parse(fs.readFileSync(resultPath,'utf8'));assert.ok(!raw.osArgs.includes('synthetic-cdp-secret'));
 }finally{restore();fs.rmSync(dir,{recursive:true,force:true})}
});


test('compatibility preflight accepts reviewed installation and rejects changed evaluator before execution',()=>{
 const adapter=path.join(__dirname,'../scripts/evaluate-cdp.mjs');
 const evaluator=(process.env.CA_EDD_EVALUATOR_PATH || path.join(os.homedir(),'.claude/skills/autobrowse/scripts/evaluate.mjs'));
 const good=cp.spawnSync(process.execPath,[adapter,'--check','--evaluate-entry',evaluator],{encoding:'utf8',env:{PATH:process.env.PATH},timeout:5000});
 assert.equal(good.status,0,good.stderr);assert.match(good.stdout,/compatibility verified/);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cookbook-cdp-compat-'));
 try{
  const changed=path.join(dir,'evaluate.mjs');fs.writeFileSync(changed,'throw new Error("SHOULD_NOT_EXECUTE");');
  const bad=cp.spawnSync(process.execPath,[adapter,'--check','--evaluate-entry',changed],{encoding:'utf8',env:{PATH:process.env.PATH,CA_EDD_CDP_URL:connection},timeout:5000});
  assert.equal(bad.status,1);assert.doesNotMatch(bad.stdout+bad.stderr,/synthetic-cdp-secret|SHOULD_NOT_EXECUTE/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
