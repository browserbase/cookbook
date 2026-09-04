// Node24: node --test tests/travel-portal-auth.test.mjs. Optional PLAYWRIGHT_MODULE_PATH and CHROME_EXECUTABLE_PATH enable local DOM coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes,createRequire} from 'node:module';
const source=stripTypeScriptTypes(fs.readFileSync(new URL('../travel-portal-auth.ts',import.meta.url),'utf8'));
const {classifyTravelPortalAuth,readTravelPortalAuthEvidence}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const valid={url:'https://app.travel.example/app/flights',text:'Book a flight',signInControls:false,accountControls:true,travelControls:true};
test('positive account and travel workspace evidence passes exact app origin',()=>{assert.equal(classifyTravelPortalAuth(valid),'authenticated');for(const path of ['/app','/app/'])assert.equal(classifyTravelPortalAuth({...valid,url:'https://app.travel.example'+path}),'authenticated');});
for(const url of ['http://app.travel.example/app','https://app.travel.example.evil.invalid/app','https://app.travel.example@evil.invalid/app','https://user@app.travel.example/app','https://app.travel.example:443/app','https://app.travel.example:8443/app','https://app.travel.example/application','https://app.travel.example/','https://travel.example/app','not a URL'])test(`misleading or non-workspace URL stays unknown: ${url}`,()=>{assert.equal(classifyTravelPortalAuth({...valid,url}),'unknown');});
for(const text of ['Sign in to continue','Sign up','Log in','Create an account','Enter the verification code','Check your email','MFA required','Security check','Two-factor authentication','CAPTCHA'])test(`gate text excludes authentication: ${text}`,()=>{assert.equal(classifyTravelPortalAuth({...valid,text}),'unauthenticated');});
test('body length and one-sided controls never establish readiness',()=>{assert.equal(classifyTravelPortalAuth({...valid,text:'Welcome '.repeat(1000),accountControls:false}),'unknown');assert.equal(classifyTravelPortalAuth({...valid,travelControls:false}),'unknown');assert.equal(classifyTravelPortalAuth({...valid,signInControls:true}),'unauthenticated');});
const require=createRequire(import.meta.url);let pw=process.env.PLAYWRIGHT_MODULE_PATH;if(!pw){try{pw=require.resolve('playwright-core');}catch{}}
const chrome=process.env.CHROME_EXECUTABLE_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
test('actual DOM collector uses visible controls without reading credentials',{skip:!(pw&&fs.existsSync(chrome))?'Set installed Playwright and Chrome paths for local DOM tests':false},async t=>{
 const {chromium}=require(pw);const browser=await chromium.launch({executablePath:chrome,headless:true});
 try{const page=await browser.newPage();
 const read=async html=>{await page.setContent(html);const evidence=await page.evaluate(readTravelPortalAuthEvidence);return {...evidence,url:valid.url};};
 for(const [name,html,expected] of [
  ['workspace','<button aria-label="Account menu"></button><a href="#">Flights</a>','authenticated'],
  ['search workspace','<button>Log out</button><input aria-label="Origin"><input aria-label="Destination">','authenticated'],
  ['generic profile update is not an account menu','<button>Update profile for everyone</button><a href="#">Flights</a>','unknown'],
  ['display contents gate','<span style="display:contents">Sign in</span><button>Profile</button><a href="#">Flights</a>','unauthenticated'],
  ['text-only landing page','<h1>Welcome to TravelPortal</h1><p>Account Flights Book travel</p>','unknown'],
  ['hidden account','<button hidden>Profile</button><a href="#">Flights</a>','unknown'],
  ['hidden ancestor','<div style="display:none"><button>Profile</button></div><a href="#">Flights</a>','unknown'],
  ['transparent account','<button style="opacity:0">Profile</button><a href="#">Flights</a>','unknown'],
  ['hidden signin ignored','<button>Profile</button><a href="#">Flights</a><input type="password" style="display:none">','authenticated'],
  ['password form','<button>Profile</button><a href="#">Flights</a><input type="password" value="PRIVATE_SYNTHETIC_PASSWORD">','unauthenticated'],
  ['email form','<button>Account</button><a href="#">Flights</a><input type="email" value="PRIVATE_SYNTHETIC_EMAIL">','unauthenticated'],
  ['username form','<input autocomplete="username" value="PRIVATE_SYNTHETIC_USERNAME"><button>Profile</button><a href="#">Flights</a>','unauthenticated'],
  ['SSO button','<button>SSO</button><button>Profile</button><a href="#">Flights</a>','unauthenticated'],
  ['signup','<h1>Sign up</h1><button>Profile</button><a href="#">Flights</a>','unauthenticated'],
  ['MFA','<h1>Verification code</h1><button>Profile</button><a href="#">Flights</a>','unauthenticated'],
  ['aria labelled controls','<span id="p" hidden>Profile</span><button aria-labelledby="p"></button><a href="#" aria-label="My trips"></a>','authenticated'],
 ])await t.test(name,async()=>{const evidence=await read(html);assert.equal(classifyTravelPortalAuth(evidence),expected);assert.ok(!JSON.stringify(evidence).includes('PRIVATE_SYNTHETIC'));});
 }finally{await browser.close();}
});
