import { createRequire } from 'node:module';
import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { installBrowseTransport } from './cdp-transport.mjs';

const getArg = name => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');

try {
  const compatibility = JSON.parse(readFileSync(new URL('./cdp-compatibility.json', import.meta.url), 'utf8'));
  const evaluator = getArg('--evaluate-entry');
  if (!evaluator || sha256(evaluator) !== compatibility.evaluatorSha256) {
    throw new Error('Evaluator transport contract changed or is unavailable; review compatibility before running');
  }
  const requireFromEvaluator = createRequire(realpathSync(evaluator));
  for (const dependency of ['@anthropic-ai/sdk', 'dotenv/config']) requireFromEvaluator.resolve(dependency);
  const candidate = (process.env.PATH || '').split(path.delimiter).filter(Boolean)
    .map(dir => path.join(dir, 'browse')).find(file => existsSync(file));
  if (!candidate) throw new Error('Compatible browse installation not found');
  const browseEntry = realpathSync(candidate);
  const browseRoot = path.dirname(path.dirname(browseEntry));
  const pkg = JSON.parse(readFileSync(path.join(browseRoot, 'package.json'), 'utf8'));
  if (pkg.name !== 'browse' || pkg.version !== compatibility.browseVersion
    || Object.entries(compatibility.browseFiles).some(([file, digest]) => sha256(path.join(browseRoot, file)) !== digest)) {
    throw new Error('Browse transport contract changed; review compatibility before running');
  }
  if (process.argv.includes('--check')) {
    console.log('CDP transport compatibility verified');
  } else {
    const connection = process.env.CA_EDD_CDP_URL;
    delete process.env.CA_EDD_CDP_URL;
    const session = getArg('--session');
    const task = getArg('--task');
    const workspace = getArg('--workspace');
    if (!connection || !session || !task || !workspace) throw new Error('Missing evaluator transport configuration');
    const marker = `wss://ca-edd-session.invalid/${encodeURIComponent(session)}`;
    installBrowseTransport({ connection, browseEntry, marker });
    // The evaluator sees a non-secret marker; only the browser child receives
    // credentials through its environment and substitutes them in memory.
    process.argv = [process.execPath, evaluator, '--task', task, '--workspace', workspace, '--env', 'remote', '--connect-url', marker, '--run-number', '1'];
    await import(pathToFileURL(evaluator).href);
  }
} catch {
  console.error('CDP transport setup failed. Check installed evaluator/browse compatibility and required configuration.');
  process.exitCode = 1;
}
