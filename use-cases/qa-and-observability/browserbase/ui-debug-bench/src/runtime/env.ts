import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadDotEnv(path = resolve(process.cwd(), ".env")): void {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    const key = match[1];
    if (!key) continue;
    const rawValue = match[2] ?? "";
    if (process.env[key] !== undefined) continue;
    process.env[key] = parseValue(rawValue);
  }
}

function parseValue(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  const comment = trimmed.search(/\s#/);
  return comment === -1 ? trimmed : trimmed.slice(0, comment).trim();
}
