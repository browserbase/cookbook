import type { ValidationReport } from "../types.js";
import { runCommand } from "./process.js";

/** Install workspace dependencies using the target's configured install command. */
export async function installDependencies(workspace: string, command: string): Promise<ValidationReport> {
  const [bin, ...args] = command.split(/\s+/);
  if (!bin) throw new Error(`Empty install command for workspace ${workspace}`);
  const result = await runCommand(bin, args, {
    cwd: workspace,
    timeoutMs: Number(process.env.INSTALL_TIMEOUT_MS ?? 180000)
  });
  return {
    ok: result.code === 0,
    command: result.command,
    stdout: result.stdout,
    stderr: result.stderr,
    wallClockMs: result.wallClockMs
  };
}
