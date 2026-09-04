import { loadTarget } from "../src/targets.js";
import { loadCheck, runCheck } from "../src/check.js";
import { loadDotEnv } from "../src/runtime/env.js";

loadDotEnv();
const target = await loadTarget("targets/bench/interaction-state-lab");
const bug = target.bugs.find((b) => b.id === "functional-counter")!;
const check = await loadCheck(bug.checkPath);
console.log(`Running check for ${bug.id} against ${bug.hostedUrl}`);
const report = await runCheck({ check, url: bug.hostedUrl! });
console.log(JSON.stringify(report, null, 2));
console.log(report.ok === false && report.result ? "\n=> PLANTED BUG CONFIRMED (check fails as expected)" : report.error ? "\n=> CHECK ERRORED" : "\n=> UNEXPECTED: check passed on the buggy app");
