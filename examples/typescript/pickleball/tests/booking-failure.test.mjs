import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes, createRequire } from 'node:module';
import vm from 'node:vm';
import { parseCalendarDate } from '../calendar-dates.ts';
const { z } = createRequire(import.meta.url)('zod/v4');

const source = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const booking = source.slice(source.indexOf('async function bookCourt('), source.indexOf('async function selectActivity('));
const contract = stripTypeScriptTypes(readFileSync(new URL('../booking-contract.ts', import.meta.url), 'utf8'))
  .replace(/^import .*;$/gm, '').replace(/\bexport /g, '');
const main = source.slice(source.indexOf('async function main()'), source.indexOf('main().catch'));
const availability = source.slice(source.indexOf('async function checkAndExtractCourts('), source.indexOf('async function bookCourt('));
const intent = { activity: 'Tennis', date: '2026-10-30', timeOfDay: 'Morning' };
const reviewed = { ...intent, court: 'Court 1', facility: 'Synthetic Park', start: '09:00', end: '10:00', participant: 'Example Player', price: 'USD 0.00' };
const receipt = { ...reviewed, reservationId: 'synthetic-reservation-123', confirmed: true, errorMessage: null, visibleReceiptText: 'Synthetic reservation details' };

async function run(change = {}) {
  const calls = [], logs = [], prompts = [], exits = [], extractions = [];
  const page = {};
  let summaryCount = 0;
  const context = vm.createContext({ z, parseCalendarDate, Set, JSON,
    inquirer: { prompt: async questions => {
      const question = questions[0]; prompts.push(question);
      if (question.name === 'participant') return { participant: change.participant ?? reviewed.participant };
      if (question.name === 'approved') { assert.equal(question.default, false); return { approved: change.approved ?? true }; }
      assert.equal(question.type, 'password'); return { verificationCode: 'synthetic-private-code' };
    } },
    console: { log: (...args) => logs.push(args.join(' ')), error: () => {} },
    process: { exit: code => exits.push(code) },
  });
  vm.runInContext(contract + '\n' + stripTypeScriptTypes(booking + availability + main) + '\nglobalThis.book=bookCourt; globalThis.runMain=main; globalThis.available=checkAndExtractCourts;', context);
  const stagehand = {
    act: async (prompt, options) => {
      assert.equal(options.page, page); calls.push(prompt);
      return calls.length === change.failAt ? change.result ?? { data: { success: false } } : { data: { success: true } };
    },
    extract: async (prompt, schema, options) => {
      assert.equal(options.page, page); z.toJSONSchema(schema); extractions.push(prompt);
      const fields = schema.shape;
      let data;
      if ('participants' in fields) data = { participants: change.participants ?? [reviewed.participant] };
      else if ('hasSelectableSlots' in fields) data = { hasSelectableSlots: change.available ?? true };
      else if ('visibleReceiptText' in fields) data = { ...receipt, ...change.receipt };
      else if ('court' in fields) {
        summaryCount++;
        data = { ...reviewed, reservationId: change.previousId ?? null, ...change.summary, ...(summaryCount > 1 ? change.refreshed : {}) };
      } else data = { confirmed: true, errorMessage: null, ...change.outcome };
      return { data: schema.parse(data) };
    },
  };
  let error, result;
  context.bookTennisPaddleCourt = () => context.book(stagehand, page, intent);
  try {
    result = change.main ? await context.runMain() : change.checkAvailability ? await context.available(stagehand, page, intent) : await context.book(stagehand, page, intent);
  } catch (caught) { error = caught; }
  return { error, result, calls, logs, prompts, exits, extractions };
}

for (let failAt = 1; failAt <= 8; failAt++) test(`failed booking action ${failAt} stops subsequent work`, async () => {
  const r = await run({ failAt }); assert.ok(r.error); assert.equal(r.calls.length, failAt);
  assert.ok(!r.logs.some(line => line.startsWith('Reservation ') && line.includes('confirmed:')));
});

