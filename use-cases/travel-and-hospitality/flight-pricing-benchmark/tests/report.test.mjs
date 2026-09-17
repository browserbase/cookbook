import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),source=readFileSync(new URL('index.ts',root),'utf8');
function fn(name){const match=new RegExp(`(?:async )?function ${name}\\(`).exec(source);assert.ok(match);const rest=source.slice(match.index);const end=rest.slice(1).search(/\n(?:async )?function |\nmain\(\)/);return end<0?rest:rest.slice(0,end+1);}
const dates=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(readFileSync(new URL('benchmark-date.ts',root),'utf8'))).toString('base64'));
const route={origin:'SFO',dest:'JFK',date:dates.departureDate(undefined),label:'Synthetic route'};
const shop=(price,extra={})=>({sourceName:'Fixture',sourceCode:'FX',cheapestNonstop:price,cheapestOverall:price,airline:null,flightTimes:null,notes:'Synthetic',elapsedMs:1,observedAt:'2026-09-07T12:00:00.000Z',...extra});
function reportScope(){const lines=[];const scope=vm.createContext({preflightBrowserModels:()=>{},DIM:'',RESET:'',divider(){},console:{log:(...args)=>lines.push(args.join(' '))}});
 vm.runInContext(stripTypeScriptTypes(['hasUsableFare','compareShops','formatPrice','diffString','printReport'].map(fn).join('\n'))+'\nglobalThis.report=printReport;globalThis.compare=compareShops;',scope);return {scope,lines};}
function result(travel_portalShop,externalShops){return {route,travel_portalShop,externalShops,travel_portalPrice:1,bestExternal:{price:2,source:'Stale'},diff:-1,travel_portalWins:true};}
test('all-failed local/no-TravelPortal report rejects cached comparisons and cloud proof',()=>{
 const {scope,lines}=reportScope();const count=scope.report([result(null,[shop(10,{error:'Synthetic failure'})])],[{name:'Fixture',code:'FX'}],false,false,1,Date.now());
 const out=lines.join('\n');assert.equal(count,0);assert.match(out,/Run unsuccessful/);assert.match(out,/Local Browser/);assert.match(out,/Paired TravelPortal\/external routes: 0/);assert.doesNotMatch(out,/What this proves|Concurrent Browserbase|auth reusable|Same-moment/);assert.doesNotMatch(out,/Stale/);
});
test('successful external-only run does not invent paired comparison',()=>{
 const {scope,lines}=reportScope();assert.equal(scope.report([result(null,[shop(100)])],[{name:'Fixture',code:'FX'}],false,false,1,Date.now()),1);
 assert.match(lines.join('\n'),/no paired TravelPortal\/external comparison available/);
});
test('paired report uses actual valid prices and timestamps',()=>{
 const {scope,lines}=reportScope();assert.equal(scope.report([result(shop(120,{sourceName:'TravelPortal',sessionId:'synthetic'}),[shop(100,{sessionId:'synthetic'})])],[{name:'Fixture',code:'FX'}],true,true,2,Date.now()),2);
 const out=lines.join('\n');assert.match(out,/Paired TravelPortal\/external routes: 1/);assert.match(out,/Average TravelPortal minus external: \$20.00/);assert.match(out,/2026-09-07T12:00:00.000Z/);assert.match(out,/Recorded Browserbase session IDs: 1/);
});
for(const bad of [null,0,-1,NaN,Infinity])test(`invalid fare cannot participate: ${bad}`,()=>{
 const {scope}=reportScope();const value=scope.compare(shop(bad),[shop(100)]);assert.equal(value.travel_portalPrice,null);assert.equal(value.diff,null);
});
test('unobserved legacy fare cannot participate',()=>{const {scope}=reportScope();for(const observedAt of [undefined,'0','not-a-date']) assert.equal(scope.compare(shop(100,{observedAt}),[shop(120)]).diff,null);});
test('route rejects expired date before allocating any browser',async()=>{
 let allocations=0;const scope=vm.createContext({preflightBrowserModels:()=>{},validateDepartureDate:dates.validateDepartureDate,divider(){},log(){},shopSource:async()=>allocations++,shopTravelPortal:async()=>allocations++});
 vm.runInContext(stripTypeScriptTypes(fn('benchmarkRoute'))+'\nglobalThis.run=benchmarkRoute;',scope);
 await assert.rejects(scope.run({...route,date:'2000-01-01'},[{}],false,true));assert.equal(allocations,0);
});
for(const name of ['shopSource','shopTravelPortal'])test(`${name} retains allocation failures as failed observations`,async()=>{
 const scope=vm.createContext({preflightBrowserModels:()=>{},RESET:'',process:{env:{TRAVEL_PORTAL_EMAIL:'synthetic',TRAVEL_PORTAL_PASSWORD:'synthetic'}},travel_portalContextId:()=>undefined,envNumber:()=>1,log(){},createStagehand:async()=>{throw Error('Synthetic allocation failure');}});
 vm.runInContext(stripTypeScriptTypes(fn('failedShop')+'\n'+fn(name))+`\nglobalThis.run=${name};`,scope);
 const value=await (name==='shopSource'?scope.run({name:'Fixture',code:'FX',color:''},route,false):scope.run(route,false));
 assert.equal(value.cheapestNonstop,null);assert.ok(value.error);assert.equal(value.observedAt,undefined);assert.ok(value.startedAt);
});
for(const invalid of [true,false])test(`main preflight and all-failed exit status: invalid date=${invalid}`,async()=>{
 let allocations=0;const scope=vm.createContext({preflightBrowserModels:()=>{},process:{argv:['node','index','--local'],env:invalid?{BENCHMARK_DEPARTURE_DATE:'2000-01-01'}:{}},divider(){},console:{log(){}},selectSources:()=>[{name:'Fixture'}],travel_portalContextId:()=>undefined,ROUTES:[{origin:'SFO',dest:'JFK',label:'Fixture'}],departureDate:dates.departureDate,validateDepartureDate:dates.validateDepartureDate,benchmarkRoute:async()=>{allocations++;return {};},printReport:()=>0});
 vm.runInContext(stripTypeScriptTypes(fn('main'))+'\nglobalThis.run=main;',scope);
 if(invalid){await assert.rejects(scope.run());assert.equal(allocations,0);}else{await scope.run();assert.equal(allocations,1);assert.equal(scope.process.exitCode,1);}
});
