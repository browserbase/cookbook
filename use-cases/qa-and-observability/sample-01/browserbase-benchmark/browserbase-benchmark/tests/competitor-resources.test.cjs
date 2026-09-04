const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {RunResources}=require('../dist/run-resources.js');

for(const name of ['browserbase','local-chromium']) {
 for(const late of [false,true]) test(`${name} owns allocation across ${late?'late startup':'Stagehand setup failure'}`,async()=>{
  const controller=new AbortController(),resources=new RunResources(controller.signal);
  let closes=0, creates=0;
  const browser={async close(){closes++}};
  const adapter={async launch(){if(late)controller.abort(new Error('deadline'));return browser}};
  const context={process:{env:{}},browserbase:adapter,localBrowser:adapter,
   resolveChromiumPath:async()=>'/synthetic/chrome',
   StagehandCreateOptionsSchema:{parse:value=>value},
   Stagehand:{async create(){creates++;throw new Error('setup failed')}}};
  const source=fs.readFileSync(path.join(__dirname,`../dist/competitors/${name}.js`),'utf8')
   .replace(/^import .*;\n/gm,'').replace('export const competitor','globalThis.competitor');
  vm.runInNewContext(source,context);
  await assert.rejects(context.competitor.createStagehand(resources),late?/deadline/:/setup failed/);
  await resources.close();assert.equal(closes,1);assert.equal(creates,late?0:1);
 });
}
