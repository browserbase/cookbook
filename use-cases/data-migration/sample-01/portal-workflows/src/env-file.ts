import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

/**
 * Upsert a single KEY=value line in a .env file, in place.
 * Replaces an existing line for `key` if present, otherwise appends — so re-running
 * `customer-login` never stacks duplicate CONTEXT_ID lines. Other lines and comments
 * are preserved untouched.
 */
export async function upsertEnv(
  path: string,
  key: string,
  value: string,
): Promise<void> {
  let lines: string[] = [];
  if (existsSync(path)) {
    const content = await readFile(path, "utf8");
    lines = content.split(/\r?\n/);
  }

  const re = new RegExp(`^\\s*${key}\\s*=`);
  let found = false;
  lines = lines.map((line) => {
    if (re.test(line)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    lines.push(`${key}=${value}`);
  }

  await writeFile(path, lines.join("\n") + "\n", "utf8");
}
