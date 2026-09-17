import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const {z}=createRequire(import.meta.url)('zod/v4');
const source=stripTypeScriptTypes(readFileSync(new URL('../stagehand/research/polymarket.ts',import.meta.url),'utf8')).replace(/^import .*$/gm,'').replace(/^export default .*$/gm,'');
const target='https://polymarket.com/event/synthetic-fixture';
const sample={marketTitle:'Fixture market?',marketStatus:'resolved',currentOdds:'0%',yesPrice:'0¢',noPrice:'100¢',totalVolume:null,priceChange:null};
async function run(change={}){
 let launches=0,current='https://polymarket.com/',extracts=0;const acts=[],closed=[],logs=[],exits=[];
 const page={goto:async()=>{if(change.navigation)throw Error('navigation');return change.noResponse?null:{ok:()=>!change.httpError};},url:async()=>change.landed??current};
 const stagehand={act:async(instruction,options)=>{acts.push({instruction,options});if(acts.length===3)current=target;return change.failAt===acts.length?{data:{success:false}}:{data:{success:true}};},extract:async(instruction,schema,options)=>{extracts++;if(change.extractThrows)throw Error('extract');if(options)assert.equal(options.page,page);if(change.redirectAfterExtract)current='https://polymarket.com/event/different-fixture';return {data:change.data??sample};},close:async()=>{closed.push('stagehand');if(change.closeThrows)throw Error('close');}};
 const context=vm.createContext({z,URL,Date,Error,process:{env:{POLYMARKET_QUERY:'fixture',POLYMARKET_MARKET_TITLE:'Fixture market?',POLYMARKET_MARKET_URL:target,...change.env},exit:code=>exits.push(code)},console:{log:(...x)=>logs.push(x),error(){}},browserbase:{launch:async()=>{launches++;if(change.launchThrows)throw Error('launch');return {context:{pages:async()=>[page]},close:async()=>closed.push('browser')};}},Stagehand:{create:async()=>{if(change.init)throw Error('init');return stagehand;}}});
 const start=source.lastIndexOf('\nrunWorkflow()');assert.ok(start>=0);vm.runInContext(source.slice(0,start)+'\nglobalThis.done='+source.slice(start+1),context);try{await context.done;}catch{}
 return {launches,acts,closed,logs,exits,exit:context.process.exitCode,extracts,page};
}
const failed=r=>assert.equal(r.exits[0]??r.exit,1);
for(const key of ['POLYMARKET_QUERY','POLYMARKET_MARKET_TITLE','POLYMARKET_MARKET_URL'])test(`requires ${key}`,async()=>{const r=await run({env:{[key]:' '}});failed(r);assert.equal(r.launches,0);});
for(const url of ['https://polymarket.com.evil.invalid/event/fixture','https://polymarket.com/','javascript:alert(1)'])test(`invalid URL ${url}`,async()=>{const r=await run({env:{POLYMARKET_MARKET_URL:url}});failed(r);assert.equal(r.launches,0);});
test('returns meaningful historical data with source and observation time',async()=>{const r=await run();assert.equal(r.exits[0]??r.exit??0,0);assert.equal(r.extracts,1);assert.equal(r.acts.length,3);for(const a of r.acts)assert.equal(a.options.page,r.page);const all=JSON.stringify(r.logs);assert.match(all,/resolved/);assert.ok(all.includes(target));assert.match(all,/observedAt/);assert.deepEqual(r.closed,['stagehand','browser']);});
for(const data of [{},{...sample,marketTitle:'different market'},{...sample,currentOdds:null,yesPrice:null,noPrice:null},{...sample,yesPrice:''},{...sample,marketStatus:'invented'}, {...sample,marketTitle:' '}])test(`rejects invalid extraction ${JSON.stringify(data)}`,async()=>{const r=await run({data});failed(r);assert.deepEqual(r.closed,['stagehand','browser']);});
for(const change of [{failAt:1},{failAt:2},{failAt:3},{landed:'https://polymarket.com/event/other'},{redirectAfterExtract:true},{httpError:true},{noResponse:true},{extractThrows:true},{init:true},{closeThrows:true},{launchThrows:true}])test(`failure propagates ${JSON.stringify(change)}`,async()=>{const r=await run(change);failed(r);assert.deepEqual(r.closed,change.launchThrows?[]:change.init?['browser']:['stagehand','browser']);if(change.failAt)assert.equal(r.extracts,0);});
