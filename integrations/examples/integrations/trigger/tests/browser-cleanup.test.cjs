const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { randomUUID } = require('node:crypto');
function source(file) {
  return stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../src/trigger', file), 'utf8'))
    .replace(/^import .*;\n/gm, '').replace(/export /g, '');
}
function fixture(file, id, failures = []) {
  const tasks = new Map(), events = [];
  const fail = stage => { events.push(stage); if (failures.includes(stage)) throw new Error(`synthetic ${stage}`); };
  const article = { title: 'Synthetic', link: 'https://example.com', summary: 'Synthetic summary' };
  const page = {
    async goto() { fail('navigate'); return { url: () => 'https://example.com' }; },
    async setContent() { fail('navigate'); },
    async title() { fail('extract'); return 'Browserbase cookbook worker check'; },
    async pdf() { fail('pdf'); return Buffer.from('synthetic'); },
    async evaluate() { fail('extract'); return id === 'summarize-hacker-news' ? [article] : id === 'puppeteer-scrape-with-proxy' ? 42 : 'Synthetic content'; },
    async setRequestInterception() { fail('interception'); }, on() {},
  };
  const browser = { async newPage() { fail('page'); return page; }, async close() { fail('close'); } };
  const acquire = async () => { fail('connect'); return browser; };
  const task = value => { tasks.set(value.id, value); return { ...value, async batchTriggerAndWait() { fail('batch'); return { runs: [{ ok: true, output: article }] }; } }; };
  const context = {
    URL, randomUUID, process: { env: { S3_BUCKET: 'synthetic-bucket', S3_PUBLIC_BASE_URL: 'https://downloads.example.com' } },
    task, schedules: { task }, logger: { info() {}, log() {}, error() {} }, wait: { for: async () => {} },
    puppeteer: { launch: acquire, connect: acquire },
    OpenAI: class { chat = { completions: { async create() { fail('model'); return { choices: [{ message: { content: 'Synthetic summary' } }] }; } } }; },
    Resend: class { constructor() { throw new Error('Email forbidden'); } },
    createElement: (...args) => args, HNSummaryEmail: 'synthetic', render: async () => { fail('render'); return '<p>synthetic</p>'; },
    S3Client: class { async send() { fail('upload'); } }, PutObjectCommand: class { constructor(value) { Object.assign(this, value); } },
  };
  vm.runInNewContext(source('with-browser.ts') + source('storage-target.ts') + source(file), context);
  return { run: () => tasks.get(id).run({ title: article.title, link: article.link }), events };
}
const cases = [
  ['puppeteer-log-page-title.tsx', 'puppeteer-log-title', ['connect', 'page', 'navigate', 'extract', 'close']],
  ['puppeteer-webpage-to-pdf.tsx', 'puppeteer-webpage-to-pdf', ['connect', 'page', 'navigate', 'pdf', 'close', 'upload']],
  ['puppeteer-scrape-with-proxy.tsx', 'puppeteer-scrape-with-proxy', ['connect', 'page', 'navigate', 'extract', 'close']],
  ['summarize-hn.tsx', 'summarize-hacker-news', ['connect', 'page', 'navigate', 'extract', 'close', 'batch', 'render']],
  ['summarize-hn.tsx', 'scrape-and-summarize-articles', ['connect', 'page', 'interception', 'navigate', 'extract', 'close', 'model']],
];

test('each actual task closes every acquired browser on success and all task-specific error paths', async () => {
  for (const [file, id, stages] of cases) {
    for (const failure of [null, ...stages]) {
      const f = fixture(file, id, failure ? [failure] : []);
      if (failure) await assert.rejects(f.run(), new RegExp(`synthetic ${failure}`));
      else await f.run();
      assert.equal(f.events.filter(event => event === 'close').length, failure === 'connect' ? 0 : 1, `${id}/${failure}`);
      for (const stage of ['upload', 'batch', 'model', 'render']) {
        if (f.events.includes(stage)) assert.ok(f.events.indexOf('close') < f.events.indexOf(stage), `${id} closes before ${stage}`);
      }
    }
  }
});

test('navigation failures remain available when cleanup also fails', async () => {
  for (const [file, id] of cases) {
    const f = fixture(file, id, ['navigate', 'close']);
    await assert.rejects(f.run(), error => {
      assert.equal(error.name, 'AggregateError');
      assert.deepEqual(Array.from(error.errors, value => value.message), ['synthetic navigate', 'synthetic close']);
      return true;
    });
    assert.equal(f.events.filter(event => event === 'close').length, 1);
  }
});
