const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const source = stripTypeScriptTypes(readFileSync(require('node:path').join(__dirname, '../src/compliance.ts'), 'utf8'));
const modulePromise = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const goodSds = { epaRegistrationNumber: '12-345', revisionDate: '2024-02-29' };
const goodLabel = { epaRegistrationNumber: '12-345' };

test('matching metadata and real leap date pass the stated checks', async () => {
  const { decideCompliance } = await modulePromise;
  assert.equal(decideCompliance(goodSds, goodLabel).status, 'APPROVED');
});
for (const value of ['123-45', '12345', '0012-345', '12-345-6']) {
  test('component boundaries preserved: ' + value, async () => {
    const { decideCompliance } = await modulePromise;
    assert.equal(decideCompliance(goodSds, { epaRegistrationNumber: value }).status, 'NEEDS_REVIEW');
  });
}
test('only surrounding and separator whitespace is normalized', async () => {
  const { decideCompliance, normalizeRegistrationNumber } = await modulePromise;
  assert.equal(decideCompliance(goodSds, { epaRegistrationNumber: ' 12 - 345 ' }).status, 'APPROVED');
  assert.equal(normalizeRegistrationNumber('12-345'), '12-345');
  assert.equal(normalizeRegistrationNumber('1 2-345'), undefined);
});
for (const value of [undefined, null, 12345, {}, [], '', 'abc12-345', '12/345', '-12-345', '12--345', '12-345 trailing']) {
  test('malformed identifier goes to review: ' + JSON.stringify(value), async () => {
    const { decideCompliance } = await modulePromise;
    assert.equal(decideCompliance({ ...goodSds, epaRegistrationNumber: value }, goodLabel).status, 'NEEDS_REVIEW');
  });
}
for (const value of [undefined, null, 20240229, {}, [], '', 'not-a-date', '02/29/2024', '2023-02-29', '1900-02-29', '2024-04-31', '2024-13-01', '2024-00-01', '2024-01-00', '0000-01-01', '2024-2-9', '2024-02-29T00:00:00Z']) {
  test('invalid or ambiguous revision date goes to review: ' + JSON.stringify(value), async () => {
    const { decideCompliance } = await modulePromise;
    assert.equal(decideCompliance({ ...goodSds, revisionDate: value }, goodLabel).status, 'NEEDS_REVIEW');
  });
}
for (const value of ['2000-02-29', '2024-04-30', '2024-12-31']) {
  test('valid calendar date: ' + value, async () => {
    const { decideCompliance } = await modulePromise;
    assert.equal(decideCompliance({ ...goodSds, revisionDate: value }, goodLabel).status, 'APPROVED');
  });
}
for (const value of [undefined, null, 'metadata', [], 1]) {
  test('untrusted answer shape goes to review: ' + JSON.stringify(value), async () => {
    const { decideCompliance } = await modulePromise;
    assert.equal(decideCompliance(value, goodLabel).status, 'NEEDS_REVIEW');
    assert.equal(decideCompliance(goodSds, value).status, 'NEEDS_REVIEW');
  });
}