test('unknown action envelopes fail', async () => {
  for (const result of [{}, { success: true }, { data: {} }, { data: { success: 'true' } }]) {
    const r = await run({ failAt: 1, result }); assert.ok(r.error); assert.equal(r.calls.length, 1); assert.equal(r.extractions.length, 0);
  }
});

test('explicit rejection is consumed before leaving the result page', async () => {
  const r = await run({ outcome: { confirmed: true, errorMessage: 'Reservation rejected' } });
  assert.ok(r.error); assert.equal(r.calls.length, 7); assert.ok(!r.calls.some(x => x.includes('Rec profile')));
});

test('unknown immediate outcome is not a reservation', async () => {
  const r = await run({ outcome: { confirmed: false } }); assert.ok(r.error); assert.equal(r.calls.length, 7);
});

for (const field of ['reservationId', 'date', 'court', 'facility', 'participant', 'price', 'start', 'end']) test(`missing receipt ${field} fails`, async () => {
  const r = await run({ receipt: { [field]: '' } }); assert.ok(r.error);
});
for (const receipt of [{ date: '2026-10-31' }, { court: 'Court 2' }, { participant: 'Other Player' }, { price: 'USD 20.00' }, { start: '09:30' }, { activity: 'Pickleball' }, { confirmed: false }, { errorMessage: 'Reservation rejected' }]) test(`mismatched or rejected receipt ${JSON.stringify(receipt)}`, async () => {
  const r = await run({ receipt }); assert.ok(r.error);
});

test('existing reservation identifier cannot confirm a new submission', async () => {
  const r = await run({ previousId: receipt.reservationId }); assert.ok(r.error);
});

test('declining review stops before booking or requesting a code', async () => {
  const r = await run({ approved: false }); assert.ok(r.error); assert.equal(r.calls.length, 3);
  assert.deepEqual(r.prompts.map(q => q.name), ['participant', 'approved']);
});

for (const summary of [{ date: '2026-10-31' }, { start: '18:00', end: '19:00' }, { participant: 'Other Player' }, { end: '08:00' }]) test(`invalid selected summary stops before submission ${JSON.stringify(summary)}`, async () => {
  const r = await run({ summary }); assert.ok(r.error); assert.equal(r.calls.length, 3);
  assert.deepEqual(r.prompts.map(q => q.name), ['participant']);
});

test('changed checkout after approval stops before submission', async () => {
  const r = await run({ refreshed: { court: 'Court 2' } }); assert.ok(r.error); assert.equal(r.calls.length, 3);
});

test('no requested-period availability never changes filters or books', async () => {
  const r = await run({ checkAvailability: true, available: false }); assert.ok(r.error); assert.equal(r.calls.length, 0);
});

test('duplicate participant names are ambiguous', async () => {
  const r = await run({ participants: [reviewed.participant, reviewed.participant] }); assert.ok(r.error); assert.equal(r.calls.length, 2); assert.equal(r.prompts.length, 0);
});

test('complete matching receipt reaches the caller without printing the code', async () => {
  const r = await run(); assert.equal(r.error, undefined); assert.equal(r.result.reservationId, receipt.reservationId);
  assert.equal(r.calls.length, 8); assert.ok(r.logs.every(line => !line.includes('synthetic-private-code')));
});

test('actual main receives a rejection and exits nonzero without success', async () => {
  const r = await run({ main: true, outcome: { errorMessage: 'Reservation rejected' } }); assert.deepEqual(r.exits, [1]);
  assert.ok(r.logs.includes('Failed to complete court booking')); assert.ok(!r.logs.some(x => x.includes('confirmed:')));
});

test('actual main reports identity only from a matching receipt', async () => {
  const r = await run({ main: true }); assert.deepEqual(r.exits, []); assert.equal(r.error, undefined);
  assert.ok(r.logs.some(x => x.includes(`Reservation ${receipt.reservationId} confirmed: ${reviewed.court}`)));
});
