import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core');
const base=fileURLToPath(new URL('../src/retail_demo/',import.meta.url));
const fixtures=JSON.parse(execFileSync('python3',['-c',`import runpy,json,sys
b=sys.argv[1]
h=runpy.run_path(b+'shelf/html.py');j=runpy.run_path(b+'stagehand_tools/inject.py')
print(json.dumps({'html':h['retailer_shelf_html'](),'inject':j['_INJECT_FN'],'final':j['FINAL_STATE_EXPRESSION']}))`,base],{encoding:'utf8'}));
async function fixture(run){const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});try{const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:fixtures.html}));await page.goto('https://synthetic.invalid');await run(page);}finally{await browser.close();}}
async function inject(page){const sku=await page.locator('[data-product-id]').first().getAttribute('data-product-id');const payload={verification_token:'synthetic-token',recommended_product_id:sku,segment:'Synthetic',budget_ceiling:100,signals:[{product_id:sku,affinity_score:99,reason:'Synthetic'}]};return {sku,receipt:await page.evaluate('('+fixtures.inject+')('+JSON.stringify(payload)+')')};}
function verdict(receipt,final,sku){return JSON.parse(execFileSync('python3',['-c',`import ast,json,sys,types
p=sys.argv[1]+'__main__.py';t=ast.parse(open(p).read());n={'RunState':object}
exec(compile(ast.Module(body=[x for x in t.body if isinstance(x,ast.FunctionDef) and x.name=='verification_errors'],type_ignores=[]),p,'exec'),n)
r,f,sku=json.load(sys.stdin);page=object();s=types.SimpleNamespace(injection_receipt=r,final_state=f,signal_response=types.SimpleNamespace(recommended_product_id=sku),page=page,injection_page=page)
print(json.dumps(n['verification_errors'](s)))`,base],{input:JSON.stringify([receipt,final,sku]),encoding:'utf8'}));}
test('actual shelf search, injection and cart click satisfy actual Python verification',async()=>fixture(async page=>{await page.locator('#apply-search').click();const {sku,receipt}=await inject(page);await page.locator(`[data-product-id="${sku}"] [data-action="add-to-cart"]`).click();const final=await page.evaluate(fixtures.final);assert.equal(final.verification.action.product_id,sku);assert.deepEqual(verdict(receipt,final,sku),[]);}));
test('cart selection before injection cannot pass even after another matching click',async()=>fixture(async page=>{await page.locator('#apply-search').click();await page.locator('[data-action="add-to-cart"]').first().click();const {sku,receipt}=await inject(page);await page.locator(`[data-product-id="${sku}"] [data-action="add-to-cart"]`).click();assert.ok(verdict(receipt,await page.evaluate(fixtures.final),sku).length);}));
test('injection without a subsequent click cannot pass',async()=>fixture(async page=>{await page.locator('#apply-search').click();const {sku,receipt}=await inject(page);assert.ok(verdict(receipt,await page.evaluate(fixtures.final),sku).length);}));
