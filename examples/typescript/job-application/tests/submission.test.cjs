const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const { test } = require('node:test');
const vm = require('node:vm');
const { z } = require('zod/v4');

async function run(change = {}, useMain = false) {
  const calls = []; const closed = []; const logs = []; const waits = [];
  let acquired = 0; let released = 0; let launches = 0;
  const url = 'https://agent-job-board.vercel.app/jobs/1';
  const job = { url: change.jobUrl || url, title: 'Synthetic Role' };
  const browserbase = { launch: async () => {
    const id = launches++;
    if (change.launchFails && (!change.queue || id === 0)) throw new Error('synthetic launch');
    let count = 0; let name; let email;
    const page = {
      goto: async () => {}, url: async () => change.resultUrl || url,
      waitForTimeout: async ms => waits.push(ms),
      locator: () => ({ count: async () => change.inputCount ?? 1, setInputFiles: async () => {} }),
      evaluate: async () => {
        if (count < 5) return { name, email, region: 'us-west-2', resume: { name: 'Agent Resume.pdf', size: 11, type: 'application/pdf' }, multiRegion: true, formCount: 1, headings: [], paragraphs: [], ...change.before };
        return { formCount: 0, headings: ['Deployment Request Submitted!'], paragraphs: ['Your application for Synthetic Role at Example has been received. Deployment protocols will be initiated soon.'], ...change.after };
      },
    };
    const stagehand = {
      act: async (instruction, options) => {
        assert.equal(options.page, page);
        count++; calls.push(instruction);
        if (instruction.includes('identifier field')) name = instruction.split(' with ')[1];
        if (instruction.includes('endpoint field')) email = instruction.split(' with ')[1];
        return { data: { success: count !== change.failAction } };
      },
      observe: async () => ({ data: Array.from({ length: change.observed ?? 1 }, () => ({ selector: '#resume' })) }),
      extract: async () => ({ data: change.emptyJobs ? [] : [job] }),
      close: async () => { closed.push('stagehand'); if (change.closeFails) throw new Error('synthetic close'); },
    };
    return { id, stagehand, context: { pages: async () => [page] }, close: async () => { closed.push('browser'); } };
  } };
  const context = vm.createContext({ URL, Buffer, AbortSignal, Math, Date,
    process: { env: { BROWSERBASE_API_KEY: 'synthetic', BROWSERBASE_PROJECT_ID: 'synthetic' } },
    console: { log: (...x) => logs.push(x.join(' ')), error: () => {} },
    fetch: async () => ({ ok: !change.fetchFails, status: 500, arrayBuffer: async () => Buffer.from(change.invalidPdf ? 'not a pdf' : '%PDFfixture') }),
  });
  let source = readFileSync(require('node:path').join(__dirname,'../index.ts'),'utf8');
  source = source.slice(0,source.lastIndexOf('main().catch')) + '\nexport { main };';
  const mod = new vm.SourceTextModule(stripTypeScriptTypes(source), { context });
  await mod.link(async name => {
    const exports = name === 'dotenv/config' ? {} : name === 'zod/v4' ? { z } : name === '@browserbasehq/sdk' ? { default: class { projects = { retrieve: async () => ({ concurrency: change.concurrency ?? 1 }) }; } } : {
      browserbase, Stagehand: { create: async ({ browser }) => { if (change.initFails && (!change.queue || browser.id === 0)) throw new Error('synthetic init'); return browser.stagehand; } },
    };
    return new vm.SyntheticModule(Object.keys(exports),function() { for (const [k,v] of Object.entries(exports)) this.setExport(k,v); },{ context });
  });
  await mod.evaluate();
  let error; let result;
  try {
    if (change.queue) {
      const permit = mod.namespace.createSemaphore(1);
      result = await Promise.allSettled(Array.from({ length: 3 }, () => mod.namespace.applyToJob(job, async () => { await permit.semaphore(); acquired++; }, () => { released++; permit.release(); })));
    } else result = useMain ? await mod.namespace.main() : await mod.namespace.applyToJob(job,async () => { acquired++; },() => { released++; }); }
  catch (e) { error=e; }
  return { error,result,calls,closed,logs,waits,acquired,released,launches };
}

test('confirmed local demo after owned cleanup',async () => {
  const r=await run(); assert.equal(r.error,undefined); assert.equal(r.result,'Synthetic Role');
  assert.deepEqual(r.closed,['stagehand','browser']);assert.equal(r.released,1);assert.equal(r.calls.length,5);
  assert.ok(r.logs.some(x=>x.includes('confirmed locally')));
});
for (let i=1;i<=5;i++) test(`failed action ${i}`,async () => {
  const r=await run({failAction:i});assert.ok(r.error);assert.equal(r.calls.length,i);assert.equal(r.released,1);assert.ok(!r.logs.some(x=>x.includes('confirmed locally')));
});
for (const change of [
  {observed:0},{observed:2},{inputCount:2},{fetchFails:true},{invalidPdf:true},
  {before:{name:'wrong'}},{before:{resume:null}},{before:{multiRegion:false}},{before:{headings:['Deployment Request Submitted!']}},
  {after:{headings:[]}},{after:{formCount:1}},{after:{paragraphs:['Other job']}},{resultUrl:'https://elsewhere.invalid/'},
  {initFails:true},{closeFails:true},{launchFails:true},
]) test(JSON.stringify(change),async () => {
  const r=await run(change);assert.ok(r.error);assert.equal(r.result,undefined);assert.equal(r.released,1);
  assert.ok(!r.logs.some(x=>x.includes('confirmed locally')));assert.ok(r.waits.length<=20);
  assert.deepEqual(r.closed,change.launchFails?[]:change.initFails?['browser']:['stagehand','browser']);
});
test('invalid job rejected before acquiring a permit',async () => {
  const r=await run({jobUrl:'https://elsewhere.invalid/jobs/1'});assert.ok(r.error);assert.equal(r.acquired,0);assert.equal(r.launches,0);
});
test('actual main counts confirmed demo and closes discovery',async () => {
  const r=await run({},true);assert.equal(r.error,undefined);assert.ok(r.logs.includes('Confirmed 1 of 1 demo submissions'));
  assert.deepEqual(r.closed,['stagehand','browser','stagehand','browser']);
});
test('actual main records failed application without claiming completion',async () => {
  const r=await run({after:{headings:[]}},true);assert.ok(r.error);assert.ok(r.logs.includes('Confirmed 0 of 1 demo submissions'));
  assert.ok(!r.logs.some(x=>x.includes('All demo confirmations')));
});
for (const change of [{concurrency:0},{concurrency:-1},{concurrency:1.5},{emptyJobs:true}]) test(`main rejects ${JSON.stringify(change)}`,async()=> {
  const r=await run(change,true);assert.ok(r.error);assert.ok(!r.logs.some(x=>x.includes('All demo confirmations')));
});

for (const change of [{ launchFails: true }, { initFails: true }]) test(`allocation failure releases the real semaphore for queued jobs ${JSON.stringify(change)}`, { timeout: 2000 }, async () => {
  const r = await run({ ...change, queue: true });
  assert.equal(r.error, undefined);
  assert.deepEqual(Array.from(r.result, x => x.status), ['rejected', 'fulfilled', 'fulfilled']);
  assert.equal(r.acquired, 3);
  assert.equal(r.released, 3);
  assert.equal(r.launches, 3);
  assert.deepEqual(r.closed, change.initFails ? ['browser', 'stagehand', 'browser', 'stagehand', 'browser'] : ['stagehand', 'browser', 'stagehand', 'browser']);
});
