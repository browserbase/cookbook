const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../src/orchestrator.ts'),'utf8'));
const fn=source.slice(source.indexOf('async function runAutobrowse('),source.indexOf('function createInvocationWorkspace('));
for(const fails of [false,true])test('orchestrator narration does not expose synthetic CDP credentials; startup failure='+fails,async()=>{
 const marker='synthetic-signing-marker',output=[];let args;
 const c={createInvocationWorkspace:()=>'/synthetic/invocation',path,TASK_NAME:'synthetic',EVALUATE_MJS:'/synthetic/evaluate.mjs',EVALUATE_ADAPTER:'/synthetic/adapter.mjs',process:{env:{},execPath:'/synthetic/node'},execFileSync(){},parseInvocationSummary:()=>null,
 console:{log:(...v)=>output.push(v.join(' '))},spawn:(_cmd,argv,options)=>{assert.equal(options.env.CA_EDD_CDP_URL,`wss://synthetic.invalid?signingKey=${marker}`);args=argv;return {on:(event,handler)=>{if(event===(fails?'error':'exit'))queueMicrotask(()=>handler(fails?Object.assign(new Error(marker),{spawnargs:argv}):0))}}}};
 vm.runInNewContext(fn,c);
 const call=c.runAutobrowse('/synthetic/workspace','synthetic-session',`wss://synthetic.invalid?signingKey=${marker}`);
 if(fails)await assert.rejects(call,error=>{assert.equal(error.message,'Autobrowse child process could not start');assert.ok(!JSON.stringify(error).includes(marker));return true});else await call;
 assert.ok(!output.join('\n').includes(marker));assert.ok(!output.join('\n').includes('wss://'));
 assert.ok(!JSON.stringify(args).includes(marker));
 assert.ok(!args.includes('--cdp'));
});

for (const code of [1, 2, null]) test(`failed evaluator (${code}) cannot read a stale successful summary`, async () => {
 let reads = 0;
 const c = { createInvocationWorkspace:()=>'/synthetic/invocation', path, TASK_NAME: 'synthetic', EVALUATE_MJS: '/synthetic/evaluator', EVALUATE_ADAPTER: '/synthetic/adapter',
  process: {env: {}, execPath: '/synthetic/node'}, execFileSync() {}, console: {log() {}},
  parseInvocationSummary() { reads++; return {success: true, reason: 'stale-account'}; },
  spawn() { return {on(event, handler) { if (event === 'exit') queueMicrotask(() => handler(code, code === null ? 'SIGTERM' : null)); }}; }
 };
 vm.runInNewContext(fn, c);
 await assert.rejects(c.runAutobrowse('/synthetic/workspace', 'synthetic-session', 'wss://synthetic.invalid?signingKey=synthetic'), /Autobrowse evaluator did not complete successfully/);
 assert.equal(reads, 0);
});
