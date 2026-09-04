import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';

export const CONNECTION_MARKER = 'wss://ca-edd-session.invalid/owned';

export function connectionRedactor(connection) {
  const url = new URL(connection);
  if (!['wss:', 'ws:'].includes(url.protocol)) throw new Error('Invalid CDP connection protocol');
  const secrets = new Set([connection, encodeURIComponent(connection)]);
  for (const [key, value] of url.searchParams) {
    if (/key|token|secret|password|signature|credential/i.test(key) && value) {
      secrets.add(value);
      secrets.add(encodeURIComponent(value));
    }
  }
  if (url.password) secrets.add(url.password);
  if (url.username) secrets.add(url.username);
  const ordered = [...secrets].sort((a,b)=>b.length-a.length);
  return value => {
    let text = String(value);
    for (const secret of ordered) text = text.split(secret).join('[REDACTED]');
    return text;
  };
}

/** Bound the installed evaluator's browse calls to a credential-free OS argv. */
export function installBrowseTransport({ connection, browseEntry, marker = CONNECTION_MARKER, execFileSync = childProcess.execFileSync }) {
  const redact = connectionRedactor(connection);
  const wrapper = fileURLToPath(new URL('./browse-cdp.mjs', import.meta.url));
  const original = childProcess.execFileSync;
  const wrapped = (file, args = [], options = {}) => {
    if (file !== 'browse') return execFileSync(file, args, options);
    // The evaluator supplies its marker after command parsing. Never expose it
    // to a shell, and refuse a command that tries to substitute another target.
    const cdpIndexes = args.flatMap((arg, i) => arg === '--cdp' ? [i] : []);
    if (cdpIndexes.length !== 1 || args[cdpIndexes[0] + 1] !== marker
      || args.some(arg => arg.startsWith('--cdp='))) {
      throw new Error('Browse command must use the owned CDP connection');
    }
    try {
      const output = execFileSync(process.execPath, [wrapper, browseEntry, ...args], {
        ...options,
        // These values are inherited by the wrapper, never interpolated in argv.
        env: { ...process.env, ...options.env, CA_EDD_CDP_URL: connection, CA_EDD_CDP_MARKER: marker, BROWSE_LOAD_DOTENV: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return Buffer.isBuffer(output) ? Buffer.from(redact(output.toString('utf8'))) : redact(output);
    } catch (error) {
      const safe = new Error('Browse command failed');
      safe.status = error.status;
      safe.stdout = redact(error.stdout?.toString('utf8') ?? '');
      safe.stderr = redact(error.stderr?.toString('utf8') ?? error.message ?? 'Browser command unavailable');
      throw safe;
    }
  };
  childProcess.execFileSync = wrapped;
  syncBuiltinESMExports();
  return () => { childProcess.execFileSync = original; syncBuiltinESMExports(); };
}
