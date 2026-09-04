import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

function canonical(value, ancestors = new Set()) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (!value || typeof value !== 'object' || ancestors.has(value)) throw new Error('Journal values must be finite, acyclic JSON values.');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) throw new Error('Journal values must be plain JSON objects.');
  if (Object.getOwnPropertySymbols(value).length) throw new Error('Journal values cannot contain symbol keys.');
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.keys(value).length !== value.length || Object.getOwnPropertyNames(value).length !== value.length + 1) throw new Error('Journal arrays must be dense and have no extra properties.');
      return '[' + Array.from({ length: value.length }, (_, index) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !('value' in descriptor)) throw new Error('Journal values cannot contain accessors.');
        return canonical(descriptor.value, ancestors);
      }).join(',') + ']';
    }
    return '{' + Object.getOwnPropertyNames(value).sort().map(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor.enumerable || !('value' in descriptor)) throw new Error('Journal values cannot contain accessors or hidden properties.');
      return JSON.stringify(key) + ':' + canonical(descriptor.value, ancestors);
    }).join(',') + '}';
  } finally {
    ancestors.delete(value);
  }
}

export function fingerprint(value) {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function copy(value) {
  return JSON.parse(canonical(value));
}

function assertDirectory(directory, create = false) {
  const parent = path.dirname(directory);
  if (parent !== directory) assertDirectory(parent, create);
  let stat;
  try { stat = fs.lstatSync(directory); }
  catch (error) {
    if (error.code !== 'ENOENT' || !create) throw error;
    try { fs.mkdirSync(directory, { mode: 0o700 }); }
    catch (mkdirError) { if (mkdirError.code !== 'EEXIST') throw mkdirError; }
    stat = fs.lstatSync(directory);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Journal directory must not contain symlinks.');
}

function read(filePath, identityHash) {
  let descriptor;
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Journal must be a regular file.');
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  } catch (error) {
    if (error.code === 'ENOENT') return Object.create(null);
    throw error;
  }
  try {
    if (!fs.fstatSync(descriptor).isFile()) throw new Error('Journal must be a regular file.');
    const data = JSON.parse(fs.readFileSync(descriptor, 'utf8'));
    if (!data || data.version !== 2 || data.identityHash !== identityHash || !data.entries
      || typeof data.entries !== 'object' || Array.isArray(data.entries)
      || Object.keys(data).sort().join(',') !== 'entries,identityHash,version') {
      throw new Error('Journal version or identity is invalid.');
    }
    return copy(data.entries);
  } catch {
    throw new Error('Journal is malformed or belongs to another identity.');
  } finally {
    fs.closeSync(descriptor);
  }
}

export function createJournal({ directory, identity, fresh = false }) {
  if (typeof directory !== 'string' || !directory.trim() || typeof fresh !== 'boolean') throw new Error('Invalid journal configuration.');
  const identityHash = fingerprint(identity);
  const root = path.resolve(directory);
  assertDirectory(root, true);
  const filePath = path.join(root, `.journal-v2-${identityHash}.json`);
  // Even a fresh run validates existing file safety and structure before replacing it.
  const previous = read(filePath, identityHash);
  let entries = fresh ? Object.create(null) : previous;
  let resetOnWrite = fresh;
  const validateKey = key => {
    if (typeof key !== 'string' || !key) throw new Error('Journal keys must be nonempty strings.');
  };
  return {
    filePath,
    get(key) {
      validateKey(key);
      return Object.hasOwn(entries, key) ? copy(entries[key]) : undefined;
    },
    has(key) {
      validateKey(key);
      return Object.hasOwn(entries, key);
    },
    set(key, value) {
      validateKey(key);
      const snapshot = copy(value);
      assertDirectory(root);
      const lockPath = `${filePath}.lock`;
      const lock = fs.openSync(lockPath, 'wx', 0o600);
      let temporary;
      try {
        const latest = read(filePath, identityHash);
        const merged = Object.assign(Object.create(null), resetOnWrite ? {} : latest);
        Object.defineProperty(merged, key, { value: snapshot, enumerable: true, writable: true, configurable: true });
        const serialized = canonical({ version: 2, identityHash, entries: merged }) + '\n';
        temporary = path.join(root, `.journal-${randomUUID()}.tmp`);
        const descriptor = fs.openSync(temporary, 'wx', 0o600);
        try {
          fs.writeFileSync(descriptor, serialized, 'utf8');
          fs.fsyncSync(descriptor);
        } finally {
          fs.closeSync(descriptor);
        }
        assertDirectory(root);
        // Recheck file safety immediately before atomic replacement.
        read(filePath, identityHash);
        fs.renameSync(temporary, filePath);
        temporary = undefined;
        entries = merged;
        resetOnWrite = false;
      } finally {
        try { if (temporary) fs.rmSync(temporary, { force: true }); }
        finally { try { fs.closeSync(lock); } finally { fs.unlinkSync(lockPath); } }
      }
    },
  };
}
