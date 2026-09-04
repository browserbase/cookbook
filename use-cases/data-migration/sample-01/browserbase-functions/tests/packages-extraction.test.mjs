import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import test from 'node:test';
const root=new URL('../',import.meta.url);
const raw=fs.readFileSync(new URL('shared/extract.ts',root),'utf8');
const scope=vm.createContext({});
vm.runInContext(stripTypeScriptTypes(raw.slice(raw.indexOf('// Embedded browser programs')).replace(/export /g,''))+'\nglobalThis.build=buildExtractPacksForTokens;globalThis.standalone=EXTRACT_CLIENT_PACKAGES;',scope);
const te=new TextEncoder();
const vint=n=>{const a=[];while(n>127){a.push(n%128|128);n=Math.floor(n/128);}return [...a,n];};
const bytes=(field,value)=>[...vint(field*8+2),...vint(value.length),...value];
const str=(f,s)=>bytes(f,te.encode(s));
const pack=(token='customer',rule='rule')=>bytes(2,[...str(1,'pack'),...str(4,token),...str(8,rule),88,3]);
const catalog={objects:[{id:'package',type:'ITEM',item_data:{product_type:'CREDIT_PACKAGE',name:'Synthetic package',variations:[{item_variation_data:{credit_package_info:{redemption_policies:[{credit_redemption_policy_data:{pricing_rule_id:'rule'}}]}}}]}}],related_objects:[{id:'rule',pricing_rule_data:{match_products_id:'set'}},{id:'set',product_set_data:{product_ids_any:['service']}},{id:'service',item_data:{name:'Synthetic service'}}]};
function harness({catalogs=[{objects:[]}],packs=[],tokens=['customer'],standalone=false,customerPages=[]}={}){
 let ci=0,pi=0,si=0;const calls=[];
 const fetch=async(url,options)=>{
  calls.push({url,options});const isCatalog=url.includes('/catalog/');const sgc=url.includes('SearchAndGetCustomers');
  const response=isCatalog?catalogs[ci++]:sgc?customerPages[si++]:packs[pi++]??[];
  if(response instanceof Error)throw response;
  return {status:response?.status??200,json:async()=>response,arrayBuffer:async()=>Uint8Array.from(response?.bytes??response).buffer};
 };
 const document={querySelector:()=>null,documentElement:{innerHTML:'M123456789012'}};
 return {calls,run:()=>vm.runInNewContext(standalone?scope.standalone:scope.build(tokens,{}),{fetch,document,window:{},localStorage:{length:0},TextDecoder,TextEncoder,Uint8Array})};
}
test('complete empty packs require successful customer probes',async()=>{const f=harness();const r=await f.run();assert.equal(r.complete,true);assert.equal(r.customersProbed,1);assert.equal(r.rows.length,0);assert.equal(f.calls.length,2);});
test('pack resolves the fully fetched catalog',async()=>{const r=await harness({catalogs:[{objects:catalog.objects,cursor:'next'},{objects:[],related_objects:catalog.related_objects}],packs:[pack()]}).run();assert.equal(r.rows[0].package_title,'Synthetic package');assert.equal(r.rows[0].catalog_item_name,'Synthetic service');assert.equal(r.rows[0].credits_remaining,3);});
for(const [name,value] of [['HTTP',{status:401}],['network',new Error('synthetic')],['truncated varint',[128]],['truncated length',[18,20,1]],['invalid field',[0]],['unsupported envelope',[10,0]],['wrong wire',[16,0]],['missing pack identity',[18,0]],['wrong customer',pack('other')]])test(`${name} rejects instead of returning empty packs`,async()=>{await assert.rejects(harness({catalogs:[catalog],packs:[value]}).run());});
for(const [name,value] of [['HTTP',{status:500}],['network',new Error('synthetic')],['missing objects',{}],['malformed objects',{objects:{}}],['error envelope',{objects:[],errors:[{}]}],['unresolved reference',{objects:catalog.objects}]])test(`catalog ${name} rejects`,async()=>{await assert.rejects(harness({catalogs:[value],packs:[pack()]}).run());});
test('later catalog page failure prevents customer probes',async()=>{const f=harness({catalogs:[{objects:catalog.objects,cursor:'next'},{status:500}]});await assert.rejects(f.run());assert.equal(f.calls.length,2);});
test('repeated catalog cursor rejects',async()=>{await assert.rejects(harness({catalogs:[{objects:catalog.objects,cursor:'same'},{objects:catalog.objects,cursor:'same'}]}).run());});
test('second customer failure rejects all earlier rows',async()=>{await assert.rejects(harness({catalogs:[catalog],tokens:['customer','other'],packs:[pack(),{status:500}]}).run());});
test('duplicate customer tokens reject before requests',async()=>{const f=harness({tokens:['customer','customer']});await assert.rejects(f.run());assert.equal(f.calls.length,0);});
test('standalone proven zero total can complete empty',async()=>{const totalZero=bytes(2,[24,0]);const r=await harness({standalone:true,customerPages:[totalZero,totalZero]}).run();assert.equal(r.complete,true);assert.equal(r.customersProbed,0);});
test('standalone failed enumeration cannot claim completion',async()=>{const totalZero=bytes(2,[24,0]);await assert.rejects(harness({standalone:true,customerPages:[totalZero,{status:500}]}).run());});
test('standalone missing total rejects',async()=>{await assert.rejects(harness({standalone:true,customerPages:[[]]}).run());});
async function caller(result){let handler,delivered=0;const context=vm.createContext({defineFn:(_,fn)=>handler=fn,workflowParams:{},EXTRACT_CLIENT_PACKAGES:'synthetic',openSquareSession:async()=>({page:{evaluate:async()=>result},sessionId:'synthetic',close:async()=>{}}),clientPackagesCsv:()=>'',deliverCsv:async()=>{delivered++;},ok:value=>({ok:true,...value}),fail:()=>({ok:false}),setTimeout:fn=>fn()});const source=fs.readFileSync(new URL('functions/client-packages.ts',root),'utf8').replace(/^import .*;\n/gm,'');vm.runInContext(stripTypeScriptTypes(source),context);return {result:await handler({}),delivered};}
test('standalone delivery refuses legacy empty rows',async()=>{const r=await caller({rows:[]});assert.equal(r.result.ok,false);assert.equal(r.delivered,0);});
test('standalone delivery accepts explicit complete empty rows',async()=>{const r=await caller({rows:[],complete:true,customersProbed:0});assert.equal(r.result.ok,true);assert.equal(r.delivered,1);});
async function agentCaller(result){let handler,delivered=0,closed=0;const context=vm.createContext({defineFn:(_,fn)=>handler=fn,workflowParams:{},BROWSERBASE_API_KEY:'synthetic',SQUARE_CLIENT_PACKAGES_CONTEXT_ID:'synthetic',Browserbase:class {},runSessionTask:async()=>({success:true}),waitForDownloadZip:async()=>null,readZipEntry:()=>({text:'synthetic'}),parseCsvObjects:()=>[{'Square Customer ID':'customer','First Name':'Synthetic'}],buildExtractPacksForTokens:scope.build,openSquareSession:async()=>({page:{evaluate:async()=>result},sessionId:'synthetic',close:async()=>{closed++;}}),clientPackagesCsv:()=>'',deliverCsv:async()=>{delivered++;}});const source=fs.readFileSync(new URL('functions/client-packages-agent.ts',root),'utf8').replace(/^import [\s\S]*?;\n/gm,'');vm.runInContext(stripTypeScriptTypes(source),context);return {result:await handler({session:{id:'synthetic'}}),delivered,closed};}
for(const [name,result] of [['legacy empty',{rows:[]}],['partial count',{rows:[],complete:true,customersProbed:0}],['missing rows',{complete:true,customersProbed:1}],['error',{rows:[],complete:true,customersProbed:1,error:'synthetic'}]])test(`agent delivery rejects ${name}`,async()=>{const r=await agentCaller(result);assert.equal(r.result.ok,false);assert.equal(r.delivered,0);assert.equal(r.closed,1);});
test('agent delivers only after all token probes completed',async()=>{const r=await agentCaller({rows:[],complete:true,customersProbed:1});assert.equal(r.result.ok,true);assert.equal(r.delivered,1);assert.equal(r.closed,1);});
