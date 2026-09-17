import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire,stripTypeScriptTypes} from 'node:module';import vm from 'node:vm';
const require=createRequire(import.meta.url),{z}=require(process.env.ZOD_MODULE_PATH || 'zod');const source=readFileSync(process.env.MENTIONS_SOURCE_PATH || new URL('../company-intel.ts',import.meta.url),'utf8');
const schema=source.slice(source.indexOf('const BlogMentionsSchema'),source.indexOf('const LeadershipSchema'));
const start=source.includes('function readMentionLinks()')?source.indexOf('function readMentionLinks()'):source.indexOf('async function findPersonMentions(');
const fragment=source.slice(start,source.indexOf('async function extractLeadershipAndSignals('));
const scope=vm.createContext({URL,z,console:{log(){}}});vm.runInContext(stripTypeScriptTypes(schema+fragment)+'\nglobalThis.find=findPersonMentions;globalThis.verify=typeof verifiedMentionUrl==="function"?verifiedMentionUrl:undefined;',scope);
const discovery='https://www.google.com/search?q=synthetic';
for(const [candidate,links,expected] of [
 ['https://company.invalid/news/a',['https://company.invalid/news/a'],'https://company.invalid/news/a'],
 ['https://company.invalid/invented',[],null],
 [null,['https://company.invalid/a'],null],
 ['https://company.invalid.attacker.invalid/a',['https://company.invalid.attacker.invalid/a'],null],
 ['javascript:alert(1)',['javascript:alert(1)'],null],
 ['https://user@company.invalid/a',['https://user@company.invalid/a'],null],
 ['https://company.invalid/a',['https://www.google.com/url?q=https%3A%2F%2Fcompany.invalid%2Fa'],'https://company.invalid/a'],
 ['https://news.company.invalid/a',['https://news.company.invalid/a'],'https://news.company.invalid/a'],
 ])test('citation candidate '+candidate,()=>assert.equal(scope.verify(candidate,discovery,'company.invalid',links),expected));
test('relative article links resolve against the actual listing destination',()=>assert.equal(scope.verify('../story','https://company.invalid/news/archive/','company.invalid',['https://company.invalid/news/story']),'https://company.invalid/news/story'));
async function find({fallback=false,candidate=null,links=[]}={}){let current='';const page={goto:async url=>{current=url.includes('google.com')?url:'https://company.invalid/news/archive/';return {status:()=>200};},url:async()=>current,waitForTimeout:async()=>{},evaluate:async fn=>fn.name==='readMentionLinks'?links:'<html>Synthetic Person</html>'};const result=await scope.find({browser:{context:{activePage:async()=>page}},extract:async(_prompt,schema)=>({data:schema.parse({mentions:fallback&&current.includes('google.com')?[]:[{title:'Synthetic story',article_url:candidate,context:'Snippet mentioning Synthetic Person',date:null,content_type:'news'}]})})},'company.invalid','Synthetic Person');return result;}
test('unavailable article URL stays unknown instead of substituting a homepage',async()=>{const r=await find();assert.equal(r.mentions[0].page_url,null);assert.equal(r.mentions[0].evidence_kind,'search_snippet');assert.ok(r.mentions[0].discovery_url.startsWith('https://www.google.com/search?'));});
test('search preserves observed article target and separately labels snippet evidence',async()=>{const url='https://company.invalid/story';const r=await find({candidate:url,links:[url]});assert.equal(r.mentions[0].page_url,url);assert.equal(r.mentions[0].evidence_kind,'search_snippet');assert.ok(!r.pagesVisited.includes(url));});
test('listing uses actual redirect destination and article link separately',async()=>{const r=await find({fallback:true,candidate:'../story',links:['https://company.invalid/news/story']});assert.equal(r.mentions[0].page_url,'https://company.invalid/news/story');assert.equal(r.mentions[0].discovery_url,'https://company.invalid/news/archive/');assert.equal(r.mentions[0].evidence_kind,'listing_excerpt');});
test('unobserved article URL is not trusted even if the model supplies it',async()=>{const r=await find({fallback:true,candidate:'https://company.invalid/invented'});assert.equal(r.mentions[0].page_url,null);});
