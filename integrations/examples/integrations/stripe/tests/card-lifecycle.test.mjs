import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
const holderId='ich_fixture123';
for(const variant of ['node','stagehand']){
 function fixture({activate=false,key='sk_test_fixture',holder={},created={},active={}}={}){
  const calls={create:[],update:[],retrieve:[],holder:[],logs:[]};
  const base={id:'ic_fixture123',cardholder:holderId,livemode:false,status:'inactive'};
  class Stripe { constructor(){this.issuing={cardholders:{retrieve:async id=>{calls.holder.push(id);return{id:holderId,livemode:false,status:'active',requirements:{disabled_reason:null,past_due:[]},...holder};}},cards:{create:async body=>{calls.create.push(body);return{...base,...created};},update:async(id,body)=>{calls.update.push([id,body]);return{...base,status:'active',...active};},retrieve:async id=>{calls.retrieve.push(id);return{...base,status:'active',...active};}}};}}
  let source=readFileSync(process.env.COOKBOOK_R158_BASELINE?`${process.env.COOKBOOK_R158_BASELINE}-${variant}.ts`:new URL(`../${variant}/2-create-card.ts`,import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'');
  // Retain declarations and remove the command invocation.
  source=source.replace(/\n(?:main|run|createCard)\(\)\.catch\([\s\S]*$/,'').replace(/\nconst cardholderId = [\s\S]*$/,'');
  const context=vm.createContext({Stripe,dotenv:{config(){}},process:{env:{STRIPE_API_KEY:key,STRIPE_CARDHOLDER_ID:holderId,STRIPE_ACTIVATE_TEST_CARD:String(activate)}},console:{log:(...x)=>calls.logs.push(x),error(){}}});
  vm.runInContext(stripTypeScriptTypes(source),context);return{context,calls};
 }
 test(`${variant}: inactive creation is explicit and does not activate`,async()=>{const{context,calls}=fixture();const card=await context.createCard(holderId);assert.equal(card.status,'inactive');assert.equal(calls.create[0].status,'inactive');assert.equal(calls.update.length,0);assert.equal(calls.holder.length,1);});
 test(`${variant}: activation retrieves and verifies the same card`,async()=>{const{context,calls}=fixture({activate:true});const card=await context.createCard(holderId);assert.equal(card.status,'active');assert.equal(calls.update.length,1);assert.equal(calls.update[0][0],'ic_fixture123');assert.equal(calls.update[0][1].status,'active');assert.deepEqual(calls.retrieve,['ic_fixture123']);});
 for(const holder of [{livemode:true},{status:'inactive'},{id:'ich_other'},{requirements:{disabled_reason:'requirements.past_due',past_due:['name']}}])test(`${variant}: rejects invalid holder ${JSON.stringify(holder)}`,async()=>{const{context,calls}=fixture({holder});await assert.rejects(context.createCard(holderId));assert.equal(calls.create.length,0);});
 for(const active of [{livemode:true},{status:'inactive'},{id:'ic_other'},{cardholder:'ich_other'}])test(`${variant}: activation cannot report unverified readiness ${JSON.stringify(active)}`,async()=>{const{context}=fixture({activate:true,active});await assert.rejects(context.createCard(holderId));});
 test(`${variant}: live key cannot create`,async()=>{let f;try{f=fixture({key:'sk_live_fixture'});}catch{return;}await assert.rejects(f.context.createCard(holderId));assert.equal(f.calls.create.length,0);});
}
