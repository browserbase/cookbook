const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),http=require('node:http');
const {checkAccess,validSites}=require('../dist/access.js');
test('browser Basic authentication carries through dashboard, same-origin fetch and report navigation', {skip:!process.env.COOKBOOK_TEST_CHROME || !process.env.COOKBOOK_TEST_PLAYWRIGHT_MODULE},async t=>{
 const {chromium}=require(process.env.COOKBOOK_TEST_PLAYWRIGHT_MODULE);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cookbook-auth-http-'));
 const token='d'.repeat(64),env={BENCHMARK_ACCESS_TOKEN:token};let browser,server;
 const source=fs.readFileSync(path.join(__dirname,'../dist/server.js'),'utf8');
 const code=source.slice(0,source.indexOf('const PORT =')).replace(/^import .*;\r?\n/gm,'');
 const context={...fs,...path,URLSearchParams,Buffer,checkAccess,validSites,process:{env,cwd:()=>root},console:{error(){},log(){}},generateReportHtml:()=>'<p>Synthetic report</p>'};
 vm.runInNewContext(code,context);
 fs.mkdirSync(path.join(root,'results'));fs.writeFileSync(path.join(root,'results','synthetic.json'),JSON.stringify([{competitor:'synthetic',site:'https://example.invalid'}]));
 try{
  server=http.createServer((req,res)=>context.handler(req,res).catch(()=>{res.writeHead(500);res.end('fixture error')}));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${server.address().port}`;env.BENCHMARK_PUBLIC_ORIGIN=origin;
  assert.equal((await fetch(origin+'/runs')).status,401);
  browser=await chromium.launch({executablePath:process.env.COOKBOOK_TEST_CHROME,headless:true,args:['--disable-background-networking']});
  const browserContext=await browser.newContext({httpCredentials:{username:'benchmark',password:token}});
  await browserContext.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await browserContext.newPage();assert.equal((await page.goto(origin)).status(),200);
  assert.equal(await page.evaluate(()=>fetch('/status').then(r=>r.status)),200);
  const [popup]=await Promise.all([page.waitForEvent('popup'),page.getByRole('link',{name:'View Report →'}).click()]);
  await popup.waitForLoadState();assert.match(await popup.textContent('body'),/Synthetic report/);
  assert.equal(await page.evaluate(()=>fetch('/run',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"runs":0}'}).then(r=>r.status)),400);
  assert.equal((await fetch(origin+'/run',{method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://unrelated.invalid'},body:'{}'})).status,403);
 }finally{
  await browser?.close();
  if(server)await new Promise(r=>{server.close(r);server.closeAllConnections()});
  fs.rmSync(root,{recursive:true,force:true});
 }
});
