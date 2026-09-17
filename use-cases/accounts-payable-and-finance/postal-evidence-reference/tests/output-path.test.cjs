const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../src/service.ts'),'utf8'));
const functions=source.slice(source.indexOf('export function filingDirectory')).replace(/export /g,'');
test('malformed filing and tracking IDs fail before cloud work',async()=>{
 let calls=0;const context=vm.createContext({path,Date,createSession:async()=>{calls++;throw new Error('unexpected cloud');}});
 vm.runInContext(functions,context);
 for(const filingId of ['../outside','a/b','a\\b','..','',{},'x\nOTHER=value']) await assert.rejects(context.takePostmarkScreenshot({filingId,trackingNumber:'123456',outDir:'/synthetic/out'}));
 await assert.rejects(context.takePostmarkScreenshot({filingId:'filing-1',trackingNumber:'../bad',outDir:'/synthetic/out'}));
 assert.equal(calls,0);
 assert.equal(context.filingDirectory('/synthetic/out','filing_123'),'/synthetic/out/filing_123');
});
