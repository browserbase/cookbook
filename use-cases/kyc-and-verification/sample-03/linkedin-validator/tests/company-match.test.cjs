const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../linkedin-validator.ts'),'utf8'));
function fixture(company){
 let launches=0;const browser={sessionId:'synthetic',close:async()=>{},context:{activePage:async()=>({goto:async()=>{},waitForTimeout:async()=>{},url:async()=> 'https://www.linkedin.com/in/synthetic-person/',title:async()=> 'Synthetic profile',evaluate:async()=>{}})}};
 const c={URL,console:{log(){}},process:{env:{}},StagehandCreateOptionsSchema:{parse:v=>v},browserbase:{launch:async()=>{launches++;return browser}},Stagehand:{create:async()=>({browser,close:async()=>{},extract:async()=>({data:{full_name:'Synthetic Person',current_company:company}})})},LinkedInProfileSchema:{}};
 vm.runInNewContext(source.slice(source.indexOf('async function validateLinkedInProfile'),source.indexOf('// --- Main ---')),c);
 return {c,get launches(){return launches}};
}
test('normalization preserves boundaries, suffixes, punctuation and Unicode letters',()=>{
 const {c}=fixture();
 for(const [a,b] of [['Meta','Metamorphosis Labs'],['Example Company',''],['   ',''],['Visa','Vi'],['A B','AB'],['A-B','AB'],['Acme Inc.','Acme'],['東京','大阪'],['!!!','!!!']])assert.equal(c.compareCompany(a,b),null,`${a}/${b}`);
 for(const [a,b] of [[' Synthetic   Labs ','synthetic labs'],['東京','東京'],['Café','Cafe\u0301']])assert.equal(c.compareCompany(a,b),true);
});
test('actual validation path makes substring-only matches inconclusive',async()=>{
 const f=fixture('Metamorphosis Labs');
 const result=await f.c.validateLinkedInProfile({name:'Synthetic Person',expected_company:'Meta',linkedin_url:'https://www.linkedin.com/in/synthetic-person/'});
 assert.equal(result.match,null);assert.match(result.match_details,/INCONCLUSIVE/);assert.doesNotMatch(result.match_details,/CONFIRMED|works at/);
});
test('blank expected name never allocates a browser',async()=>{
 const f=fixture('Synthetic');const result=await f.c.validateLinkedInProfile({name:'Synthetic Person',expected_company:'   ',linkedin_url:'https://www.linkedin.com/in/synthetic-person/'});
 assert.equal(result.match,null);assert.equal(result.error,'invalid_expected_company');assert.equal(f.launches,0);
});
test('equal names report name evidence rather than employment confirmation',async()=>{
 const f=fixture('Synthetic Labs');const result=await f.c.validateLinkedInProfile({name:'Synthetic Person',expected_company:'synthetic labs',linkedin_url:'https://www.linkedin.com/in/synthetic-person/'});
 assert.equal(result.match,true);assert.match(result.match_details,/NAME MATCH/);assert.match(result.match_details,/not independently verified/);
});
