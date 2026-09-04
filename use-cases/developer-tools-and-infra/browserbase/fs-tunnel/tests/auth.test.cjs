const {test} = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const {createServer} = require('node:http');
const cfg = {tunnelUrl:'https://tunnel.example',headerName:'X-Tunnel-Test',secret:'synthetic-token'};
const load = () => import('../tunnel-auth.mjs');
class CDP extends EventEmitter {
  calls=[];
  async send(method,params){this.calls.push({method,params});}
}
const settled = () => new Promise(resolve=>setImmediate(resolve));

test('exact-origin headers, redirects and case-insensitive removal',async()=>{
 const {installTunnelAuth}=await load(), cdp=new CDP();
 const stop=await installTunnelAuth(cdp,cfg);
 for(const [index,url] of ['https://tunnel.example/a','https://tunnel.example:443/b','https://tunnel.example.evil.test/a','http://tunnel.example/a','https://tunnel.example:8443/a','https://elsewhere.example/a'].entries()){
   cdp.emit('Fetch.requestPaused',{requestId:String(index),request:{url,headers:{'x-TUNNEL-test':'stale-token',Accept:'text/html'}}});
 }
 await settled();
 const calls=cdp.calls.filter(c=>c.method==='Fetch.continueRequest');
 assert.equal(calls.length,6);
 calls.forEach((c,i)=>assert.deepEqual(c.params.headers,i<2?[{name:'Accept',value:'text/html'},{name:cfg.headerName,value:cfg.secret}]:[{name:'Accept',value:'text/html'}]));
 assert.deepEqual(cdp.calls.find(c=>c.method==='Network.setExtraHTTPHeaders').params,{headers:{}});
 await stop();assert.equal(cdp.listenerCount('Fetch.requestPaused'),0);
});
test('invalid config rejects before enabling; continuation failure blocks request',async()=>{
 const {installTunnelAuth}=await load(),cdp=new CDP();
 await assert.rejects(installTunnelAuth(cdp,{...cfg,tunnelUrl:'https://user:pass@tunnel.example'}));
 assert.equal(cdp.calls.length,0);
 let failures=0;
 const send=cdp.send.bind(cdp);
 cdp.send=async(method,params)=>{if(method==='Fetch.continueRequest')throw new Error('synthetic');return send(method,params)};
 await installTunnelAuth(cdp,cfg,()=>failures++);
 cdp.emit('Fetch.requestPaused',{requestId:'failed',request:{url:cfg.tunnelUrl,headers:{}}});
 await settled();assert.equal(failures,1);
 assert.equal(cdp.calls.at(-1).method,'Fetch.failRequest');
});

test('Chrome keeps synthetic auth off cross-origin resources and redirect hops', {skip:!process.env.COOKBOOK_TEST_CHROME},async()=>{
 const {chromium}=require('playwright-core'), {installTunnelAuth}=await load();
 const received=[]; let otherOrigin, tunnelOrigin;
 const server = label => createServer((req,res)=>{
   received.push({label,path:req.url,token:req.headers['x-tunnel-test']});
   if(label==='tunnel' && req.url==='/redirect'){
     res.writeHead(302,{Location:otherOrigin+'/return'});res.end();return;
   }
   if(label==='other' && req.url==='/return'){
     res.writeHead(302,{Location:tunnelOrigin+'/landed'});res.end();return;
   }
   res.setHeader('Content-Type','text/html');
   res.end(label==='tunnel' && req.url==='/'?`<img src="${otherOrigin}/image"><iframe src="${otherOrigin}/frame"></iframe>`:'synthetic');
 });
 const tunnel=server('tunnel'),other=server('other');
 const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 await Promise.all([listen(tunnel),listen(other)]);
 tunnelOrigin=`http://127.0.0.1:${tunnel.address().port}`;
 otherOrigin=`http://127.0.0.1:${other.address().port}`;
 let browser;
 try{
   browser=await chromium.launch({executablePath:process.env.COOKBOOK_TEST_CHROME,headless:true,args:['--disable-background-networking']});
   const context=await browser.newContext();const page=await context.newPage();
   const cdp=await context.newCDPSession(page);
   const stop=await installTunnelAuth(cdp,{...cfg,tunnelUrl:tunnelOrigin});
   await page.goto(tunnelOrigin+'/');
   await page.goto(tunnelOrigin+'/redirect');
   await page.goto(otherOrigin+'/direct');
   const second=await context.newPage();await second.goto(tunnelOrigin+'/new-tab');
   await stop();await page.goto(tunnelOrigin+'/detached');
   for(const path of ['/','/redirect','/landed'])assert.equal(received.find(r=>r.label==='tunnel'&&r.path===path)?.token,cfg.secret,path);
   for(const path of ['/image','/frame','/return','/direct']){
     const request=received.find(r=>r.label==='other'&&r.path===path);assert.ok(request,path);assert.equal(request.token,undefined,path);
   }
   for(const path of ['/new-tab','/detached'])assert.equal(received.find(r=>r.path===path)?.token,undefined,path);
 }finally{
   await browser?.close();
   await Promise.all([tunnel,other].map(s=>new Promise(resolve=>{s.close(resolve);s.closeAllConnections()})));
 }
});
