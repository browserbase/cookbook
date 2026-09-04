const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync(process.env.IDENTITY_SOURCE || path.join(__dirname,'../linkedin-validator.ts'),'utf8'));
const target='https://www.linkedin.com/in/synthetic-person/';
async function run({name='Synthetic Person',actualName='Synthetic Person',inputUrl=target,finalUrl=target,company='Synthetic Labs'}={}){
 let launches=0,reads=0;const page={goto:async()=>{},waitForTimeout:async()=>{},url:async()=>++reads===1?target:finalUrl,title:async()=> 'Synthetic profile',evaluate:async()=>{}};
 const browser={sessionId:'synthetic',close:async()=>{},context:{activePage:async()=>page}};
 const c={URL,console:{log(){}},process:{env:{}},StagehandCreateOptionsSchema:{parse:v=>v},browserbase:{launch:async()=>{launches++;return browser;}},
 Stagehand:{create:async()=>({browser,close:async()=>{},extract:async()=>({data:{full_name:actualName,current_company:company}})})},LinkedInProfileSchema:{}};
 vm.runInNewContext(source.slice(source.indexOf('async function validateLinkedInProfile'),source.indexOf('// --- Main ---')),c);
 const result=await c.validateLinkedInProfile({name,expected_company:'Synthetic Labs',linkedin_url:inputUrl});return {result,launches};
}
test('different person at expected employer cannot match record',async()=>{const {result}=await run({actualName:'Different Person'});assert.equal(result.match,null);assert.equal(result.company_name_match,true);assert.equal(result.person_name_match,false);assert.match(result.match_details,/INCONCLUSIVE/);});
test('same name on a different final profile remains inconclusive',async()=>{const {result}=await run({finalUrl:'https://www.linkedin.com/in/other-person/'});assert.equal(result.match,null);assert.equal(result.profile_url_match,false);});
test('redirect to nonprofile URL remains inconclusive',async()=>{const {result}=await run({finalUrl:'https://www.linkedin.com/feed/'});assert.equal(result.match,null);assert.equal(result.profile_url_match,null);});
test('missing extracted name remains inconclusive',async()=>{const {result}=await run({actualName:null});assert.equal(result.match,null);assert.equal(result.person_name_match,null);});
test('initials do not establish full name agreement',async()=>{const {result}=await run({actualName:'S. Person'});assert.equal(result.match,null);});
test('name whitespace/case and equivalent profile URLs preserve agreement',async()=>{const {result}=await run({actualName:' synthetic   PERSON ',finalUrl:'https://linkedin.com/in/synthetic-person?trk=synthetic#profile'});assert.equal(result.match,true);assert.equal(result.person_name_match,true);assert.equal(result.profile_url_match,true);assert.match(result.match_details,/not independently verified/);});
test('name/profile agreement without employer agreement remains inconclusive',async()=>{const {result}=await run({company:'Different Labs'});assert.equal(result.person_name_match,true);assert.equal(result.match,null);});
for(const inputUrl of ['https://linkedin.com.evil.invalid/in/synthetic-person/','https://user:pass@www.linkedin.com/in/synthetic-person/','https://www.linkedin.com/in/a%2Fb/'])test('invalid expected profile rejected before allocation: '+inputUrl,async()=>{const {result,launches}=await run({inputUrl});assert.equal(result.match,null);assert.equal(launches,0);});
test('missing expected name rejected before allocation',async()=>{const {result,launches}=await run({name:' '});assert.equal(result.match,null);assert.equal(launches,0);});
