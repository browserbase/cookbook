import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes, createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { load } = require('cheerio');
const { z } = require('zod/v4');
const source = stripTypeScriptTypes(readFileSync(new URL('../index.ts', import.meta.url), 'utf8')).replace(/^import .*;$/gm, '');
const declarations = source.slice(0, source.lastIndexOf('main().catch'));
const payload = 'payload '.repeat(120);
const article = `<html><head><title>Research &amp; results</title></head><body><p>${'Readable article text about a synthetic topic. '.repeat(30)}</p><a href="/one">One</a><a>Named anchor</a></body></html>`;
const shell = `<html><head><title>Empty app</title></head><body><div id="root"></div><script>${payload}</script></body></html>`;

function setup(change = {}) {
  const calls = [], logs = [], requests = [];
  const page = { goto: async url => calls.push(['goto', url]) };
  const browser = { context: { pages: async () => [page] }, close: async () => calls.push(['browser.close']) };
  const stagehand = { extract: async () => { calls.push(['extract']); return { data: { title: 'Synthetic rendered result', items: [] } }; }, close: async () => calls.push(['stagehand.close']) };
  const context = vm.createContext({
    load, z, JSON, console: { log: (...args) => logs.push(args.join(' ')), error() {}, warn() {} },
    process: { argv: ['node', 'index.ts', 'https://example.invalid/'], env: { BROWSERBASE_API_KEY: 'synthetic' }, exit: () => { throw Error('unexpected process exit'); } },
    Browserbase: class { fetchAPI = { create: async params => { requests.push(params); return { statusCode: change.statusCode ?? 200, content: change.content ?? article }; } }; },
    browserbase: { launch: async () => { calls.push(['launch']); return browser; } }, Stagehand: { create: async () => stagehand },
  });
  vm.runInContext(declarations + '\nglobalThis.needs=needsBrowserFallback;globalThis.parse=parseFromHtml;globalThis.run=main;', context);
  return { context, calls, logs, requests };
}

for (const [name, html] of [
  ['script-only shell', shell],
  ['mixed-case style', `<body><STYLE>${payload}</STYLE><div></div></body>`],
  ['inert template', `<body><template><p>${payload}</p></template></body>`],
  ['comments', `<body><!-- ${payload} --><div></div></body>`],
  ['hidden subtree', `<body><section hidden><p>${payload}</p></section></body>`],
  ['head metadata', `<html><head><title>${payload}</title></head><body></body></html>`],
  ['unclosed script', `<body><div></div><script>${payload}`],
  ['noscript fallback', `<body><noscript><p>${payload}</p></noscript></body>`],
]) test(`${name} cannot satisfy the content heuristic`, () => {
  const { context } = setup(); assert.equal(typeof context.needs(html, 200), 'string');
});

test('readable body text passes the approximate heuristic', () => {
  const { context } = setup(); assert.equal(context.needs(article, 200), null);
});

test('entities and malformed nesting are parsed as text', () => {
  const { context } = setup();
  assert.equal(context.needs(`<body><p>${'A &amp; B &lt; comparison '.repeat(80)}<p>End`, 200), null);
});

test('status, short response and challenge messages still trigger fallback', () => {
  const { context } = setup();
  assert.ok(context.needs(article, 403)); assert.ok(context.needs('<p>short</p>', 200));
  assert.ok(context.needs(`<body>Please enable JavaScript ${payload}</body>`, 200));
});

test('HTML parsing decodes title and excludes fake anchors in scripts and comments', () => {
  const { context } = setup();
  const html = article.replace('</body>', `<script>"<a href='/fake'>fake</a>"</script><!-- <a href='/fake'> --> <template><a>inert</a></template></body>`);
  const parsed = context.parse(html); assert.equal(parsed.title, 'Research & results'); assert.equal(parsed.linkCount, 2);
});

test('actual caller sends raw format and falls back for a script-only shell', async () => {
  const r = setup({ content: shell }); await r.context.run();
  assert.equal(r.requests[0].format, 'raw'); assert.equal(r.calls.filter(x => x[0] === 'launch').length, 1);
  assert.ok(r.calls.some(x => x[0] === 'extract')); assert.ok(r.calls.some(x => x[0] === 'browser.close'));
  assert.ok(!r.logs.some(x => x.includes('Title: Empty app')));
});

test('actual caller keeps the readable HTML fast path and states uncertainty', async () => {
  const r = setup(); await r.context.run(); assert.equal(r.requests[0].format, 'raw'); assert.equal(r.calls.length, 0);
  assert.ok(r.logs.some(x => x.includes('Research & results')));
  assert.ok(r.logs.some(x => /heuristic/i.test(x))); assert.ok(!r.logs.some(x => /returned sufficient content/i.test(x)));
});

test('non-string raw response cannot pass by JSON stringification', async () => {
  const r = setup({ content: { text: payload } }); await r.context.run(); assert.ok(r.calls.some(x => x[0] === 'launch'));
});
