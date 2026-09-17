const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module'); const { pathToFileURL } = require('node:url');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'otp-selection-'));
for (const name of ['otp-message', 'gmail-otp']) {
  const source = fs.readFileSync(path.join(__dirname, `../${name}.ts`), 'utf8').replace('./otp-message.ts', './otp-message.mjs');
  fs.writeFileSync(path.join(directory, `${name}.mjs`), stripTypeScriptTypes(source));
}
after(() => fs.rmSync(directory, { recursive: true, force: true }));
const messages = import(pathToFileURL(path.join(directory, 'otp-message.mjs')).href);
const browser = import(pathToFileURL(path.join(directory, 'gmail-otp.mjs')).href);
const request = { requestId: 'a'.repeat(32), sender: 'sender@example.test', subject: 'Tax Portal Verification - ' + 'a'.repeat(32) };
const valid = { sender: request.sender, subject: request.subject, body: `Verification code: 123456 Request ID: ${request.requestId}` };

test('requires exact sender, subject, current ID and labelled six-digit code', async () => {
  const { selectOtp } = await messages;
  const unrelated = [
    { ...valid, sender: 'other@example.test' }, { ...valid, subject: 'Re: ' + request.subject },
    { ...valid, body: valid.body.replace(request.requestId, 'b'.repeat(32)) },
    { ...valid, body: 'Unrelated markup 987654' },
  ];
  assert.equal(selectOtp(unrelated, request), null);
  assert.equal(selectOtp([...unrelated, valid], request), '123456');
  assert.equal(selectOtp([{ ...valid, body: 'Order 999999 ' + valid.body }], request), '123456');
});
for (const body of [
  `Request ID: ${request.requestId} Verification code: 12345`,
  `Request ID: ${request.requestId} Verification code: 1234567`,
  `Request ID: ${request.requestId} Verification code: abcdef`,
  `Request ID: ${request.requestId} 123456`,
  `${valid.body} Verification code: 123456`, `${valid.body} Request ID: ${request.requestId}`,
]) test('malformed or ambiguous matching message fails closed: ' + body.slice(-22), async () => {
  const { selectOtp } = await messages; assert.throws(() => selectOtp([{ ...valid, body }], request));
});
test('duplicate matching messages are ambiguous even when codes agree', async () => {
  const { selectOtp } = await messages; assert.throws(() => selectOtp([valid, valid], request));
});
test('invalid metadata cannot become a search request', async () => {
  const { parseOtpRequest } = await messages;
  for (const value of [null, {}, { ...request, sender: 'a@example.test OR from:b@example.test' }, { ...request, subject: 'different' }, { ...request, requestId: '<x>' }]) assert.throws(() => parseOtpRequest(value));
});
test('portal metadata requires exact origin, verify route and one request', async () => {
  const { readPortalRequest } = await browser;
  const base = { origin: 'https://portal.test', pathname: '/verify-otp', requests: [request] };
  assert.deepEqual(await readPortalRequest({ evaluate: async () => base }, base.origin), request);
  for (const snapshot of [{ ...base, origin: 'https://other.test' }, { ...base, pathname: '/' }, { ...base, requests: [] }, { ...base, requests: [request, request] }]) await assert.rejects(readPortalRequest({ evaluate: async () => snapshot }, base.origin));
});
function pageFor(snapshots) {
  let reads = 0; const clicks = [];
  return { clicks, url: async () => 'https://mail.google.com/mail/u/0/', waitForTimeout: async () => {},
    evaluate: async () => snapshots[Math.min(reads++, snapshots.length - 1)],
    locator: selector => ({ nth: index => ({ click: async () => clicks.push({ selector, index }) }) }),
  };
}
const row = { visible: true, index: 3, subject: request.subject, senders: [request.sender] };
test('retrieval opens only the exact matching row and validates the opened body', async () => {
  const { retrieveGmailOtp } = await browser;
  const page = pageFor([{ rows: [{ ...row, index: 0, subject: 'Unrelated' }, row], messages: [] }, { rows: [], messages: [valid] }]);
  const queries = [];
  assert.equal(await retrieveGmailOtp(page, request, async query => queries.push(query)), '123456');
  assert.deepEqual(page.clicks, [{ selector: 'tr.zA', index: 3 }]);
  assert.deepEqual(queries, [`from:${request.sender} subject:"${request.subject}" "${request.requestId}"`]);
});
test('ambiguous rows cause no click; changed message after click yields no code', async () => {
  const { retrieveGmailOtp } = await browser;
  const duplicate = pageFor([{ rows: [row, { ...row, index: 5 }], messages: [] }]);
  await assert.rejects(retrieveGmailOtp(duplicate, request, async () => {})); assert.equal(duplicate.clicks.length, 0);
  const changed = pageFor([{ rows: [row], messages: [] }, { rows: [], messages: [{ ...valid, sender: 'other@example.test' }] }]);
  await assert.rejects(retrieveGmailOtp(changed, request, async () => {}));
});
test('login redirect and search failure stop retrieval', async () => {
  const { retrieveGmailOtp } = await browser;
  await assert.rejects(retrieveGmailOtp({ url: async () => 'https://accounts.google.com/' }, request, async () => assert.fail('searched before login')));
  await assert.rejects(retrieveGmailOtp(pageFor([]), request, async () => { throw Error('synthetic search failure'); }));
});
