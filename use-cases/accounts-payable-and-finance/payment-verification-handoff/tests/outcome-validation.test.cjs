const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const test = require('node:test');

const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../agent.ts'), 'utf8'));
const helpers = source.slice(source.indexOf('export function requireSuccessfulAction'), source.indexOf('// ─── Main'))
  .replaceAll('export function', 'function');
const context = {};
vm.runInNewContext(`${helpers}\nthis.helpers={requireSuccessfulAction,validatePaymentConfirmation,validateAccountingRecord}`, context);
const { requireSuccessfulAction, validatePaymentConfirmation, validateAccountingRecord } = context.helpers;

test('unsuccessful actions cannot be treated as completed', () => {
  assert.throws(() => requireSuccessfulAction('submit fixture', { data: { success: false, message: 'declined' } }), /Action failed.*declined/);
});

test('payment confirmation must be approved and transaction-specific', () => {
  const expected = { invoiceNumber: 'INV-42', amount: '1,250.00' };
  const valid = { confirmationNumber: 'PAY-1', invoice: 'INV-42', amount: '$1,250.00', status: 'Approved' };
  validatePaymentConfirmation(valid, expected);
  for (const mutation of [
    { status: 'Declined' },
    { confirmationNumber: '  ' },
    { invoice: 'INV-OTHER' },
    { amount: '$12.50' },
    { amount: 'unknown' },
  ]) assert.throws(() => validatePaymentConfirmation({ ...valid, ...mutation }, expected));
});

test('accounting record must link to the payment and contain required metadata', () => {
  const expected = { glCode: '6200', memo: 'fixture memo' };
  const valid = { confirmationNumber: 'PAY-1', glCode: '6200', memo: 'fixture memo', recordId: 'REC-1' };
  validateAccountingRecord(valid, 'PAY-1', expected);
  for (const mutation of [
    { recordId: '' },
    { confirmationNumber: 'PAY-OTHER' },
    { glCode: '9999' },
    { memo: 'other memo' },
  ]) assert.throws(() => validateAccountingRecord({ ...valid, ...mutation }, 'PAY-1', expected));
});
