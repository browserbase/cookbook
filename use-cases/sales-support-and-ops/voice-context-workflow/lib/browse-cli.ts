import { access, readFile, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

export const SUPPORTED_BROWSE_VERSION = "0.9.6";
const requiredCommands = ["open", "click", "type", "press", "back", "get", "wait", "snapshot", "tab:list", "tab:switch"];

export async function resolveBrowseBinary(command = process.env.BROWSE_BIN || "browse"): Promise<string> {
  const candidates = command.includes(path.sep) ? [path.resolve(command)] :
    (process.env.PATH || "").split(path.delimiter).filter(Boolean).map(directory => path.join(directory, command));
  let executable: string | undefined;
  for (const candidate of candidates) {
    try { await access(candidate, constants.X_OK); executable = await realpath(candidate); break; } catch { /* Try the next PATH entry. */ }
  }
  if (!executable) throw new Error(`Install browse@${SUPPORTED_BROWSE_VERSION} and set BROWSE_BIN to its executable.`);
  let directory = path.dirname(executable);
  while (true) {
    let pkg;
    try { pkg = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8")); } catch { /* Walk to package root. */ }
    if (pkg) {
      if (pkg.name !== "browse" || pkg.version !== SUPPORTED_BROWSE_VERSION ||
          typeof pkg.bin?.browse !== "string" || await realpath(path.resolve(directory, pkg.bin.browse)) !== executable) {
        throw new Error(`Unsupported Browse package. This adapter requires browse@${SUPPORTED_BROWSE_VERSION}.`);
      }
      const manifest = JSON.parse(await readFile(path.join(directory, "oclif.manifest.json"), "utf8"));
      for (const command of requiredCommands) {
        const flags = manifest.commands?.[command]?.flags;
        if (!flags?.session || !flags?.cdp) throw new Error(`Browse capability missing: ${command} with --session and --cdp.`);
      }
      if (!manifest.commands.snapshot.flags.full || !manifest.commands.stop?.flags?.force || !manifest.commands.stop?.flags?.session) {
        throw new Error("Browse capability missing: snapshot --full or named-session stop --force.");
      }
      return executable;
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error(`Cannot identify Browse package; install browse@${SUPPORTED_BROWSE_VERSION}.`);
}

export function browseArguments(command: string, args: string[], session: string, endpoint?: string | null): string[] {
  const result = [...command.split(":"), ...args, "--session", session];
  if (command !== "stop") {
    if (!endpoint) throw new Error("Browser CDP endpoint is not ready.");
    const url = new URL(endpoint);
    if (url.protocol !== "wss:") throw new Error("Expected a secure Browserbase CDP endpoint.");
    result.push("--cdp", endpoint);
  }
  return result;
}
