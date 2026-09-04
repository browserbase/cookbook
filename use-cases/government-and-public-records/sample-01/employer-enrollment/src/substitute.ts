import { readFileSync, writeFileSync } from "node:fs";

/** Replace $VAR / ${VAR} placeholders in template text with values from `vars`.
 *  Asserts zero remaining placeholders before returning — matches the grep-guard
 *  in the related EIN workflow guide. */
export function substituteTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  const out = template.replace(
    /\$\{?([A-Z][A-Z0-9_]*)\}?/g,
    (m, name: string) => {
      const v = vars[name];
      return v !== undefined ? v : m;
    },
  );
  const leftover = [...out.matchAll(/\$\{?([A-Z][A-Z0-9_]+)\}?/g)].map(
    (m) => m[1],
  );
  if (leftover.length > 0) {
    const uniq = [...new Set(leftover)];
    throw new Error(
      `Template has unsubstituted placeholders: ${uniq.map((n) => `$${n}`).join(", ")}`,
    );
  }
  return out;
}

export function substituteFile(
  srcPath: string,
  destPath: string,
  vars: Record<string, string>,
): void {
  const template = readFileSync(srcPath, "utf-8");
  const out = substituteTemplate(template, vars);
  writeFileSync(destPath, out);
}
