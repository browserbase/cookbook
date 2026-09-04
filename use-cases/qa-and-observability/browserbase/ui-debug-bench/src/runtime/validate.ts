import type { ValidationReport } from "../types.js";
import { runCommand } from "./process.js";

/** Run the target's validation commands (build/typecheck) in sequence; stop at the first failure. */
export async function validateWorkspace(workspace: string, commands: string[]): Promise<ValidationReport> {
  const combined: ValidationReport = { ok: true, command: "", stdout: "", stderr: "", wallClockMs: 0 };
  for (const command of commands) {
    const [bin, ...args] = command.split(/\s+/);
    if (!bin) continue;
    const result = await runCommand(bin, args, {
      cwd: workspace,
      timeoutMs: Number(process.env.VALIDATE_TIMEOUT_MS ?? 120000)
    });
    combined.command = [combined.command, result.command].filter(Boolean).join("\n");
    combined.stdout = [combined.stdout, result.stdout].filter(Boolean).join("\n");
    combined.stderr = [combined.stderr, result.stderr].filter(Boolean).join("\n");
    combined.wallClockMs += result.wallClockMs;
    if (result.code !== 0) {
      combined.ok = false;
      return combined;
    }
  }
  return combined;
}
