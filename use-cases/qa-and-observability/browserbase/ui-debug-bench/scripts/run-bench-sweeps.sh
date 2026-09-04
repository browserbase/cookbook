#!/bin/bash
# Sequential benchmark sweeps: full strategy + two ablations.
# Browse CLI session state is shared, so local-mode concurrency stays at 1.
set -uo pipefail
cd "$(dirname "$0")/.."
export BROWSE_TARGET=cdp-launch

echo "=== sweep 1/3: exact checks (default) ==="
npm run eval -- --target targets/bench --results results-bench-full

echo "=== sweep 2/3: one-shot ablation ==="
npm run eval -- --target targets/bench --max-attempts 1 --results results-bench-oneshot

echo "=== sweep 3/3: failure-text ablation ==="
npm run eval -- --target targets/bench --feedback failure-text --results results-bench-repairtext

echo "=== all sweeps done ==="
for d in results-bench-full results-bench-oneshot results-bench-repairtext; do
  echo "--- $d ---"
  head -8 "$d/aggregate.md" 2>/dev/null
done
