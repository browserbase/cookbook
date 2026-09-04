import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { x } from 'tar';

const TARBALL_BASE = 'https://codeload.github.com/browserbase/skills/tar.gz';
const MANIFEST = '.browserbase-skills.json';
const LOCK = '.browserbase-skills.lock';
const JOURNAL = '.browserbase-skills-transaction.json';

type Manifest = {
  version: 1;
  source: 'browserbase/skills';
  ref: string;
  skills: string[];
  files: Record<string, string>;
};

export type SkillSyncResult = { targetRoot: string; ref: string; filesWritten: string[] };
export type BrowserbaseSkillsStatus = {
  state: 'absent' | 'incomplete' | 'installed';
  reason: string;
};

export function defaultSkillsRoot(): string {
  return path.join(os.homedir(), '.openclaw', 'skills');
}

export function resolveSkillsRoot(explicitPath?: string): string {
  return typeof explicitPath === 'string' && explicitPath.trim()
    ? path.resolve(process.cwd(), explicitPath.trim()) : defaultSkillsRoot();
}

function exists(file: string): boolean {
  try { fs.lstatSync(file); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function rejectSymlinkAncestors(target: string): void {
  let current = path.resolve(target);
  while (true) {
    if (exists(current) && (!fs.lstatSync(current).isDirectory() || fs.lstatSync(current).isSymbolicLink())) {
      throw new Error('The skills path must contain only real directories.');
    }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function validSkillName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name);
}

function treeHashes(root: string, skills: string[]): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (relative: string): void => {
    const absolute = path.join(root, relative);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error('Skill links are not supported.');
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) walk(`${relative}/${name}`);
    } else if (stat.isFile()) {
      files[relative] = createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
    } else throw new Error('Unsupported skill file type.');
  };
  for (const skill of skills) {
    if (!validSkillName(skill) || !fs.lstatSync(path.join(root, skill)).isDirectory()) {
      throw new Error('Each skill must have a valid directory.');
    }
    walk(skill);
    const entrypoint = path.join(root, skill, 'SKILL.md');
    if (!files[`${skill}/SKILL.md`] || !fs.readFileSync(entrypoint, 'utf8').trim()) {
      throw new Error('Each skill must contain a nonempty SKILL.md.');
    }
  }
  return files;
}

function readManifest(root: string): Manifest {
  const file = path.join(root, MANIFEST);
  if (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) throw new Error('Invalid ownership manifest.');
  const value = JSON.parse(fs.readFileSync(file, 'utf8')) as Manifest;
  if (value.version !== 1 || value.source !== 'browserbase/skills' || typeof value.ref !== 'string' || !value.ref.trim()
    || !Array.isArray(value.skills) || !value.skills.length || value.skills.some(name => typeof name !== 'string' || !validSkillName(name))
    || new Set(value.skills).size !== value.skills.length || !value.files || typeof value.files !== 'object' || Array.isArray(value.files)) {
    throw new Error('Invalid ownership manifest.');
  }
  for (const [relative, hash] of Object.entries(value.files)) {
    const parts = relative.split('/');
    if (parts.length < 2 || !value.skills.includes(parts[0]) || parts.some(part => !part || part === '.' || part === '..')
      || relative.includes('\\') || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) {
      throw new Error('Invalid ownership manifest file entry.');
    }
  }
  return value;
}

function validateManaged(root: string): Manifest {
  const manifest = readManifest(root);
  const actual = treeHashes(root, manifest.skills);
  const expectedNames = Object.keys(manifest.files).sort();
  if (JSON.stringify(Object.keys(actual).sort()) !== JSON.stringify(expectedNames)
    || expectedNames.some(name => manifest.files[name] !== actual[name])) {
    throw new Error('Managed skills are incomplete or locally modified.');
  }
  return manifest;
}

export function getBrowserbaseSkillsStatus(targetRoot = defaultSkillsRoot()): BrowserbaseSkillsStatus {
  try {
    rejectSymlinkAncestors(targetRoot);
    if (exists(path.join(targetRoot, JOURNAL))) return { state: 'incomplete', reason: 'An interrupted skill sync requires recovery.' };
    if (!exists(path.join(targetRoot, MANIFEST))) return { state: 'absent', reason: 'No Browserbase ownership manifest is installed.' };
    validateManaged(targetRoot);
    return { state: 'installed', reason: 'All recorded Browserbase skill files are present and unchanged.' };
  } catch {
    return { state: 'incomplete', reason: 'The Browserbase manifest or managed skill files could not be verified.' };
  }
}

export function hasBrowserbaseSkills(targetRoot = defaultSkillsRoot()): boolean {
  return getBrowserbaseSkillsStatus(targetRoot).state === 'installed';
}

export function installedSkillFiles(targetRoot = defaultSkillsRoot()): string[] {
  if (!hasBrowserbaseSkills(targetRoot)) return [];
  return Object.keys(validateManaged(targetRoot).files).sort().map(file => path.join(targetRoot, file));
}

