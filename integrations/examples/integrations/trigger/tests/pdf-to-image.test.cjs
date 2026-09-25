const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

function load(root, failAt, publicBase = "https://downloads.example.com/assets") {
  const calls = [], uploads = [];
  const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../src/trigger/pdf-to-image.tsx'), 'utf8'))
    .replace(/^import .*;\n/gm, '').replace('export const pdfToImage', 'globalThis.pdfToImage') + stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../src/trigger/storage-target.ts'), 'utf8')).replace(/^import .*;\n/gm, '').replace(/export /g, '');
  const context = {
    fs, path, randomUUID: require('node:crypto').randomUUID, tmpdir: () => root, URL, process: { env: { S3_BUCKET: 'synthetic', S3_PUBLIC_BASE_URL: publicBase } },
    logger: { log() {} }, task: value => value,
    S3Client: class { async send(command) { uploads.push(command); if (failAt === 'upload') throw new Error('synthetic upload failure'); } },
    PutObjectCommand: class { constructor(value) { Object.assign(this, value); } },
    execSync() { calls.push({ program: 'shell' }); throw new Error('shell execution is forbidden'); },
    execFileSync(program, args) {
      calls.push({ program, args });
      if (program === failAt) throw new Error('synthetic command failure');
      if (program === 'curl') fs.writeFileSync(args[args.indexOf('--output') + 1], 'synthetic PDF');
      else if (program === 'mutool') fs.writeFileSync(args[args.indexOf('-o') + 1].replace('%d', '1'), 'synthetic PNG');
      else throw new Error('unexpected program');
    },
  };
  vm.runInNewContext(source, context);
  return { run: context.pdfToImage.run, calls, uploads };
}

test('rejects unsafe payloads before commands or files', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-task-test-'));
  try {
    const subject = load(root);
    for (const payload of [null, {}, { documentId: '../escape', pdfUrl: 'https://example.com/a.pdf' },
      { documentId: 'x;echo bad', pdfUrl: 'https://example.com/a.pdf' },
      { documentId: 'valid', pdfUrl: 'file:///etc/passwd' },
      { documentId: 'valid', pdfUrl: '--output /tmp/escape' },
      { documentId: 'valid', pdfUrl: 'https://user:password@example.com/a.pdf' }]) {
      await assert.rejects(subject.run(payload));
    }
    assert.equal(subject.calls.length, 0);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('uses literal arguments and isolated temporary files, then cleans up', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-task-test-'));
  try {
    const subject = load(root);
    const pdfUrl = 'https://example.com/a.pdf?x=$(touch%20bad);echo';
    for (let i = 0; i < 2; i++) {
      const result = await subject.run({ documentId: 'document-123', pdfUrl });
      assert.equal(result.imageUrls[0], `https://downloads.example.com/assets/${subject.uploads[i].Key}`);
      assert.deepEqual(fs.readdirSync(root), []);
    }
    assert.deepEqual(subject.calls.map(call => call.program), ['curl', 'mutool', 'curl', 'mutool']);
    assert.equal(subject.calls[0].args.at(-1), pdfUrl);
    assert.equal(subject.calls[0].args.at(-2), '--');
    assert.notEqual(subject.calls[0].args[subject.calls[0].args.indexOf('--output') + 1], subject.calls[2].args[subject.calls[2].args.indexOf('--output') + 1]);
    assert.match(subject.uploads[0].Key, /^images\/document-123\/[a-f0-9-]{36}\/page-1.png$/);
    assert.notEqual(subject.uploads[0].Key, subject.uploads[1].Key);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('cleans up after download, conversion, and upload failures', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-task-test-'));
  try {
    for (const failure of ['curl', 'mutool', 'upload']) {
      await assert.rejects(load(root, failure).run({ documentId: 'document-123', pdfUrl: 'https://example.com/a.pdf' }), /synthetic/);
      assert.deepEqual(fs.readdirSync(root), []);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});


test('image conversion rejects missing public download configuration before file or command work', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-task-test-'));
  try {
    const subject = load(root, null, '');
    await assert.rejects(subject.run({ documentId: 'document-123', pdfUrl: 'https://example.com/a.pdf' }), /S3_PUBLIC_BASE_URL/);
    assert.equal(subject.calls.length, 0);
    assert.equal(subject.uploads.length, 0);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
