import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSON5 from 'json5';
import { randomUUID } from 'node:crypto';

const DEFAULT_CONFIG_PATH = path.join(
  os.homedir(),
  '.openclaw',
  'openclaw.json'
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensureRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error(`Expected an object for ${label}.`);
  return value;
}

function validatePluginId(pluginId: string): void {
  if (typeof pluginId !== 'string' || !pluginId.trim()
    || ['__proto__', 'constructor', 'prototype'].includes(pluginId)) {
    throw new Error('Invalid plugin ID.');
  }
}

type Snapshot = { raw: Buffer; stat: fs.BigIntStats } | null;

function sameStat(left: fs.BigIntStats, right: fs.BigIntStats): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size
    && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

function snapshot(filePath: string): Snapshot {
  let descriptor: number;
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Config must be a regular file, not a link.');
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  try {
    const before = fs.fstatSync(descriptor, { bigint: true });
    const raw = fs.readFileSync(descriptor);
    const after = fs.fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || !sameStat(before, after)) throw new Error('Config changed while reading. Please retry.');
    return { raw, stat: after };
  } finally {
    fs.closeSync(descriptor);
  }
}

function parseConfig(current: Snapshot): Record<string, unknown> {
  if (!current) return {};
  const parsed: unknown = JSON5.parse(current.raw.toString('utf8'));
  if (!isRecord(parsed)) throw new Error('Expected a config object.');
  return parsed;
}

function own(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

export function resolveConfigPath(explicitPath?: string): string {
  if (explicitPath && explicitPath.trim()) {
    return path.resolve(process.cwd(), explicitPath.trim());
  }

  return DEFAULT_CONFIG_PATH;
}

export function readPluginConfig(
  filePath: string,
  pluginId: string
): Record<string, unknown> {
  validatePluginId(pluginId);
  const root = parseConfig(snapshot(filePath));
  const plugins = ensureRecord(own(root, 'plugins'), 'plugins');
  const entries = ensureRecord(own(plugins, 'entries'), 'plugins.entries');
  const pluginEntry = ensureRecord(own(entries, pluginId), 'plugin entry');
  return ensureRecord(own(pluginEntry, 'config'), 'plugin config');
}

export function writePluginConfig(
  filePath: string,
  pluginId: string,
  pluginConfig: Record<string, unknown>
): void {
  validatePluginId(pluginId);
  if (!isRecord(pluginConfig)) throw new Error('Plugin config must be an object.');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const lockPath = `${filePath}.browserbase.lock`;
  const lock = fs.openSync(lockPath, 'wx', 0o600);
  let temporary: string | undefined;
  try {
    const original = snapshot(filePath);
    const root = parseConfig(original);
    const plugins = ensureRecord(own(root, 'plugins'), 'plugins');
    const entries = ensureRecord(own(plugins, 'entries'), 'plugins.entries');
    const existingEntry = ensureRecord(own(entries, pluginId), 'plugin entry');
    const existingConfig = ensureRecord(own(existingEntry, 'config'), 'plugin config');
    if (own(existingEntry, 'enabled') !== undefined && typeof existingEntry.enabled !== 'boolean') {
      throw new Error('Plugin enabled must be a boolean.');
    }
    entries[pluginId] = {
      ...existingEntry,
      enabled: existingEntry.enabled !== false,
      config: { ...existingConfig, ...pluginConfig },
    };
    plugins.entries = entries;
    root.plugins = plugins;
    const serialized = `${JSON5.stringify(root, null, 2)}\n`;
    temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.tmp`);
    const descriptor = fs.openSync(temporary, 'wx', 0o600);
    try {
      fs.writeFileSync(descriptor, serialized, 'utf8');
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    const current = snapshot(filePath);
    if (original === null ? current !== null : current === null || !sameStat(original.stat, current.stat) || !original.raw.equals(current.raw)) {
      throw new Error('Config changed during the update. Please retry.');
    }
    fs.renameSync(temporary, filePath);
    temporary = undefined;
  } finally {
    try {
      if (temporary) fs.rmSync(temporary, { force: true });
    } finally {
      try { fs.closeSync(lock); } finally { fs.unlinkSync(lockPath); }
    }
  }
}

export function maskSecret(value: string | undefined): string {
  if (!value) {
    return 'not set';
  }

  if (value.length <= 8) {
    return `${'*'.repeat(Math.max(4, value.length))}`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function dotenvEscape(value: string): string {
  // Wrap in double quotes if value contains whitespace, quotes, #, =, or backslashes
  if (
    /[\s"'#=\\]/.test(value) ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`;
  }
  return value;
}
