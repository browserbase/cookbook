import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
function source(file) { return readFileSync(new URL(file, root), 'utf8').replace(/^import .*;$/gm, ''); }
function service(file, extra = {}, transform = s => s) {
  let handler, listener;
  const scope = { crypto, Buffer, process: { env: {}, stdout: { write() {} } }, ...extra,
    http: { createServer: fn => { handler = fn; return { listen: (...args) => { listener = args; } }; } } };
  vm.runInNewContext(transform(source(file)), scope);
  return { handler, listener };
}
async function request(server, method, url, body, headers = {}) {
  let status, result;
  await server.handler({ method, url, headers,
    on(event, fn) { if (event === 'data' && body !== undefined) fn(JSON.stringify(body)); if (event === 'end') fn(); },
  }, { writeHead: code => { status = code; }, end: text => { result = JSON.parse(text); } });
  return { status, result };
}
const identity = service('identity-provider.mjs');
const publicResponse = await request(identity, 'GET', '/pubkey');
const vault = service('vault-server.mjs', { syntheticPem: publicResponse.result.pem }, s => s
  .replace(/const ENCRYPTED_VAULT = enroll\([\s\S]*?\n\);/, 'const ENCRYPTED_VAULT = enroll("synthetic-agent", "synthetic.invalid", "synthetic-user", "synthetic-password");')
  .replace('let IDP_PUBLIC_KEY = null;', 'let IDP_PUBLIC_KEY = crypto.createPublicKey(syntheticPem);'));
const recipient = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKey = recipient.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const tokenFor = async host => (await request(identity, 'POST', '/token', { agentId: 'synthetic-agent', host, onBehalfOf: 'synthetic-user' })).result.token;

test('both credential services bind only IPv4 loopback', () => {
  for (const server of [identity, vault]) assert.equal(server.listener[1], '127.0.0.1');
});

test('issuer has a simulation-specific identity and openly signs caller-selected scope', async () => {
  const issued = await request(identity, 'POST', '/token', { agentId: 'synthetic-agent', host: 'synthetic.invalid', onBehalfOf: 'chosen-user' });
  assert.equal(issued.status, 200);
  assert.equal(issued.result.claims.iss, 'urn:browserbase:cookbook:local-idp-simulation');
  assert.equal(issued.result.claims.on_behalf_of, 'chosen-user');
  assert.equal(issued.result.claims.scope[0], 'vault:read:synthetic.invalid');
});

test('documented trust boundary: caller-selected key recovers synthetic enrollment without a browser', async () => {
  const lease = await request(vault, 'POST', '/lease', { hostname: 'synthetic.invalid', sessionPublicKey: publicKey }, { authorization: 'Bearer ' + await tokenFor('synthetic.invalid') });
  assert.equal(lease.status, 200);
  const key = crypto.privateDecrypt({ key: recipient.privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(lease.result.wrappedKey, 'base64'));
  const ciphertext = Buffer.from(lease.result.ciphertext, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(lease.result.iv, 'base64'));
  decipher.setAuthTag(ciphertext.subarray(-16));
  const plaintext = JSON.parse(Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]).toString());
  assert.equal(plaintext.password, 'synthetic-password');
  assert.equal(plaintext.hostname, 'synthetic.invalid');
  const audit = await request(vault, 'GET', '/audit');
  assert.equal(audit.result.entries.at(-1).wrappedTo, 'caller-supplied-public-key');
});

test('vault rejects missing token and a token for another host', async () => {
  const body = { hostname: 'synthetic.invalid', sessionPublicKey: publicKey };
  assert.equal((await request(vault, 'POST', '/lease', body)).status, 401);
  assert.equal((await request(vault, 'POST', '/lease', body, { authorization: 'Bearer ' + await tokenFor('different.invalid') })).status, 403);
});

test('vault rejects a signature altered after issuance', async () => {
  const parts = (await tokenFor('synthetic.invalid')).split('.');
  const sig = Buffer.from(parts[2], 'base64url'); sig[0] ^= 1; parts[2] = sig.toString('base64url');
  assert.equal((await request(vault, 'POST', '/lease', { hostname: 'synthetic.invalid', sessionPublicKey: publicKey }, { authorization: 'Bearer ' + parts.join('.') })).status, 401);
});

test('actual control-server startup binds loopback with all services stubbed', async () => {
  let listener, children = 0;
  const http = {
    createServer: () => ({ listen: (...args) => { listener = args; } }),
    get: (_url, cb) => { cb({ resume() {} }); return { on() {} }; },
  };
  const code = source('control.mjs').replaceAll('import.meta.url', JSON.stringify(new URL('control.mjs', root).href));
  vm.runInNewContext(code, {
    http, crypto, Buffer, path, fileURLToPath,
    fs: {}, process: { env: { BROWSERBASE_API_KEY: 'synthetic', }, exit() { assert.fail('Unexpected exit'); } },
    Browserbase: class {}, chromium: {}, spawn() { children++; return {}; }, console: { log() {}, error() {} },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(children, 2);
  assert.equal(listener[1], '127.0.0.1');
});
