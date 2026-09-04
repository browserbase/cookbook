import { pathToFileURL, fileURLToPath } from 'node:url';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { CONNECTION_MARKER } from './cdp-transport.mjs';

const [entry, ...args] = process.argv.slice(2);
const connection = process.env.CA_EDD_CDP_URL;
const marker = process.env.CA_EDD_CDP_MARKER || CONNECTION_MARKER;
delete process.env.CA_EDD_CDP_URL;
delete process.env.CA_EDD_CDP_MARKER;
if (!entry || !connection) throw new Error('Missing browser transport configuration');
const index = args.indexOf('--cdp');
if (index >= 0 && args[index + 1] === marker) {
  args[index + 1] = connection;
} else if (args[0] === 'daemon') {
  const targetIndex = args.indexOf('--target');
  if (targetIndex < 0) throw new Error('Missing daemon target');
  const target = JSON.parse(args[targetIndex + 1]);
  if (target.endpoint !== marker) throw new Error('Daemon must use owned target');
  target.endpoint = connection;
  args[targetIndex + 1] = JSON.stringify(target);
} else {
  throw new Error('Missing owned connection marker');
}

// browse 0.9.6 serializes the target into its daemon argv. Route that launch
// through this wrapper too; the daemon receives the URL only after startup.
const nativeSpawn = childProcess.spawn;
const wrapper = fileURLToPath(import.meta.url);
childProcess.spawn = (file, argv, options) => {
  if (file !== process.execPath || argv?.[0] !== entry || argv[1] !== 'daemon') {
    return nativeSpawn(file, argv, options);
  }
  const rewritten = argv.slice(1);
  const targetIndex = rewritten.indexOf('--target');
  if (targetIndex < 0) throw new Error('Missing daemon target');
  const target = JSON.parse(rewritten[targetIndex + 1]);
  if (target.endpoint !== connection) throw new Error('Daemon target differs from owned connection');
  target.endpoint = marker;
  rewritten[targetIndex + 1] = JSON.stringify(target);
  return nativeSpawn(process.execPath, [wrapper, entry, ...rewritten], {
    ...options,
    env: { ...options?.env, CA_EDD_CDP_URL: connection, CA_EDD_CDP_MARKER: marker, BROWSE_LOAD_DOTENV: '0' },
  });
};
syncBuiltinESMExports();

// Changes only the JS argument array, not the operating system's process argv.
process.argv = [process.execPath, entry, ...args];
await import(pathToFileURL(entry).href);
