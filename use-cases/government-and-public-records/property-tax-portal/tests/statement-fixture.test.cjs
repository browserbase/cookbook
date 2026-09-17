const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const { execFileSync } = require('node:child_process');
test('synthetic PDF generator is deterministic and its xref points to each object', () => {
  const generator = path.join(__dirname, '../scripts/generate-statement.py');
  const code = 'import runpy,sys;sys.stdout.buffer.write(runpy.run_path(sys.argv[1])["statement_pdf"]())';
  const generated = execFileSync('python3', ['-c', code, generator]);
  const checkedIn = fs.readFileSync(path.join(__dirname, '../public/tax-statement-2024.pdf'));
  assert.deepEqual(generated, checkedIn);
  const text = generated.toString('ascii');
  const start = Number(/startxref\n(\d+)\n/.exec(text)[1]); assert.equal(text.slice(start, start + 4), 'xref');
  const entries = text.slice(start).split('\n'); assert.equal(entries[1], '0 6');
  for (let index = 1; index <= 5; index++) {
    const offset = Number(entries[index + 2].slice(0, 10)); assert(text.slice(offset).startsWith(`${index} 0 obj\n`));
  }
  const stream = /\/Length (\d+) >>\nstream\n([\s\S]*?)endstream/.exec(text);
  assert.equal(Buffer.byteLength(stream[2]), Number(stream[1]));
});
