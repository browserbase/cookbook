const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {checkAccess,validSites}=require('../dist/access.js');
const token='b'.repeat(64), origin='https://benchmark.example';
function fixture(env={BENCHMARK_ACCESS_TOKEN:token,BENCHMARK_PUBLIC_ORIGIN:origin}){
 const source=fs.readFileSync(path.join(__dirname,'../dist/server.js'),'utf8');
 const code=source.slice(0,source.indexOf('const PORT =')).replace(/^import .*;\r?\n/gm,'');
 let dispatches=0;
 const context={checkAccess,validSites,Buffer,URLSearchParams,randomUUID:require('node:crypto').randomUUID,process:{env},console:{error(){},log(){}},discoverScenarios:async()=>[],discoverCompetitors:async()=>[],runBenchmark:()=>{dispatches++;return new Promise(()=>{})}};
 vm.runInNewContext(code,context);
 return {dispatches:()=>dispatches,async request(url,headers={},body){
   const req=Object.assign(new EventEmitter(),{url,headers,method:body===undefined?'GET':'POST'});
   const res={headers:{},setHeader(name,value){this.headers[name]=value},writeHead(status){this.status=status},end(body){this.body=JSON.parse(body)}};
   const finished=context.handler(req,res);
   if(body!==undefined){req.emit('data',body);req.emit('end')}
   await finished;await new Promise(r=>setImmediate(r));return res;
 }};
}
test('all protected routes reject anonymous/wrong credentials before reading data or scheduling',async()=>{
 for(const url of ['/','/status','/runs','/report','/results?runId=synthetic','/run']){
   for(const authorization of [undefined,'Bearer '+'c'.repeat(64)]){
     const f=fixture(), res=await f.request(url,{authorization},url==='/run'?'{}':undefined);
     assert.equal(res.status,401,url);assert.match(res.headers['WWW-Authenticate'],/^Basic/);assert.equal(f.dispatches(),0);
   }
 }
 const f=fixture({});assert.equal((await f.request('/status')).status,503);assert.equal((await f.request('/health')).status,200);
});
test('Basic browser and Bearer API access; cross-origin writes denied',async()=>{
 for(const authorization of ['Bearer '+token,'Basic '+Buffer.from('benchmark:'+token).toString('base64')]){
   const f=fixture();assert.equal((await f.request('/status',{authorization})).status,200);
   assert.equal((await f.request('/run',{authorization,origin:'https://unrelated.example'},'{}')).status,403);
   assert.equal((await f.request('/run',{authorization,'sec-fetch-site':'cross-site'},'{}')).status,403);
   assert.equal(f.dispatches(),0);
   assert.equal((await f.request('/run',{authorization,origin},JSON.stringify({sites:'https://site.example',runs:1}))).status,202);
   assert.equal(f.dispatches(),1);
 }
});
test('bounded URLs, counts and body reject before scheduling and leave next request available',async()=>{
 const cases=[{sites:'file:///tmp/test'},{sites:'https://user:pass@site.example'}, {sites:Array.from({length:11},(_,i)=>`https://site${i}.example`).join(',')},{sites:'https://site.example,https://site.example'},{sites:'https://site.example',runs:101},{sites:'https://site.example',runs:-1},{sites:'https://site.example',runs:1.5}];
 for(const body of [...cases.map(JSON.stringify),' '.repeat(17000)]){
   const f=fixture(), headers={authorization:'Bearer '+token};
   assert.equal((await f.request('/run',headers,body)).status,400);assert.equal(f.dispatches(),0);
   assert.equal((await f.request('/run',headers,'{"sites":"https://site.example","runs":1}')).status,202);
 }
});
