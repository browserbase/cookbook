import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

for (const variant of ['node', 'stagehand']) {
  function fixture({ env = {}, created = {}, retrieved = {}, failure } = {}) {
    const calls = [];
    const good = { id: 'ich_fixture123', livemode: false, status: 'active', requirements: { disabled_reason: null, past_due: [] } };
    class Stripe {
      constructor(key, options) {
        calls.push(['client', key, options]);
        this.issuing = { cardholders: {
          create: async (...args) => { calls.push(['create', ...args]); if (failure === 'create') throw Error('private provider detail'); return { ...good, ...created }; },
          retrieve: async (...args) => { calls.push(['retrieve', ...args]); if (failure === 'retrieve') throw Error('private provider detail'); return { ...good, ...retrieved }; },
        } };
      }
    }
    let source = readFileSync(new URL(`../${variant}/1-create-cardholder.ts`, import.meta.url), 'utf8')
      .replace(/^import .*;\s*$/gm, '').replace(/^export /gm, '')
      .replace(/\nif \(.*import\.meta[\s\S]*$/, '');
    const context = vm.createContext({ Stripe, process: { env: { STRIPE_API_KEY: 'sk_test_fixture', STRIPE_TEST_CARDHOLDER_KEY: 'fixture-holder-001', ...env }, argv: [] }, console: { log: (...args) => calls.push(['log', ...args]) } });
    vm.runInContext(stripTypeScriptTypes(source), context);
    assert.equal(calls.length, 0, 'import must not allocate a client or call Stripe');
    return { calls, run: () => context.createCardholder() };
  }
  test(`${variant}: idempotent synthetic setup verifies fresh eligible holder`, async () => {
    const f = fixture(); const holder = await f.run(); assert.equal(holder.id, 'ich_fixture123');
    assert.deepEqual(f.calls.map(x => x[0]), ['client', 'create', 'retrieve']);
    assert.equal(f.calls[0][2].timeout, 30000); assert.equal(f.calls[0][2].maxNetworkRetries, 0);
    const [, body, options] = f.calls[1];
    assert.equal(options.idempotencyKey, 'fixture-holder-001');
    assert.equal(body.type, 'individual'); assert.equal(body.status, 'active');
    assert.ok(body.individual.first_name); assert.ok(body.individual.last_name); assert.ok(body.individual.dob.year);
    assert.equal(body.individual.card_issuing, undefined, 'no fabricated terms acceptance');
    assert.equal(f.calls[2][1], 'ich_fixture123');
  });
  for (const env of [{ STRIPE_API_KEY: '' }, { STRIPE_API_KEY: 'sk_live_fixture' }, { STRIPE_TEST_CARDHOLDER_KEY: '' }, { STRIPE_TEST_CARDHOLDER_KEY: 'bad key' }]) {
    test(`${variant}: invalid configuration rejected before client ${JSON.stringify(env)}`, async () => {
      const f = fixture({ env }); await assert.rejects(f.run()); assert.equal(f.calls.length, 0);
    });
  }
  for (const invalid of [{ id: 'bad' }, { livemode: true }, { status: 'inactive' }, { requirements: null }, { requirements: { disabled_reason: 'requirements.past_due', past_due: ['individual.card_issuing.user_terms_acceptance.date'] } }]) {
    test(`${variant}: rejects ineligible creation ${JSON.stringify(invalid)}`, async () => {
      const f = fixture({ created: invalid }); await assert.rejects(f.run()); assert.ok(!f.calls.some(x => x[0] === 'retrieve'));
    });
  }
  for (const invalid of [{ id: 'ich_other' }, { livemode: true }, { status: 'inactive' }, { requirements: { disabled_reason: null, past_due: ['individual.first_name'] } }]) {
    test(`${variant}: rejects changed retrieved state ${JSON.stringify(invalid)}`, async () => {
      const f = fixture({ retrieved: invalid }); await assert.rejects(f.run()); assert.equal(f.calls.filter(x => x[0] === 'create').length, 1);
    });
  }
  for (const failure of ['create', 'retrieve']) test(`${variant}: propagates ${failure} failure`, async () => {
    const f = fixture({ failure }); await assert.rejects(f.run()); assert.equal(f.calls.filter(x => x[0] === 'create').length, 1);
  });
}
