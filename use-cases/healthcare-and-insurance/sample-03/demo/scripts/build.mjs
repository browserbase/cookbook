import { copyFile, lstat, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'dist');
const require = createRequire(import.meta.url);
const compiler = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc');
const existing = await lstat(output).catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return null;
});
if (existing?.isSymbolicLink() || (existing && !existing.isDirectory())) {
  throw new Error('Refusing to clean an unexpected dist path');
}
await rm(output, { recursive: true, force: true });
try {
  const result = spawnSync(process.execPath, [compiler, '-p', join(root, 'tsconfig.json')], { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('TypeScript build failed');
  await mkdir(join(output, 'public'), { recursive: true });
  // Only the current interface is deployable; backups and runtime data are not assets.
  for (const name of ['index.html']) {
    const source = join(root, 'public', name);
    if (!(await lstat(source)).isFile()) throw new Error('Expected a regular static asset');
    await copyFile(source, join(output, 'public', name));
  }
} catch (error) {
  await rm(output, { recursive: true, force: true });
  throw error;
}
