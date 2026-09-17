const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');
const { createHmac } = require('node:crypto');

const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../lib/session-capability.ts'), 'utf8'));
const runtime = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const secret = 'ab'.repeat(32);
const identity = { sessionId: 'session-A', conversationId: 'conversation-A', projectId: 'project-A' };
const now = 2000;

function sign(claims) {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${createHmac('sha256', Buffer.from(secret, 'hex')).update(`browsegpt-session-v1.${payload}`).digest('base64url')}`;
}

test('capabilities preserve independent conversation bindings across verifier instances', async () => {
  const sdk = await runtime;
  const a = sdk.issueSessionCapability(identity, secret, now);
  const b = sdk.issueSessionCapability({ ...identity, sessionId: 'session-B', conversationId: 'conversation-B' }, secret, now);
  const otherWorker = await import(`data:text/javascript;base64,${Buffer.from(`${source}\n// independent worker`).toString('base64')}`);
  assert.equal(otherWorker.verifySessionCapability(a.capability, secret, identity.projectId, 'operate', now).sessionId, 'session-A');
  assert.equal(otherWorker.verifySessionCapability(b.capability, secret, identity.projectId, 'operate', now).conversationId, 'conversation-B');
  assert.equal(a.expiresAt, now + sdk.SESSION_LIFETIME_SECONDS);
});

test('forgery, changed project and malformed tokens fail with a bounded generic error', async () => {
  const sdk = await runtime;
  const { capability } = sdk.issueSessionCapability(identity, secret, now);
  const [payload, signature] = capability.split('.');
  const changed = JSON.parse(Buffer.from(payload, 'base64url'));
  changed.sessionId = 'session-B';
  for (const value of [null, '', 'x'.repeat(2049), `${payload}.short`, `${payload}.${signature}.extra`, `${payload}=.${signature}`, `${Buffer.from(JSON.stringify(changed)).toString('base64url')}.${signature}`]) {
    assert.throws(() => sdk.verifySessionCapability(value, secret, identity.projectId, 'operate', now), sdk.InvalidSessionCapability);
  }
  assert.throws(() => sdk.verifySessionCapability(capability, 'cd'.repeat(32), identity.projectId, 'operate', now), sdk.InvalidSessionCapability);
  assert.throws(() => sdk.verifySessionCapability(capability, secret, 'another-project', 'operate', now), sdk.InvalidSessionCapability);
});

test('expiry rejects operations exactly at deadline and permits only bounded release grace', async () => {
  const sdk = await runtime;
  const { capability, expiresAt } = sdk.issueSessionCapability(identity, secret, now);
  assert.throws(() => sdk.verifySessionCapability(capability, secret, identity.projectId, 'operate', now - 1), sdk.InvalidSessionCapability);
  assert.doesNotThrow(() => sdk.verifySessionCapability(capability, secret, identity.projectId, 'operate', expiresAt - 1));
  assert.throws(() => sdk.verifySessionCapability(capability, secret, identity.projectId, 'operate', expiresAt), sdk.InvalidSessionCapability);
  assert.doesNotThrow(() => sdk.verifySessionCapability(capability, secret, identity.projectId, 'release', expiresAt));
  assert.doesNotThrow(() => sdk.verifySessionCapability(capability, secret, identity.projectId, 'release', expiresAt + sdk.RELEASE_GRACE_SECONDS - 1));
  assert.throws(() => sdk.verifySessionCapability(capability, secret, identity.projectId, 'release', expiresAt + sdk.RELEASE_GRACE_SECONDS), sdk.InvalidSessionCapability);
});

test('even correctly signed malformed claims cannot authorize sessions', async () => {
  const sdk = await runtime;
  const claims = { v: 1, ...identity, issuedAt: now, expiresAt: now + sdk.SESSION_LIFETIME_SECONDS };
  for (const change of [{ v: 2 }, { sessionId: '../other' }, { conversationId: '' }, { projectId: 4 }, { expiresAt: claims.expiresAt + 1 }, { issuedAt: 0.5 }, { extra: true }]) {
    assert.throws(() => sdk.verifySessionCapability(sign({ ...claims, ...change }), secret, identity.projectId, 'operate', now), sdk.InvalidSessionCapability);
  }
  for (const value of [null, [], 'not claims']) {
    assert.throws(() => sdk.verifySessionCapability(sign(value), secret, identity.projectId, 'operate', now), sdk.InvalidSessionCapability);
  }
});

test('issuer rejects unsafe identities and misconfigured signing keys', async () => {
  const sdk = await runtime;
  for (const bad of ['', 'predictable-password', 'zz'.repeat(32), 'ab'.repeat(31)]) {
    assert.throws(() => sdk.issueSessionCapability(identity, bad, now), /32 random bytes/);
    assert.throws(() => sdk.verifySessionCapability(null, bad, identity.projectId, 'operate', now), /32 random bytes/);
  }
  assert.throws(() => sdk.issueSessionCapability({ ...identity, sessionId: 'x'.repeat(129) }, secret, now), sdk.InvalidSessionCapability);
  assert.throws(() => sdk.issueSessionCapability(identity, secret, NaN), sdk.InvalidSessionCapability);
});