export async function syncBrowserbaseSkills(options?: {
  targetRoot?: string; ref?: string; fetchImpl?: typeof fetch;
}): Promise<SkillSyncResult> {
  const targetRoot = resolveSkillsRoot(options?.targetRoot);
  const ref = options?.ref?.trim() || 'main';
  const fetchImpl = options?.fetchImpl ?? fetch;
  rejectSymlinkAncestors(targetRoot);
  await fsp.mkdir(targetRoot, { recursive: true });
  rejectSymlinkAncestors(targetRoot);
  if (exists(path.join(targetRoot, JOURNAL))) throw new Error('Interrupted skill sync: preserve the journal and backups for recovery.');
  const lockPath = path.join(targetRoot, LOCK);
  const lock = await fsp.open(lockPath, 'wx', 0o600).catch(() => {
    throw new Error('A skill sync lock already exists or cannot be acquired.');
  });
  let stage: string | undefined;
  let journalWritten = false;
  let retainRecovery = false;
  const moved: { from: string; to: string }[] = [];
  try {
    if (exists(path.join(targetRoot, JOURNAL))) throw new Error('Interrupted skill sync requires recovery.');
    const previous = exists(path.join(targetRoot, MANIFEST)) ? validateManaged(targetRoot) : undefined;
    stage = await fsp.mkdtemp(path.join(path.dirname(targetRoot), '.browserbase-skills-stage-'));
    const incoming = path.join(stage, 'incoming');
    const backup = path.join(stage, 'backup');
    await fsp.mkdir(incoming);
    await fsp.mkdir(backup);
    const signal = AbortSignal.timeout(30_000);
    const response = await fetchImpl(`${TARBALL_BASE}/${encodeURIComponent(ref)}`, {
      headers: { 'user-agent': 'openclaw-browserbase-plugin' }, redirect: 'follow', signal,
    });
    if (!response.ok || !response.body) throw new Error('Could not download the Browserbase skills archive.');
    const seen = new Set<string>();
    let archiveError: Error | undefined;
    await pipeline(Readable.fromWeb(response.body as import('stream/web').ReadableStream), x({
      cwd: incoming, strip: 2, strict: true,
      filter: (entryPath, entry) => {
        const parts = entryPath.replace(/\/$/, '').split('/');
        if (entryPath.includes('\\') || entryPath.includes('\0') || parts.some(part => !part || part === '.' || part === '..')
          || !('type' in entry) || !['File', 'Directory'].includes(entry.type)) {
          archiveError = new Error('The skills archive contains an unsafe path or link.');
          return false;
        }
        if (parts[1] !== 'skills' || parts.length < 3) return false;
        if (!validSkillName(parts[2]) || seen.has(parts.slice(2).join('/'))) {
          archiveError = new Error('The skills archive contains an invalid or duplicate entry.');
          return false;
        }
        seen.add(parts.slice(2).join('/'));
        return true;
      },
    }), { signal });
    if (archiveError) throw archiveError;
    const skills = (await fsp.readdir(incoming)).sort();
    if (!skills.length) throw new Error('The archive contains no skills.');
    const manifest: Manifest = { version: 1, source: 'browserbase/skills', ref, skills, files: treeHashes(incoming, skills) };
    await fsp.writeFile(path.join(stage, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    rejectSymlinkAncestors(targetRoot);
    if (previous && JSON.stringify(validateManaged(targetRoot)) !== JSON.stringify(previous)) {
      throw new Error('Ownership changed during skill sync.');
    }
    if (!previous && exists(path.join(targetRoot, MANIFEST))) throw new Error('Ownership changed during skill sync.');
    for (const skill of skills) {
      if (exists(path.join(targetRoot, skill)) && !previous?.skills.includes(skill)) {
        throw new Error(`Refusing to replace unowned skill directory: ${skill}`);
      }
    }
    await fsp.writeFile(path.join(targetRoot, JOURNAL), JSON.stringify({ version: 1, stage, previousSkills: previous?.skills ?? [], skills }),
      { flag: 'wx', mode: 0o600 });
    journalWritten = true;
    const move = async (from: string, to: string) => {
      await fsp.rename(from, to);
      moved.push({ from, to });
    };
    for (const skill of previous?.skills ?? []) await move(path.join(targetRoot, skill), path.join(backup, skill));
    for (const skill of skills) await move(path.join(incoming, skill), path.join(targetRoot, skill));
    if (previous) await move(path.join(targetRoot, MANIFEST), path.join(backup, MANIFEST));
    await move(path.join(stage, MANIFEST), path.join(targetRoot, MANIFEST));
    validateManaged(targetRoot);
    const filesWritten = Object.keys(manifest.files).sort().map(file => path.join(targetRoot, file));
    await fsp.unlink(path.join(targetRoot, JOURNAL));
    journalWritten = false;
    return { targetRoot, ref, filesWritten };
  } catch (error) {
    for (const { from, to } of [...moved].reverse()) {
      try { await fsp.rename(to, from); } catch { retainRecovery = true; }
    }
    if (journalWritten && !retainRecovery) {
      try { await fsp.unlink(path.join(targetRoot, JOURNAL)); journalWritten = false; }
      catch { retainRecovery = true; }
    }
    if (retainRecovery) throw new Error('Skill sync rollback failed. Preserve the transaction journal and staged backups for recovery.');
    throw error;
  } finally {
    try {
      if (stage && !retainRecovery) await fsp.rm(stage, { recursive: true, force: true });
    } finally {
      try { await lock.close(); } finally { await fsp.unlink(lockPath); }
    }
  }
}
