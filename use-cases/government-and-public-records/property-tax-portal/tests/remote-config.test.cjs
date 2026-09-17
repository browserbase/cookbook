const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../automate.ts'),'utf8');const a=source.indexOf('function remoteConfiguration(');const b=source.indexOf('\nasync function main(',a);assert(a>=0&&b>a);
const read=vm.runInNewContext(stripTypeScriptTypes(source.slice(a,b))+';remoteConfiguration',{URL});
const valid={PORTAL_URL:'https://portal.example.test/',BROWSERBASE_CONTEXT_ID:'fixture-context',BROWSERBASE_API_KEY:'synthetic',OPENAI_API_KEY:'synthetic'};
test('valid remote origin and context are normalized',()=>assert.deepEqual(JSON.parse(JSON.stringify(read(valid))),{portalUrl:'https://portal.example.test',contextId:'fixture-context'}));
for(const key of Object.keys(valid))test(`missing ${key} rejects`,()=>assert.throws(()=>read({...valid,[key]:' '}),new RegExp(key)));
for(const url of ['http://localhost:3000','http://localhost.:3000','http://127.0.0.1:3000','http://2130706433:3000','http://[::1]','http://[::ffff:127.0.0.1]','http://0.0.0.0','file:///tmp/fixture','https://user:secret@portal.example.test','https://portal.example.test/path','https://portal.example.test?query=x','https://portal.example.test/#hash'])test(`reject unsuitable origin ${url}`,()=>assert.throws(()=>read({...valid,PORTAL_URL:url})));
test('invalid config stops the actual main before browser allocation',async()=>{
 const end=source.indexOf('\nmain()',b);assert(end>b);let launched=0;
 const main=vm.runInNewContext(stripTypeScriptTypes(source.slice(a,end))+';main',{URL,process:{env:{...valid,PORTAL_URL:'http://localhost:3000'}},browserbase:{launch:async()=>{launched++;}},console:{log:()=>{}}});
 await assert.rejects(main(),/loopback/);assert.equal(launched,0);
});
