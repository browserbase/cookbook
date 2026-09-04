const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

for (const mode of ['apply-failure', 'output-failure', 'cleanup-failure', 'no-destroy', 'ssm-failure']) {
  test(`isolated provisioning cleanup: ${mode}`, t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cookbook-cleanup-test-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const dir of ['scripts', 'infra', 'bin']) fs.mkdirSync(path.join(root, dir));
    fs.copyFileSync(path.join(__dirname, '../scripts/run.sh'), path.join(root, 'scripts/run.sh'));
    for (const name of ['main.tf', 'variables.tf', 'outputs.tf', 'user_data.sh']) fs.copyFileSync(path.join(__dirname, '../infra', name), path.join(root, 'infra', name));
    fs.writeFileSync(path.join(root, 'infra/terraform.tfstate'), 'preexisting-state');
    const mocks = {
      npm: '#!/bin/sh\nexit 0\n', aws: '#!/bin/sh\nexit 1\n', sleep: '#!/bin/sh\nexit 0\n', seq: '#!/bin/sh\necho 30\n',
      terraform: `#!/bin/bash
printf '%s|%s\\n' "$1" "$PWD" >> "$TEST_ROOT/calls"
case "$1" in
 init) exit 0;;
 apply) touch resource; if [[ "$TEST_MODE" != output-failure && "$TEST_MODE" != ssm-failure ]]; then exit 23; fi;;
 output) if [[ "$TEST_MODE" == output-failure ]]; then exit 24; fi; echo synthetic-instance;;
 destroy) if [[ "$TEST_MODE" == cleanup-failure ]]; then exit 25; fi; rm resource;;
esac
`,
    };
    for (const [name, content] of Object.entries(mocks)) fs.writeFileSync(path.join(root, 'bin', name), content, { mode: 0o755 });
    const env = { PATH: path.join(root, 'bin') + ':/usr/bin:/bin', TEST_ROOT: root, TEST_MODE: mode };
    for (const key of ['GOOGLE_API_KEY', 'BROWSERBASE_API_KEY', 'BROWSERBASE_PROJECT_ID', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) env[key] = 'synthetic';
    const result = spawnSync('/bin/bash', [path.join(root, 'scripts/run.sh'), ...(mode === 'no-destroy' ? ['--no-destroy'] : [])], { env, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, mode === 'output-failure' ? 24 : mode === 'ssm-failure' ? 1 : 23, result.stderr);
    const calls = fs.readFileSync(path.join(root, 'calls'), 'utf8').trim().split('\n').map(line => line.split('|'));
    const work = calls[0][1];
    assert.notEqual(work, path.join(root, 'infra'));
    assert.ok(work.startsWith(path.join(root, '.benchmark-runs') + path.sep));
    assert.ok(calls.every(([, cwd]) => cwd === work));
    assert.equal(calls.some(([command]) => command === 'destroy'), mode !== 'no-destroy');
    assert.equal(fs.existsSync(path.join(work, 'resource')), ['no-destroy', 'cleanup-failure'].includes(mode));
    assert.equal(fs.readFileSync(path.join(root, 'infra/terraform.tfstate'), 'utf8'), 'preexisting-state');
    if (mode === 'cleanup-failure') assert.match(result.stdout + result.stderr, /Cleanup failed/);
    assert.ok(result.stdout.includes(work));
  });
}
