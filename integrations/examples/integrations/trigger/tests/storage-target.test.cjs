const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { stripTypeScriptTypes } = require('node:module');
function source(file) {
  return stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../src/trigger', file), 'utf8'))
    .replace(/^import .*;\n/gm, '').replace(/export /g, '');
}
function fixture(file, env = {}, uploadFailure = false) {
  let handler, generated = 0;
  const uploads = [], logs = [];
  const context = {
    URL, randomUUID, process: { env: { S3_BUCKET: 'synthetic-bucket', S3_PUBLIC_BASE_URL: 'https://downloads.example.com/artifacts/', ...env } },
    task: value => { handler = value.run; return value; }, logger: { log(...values) { logs.push(values); }, info() {} },
    Document: 'Document', Page: 'Page', View: 'View', Text: 'Text', createElement: (...args) => args,
    renderToBuffer: async () => { generated++; return Buffer.from('synthetic private PDF'); },
    puppeteer: { async launch() { generated++; return { async newPage() { return { async goto() { return { url: () => 'https://example.com' }; }, async pdf() { return Buffer.from('synthetic private PDF'); } }; }, async close() {} }; } },
    S3Client: class { async send(command) { uploads.push(command); if (uploadFailure) throw new Error('synthetic upload rejected'); } },
    PutObjectCommand: class { constructor(value) { Object.assign(this, value); } },
  };
  vm.runInNewContext(source('with-browser.ts') + source('storage-target.ts') + source(file), context);
  return { run: () => handler({ text: 'synthetic private resume' }), uploads, logs, generated: () => generated, target: context.storageTarget };
}

test('both PDF task callbacks produce unique concurrent keys and URLs matching the configured base', async () => {
  for (const file of ['react-pdf.tsx', 'puppeteer-webpage-to-pdf.tsx']) {
    const f = fixture(file);
    const results = await Promise.all([f.run(), f.run()]);
    assert.equal(new Set(f.uploads.map(upload => upload.Key)).size, 2);
    for (const result of results) {
      assert.equal(result.bucket, 'synthetic-bucket');
      assert.equal(result.pdfUrl, `https://downloads.example.com/artifacts/${result.key}`);
      assert.ok(f.uploads.some(upload => upload.Key === result.key));
      assert.doesNotMatch(result.pdfUrl, /amazonaws|cloudflarestorage/);
    }
    assert.doesNotMatch(JSON.stringify(f.logs), /synthetic private/);
  }
});

test('invalid configuration fails before rendering, launching browsers or uploading', async () => {
  for (const file of ['react-pdf.tsx', 'puppeteer-webpage-to-pdf.tsx']) {
    for (const env of [{ S3_BUCKET: '' }, ...['', 'http://example.com', 'https://user:secret@example.com', 'https://example.com?token=x', 'https://example.com#fragment', 'https://account.r2.cloudflarestorage.com'].map(value => ({ S3_PUBLIC_BASE_URL: value }))]) {
      const f = fixture(file, env);
      await assert.rejects(f.run(), /Configure|S3_PUBLIC_BASE_URL/);
      assert.equal(f.generated(), 0);
      assert.equal(f.uploads.length, 0);
    }
  }
});

test('failed uploads do not return an artifact URL and key segments cannot traverse', async () => {
  for (const file of ['react-pdf.tsx', 'puppeteer-webpage-to-pdf.tsx']) {
    await assert.rejects(fixture(file, {}, true).run(), /upload rejected/);
  }
  const f = fixture('react-pdf.tsx');
  assert.throws(() => f.target('../outside'), /prefix/);
  const target = f.target('images/document');
  assert.throws(() => target.file('../outside.pdf'), /filename/);
  assert.throws(() => target.file('image.png?x=1'), /filename/);
});
