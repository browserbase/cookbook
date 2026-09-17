const { test, after } = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const vm = require('node:vm'); const http = require('node:http');
const { stripTypeScriptTypes } = require('node:module'); const { pathToFileURL } = require('node:url');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'statement-download-'));
const source = fs.readFileSync(path.join(__dirname, '../download-statement.ts'), 'utf8');
fs.mkdirSync(path.join(directory, 'public'));
const expected = fs.readFileSync(path.join(__dirname, '../public/tax-statement-2024.pdf'));
fs.writeFileSync(path.join(directory, 'public/tax-statement-2024.pdf'), expected);
fs.writeFileSync(path.join(directory, 'download.mjs'), stripTypeScriptTypes(source));
const modulePromise = import(pathToFileURL(path.join(directory, 'download.mjs')).href);
after(() => fs.rmSync(directory, { recursive: true, force: true }));
const correct = { base64: expected.toString('base64'), bytes: expected.length };
test('verified exact fixture is saved privately in unique directories without overwriting', async () => {
  const { downloadStatement } = await modulePromise; const root = path.join(directory, 'saved');
  const first = await downloadStatement({ evaluate: async () => correct }, 'https://portal.test', root);
  const second = await downloadStatement({ evaluate: async () => correct }, 'https://portal.test', root);
  assert.notEqual(first.path, second.path); assert.deepEqual(fs.readFileSync(first.path), expected);
  assert.equal(first.bytes, expected.length); assert.equal(first.sha256.length, 64);
  assert.equal(fs.statSync(first.path).mode & 0o777, 0o600); assert.equal(fs.statSync(path.dirname(first.path)).mode & 0o777, 0o700);
});
for (const [name, value] of [ ['empty', { base64: '', bytes: 0 }], ['malformed', {}], ['bad-encoding', { ...correct, base64: '!' + correct.base64 }], ['wrong-length', { ...correct, bytes: 1 }], ['HTML', { base64: Buffer.from('<html>Login</html>').toString('base64'), bytes: 18 }], ['truncated', { base64: expected.subarray(0, -1).toString('base64'), bytes: expected.length - 1 }]]) test(`reject ${name} before writing an artifact`, async () => {
  const { downloadStatement } = await modulePromise; const root = path.join(directory, name);
  await assert.rejects(downloadStatement({ evaluate: async () => value }, 'https://portal.test', root)); assert(!fs.existsSync(root));
});
test('filesystem failure is fatal and an existing file is preserved', async () => {
  const { downloadStatement } = await modulePromise; const file = path.join(directory, 'existing'); fs.writeFileSync(file, 'keep');
  await assert.rejects(downloadStatement({ evaluate: async () => correct }, 'https://portal.test', file)); assert.equal(fs.readFileSync(file, 'utf8'), 'keep');
});
async function requestFixture(t, options = {}) {
  const server = http.createServer((_req, res) => {
    res.writeHead(options.status ?? 200, { 'content-type': options.type ?? 'application/pdf', ...options.headers });
    if (options.hang) { res.write(expected.subarray(0, 1)); return; }
    res.end(options.body ?? expected);
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const { fetchStatement } = await modulePromise;
  const fn = vm.runInNewContext(`(${fetchStatement.toString()})`, {
    location: { origin: options.wrongOrigin ? 'http://wrong.test' : origin, pathname: options.wrongPage ? '/' : '/documents' },
    document: { querySelectorAll: () => options.missingLink ? [] : [{ href: `${origin}/public/tax-statement-2024.pdf` }] },
    fetch, AbortController, setTimeout, clearTimeout, URL, btoa,
  });
  return () => fn(origin);
}
test('actual loopback HTTP bytes are retrieved with browser callback contract', async t => {
  const read = await requestFixture(t); const result = await read(); assert.equal(result.base64, correct.base64); assert.equal(result.bytes, expected.length);
});
for (const [name, options] of [['unauthorized', { status: 401 }], ['redirect', { status: 302, headers: { location: '/login' } }], ['HTML', { type: 'text/html' }], ['empty', { body: Buffer.alloc(0) }], ['oversized', { body: Buffer.alloc(1024 * 1024 + 1) }], ['wrong-origin', { wrongOrigin: true }], ['wrong-page', { wrongPage: true }], ['missing-link', { missingLink: true }]]) test(`browser fetch rejects ${name}`, async t => { const read = await requestFixture(t, options); await assert.rejects(read()); });
test('browser fetch aborts an unfinished response within its deadline', { timeout: 20_000 }, async t => { const read = await requestFixture(t, { hang: true }); await assert.rejects(read()); });
