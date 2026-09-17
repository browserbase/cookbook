import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
const source = readFileSync(process.env.EXTENSION_SOURCE_PATH || new URL('../extension/content.js', import.meta.url), 'utf8');
async function extension() {
  const cookies = new Map();
  class Input {
    get value() { return this.current ?? ''; }
    set value(value) { this.current = value; }
    dispatchEvent() {}
  }
  const username = new Input(), password = new Input();
  const document = {
    get cookie() { return [...cookies].map(([key, value]) => `${key}=${value}`).join('; '); },
    set cookie(value) {
      const [pair] = value.split(';'); const at = pair.indexOf('=');
      const key = pair.slice(0, at), val = pair.slice(at + 1);
      if (value.includes('expires=')) cookies.delete(key); else cookies.set(key, val);
    },
    querySelector: selector => selector.includes('password') ? password : username,
  };
  const scope = vm.createContext({
    crypto: crypto.webcrypto, Uint8Array, TextDecoder, HTMLInputElement: Input,
    Event: class {}, document, location: { hostname: 'synthetic.invalid' },
    btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
    console: { log() {} }, setTimeout() {},
  });
  vm.runInContext(source + '\nglobalThis.api={publishSessionKey,unwrapAndFill,getKeys:()=>sessionKeyPair};', scope);
  await scope.api.publishSessionKey();
  return { api: scope.api, document, cookies, username, password };
}

test('actual generated private key refuses PKCS8 and JWK export while public SPKI remains usable', async () => {
  const f = await extension();
  const keys = f.api.getKeys();
  assert.equal(keys.privateKey.extractable, false);
  assert.deepEqual(keys.privateKey.usages, ['decrypt']);
  for (const format of ['pkcs8', 'jwk']) await assert.rejects(crypto.webcrypto.subtle.exportKey(format, keys.privateKey), error => ['InvalidAccessError', 'InvalidAccessException'].includes(error.name));
  assert.equal(keys.publicKey.extractable, true);
  const published = decodeURIComponent(f.cookies.get('__rpass_session_pubkey__'));
  assert.deepEqual(Buffer.from(published, 'base64'), Buffer.from(await crypto.webcrypto.subtle.exportKey('spki', keys.publicKey)));
  assert.equal(crypto.createPublicKey({ key: Buffer.from(published, 'base64'), type: 'spki', format: 'der' }).asymmetricKeyType, 'rsa');
});

test('non-extractable private key still unwraps a synthetic lease and fills then deletes transport cookies', async () => {
  const f = await extension();
  const publicKey = crypto.createPublicKey({ key: Buffer.from(decodeURIComponent(f.cookies.get('__rpass_session_pubkey__')), 'base64'), type: 'spki', format: 'der' });
  const key = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = { username: 'synthetic-user', password: 'synthetic-password', hostname: 'synthetic.invalid', agentId: 'synthetic-agent', exp: Math.floor(Date.now() / 1000) + 60 };
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(plaintext)), cipher.final(), cipher.getAuthTag()]);
  const wrappedKey = crypto.publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, key);
  f.document.cookie = '__rpass_wrapped_lease__=' + encodeURIComponent(JSON.stringify({ wrappedKey: wrappedKey.toString('base64'), iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64') }));
  assert.equal(await f.api.unwrapAndFill(), true);
  assert.equal(f.username.value, 'synthetic-user');
  assert.equal(f.password.value, 'synthetic-password');
  assert.equal(f.cookies.size, 0);
  assert.equal(f.api.getKeys().privateKey.extractable, false);
});
