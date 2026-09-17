"""Exercise the actual launcher with shell stubs; no server or cloud calls."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SOURCE = Path(os.environ.get('LAUNCHER_SOURCE', Path(__file__).resolve().parents[1] / 'run-demo.sh'))
STUBS = r'''
lsof(){ case "$*" in *":${BUSY_PORT:-none}"*) return 0;; esac; return "${LSOF_STATUS:-1}"; }
node(){ printf '%s\n' '---READY---' '{"tunnelUrl":"https://synthetic.invalid","secret":"synthetic"}'; }
sleep(){ :; }
kill(){ if [ "$1" = "-0" ] && [ "${CHILD_EXITED:-0}" = 1 ]; then return 1; fi; printf 'kill %s\n' "$*" >> "$CALLS"; return 0; }
jobs(){ if [ "${#OWNED_PIDS[@]}" -gt 0 ]; then printf '%s\n' "${OWNED_PIDS[0]}"; fi; }
curl(){ printf 'curl %s\n' "$*" >> "$CALLS"; case "$*" in *REQUEST_RELEASE*) return 0;; *'/v1/sessions'*) printf '%s' '{"id":"current-synthetic","connectUrl":"wss://synthetic.invalid"}';; *) echo '<title>Synthetic</title>';; esac; }
test-runner(){ echo 'synthetic runner'; return "${RUNNER_STATUS:-0}"; }
'''

class LauncherTests(unittest.TestCase):
    def run_fixture(self, **overrides):
        with tempfile.TemporaryDirectory(prefix='cookbook-r208-') as directory:
            root = Path(directory)
            shutil.copyfile(SOURCE, root / 'run-demo.sh')
            (root / 'stubs.sh').write_text(STUBS)
            stale = {'app.pid': '987651', 'shim.pid': '987652', 'tunnel.pid': '987653',
                     'bb-session.json': '{"id":"unrelated-old-session"}'}
            for name, value in stale.items(): (root / name).write_text(value)
            env = {**os.environ, 'BASH_ENV': str(root / 'stubs.sh'), 'CALLS': str(root / 'calls'),
                   'ENV_FILE': str(root / 'nonexistent'), 'BROWSERBASE_API_KEY': 'synthetic', 'TEST_RUNNER_API_KEY': 'synthetic',
                   'TMPDIR': str(root), **overrides}
            run = subprocess.run(['bash', str(root / 'run-demo.sh')], input='\n', text=True,
                                 capture_output=True, env=env, timeout=15)
            calls = (root / 'calls').read_text() if (root / 'calls').exists() else ''
            self.assertEqual({name: (root / name).read_text() for name in stale}, stale)
            self.assertFalse(list(root.glob('test-runner-demo.*')))
            self.assertNotIn('98765', calls)
            self.assertNotIn('unrelated-old-session', calls)
            return run, calls

    def test_app_port_conflict_exits_without_kill_or_cloud(self):
        run, calls = self.run_fixture(BUSY_PORT='3000')
        self.assertNotEqual(run.returncode, 0)
        self.assertIn('Port 3000 is already in use', run.stderr)
        self.assertEqual(calls, '')

    def test_shim_port_conflict_exits_before_starting_resources(self):
        run, calls = self.run_fixture(BUSY_PORT='8000')
        self.assertNotEqual(run.returncode, 0)
        self.assertEqual(calls, '')

    def test_port_inspection_error_fails_closed(self):
        run, calls = self.run_fixture(LSOF_STATUS='2')
        self.assertNotEqual(run.returncode, 0)
        self.assertIn('Could not check port', run.stderr)
        self.assertEqual(calls, '')

    def test_child_start_failure_stops_before_cloud_creation(self):
        run, calls = self.run_fixture(CHILD_EXITED='1')
        self.assertNotEqual(run.returncode, 0)
        self.assertIn('Local app exited', run.stderr)
        self.assertNotIn('curl ', calls)

    def test_cleanup_only_signals_running_owned_child_and_current_session(self):
        run, calls = self.run_fixture()
        self.assertEqual(run.returncode, 0, run.stderr)
        signals = [line for line in calls.splitlines() if line.startswith('kill ') and not line.startswith('kill -0 ')]
        self.assertEqual(len(signals), 1, calls)
        self.assertEqual(calls.count('REQUEST_RELEASE'), 1)
        self.assertIn('/sessions/current-synthetic', calls)

    def test_runner_failure_preserves_failure_and_releases_current_resources(self):
        run, calls = self.run_fixture(RUNNER_STATUS='7')
        self.assertEqual(run.returncode, 7, run.stderr)
        self.assertEqual(calls.count('REQUEST_RELEASE'), 1)

if __name__ == '__main__': unittest.main()
