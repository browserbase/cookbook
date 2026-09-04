const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

for (const mode of ['rejected', 'accepted']) test(`Render launcher ${mode} start`, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cookbook-render-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ['scripts', 'bin']) fs.mkdirSync(path.join(root, dir));
  fs.copyFileSync(path.join(__dirname, '../scripts/render-run.sh'), path.join(root, 'scripts/render-run.sh'));
  const mocks = {
    sleep: '#!/bin/sh\nexit 0\n', open: '#!/bin/sh\nexit 0\n',
    node: '#!/bin/bash\nprintf "%s\\n" "$@" > "$TEST_ROOT/report-args"\n',
    curl: `#!/bin/bash
out=""
config=""
for ((i=1;i<=$#;i++)); do
 if [[ "\${!i}" == -o ]]; then j=$((i+1)); out="\${!j}"; fi
 if [[ "\${!i}" == --config ]]; then j=$((i+1)); config="\${!j}"; fi
done
url="\${!#}"
if [[ "$url" != */health ]]; then
 python3 - "$config" <<'PYCHECK'
import os, sys, stat
assert stat.S_IMODE(os.stat(sys.argv[1]).st_mode) == 0o600
assert open(sys.argv[1]).read().strip() == 'header = "Authorization: Bearer ' + os.environ['BENCHMARK_ACCESS_TOKEN'] + '"'
with open(os.environ['TEST_ROOT']+'/auth-configs','a') as out: out.write(sys.argv[1]+'\\n')
PYCHECK
 [[ $? == 0 ]] || exit 93
fi
echo "$url" >> "$TEST_ROOT/calls"
case "$url" in
 */health) printf 200;;
 */run) if [[ "$TEST_MODE" == rejected ]]; then body='{"error":"Benchmark already running"}'; status=409; else body='{"runId":"owned-run"}'; status=202; fi
 if [[ -n "$out" ]]; then printf '%s' "$body" > "$out"; printf '%s' "$status"; else printf '%s' "$body"; fi;;
 */results?runId=owned-run) printf '[{"site":"https://owned.invalid"}]' > "$out"; printf 200;;
 *) exit 91;;
esac
`,
  };
  for (const [name, content] of Object.entries(mocks)) fs.writeFileSync(path.join(root, 'bin', name), content, { mode: 0o755 });
  const result = spawnSync('/bin/bash', [path.join(root, 'scripts/render-run.sh')], { env: { PATH: path.join(root, 'bin') + ':/usr/bin:/bin:/usr/local/bin', BENCHMARK_ACCESS_TOKEN:'a'.repeat(64), TEST_ROOT: root, TEST_MODE: mode, RENDER_SERVICE_URL: 'https://service.invalid', BENCHMARK_SITES: 'https://owned.invalid' }, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.stdout.includes('a'.repeat(64)),false);
  for(const filename of fs.readFileSync(path.join(root,'auth-configs'),'utf8').trim().split('\n')) assert.equal(fs.existsSync(filename),false);
  const calls = fs.readFileSync(path.join(root, 'calls'), 'utf8');
  if (mode === 'rejected') {
    assert.equal(result.status, 1);
    assert.equal(calls.includes('/results'), false);
    assert.equal(fs.existsSync(path.join(root, 'report-args')), false);
  } else {
    assert.equal(result.status, 0, result.stderr);
    assert.ok(calls.includes('/results?runId=owned-run'));
    const saved = path.join(root, 'results/owned-run.json');
    assert.equal(JSON.parse(fs.readFileSync(saved))[0].site, 'https://owned.invalid');
    assert.ok(fs.readFileSync(path.join(root, 'report-args'), 'utf8').includes('--file\n' + saved));
  }
});
