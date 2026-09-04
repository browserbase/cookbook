const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../src/main.ts'),'utf8');
const start=source.indexOf('function hillsboroughPerimeterXBlocker(');
const end=source.indexOf('\nasync function ',start);
assert(start>=0&&end>start);
const classify=vm.runInNewContext(stripTypeScriptTypes(source.slice(start,end))+'; hillsboroughPerimeterXBlocker');
for(const state of [{}, {url:'https://example.test/results'}, {url:'https://example.test/results',captchaElementPresent:false,accessDeniedText:false,verifyHumanText:false,pxScriptUrls:['https://example.test/sensor.js'],captchaScriptUrls:['https://example.test/captcha.js']}]) {
 test(`no challenge from URL or supporting scripts alone: ${JSON.stringify(state)}`,()=>assert.equal(classify(state),undefined));
}
for(const signal of ['captchaElementPresent','verifyHumanText','accessDeniedText']) {
 test(`actual ${signal} remains a blocker and retains URL evidence`,()=>{
  const result=classify({url:'https://example.test/challenge',[signal]:true});
  assert.equal(result.status,signal==='accessDeniedText'?'blocked_site_denial':'blocked_human_check');
  assert(result.evidence.includes('url=https://example.test/challenge'));
 });
}
test('denial takes precedence over simultaneous human challenge',()=>assert.equal(classify({accessDeniedText:true,verifyHumanText:true}).status,'blocked_site_denial'));
