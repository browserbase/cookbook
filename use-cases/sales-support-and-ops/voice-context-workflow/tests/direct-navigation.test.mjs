import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const raw = readFileSync(process.env.NAVIGATION_SOURCE || new URL('../lib/demo-controller.ts', import.meta.url), 'utf8');
const between = (a,b) => raw.slice(raw.indexOf(a),raw.indexOf(b,raw.indexOf(a)));
const start = raw.includes('function normalizeInstructionText') ? 'function normalizeInstructionText' : 'function getDirectNavigationUrl';
const code = between('const DIRECT_NAVIGATION_TARGETS','type BrowserPageSummary') + between(start,'function assertNavigationSucceeded');
const context = vm.createContext({ URL });
vm.runInContext(stripTypeScriptTypes(code) + '\nglobalThis.resolve = getDirectNavigationUrl;', context);
for (const [instruction, expected] of [
  ['open https://example.com/account/settings?view=Billing','https://example.com/account/settings?view=Billing'],
  ['go to https://voice_provider.io/docs/Conversational-AI?mode=Test#Overview','https://voice_provider.io/docs/Conversational-AI?mode=Test#Overview'],
  ['please visit HTTP://EXAMPLE.COM:8080/A%2Fb?x=One&y=Two#Case','http://example.com:8080/A%2Fb?x=One&y=Two#Case'],
  ['navigate to "https://example.com/login?next=%2FAccount"','https://example.com/login?next=%2FAccount'],
  ['open example.com/Account?view=Billing','https://example.com/Account?view=Billing'],
  ['could you open Browserbase homepage','https://www.browserbase.com/'],
  ["go to Voice Provider’s official website",'https://voice_provider.io/'],
  ['visit google news','https://news.google.com/home?hl=en-US&gl=US&ceid=US:en'],
  ['open https://example.com and click submit',null],
  ['do not open https://example.com',null],
  ['open Browserbase docs',null],
  ['open browserbase and summarize it',null],
  ['open https://user:pass@example.com/path',null],
  ['open javascript:alert(1)',null],
  ['open unknown product',null],
  ['open https://example.com https://other.invalid',null],
]) test(instruction,()=>assert.equal(context.resolve(instruction),expected));
test('actual direct-navigation branch sends the full URL to the browser action',async()=>{
  let action;
  const session = { activeRunId:'synthetic', abortController:new AbortController(), pendingQueue:[] };
  const scope = vm.createContext({URL, AbortController, getDirectNavigationUrl:context.resolve,
    ensureBrowserRuntime:async()=>{}, executeBrowserAction:async(_s,a)=>{action=a;return {url:a.url,title:'Synthetic'};},
    assertNavigationSucceeded(){}, syncPageState:async()=>{}, publishSession(){}, pushEvent(){},
    describeBrowserAction:()=>'',formatNavigationCompleteSummary:()=>'',markRunComplete:s=>{s.completed=true;},
    setControlOutcome:()=>{}, });
  vm.runInContext(stripTypeScriptTypes(between('async function runInstructionLoop','async function executeInstruction'))+'\nglobalThis.run=runInstructionLoop;',scope);
  await scope.run(session,{instruction:'open https://example.com/Account?view=Billing#Detail'});
  assert.equal(action.url,'https://example.com/Account?view=Billing#Detail');
  assert.equal(session.completed,true);
});
