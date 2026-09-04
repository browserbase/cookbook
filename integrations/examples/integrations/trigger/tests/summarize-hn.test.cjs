const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const article = { title: 'Synthetic article', link: 'https://example.com/article', summary: 'Synthetic summary.' };
function fixture({ runs = [{ ok: true, output: article }], result = { data: { id: 'synthetic-email-id' }, error: null }, env = {}, sendError, articleCount = 1 } = {}) {
  const tasks = new Map(), sends = [], logs = [];
  let clients = 0;
  const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../src/trigger/summarize-hn.tsx'), 'utf8'))
    .replace(/^import .*;\n/gm, '').replace(/export /g, '') + stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../src/trigger/with-browser.ts'), 'utf8')).replace(/export /g, '');
  const task = definition => { tasks.set(definition.id, definition); return { ...definition, batchTriggerAndWait: async () => ({ runs }) }; };
  vm.runInNewContext(source, {
    URL, process: { env }, task, schedules: { task }, wait: { for: async () => {} },
    logger: { info(message, fields) { logs.push({ message, fields }); } },
    OpenAI: class {},
    Resend: class { constructor() { clients++; } emails = { async send(payload, options) { sends.push({ payload, options }); if (sendError) throw sendError; return result; } }; },
    createElement: (type, props) => ({ type, props }), HNSummaryEmail: 'synthetic-email', render: async value => JSON.stringify(value.props),
    puppeteer: { async connect() { return { async newPage() { return { async goto() {}, async evaluate() { return Array.from({ length: articleCount }, () => ({ title: article.title, link: article.link })); } }; }, async close() {} }; } },
  });
  return { tasks, sends, logs, clients: () => clients };
}
const sendEnv = { RESEND_API_KEY: 'synthetic-key', HN_EMAIL_FROM: 'sender@example.com', HN_EMAIL_TO: 'recipient@example.com' };
const payload = { send: true, deliveryId: 'synthetic-reviewed-email', articles: [article] };

test('scheduled summary returns a reviewable draft without constructing an email client', async () => {
  const f = fixture();
  const result = await f.tasks.get('summarize-hacker-news').run();
  assert.equal(result.status, 'ready-for-review');
  assert.equal(result.articles[0].summary, article.summary);
  assert.match(result.html, /Synthetic summary/);
  assert.equal(f.clients(), 0);
  assert.equal(f.sends.length, 0);
});

test('failed, partial, missing and empty summaries never become ready drafts or emails', async () => {
  for (const runs of [[], [{ ok: false }], [{ ok: true, output: article }, { ok: false }], [{ ok: true, output: { ...article, summary: null } }]]) {
    const f = fixture({ runs, articleCount: runs.length === 2 ? 2 : 1 });
    await assert.rejects(f.tasks.get('summarize-hacker-news').run(), /incomplete|summary/);
    assert.equal(f.clients(), 0);
    assert.equal(f.logs.some(entry => entry.message.includes('ready for review')), false);
  }
});

test('sending requires explicit action, complete content and configured addresses before provider use', async () => {
  for (const value of [null, {}, { ...payload, send: false }, { ...payload, send: 'true' }, { ...payload, deliveryId: '' }, { ...payload, articles: [] }, { ...payload, articles: [{ ...article, link: 'javascript:alert(1)' }] }]) {
    const f = fixture({ env: sendEnv });
    await assert.rejects(f.tasks.get('send-hacker-news-summary').run(value));
    assert.equal(f.clients(), 0);
  }
  for (const env of [{}, { ...sendEnv, HN_EMAIL_TO: '' }, { ...sendEnv, HN_EMAIL_FROM: 'sender@example.com\r\nBcc:other@example.com' }]) {
    const f = fixture({ env });
    await assert.rejects(f.tasks.get('send-hacker-news-summary').run(payload), /Configure/);
    assert.equal(f.sends.length, 0);
  }
});

test('provider rejection or missing acceptance ID cannot report success', async () => {
  for (const result of [{ data: null, error: { message: 'synthetic rejection' } }, { data: { id: 'id' }, error: { message: 'rejected' } }, { data: {}, error: null }]) {
    const f = fixture({ env: sendEnv, result });
    await assert.rejects(f.tasks.get('send-hacker-news-summary').run(payload), /did not confirm acceptance/);
    assert.equal(f.logs.some(entry => entry.message.includes('accepted')), false);
  }
  const f = fixture({ env: sendEnv, sendError: new Error('synthetic network failure') });
  await assert.rejects(f.tasks.get('send-hacker-news-summary').run(payload), /network failure/);
  assert.equal(f.logs.some(entry => entry.message.includes('accepted')), false);
});

test('accepted send uses only configured addresses and the stable retry key', async () => {
  const f = fixture({ env: sendEnv });
  const sender = f.tasks.get('send-hacker-news-summary');
  assert.equal(sender.retry.maxAttempts, 1);
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await sender.run(payload);
    assert.equal(result.status, 'accepted');
    assert.equal(result.emailId, 'synthetic-email-id');
    assert.equal(f.sends[attempt].payload.from, sendEnv.HN_EMAIL_FROM);
    assert.deepEqual(Array.from(f.sends[attempt].payload.to), [sendEnv.HN_EMAIL_TO]);
    assert.equal(f.sends[attempt].options.idempotencyKey, 'hn-summary-synthetic-reviewed-email');
  }
  assert.equal(f.logs.some(entry => /delivered|sent successfully/.test(entry.message)), false);
});
