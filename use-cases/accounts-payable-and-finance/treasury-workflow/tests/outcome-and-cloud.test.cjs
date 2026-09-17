const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const test = require('node:test');

const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../index.ts'), 'utf8'));
const helpers = source.slice(source.indexOf('export function validateCloudPortalUrls'), source.indexOf('// ─── Main Demo'))
  .replaceAll('export function', 'function');
const context = { URL };
vm.runInNewContext(`${helpers}\nthis.helpers={validateCloudPortalUrls,requireSuccessfulAction,validateReconciliation}`, context);
const { validateCloudPortalUrls, requireSuccessfulAction, validateReconciliation } = context.helpers;

test('cloud mode requires valid, public HTTPS portal URLs', () => {
  validateCloudPortalUrls({ BANK_PORTAL_URL: 'https://bank.example.test/path', TREASURY_PORTAL_URL: 'https://treasury.example.test/path' });
  for (const value of [
    'http://localhost:3000/bank-portal.html',
    'https://127.0.0.1/portal',
    'https://[::1]/portal',
    'http://bank.example.test/portal',
    'not a URL',
  ]) assert.throws(() => validateCloudPortalUrls({ BANK_PORTAL_URL: value }));
});

test('reconciliation requires this run downloads, matching uploads, and positive confirmation', () => {
  validateReconciliation(['/tmp/one.pdf'], ['/tmp/one.pdf'], { isSuccess: true, message: 'Queued one statement', submittedCount: 1 });
  assert.throws(() => validateReconciliation([], [], { isSuccess: true, message: 'Queued', submittedCount: 0 }), /No statements/);
  assert.throws(() => validateReconciliation(['/tmp/one.pdf'], [], { isSuccess: true, message: 'Queued', submittedCount: 0 }), /do not match/);
  assert.throws(() => validateReconciliation(['/tmp/one.pdf'], ['/tmp/old.pdf'], { isSuccess: true, message: 'Queued', submittedCount: 1 }), /do not match/);
  assert.throws(() => validateReconciliation(['/tmp/one.pdf'], ['/tmp/one.pdf'], { isSuccess: false, message: 'Declined', submittedCount: 1 }), /did not confirm/);
  assert.throws(() => validateReconciliation(['/tmp/one.pdf'], ['/tmp/one.pdf'], { isSuccess: true, message: '  ', submittedCount: 1 }), /did not confirm/);
  assert.throws(() => validateReconciliation(['/tmp/one.pdf'], ['/tmp/one.pdf'], { isSuccess: true, message: 'Queued two', submittedCount: 2 }), /confirmed 2 statements, expected 1/);
});

test('failed portal actions stop the workflow', () => {
  requireSuccessfulAction('fixture action', { data: { success: true } });
  assert.throws(
    () => requireSuccessfulAction('submit statements', { data: { success: false, message: 'disabled' } }),
    /Action failed: submit statements: disabled/,
  );
});

test('documentation does not claim localhost automatically works in cloud mode', () => {
  const readme = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8');
  assert.match(readme, /cloud browser cannot reach[\s\S]*localhost/);
  assert.match(readme, /BANK_PORTAL_URL=https:\/\//);
  assert.match(readme, /TREASURY_PORTAL_URL=https:\/\//);
});
