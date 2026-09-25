import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes, createRequire } from 'node:module';
import vm from 'node:vm';
const { z } = createRequire(import.meta.url)('zod/v4');
const source = stripTypeScriptTypes(readFileSync(new URL('../index.ts', import.meta.url), 'utf8')).replace(/^import .*;$/gm, '');
const declarations = source.slice(0, source.lastIndexOf('main().catch'));
const link = { url: 'https://example.invalid/pricing', linkText: 'Read documentation' };

async function run(change = {}) {
  const logs = [], exits = [], closed = [], navigations = [];
  let extracts = 0, launches = 0;
  const context = vm.createContext({ z, URL, Set, Map,
    process: { env: {}, exit: code => exits.push(code) },
    console: { log: (...args) => logs.push(args.join(' ')), error() {}, warn() {} },
    browserbase: { launch: async () => {
      launches++;
      let currentUrl;
      const page = {
        goto: async url => { navigations.push(url); currentUrl = change.landed ?? url; if (change.navigationFails) throw Error('synthetic navigation failure'); if (change.noResponse) return null; return { ok: () => !change.httpError, status: () => 404, statusText: () => 'Not Found' }; },
        waitForLoadState: async () => {}, url: async () => currentUrl,
        title: async () => 'Pricing', evaluate: async () => change.exactText ? 'read documentation' : 'Pricing and payment plans',
      };
      const stagehand = {
        extract: async (_instruction, schema, options) => {
          if ('links' in schema.shape) return { data: { links: [change.link ?? link] } };
          assert.equal(options.page, page); extracts++;
          if (change.modelThrows || (change.firstAttemptFails && extracts === 1)) throw Error('synthetic model failure');
          const value = { pageTitle: 'Pricing', contentMatches: change.match ?? false, assessment: 'Pricing does not provide documentation', ...change.malformed };
          return { data: schema.parse(value) };
        },
        close: async () => closed.push('stagehand'),
      };
      return { context: { pages: async () => [page] }, stagehand, close: async () => closed.push('browser') };
    } },
    Stagehand: { create: async ({ browser }) => browser.stagehand },
  });
  vm.runInContext(declarations + '\nglobalThis.verify=verifySingleLink;globalThis.report=outputResults;', context);
  let result;
  if (change.main) {
    vm.runInContext(source.slice(source.lastIndexOf('main().catch')).replace('main().catch(', 'globalThis.done=main().catch('), context);
    await context.done;
  } else result = await context.verify(change.link ?? link);
  return { result, logs, exits, closed, extracts, launches, navigations, context };
}

for (const change of [{}, { exactText: true }, { landed: 'https://example.invalid/other' }]) test(`negative semantics survives routing/text evidence ${JSON.stringify(change)}`, async () => {
  const r = await run(change); assert.equal(r.result.success, false); assert.equal(r.result.reachable, true);
  assert.equal(r.result.contentMatches, false); assert.equal(r.result.contentStatus, 'mismatched'); assert.equal(r.extracts, 1);
  assert.deepEqual(r.closed, ['stagehand', 'browser']);
});
for (const change of [{ modelThrows: true }, { malformed: { contentMatches: 'true' } }]) test(`failed model assessment stays unknown ${JSON.stringify(change)}`, async () => {
  const r = await run(change); assert.equal(r.result.success, false); assert.equal(r.result.reachable, true);
  assert.equal(r.result.contentMatches, undefined); assert.equal(r.result.contentStatus, 'unknown'); assert.equal(r.extracts, 2);
});

test('a successful retry can produce a positive semantic assessment', async () => {
  const r = await run({ firstAttemptFails: true, match: true }); assert.equal(r.extracts, 2); assert.equal(r.result.success, true); assert.equal(r.result.contentStatus, 'matched');
});
for (const url of ['https://example.invalid/help/x.com', 'https://example.invalid/?next=https://x.com', 'https://x.com.example.invalid/', 'https://notx.com/', 'https://x.com@example.invalid/']) test(`ordinary destination is not social: ${url}`, async () => {
  const r = await run({ link: { ...link, url } }); assert.equal(r.extracts, 1); assert.equal(r.result.contentStatus, 'mismatched');
});
for (const url of ['https://x.com/example', 'https://X.COM./example']) test(`social host is explicitly skipped: ${url}`, async () => {
  const r = await run({ link: { ...link, url } }); assert.equal(r.extracts, 0); assert.equal(r.result.success, true); assert.equal(r.result.reachable, true);
  assert.equal(r.result.contentStatus, 'skipped'); assert.equal(r.result.contentMatches, undefined);
});

test('social redirect to an ordinary host does not skip content verification', async () => {
  const r = await run({ link: { ...link, url: 'https://x.com/example' }, landed: 'https://example.invalid/pricing' });
  assert.equal(r.extracts, 1); assert.equal(r.result.contentStatus, 'mismatched');
});
for (const change of [{ httpError: true }, { navigationFails: true }, { landed: 'about:blank' }]) test(`unreachable link remains separate ${JSON.stringify(change)}`, async () => {
  const r = await run(change); assert.equal(r.result.success, false); assert.equal(r.result.reachable, false); assert.equal(r.result.contentStatus, 'unknown'); assert.equal(r.extracts, 0);
});

test('invalid URL is rejected before allocating a browser', async () => {
  const r = await run({ link: { ...link, url: 'javascript:alert(1)' } }); assert.equal(r.result.success, false); assert.equal(r.launches, 0);
});
for (const change of [{}, { modelThrows: true }, { match: true }]) test(`actual CLI reports semantic outcomes ${JSON.stringify(change)}`, async () => {
  const r = await run({ ...change, main: true }); assert.deepEqual(r.exits, change.match ? [] : [1]);
  const reports = r.logs.filter(x => x.startsWith('{')).map(x => JSON.parse(x)).filter(x => 'totalLinks' in x);
  assert.ok(reports.length > 0); assert.equal(reports[0].reachable, 1); assert.equal(reports[0].successful, change.match ? 1 : 0);
  assert.equal(reports[0].failed, change.match ? 0 : 1);
  if (!change.match) assert.ok(!r.logs.some(x => x.includes('All links verified!') || x.includes('Script completed successfully')));
});

test('missing HTTP response cannot establish reachability', async () => {
  const r = await run({ noResponse: true }); assert.equal(r.result.reachable, false); assert.equal(r.result.success, false); assert.equal(r.result.contentStatus, 'unknown'); assert.equal(r.extracts, 0);
});
