const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../scripts/run.sh'), 'utf8');
const encoding = source.slice(source.indexOf('EXTRA_ARGS_STR='), source.indexOf('# Write the script to a temp file'));
const replacement = source.split('\n').find(line => line.startsWith('REMOTE_SCRIPT="${REMOTE_SCRIPT/EXTRA_ARGS_PLACEHOLDER/'));
const command = source.split('\n').find(line => line.startsWith('node dist/runner.js EXTRA_ARGS_PLACEHOLDER'));
assert.ok(encoding && replacement && command);

test('remote Bash receives all argument values literally', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cookbook-argv-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'bin'));
  fs.writeFileSync(path.join(root, 'bin/node'), '#!/bin/bash\nprintf "%s\\0" "$@" > "$TEST_ROOT/argv"\n', { mode: 0o755 });
  const cases = [
    [],
    ['--sites', 'https://example.invalid/path', '--runs', '2'],
    ['--sites', 'https://example.invalid/?a=1&b=2', '--runs', '2'],
    ['--sites', 'https://example.invalid/a b', '--runs', '2'],
    ['--sites', 'https://example.invalid; printf marker > marker', '--runs', '2'],
    ['--sites', 'https://example.invalid/$(touch marker)`touch marker`"\'\\\n*', '--runs', '2'],
  ];
  for (const args of cases) {
    const generated = spawnSync('/bin/bash', ['-c', 'set -eu\nEXTRA_ARGS=("$@")\n' + encoding + '\nREMOTE_SCRIPT="' + command + '"\n' + replacement + '\nprintf "%s" "$REMOTE_SCRIPT"', 'fixture', ...args], { encoding: 'utf8' });
    assert.equal(generated.status, 0, generated.stderr);
    const run = spawnSync('/bin/bash', ['-c', generated.stdout + '\nwait\n'], { cwd: root, env: { PATH: path.join(root, 'bin') + ':/usr/bin:/bin', TEST_ROOT: root }, encoding: 'utf8', timeout: 5000 });
    assert.equal(run.status, 0, run.stderr);
    const received = fs.readFileSync(path.join(root, 'argv'), 'utf8').split('\0').slice(0, -1);
    assert.deepEqual(received, ['dist/runner.js', ...args]);
    assert.equal(fs.existsSync(path.join(root, 'marker')), false);
  }
});
