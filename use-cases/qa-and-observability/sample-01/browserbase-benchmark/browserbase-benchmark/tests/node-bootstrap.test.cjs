const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = join(__dirname, '..');
const source = readFileSync(join(root, 'infra/user_data.sh'), 'utf8');
const install = source.slice(source.indexOf('dnf install -y curl'), source.indexOf('# Pre-install system deps'));

for (const [arch, failure] of [['x86_64', ''], ['aarch64', ''], ['unsupported', ''], ['x86_64', 'download'], ['x86_64', 'checksum'], ['x86_64', 'extract'], ['x86_64', 'version']]) {
  test(`bootstrap Node installation: ${arch}/${failure || 'success'}`, () => {
    const temp = mkdtempSync(join(tmpdir(), 'cookbook-node-bootstrap-'));
    const script = `set -euo pipefail
      dnf() { :; }
      uname() { printf '%s' "$TEST_ARCH"; }
      curl() { echo download >> "$TEST_LOG"; [[ "$TEST_FAILURE" != download ]]; }
      sha256sum() { cat > "$TEST_CHECKSUM"; echo checksum >> "$TEST_LOG"; [[ "$TEST_FAILURE" != checksum ]]; }
      tar() { echo extract >> "$TEST_LOG"; [[ "$TEST_FAILURE" != extract ]]; }
      node() { if [[ "$TEST_FAILURE" = version ]]; then echo v20.0.0; else echo v24.19.0; fi; }
      npm() { echo npm >> "$TEST_LOG"; }
      ${install}
    `;
    try {
      const result = spawnSync('/bin/bash', ['-c', script], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', TEST_ARCH: arch, TEST_FAILURE: failure, TEST_LOG: join(temp, 'calls'), TEST_CHECKSUM: join(temp, 'checksum') } });
      const success = arch !== 'unsupported' && !failure;
      assert.equal(result.status === 0, success, result.stderr);
      let calls = [];
      try { calls = readFileSync(join(temp, 'calls'), 'utf8').trim().split('\n'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const stages = ['download', 'checksum', 'extract', 'npm'];
      const count = arch === 'unsupported' ? 0 : failure === 'version' ? 3 : failure ? stages.indexOf(failure) + 1 : 4;
      assert.deepEqual(calls, stages.slice(0, count));
      if (success) {
        const checksum = readFileSync(join(temp, 'checksum'), 'utf8');
        assert.match(checksum, arch === 'x86_64' ? /^14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647  / : /^01443c1e1a29e531ccad5a46fefa6df490d2189c49f7955904aecdbb0fe86fdc  /);
      }
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });
}
