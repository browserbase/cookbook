import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stripTypeScriptTypes, createRequire } from 'node:module';
import vm from 'node:vm';
const AdmZip = createRequire(import.meta.url)('adm-zip');
const source = stripTypeScriptTypes(fs.readFileSync(new URL('../index.ts', import.meta.url), 'utf8')).replace(/^import .*;$/gm, '');
const declarations = source.slice(0, source.lastIndexOf('main().catch'));

async function fixture(fn, change = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cookbook-receipts-test-'));
  const resolve = file => path.isAbsolute(file) ? file : path.join(dir, file);
  const io = new Proxy(fs, { get(target, name) {
    if (['existsSync', 'mkdirSync', 'lstatSync', 'readdirSync', 'writeFileSync', 'readFileSync'].includes(name)) return (file, ...args) => {
      if (change.lateCollision && name === 'writeFileSync' && String(file).endsWith('a.pdf') && args[1]?.flag === 'wx') fs.writeFileSync(resolve(file), 'created by another writer');
      return target[name](resolve(file), ...args);
    };
    return target[name];
  } });
  const uploads = [], logs = [], exits = [];
  const zipPath = path.join(dir, "archive.zip"), out = path.join(dir, "documents");
  class ExtendClient {
    files = { upload: async blob => { uploads.push(await blob.text()); if (change.uploadFails) throw Error('synthetic upload failure'); return { id: 'synthetic-file' }; } };
    extract = async () => { if (change.extractThrows) throw Error('synthetic parse, "failure"'); return { id: 'synthetic-run', status: 'PROCESSED', output: { value: { vendor_name: 'Example Vendor', line_items: [] } }, ...change.result }; };
  }
  const page = { goto: async () => {} };
  const browser = { sessionId: "synthetic", context: { pages: async () => [page] }, close: async () => {} };
  const stagehand = { observe: async () => ({ data: [{ selector: "#download" }] }), act: async () => ({ data: { success: true } }), close: async () => {} };
  const context = vm.createContext({ fs: io, path, AdmZip: class extends AdmZip { constructor(input) { super(typeof input === "string" ? resolve(input) : input); } }, Buffer, Blob, ExtendClient,
    Browserbase: class { sessions = { downloads: { list: async () => ({ arrayBuffer: async () => fs.readFileSync(zipPath) }) } }; },
    browserbase: { launch: async () => browser }, Stagehand: { create: async () => stagehand }, setTimeout: callback => { callback(); return 1; },
    process: { env: { EXTEND_API_KEY: "synthetic", BROWSERBASE_API_KEY: "synthetic" }, exit: code => exits.push(code) }, console: { log: (...args) => logs.push(args.join(' ')), error() {}, warn() {} } });
  vm.runInContext(declarations + '\nglobalThis.extractZip=extractFilesFromZip;globalThis.parseReceipts=parseReceiptsWithExtend;', context);
  const writeZip = entries => {
    const zip = new AdmZip();
    entries.forEach(([name, data = 'synthetic receipt', attr]) => {
      const key = 'entry-' + zip.getEntries().length; zip.addFile(key, Buffer.from(data));
      const entry = zip.getEntry(key); entry.entryName = name; if (attr !== undefined) entry.attr = attr;
    });
    zip.writeZip(zipPath);
  };
  try { await fn({ dir, out, zipPath, writeZip, context, uploads, logs, exits }); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('nested ZIP entries return readable flattened paths', () => fixture(async f => {
  f.writeZip([['receipts/a.pdf', 'first'], ['receipts/sub/b.pdf', 'second']]);
  const paths = f.context.extractZip(f.zipPath, f.out);
  assert.deepEqual(Array.from(paths).sort(), [path.join(f.out, 'a.pdf'), path.join(f.out, 'b.pdf')]);
  assert.deepEqual(Array.from(paths, file => fs.readFileSync(file, 'utf8')).sort(), ['first', 'second']);
  await f.context.parseReceipts(paths); assert.equal(f.uploads.length, 2);
}));
for (const names of [['x/a.pdf', 'y/a.pdf'], ['x/A.pdf', 'y/a.pdf'], ['x/café.pdf', 'y/cafe\u0301.pdf']]) test(`flattened name collision rejects before writing ${JSON.stringify(names)}`, () => fixture(f => {
  f.writeZip(names.map(name => [name])); assert.throws(() => f.context.extractZip(f.zipPath, f.out)); assert.deepEqual(fs.readdirSync(f.out), []);
}));
for (const name of ['../escape.pdf', '/absolute.pdf', 'C:/file.pdf', 'x/../file.pdf', 'x\\file.pdf', 'x/file.pdf:stream']) test(`unsafe archive name ${name}`, () => fixture(f => {
  f.writeZip([[name]]); assert.throws(() => f.context.extractZip(f.zipPath, f.out)); assert.deepEqual(fs.readdirSync(f.out), []);
}));

test('directory-only archive is not successful extraction', () => fixture(f => {
  f.writeZip([['receipts/', '']]); assert.throws(() => f.context.extractZip(f.zipPath, f.out));
}));

test('ZIP symlink is rejected', () => fixture(f => {
  f.writeZip([['link.pdf', 'target.pdf', (0o120777 << 16) >>> 0]]); assert.throws(() => f.context.extractZip(f.zipPath, f.out));
}));
for (const symlink of [false, true]) test(`existing destination is preserved (symlink=${symlink})`, () => fixture(f => {
  fs.mkdirSync(f.out); const existing = path.join(f.out, 'a.pdf');
  fs.writeFileSync(path.join(f.dir, 'original'), 'keep');
  if (symlink) fs.symlinkSync(path.join(f.dir, 'original'), existing); else fs.writeFileSync(existing, 'keep');
  f.writeZip([['nested/a.pdf', 'replacement']]); assert.throws(() => f.context.extractZip(f.zipPath, f.out)); assert.equal(fs.readFileSync(existing, 'utf8'), 'keep');
}));

test('missing file remains in JSON and CSV before failure propagates', () => fixture(async f => {
  f.writeZip([['receipts/good.pdf']]); const good = f.context.extractZip(f.zipPath, f.out)[0];
  await assert.rejects(() => f.context.parseReceipts([good, path.join(f.out, 'missing.pdf')]), /1 of 2 receipts failed/);
  const results = JSON.parse(fs.readFileSync(path.join(f.dir, 'output/results/receipts.json'), 'utf8'));
  assert.deepEqual(results.map(x => x.status), ['succeeded', 'failed']); assert.ok(results[1].error.includes('ENOENT'));
  const csv = fs.readFileSync(path.join(f.dir, 'output/results/receipts.csv'), 'utf8');
  assert.ok(csv.startsWith('file,status,error,')); assert.ok(csv.includes('"missing.pdf","failed",')); assert.ok(csv.includes('ENOENT')); assert.equal(f.uploads.length, 1);
}));
for (const change of [{ uploadFails: true }, { extractThrows: true }, { result: { status: 'FAILED', failureReason: 'PARSING_ERROR' } }, { result: { status: 'PROCESSING' } }, { result: { output: null } }]) test(`parse failure is reported and propagated ${JSON.stringify(change)}`, () => fixture(async f => {
  f.writeZip([['a.pdf']]); const files = f.context.extractZip(f.zipPath, f.out);
  await assert.rejects(() => f.context.parseReceipts(files));
  const results = JSON.parse(fs.readFileSync(path.join(f.dir, 'output/results/receipts.json'), 'utf8')); assert.equal(results[0].status, 'failed'); assert.ok(results[0].error);
  const csv = fs.readFileSync(path.join(f.dir, 'output/results/receipts.csv'), 'utf8'); assert.ok(csv.includes('"a.pdf","failed",'));
  if (change.extractThrows) assert.ok(csv.includes('synthetic parse, ""failure""'));
}, change));

for (const extractThrows of [false, true]) test(`actual CLI reports and exits for parse outcome (failure=${extractThrows})`, () => fixture(async f => {
  f.writeZip([["nested/receipt.pdf"]]);
  const invoke = source.slice(source.lastIndexOf('main().catch')).replace('main().catch(', 'globalThis.done = main().catch(');
  vm.runInContext(invoke, f.context); await f.context.done;
  assert.deepEqual(f.exits, extractThrows ? [1] : []);
  const results = JSON.parse(fs.readFileSync(path.join(f.dir, 'output/results/receipts.json'), 'utf8'));
  assert.equal(results[0].status, extractThrows ? 'failed' : 'succeeded');
  assert.ok(fs.existsSync(path.join(f.dir, 'output/results/receipts.csv')));
  assert.equal(f.logs.some(line => line.includes('Expense receipt download complete!')), !extractThrows);
}, { extractThrows }));

test('corrupt uncompressed size fails before any files are written', () => fixture(f => {
  f.writeZip([['a.pdf', 'first'], ['b.pdf', 'second']]);
  const zip = fs.readFileSync(f.zipPath); const central = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.ok(central >= 0); zip.writeUInt32LE(zip.readUInt32LE(central + 24) + 1, central + 24); fs.writeFileSync(f.zipPath, zip);
  assert.throws(() => f.context.extractZip(f.zipPath, f.out)); assert.deepEqual(fs.readdirSync(f.out), []);
}));

test('a file appearing after preflight is not overwritten', () => fixture(f => {
  f.writeZip([['a.pdf', 'replacement']]); assert.throws(() => f.context.extractZip(f.zipPath, f.out));
  assert.equal(fs.readFileSync(path.join(f.out, 'a.pdf'), 'utf8'), 'created by another writer');
}, { lateCollision: true }));
