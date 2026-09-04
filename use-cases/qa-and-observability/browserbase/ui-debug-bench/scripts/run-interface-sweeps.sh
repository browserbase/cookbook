#!/bin/bash
# Interface comparison sweeps at the default (winning) strategy.
# browse is covered by results-bench-full from run-bench-sweeps.sh.
set -uo pipefail
cd "$(dirname "$0")/.."

echo "=== interface sweep 1/2: stagehand-act ==="
npm run eval -- --target targets/bench --interface stagehand-act --results results-bench-stagehand-act

echo "=== interface sweep 2/2: stagehand-cdp ==="
npm run eval -- --target targets/bench --interface stagehand-cdp --results results-bench-stagehand-cdp

echo "=== interface sweeps done ==="
for d in results-bench-stagehand-act results-bench-stagehand-cdp; do
  echo "--- $d ---"
  head -8 "$d/aggregate.md" 2>/dev/null
done
