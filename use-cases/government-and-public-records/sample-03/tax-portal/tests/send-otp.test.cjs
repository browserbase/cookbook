const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { stripTypeScriptTypes } = require('node:module');

// Load complete production modules with real Express; importing server.ts would load dotenv.
const modules = fs.mkdtempSync(path.join(os.tmpdir(), 'tax-portal-http-'));
for (const name of ['portal', 'portal-pages', 'email-delivery', 'server-config', 'otp-message']) {
  let source = fs.readFileSync(path.join(__dirname, `../${name}.ts`), 'utf8');
  source = source.replace('from "express"', `from ${JSON.stringify(pathToFileURL(require.resolve('express')).href)}`)
    .replace('./portal-pages.ts', './portal-pages.mjs').replaceAll('./otp-message.ts', './otp-message.mjs');
  fs.writeFileSync(path.join(modules, `${name}.mjs`), stripTypeScriptTypes(source));
}
after(() => fs.rmSync(modules, { recursive: true, force: true }));
const appModule = import(pathToFileURL(path.join(modules, 'portal.mjs')).href);
const deliveryModule = import(pathToFileURL(path.join(modules, 'email-delivery.mjs')).href);
const configModule = import(pathToFileURL(path.join(modules, 'server-config.mjs')).href);
const accepted = { data: { id: 'synthetic-message' }, error: null };

async function fixture(t, options = {}) {
  const { createTaxPortal } = await appModule;
  const { acceptedEmailDelivery } = await deliveryModule;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tax-portal-pdf-'));
  const statementPath = options.packagedFile ? path.join(__dirname, '../public/tax-statement-2024.pdf') : path.join(directory, 'statement.pdf');
  if (!options.missingFile && !options.packagedFile) fs.writeFileSync(statementPath, '%PDF-1.4\nSYNTHETIC TEST DOCUMENT\n');
  let time = 0;
  const messages = [];
  const origin = options.origin ?? 'http://localhost:3000';
  const app = createTaxPortal({ origin, recipient: options.recipient ?? 'fixture@example.test', statementPath,
    clock: () => time,
    deliverCode: acceptedEmailDelivery(async message => {
      messages.push(message);
      return options.send ? options.send(message, messages.length) : accepted;
    }, 'sender@example.test'),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  function browser() {
    return { cookie: '', csrf: '', async call(route, options = {}) {
      const method = options.method ?? (options.form !== undefined || options.json !== undefined ? 'POST' : 'GET');
      const body = options.json !== undefined ? JSON.stringify({ csrf: this.csrf, ...options.json }) :
        options.form !== undefined ? new URLSearchParams({ csrf: this.csrf, ...options.form }).toString() : undefined;
      const headers = { host: new URL(origin).host, cookie: this.cookie, ...options.headers };
      if (body !== undefined) {
        headers['content-type'] = options.json !== undefined ? 'application/json' : 'application/x-www-form-urlencoded';
        headers['content-length'] = Buffer.byteLength(body);
      }
      const response = await new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: route, method, headers }, res => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
        });
        req.on('error', reject); req.end(body);
      });
      if (response.headers['set-cookie']) this.cookie = response.headers['set-cookie'][0].split(';')[0];
      const csrf = response.body.match(/name="csrf" value="([a-f0-9]{64})"/);
      if (csrf) this.csrf = csrf[1];
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.equal(response.headers['referrer-policy'], 'same-origin');
      return response;
    }, async login() {
      assert.equal((await this.call('/')).status, 200);
      const response = await this.call('/login', { form: { username: 'demo_agent', password: 'demo123' } });
      assert.equal(response.status, 200);
      return response;
    } };
  }
  const code = (index = messages.length - 1) => {
    const match = messages[index].html.match(/\b\d{6}\b/);
    assert(match, 'synthetic provider observed six-digit code'); return match[0];
  };
  return { browser, messages, code, advance: amount => { time += amount; } };
}
async function sent(f, b) { const response = await b.call('/send-otp', { form: {} }); assert.equal(response.status, 302); assert.equal(response.headers.location, '/verify-otp'); return f.code(); }
async function waitFor(predicate) { for (let n = 0; n < 100; n++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); } assert.fail('fixture provider was not called'); }

