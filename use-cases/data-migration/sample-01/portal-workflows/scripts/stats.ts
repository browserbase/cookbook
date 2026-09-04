import { runStats } from "../src/stats.js";

/**
 * Aggregate run history for a workflow and report pass rate, step/duration percentiles, and a
 * recommended maxSteps. Read-only — never touches sessions or workflow.json.
 *
 *   npm run stats square/customer-list
 *   npm run stats square/customer-list -- --label haiku-4.5-no-cdp
 */
function strFlag(argv: string[], names: string[]): string | undefined {
  const i = argv.findIndex((a) => names.includes(a));
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const name = process.argv[2];
  const rest = process.argv.slice(3);
  const label = strFlag(rest, ["--label", "-l"]);

  if (!name) {
    console.error("Usage: tsx scripts/stats.ts <workflow> [--label NAME]");
    console.error(
      "Example: npm run stats square/customer-list -- --label haiku-4.5-no-cdp",
    );
    process.exit(1);
  }

  await runStats(name, label);
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
