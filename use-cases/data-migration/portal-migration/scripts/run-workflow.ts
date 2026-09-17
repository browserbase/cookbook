import { runWorkflow } from "../src/runner.js";

/**
 * Generic workflow entrypoint. The workflow name is baked into each npm script
 * (e.g. `tsx scripts/run-workflow.ts platform-a/customer-list`); flags come after `--`.
 *
 *   npm run platform-a/customer-list -- --volume 10
 *   npm run platform-a/customer-list -- --volume 10 --concurrency 5
 *   npm run platform-a/customer-list -- --volume 10 --label gemini-3-no-cdp
 *
 * Note the `--` separator: `npm run <script> --volume 10` would NOT forward the flag
 * (npm consumes it). Everything after `--` is passed through to this script.
 */
function numFlag(argv: string[], names: string[], def: number): number {
  const i = argv.findIndex((a) => names.includes(a));
  if (i >= 0 && argv[i + 1] !== undefined) return Number(argv[i + 1]);
  return def;
}

function strFlag(argv: string[], names: string[]): string | undefined {
  const i = argv.findIndex((a) => names.includes(a));
  return i >= 0 ? argv[i + 1] : undefined;
}

function usage(): void {
  console.error(
    "Usage: tsx scripts/run-workflow.ts <workflow> [--volume N] [--concurrency N] [--label NAME]",
  );
  console.error(
    "Example: npm run platform-a/customer-list -- --volume 10 --label gemini-3-no-cdp",
  );
}

async function main(): Promise<void> {
  const name = process.argv[2];
  const rest = process.argv.slice(3);

  const volume = numFlag(rest, ["--volume", "-v"], 1);
  const concurrency = numFlag(rest, ["--concurrency", "-c"], NaN);
  const retries = numFlag(rest, ["--retries", "-r"], NaN);
  const label = strFlag(rest, ["--label", "-l"]);

  if (!name || !Number.isInteger(volume) || volume < 1) {
    usage();
    process.exit(1);
  }

  await runWorkflow(name, {
    volume,
    concurrency:
      Number.isInteger(concurrency) && concurrency > 0
        ? concurrency
        : undefined,
    retries: Number.isInteger(retries) && retries >= 0 ? retries : undefined,
    label,
  });
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
