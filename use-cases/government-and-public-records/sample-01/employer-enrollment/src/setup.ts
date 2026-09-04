import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";

export function preflightInputs(root: string, task: string, env: NodeJS.ProcessEnv): Record<string, string> {
  const profileNames = ["TEST_FIRST_NAME", "TEST_LAST_NAME", "TEST_BUSINESS_NAME", "TEST_EIN", "TEST_PHONE", "TEST_ADDRESS_LINE1", "TEST_CITY", "TEST_STATE", "TEST_ZIP"];
  const required = ["BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID", "AGENTMAIL_API_KEY", "ANTHROPIC_API_KEY", ...profileNames];
  const missing = required.filter(name => !env[name]?.trim());
  if (missing.length) throw new Error(`Missing required configuration: ${missing.join(", ")}`);
  for (const name of ["task-phase1.md.template", "task-phase2.md.template", "task-phase3.md.template", "strategy.md"]) {
    const file = path.join(root, "autobrowse", "tasks", task, name);
    try {
      if (!statSync(file).isFile()) throw new Error("Not a file");
      accessSync(file, constants.R_OK);
    } catch {
      throw new Error(`Required task file is unavailable: ${name}`);
    }
  }
  return Object.fromEntries(profileNames.map(name => [name, env[name]!]));
}
