const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const {stripTypeScriptTypes}=require('node:module');
const raw=stripTypeScriptTypes(fs.readFileSync(process.env.CONTEXT_SOURCE || path.join(__dirname,'../linkedin-validator.ts'),'utf8'));
async function run(args,env){let selected,calls=0;const output=[];const c={process:{argv:['node','linkedin-validator.ts',...args],env:{BROWSERBASE_CONTEXT_ID:env}},console:{log:(...a)=>output.push(a.join(' '))},validateLinkedInProfile:async(_input,id)=>{calls++;selected=id;return {match:null,match_details:'Synthetic',duration_ms:0};}};
 const helper=raw.includes('function selectContextId')?raw.slice(raw.indexOf('function selectContextId'),raw.indexOf('// --- Main ---')):'';
 vm.runInNewContext(helper+raw.slice(raw.indexOf('async function main()'),raw.indexOf('export {')),c);
 try{await c.main();return {selected,calls,output};}catch(error){return {error,calls};}
}
for(const args of [['--context','synthetic-cli'],['--context=synthetic-cli']])test('actual main forwards CLI context over environment: '+args.join(' '),async()=>{const r=await run(args,'synthetic-env');assert.equal(r.selected,'synthetic-cli');assert.equal(r.calls,1);assert.ok(r.output.some(line=>line.includes('synthetic-cli')));});
test('environment fallback is forwarded',async()=>{assert.equal((await run([],'synthetic-env')).selected,'synthetic-env');});
test('missing context uses no persistent context',async()=>{const r=await run([]);assert.equal(r.selected,undefined);assert.equal(r.calls,1);});
for(const args of [['--context'],['--context='],['--context','bad id'],['--context','one','--context','two'],['--other'],['positional']])test('malformed CLI stops before validation: '+args.join(' '),async()=>{const r=await run(args);assert.ok(r.error);assert.equal(r.calls,0);});
test('malformed environment stops before validation',async()=>{const r=await run([],'bad id');assert.ok(r.error);assert.equal(r.calls,0);});
