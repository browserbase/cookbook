import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
const {z} = await import(process.env.COOKBOOK_ZOD_MODULE || 'zod/v4');
const sourcePath = new URL('../index.ts', import.meta.url);
function fixture({ countFailure=false, writeFailure=false, connectFailure=false, indexFailure=false }={}) {
 const rows=new Map(), calls={connect:0,close:0,count:0,queries:0,logs:[],errors:[],writes:0};
 const collection={
  listIndexes:()=>({toArray:async()=>[]}),createIndex:async()=>{if(indexFailure)throw Error("index failed");},
  insertOne:async data=>{if(rows.has(data.url))throw Error('duplicate URL');rows.set(data.url,{...data});},
  insertMany:async values=>{for(const data of values)await collection.insertOne(data);},
  updateOne:async(filter,update,options)=>{calls.writes++;if(writeFailure)throw Error('write failed');assert.equal(options.upsert,true);rows.set(filter.url,{...rows.get(filter.url),...update.$set});return {acknowledged:true,matchedCount:1};},
  countDocuments:async()=>{calls.count++;if(countFailure)throw Error('count failed');return rows.size;},
  aggregate:()=>({toArray:async()=>{calls.queries++;return [{_id:'fixture',count:1}];}}),
  find:()=>({toArray:async()=>Array.from(rows.values())})
 };
 const database={admin:()=>({listDatabases:async()=>({databases:[{name:'fixture'}]})}),createCollection:async()=>{},collection:()=>collection};
 class MongoClient {async connect(){calls.connect++;if(connectFailure)throw Error('connect failed');}db(){return database;}async close(){calls.close++;}}
 const chalk=new Proxy({}, {get:()=>value=>value});
 const context=vm.createContext({z,MongoClient,MongoServerError:class extends Error{},chalk,process:{env:{DB_NAME:'fixture'}},console:{log:(...x)=>calls.logs.push(x.join(' ')),error:(...x)=>calls.errors.push(x.join(' ')),table(){}},URL,Date});
 let source=readFileSync(process.env.COOKBOOK_R155_BASELINE || sourcePath,'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
 source=source.slice(0,source.lastIndexOf('\nrun('));
 vm.runInContext(stripTypeScriptTypes(source),context);
 return {context,rows,calls,database};
}
test('analysis uses the database returned by successful connection',async()=>{
 const {context,calls}=fixture();await context.runQueries();assert.ok(calls.count>=3);assert.equal(calls.queries,1);assert.equal(calls.connect,1);
});
test('analysis errors reject rather than log success',async()=>{
 const {context,calls}=fixture({countFailure:true});await assert.rejects(context.runQueries());assert.ok(!calls.logs.some(x=>x.includes('Queries completed successfully')));
});
test('product detail updates the listing while retaining omitted fields',async()=>{
 const {context,rows}=fixture();const url='https://example.invalid/product';
 await context.storeData('products',{url,name:'listing',price:'1',category:'fixture'});
 const page={goto:async()=>{},waitForTimeout:async()=>{},evaluate:async()=>{}};
 await context.scrapeProductDetails(page,url,{extract:async()=>({data:{name:'detail',price:'2',description:'enriched'}})});
 assert.equal(rows.size,1);assert.equal(rows.get(url).description,'enriched');assert.equal(rows.get(url).category,'fixture');
 await context.storeData('products',[{url,name:'new listing',price:'3'}]);assert.equal(rows.size,1);assert.equal(rows.get(url).description,'enriched');
});
test('write failures reject',async()=>{const {context}=fixture({writeFailure:true});await assert.rejects(context.storeData('products',{url:'https://example.invalid/product',name:'fixture'}));});
test('failed connections are closed and not cached',async()=>{const {context,calls}=fixture({connectFailure:true});await assert.rejects(context.connectToMongo());await assert.rejects(context.connectToMongo());assert.equal(calls.connect,2);assert.equal(calls.close,2);});
test('invalid batches fail before writing any product',async()=>{for(const url of [undefined,'','javascript:alert(1)','https://user:secret@example.invalid/p']){const {context,calls}=fixture();await assert.rejects(context.storeData('products',[{url:'https://example.invalid/valid'}, {url}]));assert.equal(calls.writes,0);}});
test('updates omit immutable identity and undefined fields',async()=>{const {context,rows}=fixture();const url='https://example.invalid/p';await context.storeData('products',{url,description:'keep'});await context.storeData('products',{url,_id:'forbidden',description:undefined});assert.equal(rows.get(url)._id,undefined);assert.equal(rows.get(url).description,'keep');});
for(const failure of ['create','main','mongoClose','stagehandClose','browserClose',undefined]){
 test(`runner cleanup and outcome ${failure || 'success'}`,async()=>{
  const {context,calls}=fixture();const closed=[];
  context.process.env.BROWSERBASE_API_KEY='fixture';
  const browser={sessionId:'fixture',context:{pages:async()=>[{}]},close:async()=>{closed.push('browser');if(failure==='browserClose')throw Error('browser close failed');}};
  context.browserbase={launch:async()=>browser};
  context.Stagehand={create:async()=>{if(failure==='create')throw Error('create failed');return{close:async()=>{closed.push('stagehand');if(failure==='stagehandClose')throw Error('stagehand close failed');}};}};
  context.main=async()=>{if(failure==='main')throw Error('main failed');};
  context.closeMongo=async()=>{closed.push('mongo');if(failure==='mongoClose')throw Error('mongo close failed');};
  if(failure)await assert.rejects(context.run());else await context.run();
  assert.deepEqual(closed,failure==='create'?['mongo','browser']:['mongo','stagehand','browser']);
  assert.equal(calls.logs.some(x=>x.includes('operations completed successfully')),!failure);
 });
}
test('index failure prevents caching the database',async()=>{const {context,calls}=fixture({indexFailure:true});await assert.rejects(context.connectToMongo());await assert.rejects(context.connectToMongo());assert.equal(calls.connect,2);assert.equal(calls.close,2);});
for(const failure of ['listing','detail','analysis'])test(`main propagates ${failure} failure`,async()=>{const {context}=fixture();context.scrapeProductList=async()=>{if(failure==='listing')throw Error('listing failed');return{products:[{url:'https://example.invalid/p',name:'fixture'}]};};context.scrapeProductDetails=async()=>{if(failure==='detail')throw Error('detail failed');return{name:'fixture'};};context.runQueries=async()=>{if(failure==='analysis')throw Error('analysis failed');};await assert.rejects(context.main({page:{waitForTimeout:async()=>{}},stagehand:{}}));});
test('CLI rejection sets nonzero exit status',async()=>{const {context}=fixture();context.run=async()=>{throw Error('fixture failure');};const source=readFileSync(process.env.COOKBOOK_R155_BASELINE || sourcePath,'utf8');const completion=vm.runInContext(source.slice(source.lastIndexOf('\nrun(')),context);if(process.env.COOKBOOK_R155_BASELINE){await assert.rejects(completion);}else await completion;assert.equal(context.process.exitCode,1);});
test('listing category survives product and snapshot storage',async()=>{
 const {context,rows}=fixture();const page={goto:async()=>{},waitForTimeout:async()=>{},waitForSelector:async()=>{},evaluate:async()=>{}};
 const result=await context.scrapeProductList(page,'https://example.invalid/catalog',{extract:async()=>({data:{products:[{name:'fixture',price:'1',url:'https://example.invalid/p'}],category:'Electronics'}})});
 assert.equal(result.products[0].category,'Electronics');
 assert.equal(rows.get('https://example.invalid/p').category,'Electronics');
 assert.equal(rows.get(undefined).products[0].category,'Electronics');
 const groups=new Map();for(const row of rows.values())if(row.url)groups.set(row.category,(groups.get(row.category)||0)+1);
 assert.equal(groups.get('Electronics'),1);assert.equal(groups.has(undefined),false);
});
