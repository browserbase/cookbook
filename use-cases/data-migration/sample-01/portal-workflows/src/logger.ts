/**
 * Per-session prefixed logging so the interleaved output of N concurrent runs
 * stays readable, e.g. `[3/10] live view: ...`.
 */
export function tagged(tag: string) {
  return (...args: unknown[]) => console.log(`[${tag}]`, ...args);
}

/** Print a boxed block of instructions to stdout. */
export function box(lines: string[]): void {
  const width = Math.max(...lines.map((l) => l.length));
  const bar = "─".repeat(width + 2);
  console.log(`┌${bar}┐`);
  for (const line of lines) console.log(`│ ${line.padEnd(width)} │`);
  console.log(`└${bar}┘`);
}
