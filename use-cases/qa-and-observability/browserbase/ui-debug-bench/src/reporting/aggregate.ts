import type { RunRecord } from "../types.js";

export function renderAggregateMarkdown(records: RunRecord[]): string {
  const lines: string[] = ["# UI Debug Bench Results", ""];
  const local = records.filter((r) => r.mode === "local");
  if (local.length > 0) {
    lines.push(`Runs: ${local.length}`);
    lines.push(`Final success: ${local.filter((r) => r.success).length}/${local.length}`);
    lines.push(`First-pass success: ${local.filter((r) => r.first_pass_success).length}/${local.length}`);
    const repaired = local.filter((r) => !r.first_pass_success && r.success).length;
    const attempted = local.filter((r) => !r.first_pass_success && r.attempts_used > 1).length;
    lines.push(`Repair recovered: ${repaired}/${attempted || 0}`);
    lines.push("");
  }
  lines.push("| Target | Bug | Category | Mode | Interface | Bug Confirmed | First Pass | Attempts | Success | Files | Tokens D/F | Wall ms |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | ---: |");
  for (const r of records) {
    lines.push([
      "",
      r.target,
      r.bugId,
      r.category,
      r.mode,
      r.interface,
      r.pre_fix_bug_confirmed ? "yes" : "NO",
      r.first_pass_success ? "yes" : "no",
      String(r.attempts_used),
      r.mode === "hosted" ? "n/a" : r.success ? "pass" : "fail",
      r.files_modified.join(", ") || "-",
      `${r.tokens.debugger}/${r.tokens.fixer}`,
      String(r.wall_clock_ms),
      ""
    ].join(" | ").trim());
  }
  const errored = records.filter((r) => r.error);
  if (errored.length > 0) {
    lines.push("", "## Errors", "");
    for (const r of errored) {
      lines.push(`- ${r.target}/${r.bugId}: ${r.error?.message}`);
    }
  }
  lines.push("", "## Methodology", "");
  lines.push("- One loop: debug -> fix -> check, repeating with the check's exact result as feedback until it passes or attempts run out.");
  lines.push("- The check is both oracle and probe: it gates success AND tells the fixer exactly what failed.");
  lines.push("- The debugger never sees source code or the check; the fixer sees the check's result only after a failed attempt.");
  lines.push("- `files_modified` comes from hashing the workspace before/after, not from trusting the fixer.");
  lines.push("- `Bug Confirmed` means the check failed pre-fix, proving the planted bug reproduces.");
  return `${lines.join("\n")}\n`;
}