for (const [name, result] of [
  ['rejection', { data: null, error: { message: 'private-provider-marker' } }],
  ['missing-data', { error: null, data: null }], ['missing-id', { data: {} }],
  ['empty-id', { data: { id: ' ' } }], ['null-result', null], ['throw', undefined],
]) test(`provider ${name} cannot activate a code or redirect`, async t => {
  const f = await fixture(t, { send: async () => { if (name === 'throw') throw Error('private-provider-marker'); return result; } });
  const b = f.browser(); await b.login();
  const response = await b.call('/send-otp', { form: {} });
  assert.equal(response.status, 502); assert.equal(response.headers.location, undefined);
  assert(!response.body.includes('private-provider-marker'));
  assert.equal((await b.call('/verify-otp', { form: { otp: f.code() } })).status, 401);
  assert.equal((await b.call('/documents')).status, 401);
});
test('missing recipient makes no provider call', async t => {
  const f = await fixture(t, { recipient: ' ' }); const b = f.browser(); await b.login();
  assert.equal((await b.call('/send-otp', { form: {} })).status, 503); assert.equal(f.messages.length, 0);
});
test('anonymous direct page and PDF GET/HEAD requests are denied', async t => {
  const f = await fixture(t); const b = f.browser();
  for (const route of ['/documents', '/public/tax-statement-2024.pdf']) for (const method of ['GET', 'HEAD']) {
    assert.equal((await b.call(route, { method })).status, 401);
  }
  assert.equal((await b.call('/public/anything-else.pdf')).status, 404);
  await b.call('/');
  assert.equal((await b.call('/send-otp', { form: {} })).status, 401);
  assert.equal(f.messages.length, 0);
});
test('accepted code verifies only its session; rotates cookie; protects actual document bytes', async t => {
  const f = await fixture(t); const a = f.browser(); const b = f.browser();
  await a.login(); await b.login(); const oldCookie = a.cookie; const oldCsrf = a.csrf;
  const codeA = await sent(f, a);
  assert.equal((await b.call('/verify-otp', { form: { otp: codeA } })).status, 401);
  const response = await a.call('/verify-otp', { form: { otp: codeA } });
  assert.equal(response.status, 302); assert.equal(response.headers.location, '/documents'); assert.notEqual(a.cookie, oldCookie);
  assert.equal((await a.call('/documents')).status, 200);
  const file = await a.call('/public/tax-statement-2024.pdf');
  assert.equal(file.status, 200); assert(file.body.includes('SYNTHETIC TEST DOCUMENT'));
  assert.equal((await a.call('/public/tax-statement-2024.pdf', { method: 'HEAD' })).status, 200);
  assert.equal((await b.call('/documents')).status, 401);
  const stale = f.browser(); stale.cookie = oldCookie; stale.csrf = oldCsrf;
  assert.equal((await stale.call('/verify-otp', { form: { otp: codeA } })).status, 401);
  await a.call('/');
  assert.equal((await a.call('/verify-otp', { form: { otp: codeA } })).status, 401);
});
test('independent issued challenges survive other owners sending and verifying', async t => {
  const f = await fixture(t); const a = f.browser(); const b = f.browser(); await a.login(); await b.login();
  const codeA = await sent(f, a); const codeB = await sent(f, b);
  assert.equal((await a.call('/verify-otp', { form: { otp: codeA } })).status, 302);
  assert.equal((await b.call('/verify-otp', { form: { otp: codeB } })).status, 302);
});
for (const supplied of [null, undefined, 123456, {}, '']) test(`unissued malformed code is denied: ${JSON.stringify(supplied)}`, async t => {
  const f = await fixture(t); const b = f.browser(); await b.login();
  assert.equal((await b.call('/verify-otp', { json: { otp: supplied } })).status, 401);
  assert.equal((await b.call('/documents')).status, 401);
});
test('challenge expires exactly ten minutes after acceptance; authenticated access also expires', async t => {
  const f = await fixture(t); const a = f.browser(); await a.login(); const expiredCode = await sent(f, a);
  f.advance(600_000);
  assert.equal((await a.call('/verify-otp', { form: { otp: expiredCode } })).status, 401);
  const code = await sent(f, a);
  assert.equal((await a.call('/verify-otp', { form: { otp: code } })).status, 302);
  f.advance(600_000);
  assert.equal((await a.call('/documents')).status, 401);
});
test('five failed submissions exhaust a challenge including malformed JSON', async t => {
  const f = await fixture(t); const b = f.browser(); await b.login(); const code = await sent(f, b);
  for (const otp of [null, 123456, {}, '', 'not-a-code']) assert.equal((await b.call('/verify-otp', { json: { otp } })).status, 401);
  assert.equal((await b.call('/verify-otp', { form: { otp: code } })).status, 401);
});
test('resend cooldown preserves active code; five-send budget survives login rotation', async t => {
  const f = await fixture(t); const b = f.browser(); await b.login(); const code = await sent(f, b);
  assert.equal((await b.call('/send-otp', { form: {} })).status, 429); assert.equal(f.messages.length, 1);
  assert.equal((await b.call('/verify-otp', { form: { otp: code } })).status, 302);
  for (let n = 1; n < 5; n++) { f.advance(60_000); await b.login(); await sent(f, b); }
  f.advance(60_000); await b.login();
  assert.equal((await b.call('/send-otp', { form: {} })).status, 429); assert.equal(f.messages.length, 5);
});
test('same-owner concurrent request is rejected without invalidating pending acceptance', async t => {
  let accept; const f = await fixture(t, { send: () => new Promise(resolve => { accept = resolve; }) });
  const b = f.browser(); await b.login();
  const pending = b.call('/send-otp', { form: {} }); await waitFor(() => accept);
  assert.equal((await b.call('/send-otp', { form: {} })).status, 409); assert.equal(f.messages.length, 1);
  accept(accepted); assert.equal((await pending).status, 302);
  assert.equal((await b.call('/verify-otp', { form: { otp: f.code() } })).status, 302);
});
for (const outcome of ['accept', 'reject']) test(`late ${outcome} after login replacement cannot alter new challenge`, async t => {
  let settle; const f = await fixture(t, { send: (_message, n) => n === 1 ? new Promise((resolve, reject) => {
    settle = () => outcome === 'accept' ? resolve(accepted) : reject(Error('private-provider-marker'));
  }) : accepted });
  const b = f.browser(); await b.login(); const old = f.browser(); old.cookie = b.cookie; old.csrf = b.csrf;
  const pending = old.call('/send-otp', { form: {} }); await waitFor(() => settle);
  f.advance(60_000); await b.login(); const code = await sent(f, b);
  settle(); assert.equal((await pending).status, outcome === 'accept' ? 409 : 502);
  assert.equal((await b.call('/verify-otp', { form: { otp: code } })).status, 302);
});
test('CSRF, foreign origin, Host and duplicate cookies fail closed', async t => {
  const f = await fixture(t); const b = f.browser(); await b.login();
  assert.equal((await b.call('/send-otp', { form: { csrf: 'forged' } })).status, 403);
  assert.equal((await b.call('/send-otp', { form: {}, headers: { origin: 'https://foreign.example' } })).status, 403);
  assert.equal((await b.call('/', { headers: { host: 'foreign.example' } })).status, 421);
  assert.equal((await b.call('/send-otp', { form: {}, headers: { cookie: `${b.cookie}; ${b.cookie}` } })).status, 401);
  assert.equal(f.messages.length, 0);
  assert.equal((await b.call('/send-otp', { form: {}, headers: { origin: 'http://localhost:3000' } })).status, 302);
});
test('cookies are host-only HttpOnly Lax with HTTPS-derived Secure; Gmail top-level GET remains available', async t => {
  for (const origin of ['http://localhost:3000', 'https://portal.example.test']) {
    const f = await fixture(t, { origin }); const b = f.browser(); const root = await b.call('/');
    const cookie = root.headers['set-cookie'][0];
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Path=\//);
    assert(!cookie.includes('Domain=')); assert.equal(cookie.includes('; Secure'), origin.startsWith('https:'));
    const anonymous = b.cookie; await b.login(); assert.notEqual(b.cookie, anonymous); await sent(f, b);
    const response = await b.call('/verify-otp', { headers: { 'sec-fetch-site': 'cross-site', referer: 'https://mail.google.com/' } });
    assert.equal(response.status, 200); assert(response.body.includes('Verify &amp; Continue') || response.body.includes('Verify & Continue'));
  }
});
test('configured recipient is HTML escaped, and authorized missing PDF remains a real404', async t => {
  const f = await fixture(t, { recipient: '<marker>@example.test', missingFile: true }); const b = f.browser(); await b.login(); const code = await sent(f, b);
  const page = await b.call('/verify-otp'); assert(!page.body.includes('<marker>')); assert(page.body.includes('&lt;marker&gt;'));
  await b.call('/verify-otp', { form: { otp: code } }); assert.equal((await b.call('/public/tax-statement-2024.pdf')).status, 404);
});
test('logical session deadline is not extended by login rotation', async t => {
  const f = await fixture(t); const b = f.browser(); await b.login(); f.advance(29 * 60_000); await b.login();
  const code = await sent(f, b); assert.equal((await b.call('/verify-otp', { form: { otp: code } })).status, 302);
  f.advance(60_000); assert.equal((await b.call('/documents')).status, 401);
});
test('server defaults to loopback and validates explicit external hosting', async () => {
  const { serverConfiguration } = await configModule;
  assert.deepEqual(serverConfiguration({}), { host: '127.0.0.1', port: 3000, origin: 'http://localhost:3000' });
  for (const PORT of ['0', '-1', '65536', '3.1', 'oops']) assert.throws(() => serverConfiguration({ PORT }));
  assert.throws(() => serverConfiguration({ HOST: '0.0.0.0' }));
  assert.throws(() => serverConfiguration({ PORTAL_URL: 'https://portal.test/path' }));
  assert.deepEqual(serverConfiguration({ HOST: '0.0.0.0', PORTAL_URL: 'https://portal.test' }), { host: '0.0.0.0', port: 3000, origin: 'https://portal.test' });
});
test('ten failures exhaust the logical owner across challenge and login rotations', async t => {
  const f = await fixture(t); const b = f.browser(); await b.login();
  for (let round = 0; round < 2; round++) {
    await sent(f, b);
    for (let n = 0; n < 5; n++) assert.equal((await b.call('/verify-otp', { form: { otp: 'invalid' } })).status, 401);
    f.advance(60_000); await b.login();
  }
  assert.equal((await b.call('/send-otp', { form: {} })).status, 429);
});
test('process-wide recipient quota cannot be bypassed with new cookies', async t => {
  const f = await fixture(t);
  for (let n = 0; n < 20; n++) { const b = f.browser(); await b.login(); await sent(f, b); }
  const next = f.browser(); await next.login();
  assert.equal((await next.call('/send-otp', { form: {} })).status, 429); assert.equal(f.messages.length, 20);
  f.advance(600_000); await sent(f, next); assert.equal(f.messages.length, 21);
});
test('session capacity refuses new owners, retains existing ones, and prunes expired owners', async t => {
  const f = await fixture(t); const existing = f.browser(); await existing.login();
  for (let n = 1; n < 1000; n++) assert.equal((await f.browser().call('/')).status, 200);
  assert.equal((await f.browser().call('/')).status, 503);
  assert.equal((await existing.call('/')).status, 200);
  await sent(f, existing);
  f.advance(30 * 60_000); assert.equal((await f.browser().call('/')).status, 200);
});
test('timed-out HTTP requests retain actual provider capacity and late results cannot activate codes', { timeout: 40_000 }, async t => {
  const operations = [];
  const f = await fixture(t, { send: (_message, n) => n <= 20 ? new Promise((resolve, reject) => operations.push({ resolve, reject })) : accepted });
  t.after(() => { for (const operation of operations) operation.resolve(accepted); });
  const browsers = []; const requests = [];
  for (let n = 0; n < 20; n++) {
    const b = f.browser(); await b.login(); browsers.push(b); requests.push(b.call('/send-otp', { form: {} }));
  }
  await waitFor(() => operations.length === 20);
  f.advance(600_000);
  const next = f.browser(); await next.login();
  assert.equal((await next.call('/send-otp', { form: {} })).status, 503);
  const responses = await Promise.all(requests);
  assert(responses.every(response => response.status === 502));
  assert.equal((await next.call('/send-otp', { form: {} })).status, 503);
  operations[0].resolve(accepted); operations[1].reject(Error('private-provider-marker'));
  await new Promise(resolve => setImmediate(resolve));
  for (const index of [0, 1]) assert.equal((await browsers[index].call('/verify-otp', { form: { otp: f.code(index) } })).status, 401);
  await sent(f, next);
});
test('admitted failed resend invalidates the previously issued code', async t => {
  const f = await fixture(t, { send: (_message, n) => n === 1 ? accepted : { data: null, error: { message: 'rejected' } } });
  const b = f.browser(); await b.login(); const oldCode = await sent(f, b); f.advance(60_000);
  assert.equal((await b.call('/send-otp', { form: {} })).status, 502);
  assert.equal((await b.call('/verify-otp', { form: { otp: oldCode } })).status, 401);
});
test('code lifetime starts at acceptance, but expired owner cannot be revived', async t => {
  for (const expireOwner of [false, true]) {
    let accept; const f = await fixture(t, { send: () => new Promise(resolve => { accept = resolve; }) });
    const b = f.browser(); await b.login(); const request = b.call('/send-otp', { form: {} }); await waitFor(() => accept);
    f.advance(expireOwner ? 30 * 60_000 : 60_000); accept(accepted);
    assert.equal((await request).status, expireOwner ? 409 : 302);
    if (!expireOwner) f.advance(599_999);
    assert.equal((await b.call('/verify-otp', { form: { otp: f.code() } })).status, expireOwner ? 401 : 302);
  }
});
test('only the accepted owner sees metadata matching its exact email request', async t => {
  const f = await fixture(t); const a = f.browser(); const b = f.browser(); await a.login(); await b.login();
  assert(!(await a.call('/verify-otp')).body.includes('data-otp-request'));
  await sent(f, a);
  const page = await a.call('/verify-otp');
  const requestId = /data-otp-request="([a-f0-9]{32})"/.exec(page.body)?.[1];
  assert(requestId);
  assert.equal(f.messages[0].subject, `Tax Portal Verification - ${requestId}`);
  assert(f.messages[0].html.includes(`Request ID: ${requestId}`));
  assert(f.messages[0].html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").includes(`Verification code: ${f.code()}`));
  assert(page.body.includes('data-otp-sender="sender@example.test"'));
  assert(page.body.includes(`data-otp-subject="${f.messages[0].subject}"`));
  assert(!page.body.includes(`name="otp" value="${f.code()}"`));
  assert(!(await b.call('/verify-otp')).body.includes('data-otp-request'));
  assert.equal((await a.call('/verify-otp', { form: { otp: requestId } })).status, 401);
  f.advance(60_000); await sent(f, a);
  const replacement = /data-otp-request="([a-f0-9]{32})"/.exec((await a.call('/verify-otp')).body)?.[1];
  assert(replacement); assert.notEqual(replacement, requestId);
  assert.equal(f.messages[1].subject, `Tax Portal Verification - ${replacement}`);
  f.advance(600_000); assert(!(await a.call('/verify-otp')).body.includes('data-otp-request'));
});
test('pending and rejected emails do not publish accepted request metadata', async t => {
  let settle; const f = await fixture(t, { send: () => new Promise(resolve => { settle = resolve; }) });
  const b = f.browser(); await b.login(); const send = b.call('/send-otp', { form: {} }); await waitFor(() => settle);
  const pending = await b.call('/verify-otp'); assert.equal(pending.status, 409); assert(!pending.body.includes('data-otp-request'));
  settle({ data: null, error: { message: 'synthetic-rejection' } }); assert.equal((await send).status, 502);
  assert(!(await b.call('/verify-otp')).body.includes('data-otp-request'));
});
test('delivery validates correlation inputs and canonicalizes a display-name sender', async () => {
  const { acceptedEmailDelivery } = await deliveryModule;
  let sends = 0;
  const deliver = acceptedEmailDelivery(async () => { sends++; return accepted; }, 'Demo Sender <Sender@Example.test>');
  const requestId = 'a'.repeat(32);
  assert.deepEqual(await deliver({ recipient: 'fixture@example.test', code: '000123', requestId }), {
    sender: 'sender@example.test', subject: `Tax Portal Verification - ${requestId}`,
  });
  for (const id of ['', 'x'.repeat(32), '<script>']) await assert.rejects(deliver({ recipient: 'fixture@example.test', code: '123456', requestId: id }));
  await assert.rejects(deliver({ recipient: 'fixture@example.test', code: '<x>', requestId }));
  assert.equal(sends, 1);
  for (const from of ['sender@example.test\r\nBcc: other@example.test', 'a@example.test,b@example.test', 'not-an-address']) assert.throws(() => acceptedEmailDelivery(async () => accepted, from));
});

test('packaged synthetic PDF is protected and served with exact bytes after verification', async t => {
  const f = await fixture(t, { packagedFile: true }); const b = f.browser();
  assert.equal((await b.call('/public/tax-statement-2024.pdf')).status, 401);
  await b.login(); const code = await sent(f, b);
  assert.equal((await b.call('/verify-otp', { form: { otp: code } })).status, 302);
  const response = await b.call('/public/tax-statement-2024.pdf');
  assert.equal(response.status, 200); assert.match(response.headers['content-type'], /^application\/pdf/);
  const expected = fs.readFileSync(path.join(__dirname, '../public/tax-statement-2024.pdf'), 'utf8');
  assert.equal(response.body, expected);
  assert.equal(Number(response.headers['content-length']), Buffer.byteLength(expected));
  assert.match(expected, /^%PDF-1\.4/); assert.match(expected, /SYNTHETIC TAX STATEMENT/); assert.match(expected, /%%EOF\s*$/);
});
