import { loadSuite } from "../src/targets.js";
import { loadCheck } from "../src/check.js";

for (const dir of ["targets/starter", "targets/bench"]) {
  const targets = await loadSuite(dir);
  console.log(`${dir}: ${targets.length} targets, ${targets.reduce((n, t) => n + t.bugs.length, 0)} bugs`);
  for (const t of targets) {
    for (const b of t.bugs) {
      const check = await loadCheck(b.checkPath);
      const issues: string[] = [];
      if (!check.expression.includes("passed")) issues.push("no passed field");
      if (!check.expression.includes("passCondition")) issues.push("no passCondition");
      if (check.expression.includes("${")) issues.push("has ${ interpolation");
      console.log(`  ${t.name}/${b.id} [${b.category}] route=${b.route || "/"} hosted=${b.hostedUrl ? "y" : "-"} hints=${b.repairHints ? "y" : "-"} viewport=${check.viewport ? "375x700" : "-"}${issues.length ? "  ISSUES: " + issues.join(", ") : ""}`);
    }
  }
}
