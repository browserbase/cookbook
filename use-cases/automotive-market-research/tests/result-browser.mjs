import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=await import(process.env.COOKBOOK_PLAYWRIGHT_MODULE || 'playwright-core');
const browser=await chromium.launch({headless:true,executablePath:process.env.COOKBOOK_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  const sourceUrl='https://fred.stlouisfed.org/graph/fredgraph.csv?id=MCOILWTICO';
  const output={success:true,runtimeCalculationUsed:true,sourceUrl,indexSeries:'MCOILWTICO',previousObservationDate:'2026-05-01',previousObservationValue:100,latestObservationDate:'2026-06-01',latestObservationValue:120,indexChangePct:20,contractId:'PC-2026-03782',itemId:'99999',adjustments:[{condition:'9977',reason:'8985',newPrice:.457,effectiveDate:'07-01-2026'}],totalPrice:87.557,verification:'Synthetic observed condition and total match.'};
  output.calculationArtifact=JSON.stringify({...output,currentPrice:.415,passThrough:.5,baselineTotal:87.515,condition:'9977',reason:'8985',effectiveDate:'07-01-2026',validTo:'12-31-2026',newPrice:.457});
  let successful=false;
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='http://fixture.invalid')return route.abort();
    if(url.pathname.startsWith('/api/')){
      assert.equal(route.request().headers()['x-demo-control-token'],'synthetic-token');
      const result=url.pathname.endsWith('/start')?{runId:'synthetic'}:url.pathname.endsWith('/messages')?[]:{status:'COMPLETED',result:{output:{...output,success:successful,verification:successful?output.verification:'<img src=x onerror="window.injected=true">Unable to verify'}}};
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
    }
    const files={'/':'index.html','/app.js':'app.js','/styles.css':'styles.css','/assets/browserbase-logo.png':'assets/browserbase-logo.png'};
    const file=files[url.pathname];if(!file)return route.abort();
    let body=fs.readFileSync(new URL('../'+file,import.meta.url));
    if(file==='index.html')body=Buffer.from(body.toString().replace('__DEMO_CONTROL_TOKEN__','synthetic-token'));
    return route.fulfill({status:200,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html',body});
  });
  await page.goto('http://fixture.invalid');
  await page.locator('#agentToggle').click();
  await page.locator('#runButton').click();
  await page.waitForFunction(()=>document.getElementById('statusLabel').textContent==='Failed');
  assert.equal(await page.locator('#reviewCard').isVisible(),false);
  assert.equal(await page.locator('#runButton').isEnabled(),true);
  assert.match(await page.locator('#toast').textContent(),/Result not accepted/);
  assert.equal(await page.evaluate(()=>window.injected),undefined);
  assert.equal(await page.locator('#steps img').count(),0);
  successful=true;
  await page.locator('#runButton').click();
  await page.locator('#reviewCard').waitFor({state:'visible'});
  assert.match(await page.locator('#toast').textContent(),/agent reports/);
  await page.locator('#reviewButton').click();
  assert.match(await page.locator('.review-modal').textContent(),/87.557/);
  assert.deepEqual(errors,[]);
  console.log('Rendered failure, retry, accepted result and review verified in local Chrome with synthetic API responses. No external requests.');
} finally {await browser.close();}
