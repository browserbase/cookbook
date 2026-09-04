import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('index.ts',root),'utf8');
function fn(name){const match=new RegExp(`(?:async )?function ${name}\\(`).exec(source);assert.ok(match);const rest=source.slice(match.index);const end=rest.slice(1).search(/\n(?:async )?function /);return end<0?rest:rest.slice(0,end+1);}
const helper=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(readFileSync(new URL('travel-portal-auth.ts',root),'utf8'))).toString('base64'));
function loginScope(evidence){let actions=0;const page={goto:async()=>{},url:async()=>evidence.url,evaluate:async()=>evidence,waitForLoadState:async()=>{},reload:async()=>{},waitForTimeout:async()=>{}};
 const scope=vm.createContext({preflightBrowserModels:()=>{},URL,classifyTravelPortalAuth:helper.classifyTravelPortalAuth,readTravelPortalAuthEvidence:helper.readTravelPortalAuthEvidence,
  log(){},envNumber:()=>1,TRAVEL_PORTAL_APP_URL:'https://app.travel.example/app/user2/',TRAVEL_PORTAL_SIGNIN_URL:'https://travel.example/signin',
  hasHumanGate:(_url,text)=>/mfa|verification code|captcha/i.test(text),
  waitForText:async(_page,predicate)=>{await predicate(evidence.text);return evidence.text;},
  stagehand:{act:async()=>{actions++;throw Error('Unexpected provider action');}},page});
 vm.runInContext(stripTypeScriptTypes([fn('travel_portalAppAuthenticated'),fn('travel_portalAppShellIsBlank'),fn('ensureTravelPortalLogin')].join('\n'))+'\nglobalThis.ensure=ensureTravelPortalLogin;',scope);
 return {scope,actions:()=>actions};}
for(const [name,evidence,expected] of [
 ['password sign-in',{url:'https://app.travel.example/app/user2/',text:'Sign in with your email and password to continue',signInControls:true,accountControls:false,travelControls:false},false],
 ['ambiguous shell',{url:'https://app.travel.example/app/user2/',text:'Welcome to this workspace loading application',signInControls:false,accountControls:false,travelControls:false},false],
 ['workspace',{url:'https://app.travel.example/app/user2/',text:'My trips Flights Profile',signInControls:false,accountControls:true,travelControls:true},true],
])test(`actual login caller requires measured evidence: ${name}`,async()=>{
 const {scope,actions}=loginScope(evidence);
 assert.equal(await scope.ensure({page:scope.page,stagehand:scope.stagehand,tag:'fixture',contextId:'fixture',manualOnly:true,allowManualCompletion:true}),expected);
 assert.equal(actions(),0);
});
test('actual auth adapter treats failed observation as unknown',async()=>{
 const scope=vm.createContext({preflightBrowserModels:()=>{},classifyTravelPortalAuth:helper.classifyTravelPortalAuth,readTravelPortalAuthEvidence:helper.readTravelPortalAuthEvidence});
 vm.runInContext(stripTypeScriptTypes(fn('travel_portalAppAuthenticated'))+'\nglobalThis.check=travel_portalAppAuthenticated;',scope);
 assert.equal(await scope.check({evaluate:async()=>{throw Error('Synthetic detached page');}}),false);
});
for(const verified of [false,true])test(`actual setup only reports verification when observed: ${verified}`,async()=>{
 let closed=0;const logs=[];
 const scope=vm.createContext({preflightBrowserModels:()=>{},divider(){},requireEnv:()=> 'synthetic',process:{env:{}},
  Browserbase:class {sessions={debug:async()=>null};},travel_portalContextId:()=> 'synthetic-context',RESET:'',
  createStagehand:async()=>({browser:{sessionId:'synthetic-session',context:{activePage:async()=>({})}},close:async()=>closed++}),
  log(){},console:{log:(...args)=>logs.push(args.join(' '))},ensureTravelPortalLogin:async()=>true,verifyTravelPortalContextReady:async()=>verified});
 vm.runInContext(stripTypeScriptTypes(fn('setupTravelPortalContext'))+'\nglobalThis.setup=setupTravelPortalContext;',scope);
 if(verified)await scope.setup();else await assert.rejects(scope.setup(),/not verified/);
 assert.equal(logs.some(line=>line.includes('Verified authenticated workspace')),verified);
 assert.equal(logs.some(line=>line.includes('Next run:')),verified);assert.equal(closed,1);
});
for(const authenticated of [false,true])test(`actual context readiness rechecks DOM rather than app URL: ${authenticated}`,async()=>{
 const evidence={url:'https://app.travel.example/app/user2/',text:authenticated?'My trips Flights Profile':'Sign in with your email and password to continue',signInControls:!authenticated,accountControls:authenticated,travelControls:authenticated};
 const {scope}=loginScope(evidence);
 scope.dismissOptionalTravelPortalPrompts=async()=>{};scope.visibleText=async()=>evidence.text;
 vm.runInContext(stripTypeScriptTypes(fn('verifyTravelPortalContextReady'))+'\nglobalThis.verify=verifyTravelPortalContextReady;',scope);
 assert.equal(await scope.verify(scope.stagehand,scope.page,'synthetic'),authenticated);
});
