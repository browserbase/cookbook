import { loadSuite } from "../src/targets.js";
import { loadCheck, runCheck } from "../src/check.js";
import { loadDotEnv } from "../src/runtime/env.js";

loadDotEnv();
const targets = await loadSuite("targets/bench");
const cells = targets.flatMap((t) => t.bugs.map((b) => ({ t, b })));
let confirmed = 0, errored = 0, unexpected = 0;
let index = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (index < cells.length) {
    const { t, b } = cells[index++]!;
    const check = await loadCheck(b.checkPath);
    const report = await runCheck({ check, url: b.hostedUrl! });
    const status = report.error ? "ERROR" : report.ok ? "UNEXPECTED-PASS" : "bug-confirmed";
    if (report.error) errored++; else if (report.ok) unexpected++; else confirmed++;
    console.log(`${t.name}/${b.id}: ${status}${report.error ? ` (${report.error.slice(0, 100)})` : ""}`);
    if (status !== "bug-confirmed" && report.result) console.log(`   result: ${JSON.stringify(report.result).slice(0, 300)}`);
  }
}));
console.log(`\nconfirmed=${confirmed}/18 errored=${errored} unexpected-pass=${unexpected}`);
