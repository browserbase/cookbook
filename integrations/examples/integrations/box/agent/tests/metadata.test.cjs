const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const path = require('node:path');
const marker = 'SYNTHETIC_PRIVATE_MARKER';

async function fixture(response, failure = false) {
  const output = []; const requests = []; const state = { exitCode: 0, env: {} };
  const context = vm.createContext({ process: state, console: { log: (...args) => output.push(args.join(' ')), error: (...args) => output.push(args.join(' ')) }, URLSearchParams, FormData, Blob, setTimeout,
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (failure && url.endsWith('/ai/extract_structured')) return { ok: false, status: 403, statusText: marker, text: async () => { throw new Error('Raw error body should not be read'); } };
      const body = url.includes('oauth2') ? { access_token: 'fixture' } : url.includes('upload.box.com') ? { entries: [{ id: 'fixture', name: marker }] } : url.endsWith('/ai/ask') ? { answer: marker } : url.endsWith('/ai/extract_structured') ? response : {};
      return { ok: true, json: async () => body };
    }
  });
  const source = stripTypeScriptTypes(readFileSync(path.join(__dirname, '../src/box.ts'), 'utf8'));
  const box = new vm.SourceTextModule(source, { context }); await box.link(() => { throw new Error('Unexpected import'); }); await box.evaluate();
  const synthetic = (exports) => new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context });
  async function main() {
    const source = stripTypeScriptTypes(readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8')).replace('main().catch(', 'await main().catch(');
    const mod = new vm.SourceTextModule(source, { context });
    await mod.link(specifier => {
      if (specifier === './box.js') return box;
      if (specifier === 'dotenv/config') return synthetic({});
      if (specifier === './downloads.js') return synthetic({ getAgentDownload: async () => ({ filename: 'fixture.pdf', bytes: new Uint8Array([1]), mimeType: 'application/pdf' }) });
      if (specifier === '@browserbasehq/sdk') return synthetic({ default: class { agents = { runs: { create: async () => ({ runId: marker }), retrieve: async () => ({ status: 'COMPLETED', sessionId: marker, runId: marker, agentId: marker }) } }; } });
      throw new Error('Unexpected import: ' + specifier);
    });
    await mod.evaluate();
  }
  return { box: box.namespace, output, requests, state, main };
}

test('actual HTTP extraction boundary keeps only requested validated fields', async () => {
  const f = await fixture({ answer: { customerName: marker, amountDue: '10.00', dueDate: '2024-02-29' }, confidence_score: { customerName: marker }, citations: [marker] });
  const result = await f.box.extractBoxMetadata('fixture', { id: 'fixture' }, f.box.DOCUMENT_FIELDS.filter(x => x.key === 'amountDue'));
  assert.equal(JSON.stringify(result), '{"answer":{"amountDue":"10.00"}}');
});

test('all documented formats pass and missing values remain absent', async () => {
  const f = await fixture({});
  const answer = { statementDate: '2024-02-29', dueDate: '2024-03-31', billingPeriod: '2024-02-01 to 2024-02-29', amountDue: '$10.25', previousBalance: '-1.00', paymentsReceived: 'USD 4.00', electricityCharges: '10', gasCharges: '0', electricityUsage: '123.5 kWh', gasUsage: '2 therms', ratePlan: 'E-TOU-C' };
  assert.deepEqual(JSON.parse(JSON.stringify(f.box.parseExtractionResponse({ answer }, Object.keys(answer)).answer)), answer);
  assert.equal(JSON.stringify(f.box.parseExtractionResponse({ answer: { amountDue: null, dueDate: '' } }, ['amountDue', 'dueDate'])), '{"answer":{}}');
});

for (const [key, value] of [['amountDue', marker], ['amountDue', {}], ['amountDue', 12], ['amountDue', '1,234.00'], ['dueDate', '2023-02-29'], ['dueDate', marker], ['billingPeriod', '2024-03-01 to 2024-02-01'], ['ratePlan', 'Customer: ' + marker], ['electricityUsage', marker], ['gasUsage', '5 meters']]) {
  test('invalid known field fails without echoing content: ' + key + ' ' + typeof value, async () => {
    const f = await fixture({ answer: { [key]: value } });
    await assert.rejects(f.box.extractBoxMetadata('fixture', { id: 'fixture' }, f.box.DOCUMENT_FIELDS), error => !error.message.includes(marker));
  });
}
for (const response of [null, [], {}, { answer: null }, { answer: 'raw text' }, { answer: [] }]) {
  test('malformed envelope rejected: ' + JSON.stringify(response), async () => {
    const f = await fixture(response);
    await assert.rejects(f.box.extractBoxMetadata('fixture', { id: 'fixture' }, f.box.DOCUMENT_FIELDS));
  });
}
test('unsupported requested key fails before HTTP', async () => {
  const f = await fixture({});
  await assert.rejects(f.box.extractBoxMetadata('fixture', { id: 'fixture' }, [{ key: 'customerName' }]));
  assert.equal(f.requests.length, 0);
});
for (const mode of ['success', 'invalid', 'http-error']) {
  test('actual main output excludes private markers: ' + mode, async () => {
    const f = await fixture({ answer: { customerName: marker, amountDue: mode === 'invalid' ? marker : '10.00' } }, mode === 'http-error');
    await f.main();
    assert(!f.output.join('\n').includes(marker));
    assert(!f.output.join('\n').includes('Public-safe'));
    assert.equal(f.state.exitCode, mode === 'success' ? 0 : 1);
    if (mode === 'success') assert(f.output.join('\n').includes('10.00'));
  });
}
