import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
for(const variant of ['node','stagehand']){
 function fixture({key='sk_test_fixture',card={},holder={},second={}}={}){
  const calls={cards:[],holders:[],logs:[]};
  const owner={id:'ich_fixture123',livemode:false,status:'active',requirements:{disabled_reason:null,past_due:[]},name:'Fixture Person',email:'fixture@example.invalid',phone_number:'+15555550100',billing:{address:{line1:'Fixture',city:'Fixture',state:'CA',country:'US',postal_code:'00000'}},...holder};
  const base={id:'ic_fixture123',livemode:false,status:'active',cardholder:owner,number:'4000000000000000',cvc:'123',exp_month:1,exp_year:2030,last4:'0000',brand:'Visa',currency:'usd',...card};
  class Stripe {constructor(){this.issuing={cards:{retrieve:async(...args)=>{calls.cards.push(args);return calls.cards.length>1?{...base,...second}:base;}},cardholders:{retrieve:async id=>{calls.holders.push(id);return owner;}}};}}
  let source=readFileSync(process.env.COOKBOOK_R158_RETRIEVAL_BASELINE?`${process.env.COOKBOOK_R158_RETRIEVAL_BASELINE}-${variant}.ts`:new URL(`../${variant}/3-get-card.ts`,import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
  source=source.replace(/\nif \(.*import\.meta[\s\S]*$/,'').replace(/\nconst cardId = [\s\S]*$/,'');
  const context=vm.createContext({Stripe,dotenv:{config(){}},process:{env:{STRIPE_API_KEY:key,STRIPE_CARDHOLDER_ID:'ich_fixture123'},argv:[]},console:{log:(...x)=>calls.logs.push(x),error:(...x)=>calls.logs.push(x)}});
  vm.runInContext(stripTypeScriptTypes(source),context);return{context,calls};
 }
 test(`${variant}: metadata is checked before sensitive expansion with no logging`,async()=>{const{context,calls}=fixture();const result=await context.getCard('ic_fixture123');assert.equal(result.card_number,'4000000000000000');assert.equal(result.id,'ic_fixture123');assert.equal(calls.cards.length,2);assert.ok(!JSON.stringify(calls.cards[0]).includes('number'));assert.equal(calls.logs.length,0);});
 for(const card of [{livemode:true},{status:'inactive'},{id:'ic_other'},{cardholder:'ich_other'}])test(`${variant}: invalid metadata prevents expansion ${JSON.stringify(card)}`,async()=>{const{context,calls}=fixture({card});await assert.rejects(context.getCard('ic_fixture123'));assert.equal(calls.cards.length,1);assert.ok(!JSON.stringify(calls.cards).includes('number'));assert.equal(calls.logs.length,0);});
 for(const holder of [{livemode:true},{status:'inactive'},{requirements:{disabled_reason:'past_due',past_due:['name']}}])test(`${variant}: holder must be eligible ${JSON.stringify(holder)}`,async()=>{const{context,calls}=fixture({holder});await assert.rejects(context.getCard('ic_fixture123'));assert.equal(calls.cards.length,1);});
 test(`${variant}: changed state after expansion rejects`,async()=>{const{context}=fixture({second:{status:'inactive'}});await assert.rejects(context.getCard('ic_fixture123'));});
 test(`${variant}: live key cannot retrieve`,async()=>{let f;try{f=fixture({key:'sk_live_fixture'});}catch{return;}await assert.rejects(f.context.getCard('ic_fixture123'));assert.equal(f.calls.cards.length,0);});
}
