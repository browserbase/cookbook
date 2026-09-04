const {test}=require('node:test'),assert=require('node:assert/strict');
const {runBenchmark}=require('../dist/runner.js');
const {RunResources}=require('../dist/run-resources.js');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const base={sites:['https://synthetic.invalid'],runs:2,runTimeoutMs:10};

test('timeout closes resources and waits for the old operation to settle before next measurement',async()=>{
 const events=[];let index=0;
 const competitor={name:'synthetic',label:'synthetic',async createStagehand(resources){
   const id=++index;events.push('create'+id);
   let release;const closed=new Promise(resolve=>release=resolve);
   const browser=await resources.own({context:{pages:async()=>[{closed,id}]},async close(){events.push('close'+id);release()}});
   return resources.own({browser,async close(){}});
 }};
 const scenario={name:'synthetic',steps:[{name:'work',async run(_stagehand,page,{signal}){await page.closed;await delay(10);events.push('settle'+page.id);signal.throwIfAborted()}}]};
 const results=await runBenchmark({...base,competitors:[competitor],scenarios:[scenario]});
 assert.deepEqual(events,['create1','close1','settle1','create2','close2','settle2']);
 assert.ok(results.every(r=>/timed out/.test(r.error)));
});

test('late allocation after deadline is closed before it can start scenario work',async()=>{
 const events=[];let index=0;
 const competitor={name:'synthetic',label:'synthetic',async createStagehand(resources){
   const id=++index;events.push('create'+id);await delay(20);
   await resources.own({async close(){await delay(5);events.push('close'+id)}});
   throw new Error('must abort before this line');
 }};
 const results=await runBenchmark({...base,competitors:[competitor],scenarios:[{name:'synthetic',steps:[{name:'never',run:async()=>assert.fail('scenario started')}]}]});
 assert.deepEqual(events,['create1','close1','create2','close2']);
 assert.ok(results.every(r=>/timed out/.test(r.error)));
});

test('factory failure after allocation cleans the owned browser',async()=>{
 let closes=0;
 const results=await runBenchmark({...base,runs:1,competitors:[{name:'synthetic',label:'synthetic',async createStagehand(resources){await resources.own({async close(){closes++}});throw new Error('initialization failed')}}],scenarios:[{name:'synthetic',steps:[]}]});
 assert.equal(closes,1);assert.match(results[0].error,/initialization failed/);
});

test('cleanup failure stops the entire benchmark instead of contaminating later measurements',async()=>{
 let creates=0, browserCloses=0;
 const competitor={name:'synthetic',label:'synthetic',async createStagehand(){creates++;return {browser:{context:{pages:async()=>[{}]},async close(){browserCloses++}},async close(){throw new Error('cleanup failure')}}}};
 await assert.rejects(runBenchmark({...base,competitors:[competitor],scenarios:[{name:'synthetic',steps:[]}]}),/cleanup failed/);
 assert.equal(creates,1);assert.equal(browserCloses,1);
});

test('resource close starts independently and each registered handle closes once',async()=>{
 const controller=new AbortController(),resources=new RunResources(controller.signal);let release, first=0,second=0;
 const one={close:async()=>{first++;await new Promise(resolve=>release=resolve)}};
 await resources.own(one);await resources.own(one);
 await resources.own({close:async()=>{second++;release()}});
 await resources.close();await resources.close();assert.equal(first,1);assert.equal(second,1);
});
