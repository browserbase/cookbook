const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {EventEmitter} = require('node:events');
const test = require('node:test');
function fixture(t, realHttp = false) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cookbook-static-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'assets'));
  for(const [name,bytes] of Object.entries({'index.html':'<meta name="demo-control-token" content="__DEMO_CONTROL_TOKEN__">','app.js':'synthetic script','styles.css':'synthetic css','assets/browserbase-logo.png':'synthetic image','.env':'SYNTHETIC_ONLY','server.js':'private source','.browserbase-agent.json':'{"agentId":"synthetic-id"}'})) fs.writeFileSync(path.join(root,name),bytes);
  const handlers=[]; let actualServer; let listenArgs; let providerCalls=0;
  const http={createServer(handler){handlers.push(handler); if (realHttp) { actualServer = require("node:http").createServer(handler); t.after(() => new Promise(resolve => actualServer.close(resolve))); return actualServer; } return {listen(...args){listenArgs=args;},close(){}}},request(){throw Error('Unexpected proxy request')}};
  const source=fs.readFileSync(process.env.COOKBOOK_R168_BASELINE || path.join(__dirname,'../server.js'),'utf8');
  const context=vm.createContext({require(name){return {http,fs,path,crypto:{randomUUID:()=> 'synthetic-control-token'},child_process:{spawn(){throw Error('Unexpected spawn')}}}[name] || require(name)},__dirname:root,process:{env:realHttp ? {PORT:"0"} : {},on(){}},console:{log(){},error(){}},URL,Buffer,setTimeout,clearTimeout,fetch(){providerCalls++;throw Error('Unexpected provider call')}});
  vm.runInContext(source,context);
  async function request(url, options={}) {
    let status,headers,body;const req=Object.assign(new EventEmitter(),{url,method:'GET',headers:{host:'127.0.0.1:4173',...options.headers}},options);req.headers={host:'127.0.0.1:4173',...options.headers};
    return new Promise((resolve,reject)=>{
      queueMicrotask(()=>req.emit("end"));
      try { Promise.resolve((options.handler||handlers[0])(req,{writeHead(s,h){status=s;headers=h||{};},end(x){body=x===undefined?'':String(x);resolve({status,headers,body});}})).catch(reject); } catch(error) { reject(error); }
    });
  }
  return {root,request,context,handlers,get actualServer(){return actualServer},get listenArgs(){return listenArgs},get providerCalls(){return providerCalls}};
}
test('binds exclusively to loopback',t=>{const f=fixture(t);assert.equal(f.listenArgs[1],'127.0.0.1');});
for(const url of ['/.env','/.browserbase-agent.json','/server.js','/package.json','/scripts/setup-agent.js','/runtime.json','/%2eenv','/assets/../.env','/api']) test(`does not serve private path ${url}`,async t=>{const f=fixture(t);const r=await f.request(url);assert.ok([403,404].includes(r.status));assert.ok(!r.body.includes('SYNTHETIC_ONLY'));assert.equal(f.providerCalls,0);});
for(const url of ['/','/index.html','/app.js','/styles.css','/assets/browserbase-logo.png']) test(`serves allowlisted asset ${url}`,async t=>{const f=fixture(t);const r=await f.request(url);assert.equal(r.status,200);assert.equal(r.headers['X-Content-Type-Options'],'nosniff');});
test('asset symlink cannot expose a private file',async t=>{const f=fixture(t);fs.unlinkSync(path.join(f.root,'app.js'));fs.symlinkSync(path.join(f.root,'.env'),path.join(f.root,'app.js'));assert.equal((await f.request('/app.js')).status,404);});
test('rejects unknown host before serving a token',async t=>{const f=fixture(t);const r=await f.request('/',{headers:{host:'attacker.invalid:4173'}});assert.equal(r.status,403);assert.ok(!r.body.includes('synthetic-control-token'));});
test('all control endpoints reject unauthenticated requests without provider calls',async t=>{const f=fixture(t);for(const [url,method] of [['/api/agent/config','GET'],['/api/agent/start','POST'],['/api/agent/runs/any','GET'],['/api/agent/runs/any/messages','GET']]) assert.equal((await f.request(url,{method})).status,403);assert.equal(f.providerCalls,0);});
test('local token authorizes config but foreign origin is forbidden',async t=>{const f=fixture(t);const page=await f.request('/');assert.ok(page.body.includes('synthetic-control-token'));const headers={'x-demo-control-token':'synthetic-control-token',origin:'http://127.0.0.1:4173'};assert.equal((await f.request('/api/agent/config',{headers})).status,200);for(const origin of ['null','https://attacker.invalid','http://127.0.0.1:4173.attacker.invalid']) assert.equal((await f.request('/api/agent/config',{headers:{...headers,origin}})).status,403);});
test('tunneled HTML contains no local control token and API stays forbidden',async t=>{const f=fixture(t);for(const url of ['/','/index.html']){const r=await f.request(url,{headers:{'x-demo-tunnel':'synthetic'}});assert.equal(r.status,200);assert.ok(!r.body.includes('synthetic-control-token'));}assert.equal((await f.request('/api/agent/config',{headers:{'x-demo-tunnel':'synthetic','x-demo-control-token':'synthetic-control-token'}})).status,403);});
test('tunnel proxy rejects control endpoints even with its authentication cookie',async t=>{const f=fixture(t);vm.runInContext('createTunnelProxy("synthetic-tunnel-secret")',f.context);for(const url of ['/api','/api/agent/start','/api/agent/config']){const r=await f.request(url,{handler:f.handlers[1],headers:{cookie:'bb-tunnel-auth=synthetic-tunnel-secret'}});assert.equal(r.status,403);}});
test('HEAD omits body and unsupported asset methods fail',async t=>{const f=fixture(t);assert.equal((await f.request('/',{method:'HEAD'})).body,'');assert.equal((await f.request('/',{method:'POST'})).status,405);});
test('browser control wrapper forwards token and preserves request headers',async ()=>{const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').split('\n\n')[0];let call;const context=vm.createContext({document:{querySelector:()=>({content:'synthetic-token'})},fetch:(...args)=>{call=args;}});vm.runInContext(source,context);context.agentFetch('/api/agent/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(call[1].headers['X-Demo-Control-Token'],'synthetic-token');assert.equal(call[1].headers['Content-Type'],'application/json');});

test('actual loopback HTTP server serves UI and rejects private paths and control calls',async t=>{
  const f=fixture(t,true); await require('node:events').once(f.actualServer,'listening');
  assert.equal(f.actualServer.address().address,'127.0.0.1');
  const port=f.actualServer.address().port;
  const request=(url,headers={})=>new Promise((resolve,reject)=>{const req=require('node:http').get({host:'127.0.0.1',port,path:url,headers:{host:'127.0.0.1:0',...headers}},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body}));});req.on('error',reject);});
  assert.equal((await request('/')).status,200);
  assert.equal((await request('/.env')).status,404);
  assert.equal((await request('/server.js')).status,404);
  assert.equal((await request('/api/agent/config')).status,403);
  assert.equal((await request('/api/agent/config',{'x-demo-control-token':'synthetic-control-token'})).status,200);
  assert.equal(f.providerCalls,0);
});
