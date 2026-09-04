import pLimit from "p-limit";
import { fetchPdp, type FetchInput, type FetchRecord } from "./fetchPdp";
import { aggregate, type StageMetrics } from "./metrics";

export interface StageResult {
  metrics: StageMetrics;
  records: FetchRecord[];
}

/**
 * Run a stage of `inputs` at bounded concurrency. Concurrency is the lever that
 * maps to your Browserbase plan's concurrent-browser cap.
 */
export async function runStage(
  stageN: number,
  inputs: FetchInput[],
  workers: number,
  onRecord?: (rec: FetchRecord, done: number, total: number) => void,
): Promise<StageResult> {
  const limit = pLimit(Math.max(1, workers));
  const t0 = Date.now();
  let done = 0;

  const records = await Promise.all(
    inputs.map((inp) =>
      limit(async () => {
        const rec = await fetchPdp(inp);
        done += 1;
        onRecord?.(rec, done, inputs.length);
        return rec;
      }),
    ),
  );

  const wallClockMs = Date.now() - t0;
  return { metrics: aggregate(records, stageN, wallClockMs), records };
}
