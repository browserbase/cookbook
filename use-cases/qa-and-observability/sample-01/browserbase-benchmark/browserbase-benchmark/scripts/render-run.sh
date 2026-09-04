#!/usr/bin/env bash
# render-run.sh — triggers a benchmark run on a pre-deployed Render service,
# polls for results, and generates a local report.
# Called by run.sh --render; not intended to be run directly.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SERVICE_URL="${RENDER_SERVICE_URL%/}"   # strip trailing slash if present

if [[ ! "${BENCHMARK_ACCESS_TOKEN:-}" =~ ^[[:xdigit:]]{64}$ ]]; then
  echo "ERROR: Set BENCHMARK_ACCESS_TOKEN to the server's 64-character hexadecimal access token."
  exit 1
fi
AUTH_CONFIG=$(mktemp)
RESPONSE_FILE=$(mktemp)
trap 'rm -f "$AUTH_CONFIG" "$RESPONSE_FILE"' EXIT
chmod 600 "$AUTH_CONFIG" "$RESPONSE_FILE"
python3 - "$AUTH_CONFIG" "$SERVICE_URL" <<'PYAUTH'
import os, sys
from urllib.parse import urlsplit
url = urlsplit(sys.argv[2])
assert url.hostname and not url.username and not url.password and not url.query and not url.fragment
assert url.scheme == 'https' or (url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1', '::1'))
with open(sys.argv[1], 'w') as handle:
    handle.write('header = "Authorization: Bearer ' + os.environ['BENCHMARK_ACCESS_TOKEN'] + '"\n')
PYAUTH

# Parse --sites / --runs / --browser-only from args
SITES_ARG="${BENCHMARK_SITES:-}"
RUNS_ARG="${BENCHMARK_RUNS:-5}"
BROWSER_ONLY="false"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --sites)        SITES_ARG="$2"; shift 2 ;;
    --runs)         RUNS_ARG="$2";  shift 2 ;;
    --browser-only) BROWSER_ONLY="true"; shift ;;
    *) shift ;;
  esac
done

if [[ -z "$SITES_ARG" ]]; then
  echo "ERROR: No sites configured. Set BENCHMARK_SITES in .env or pass --sites <urls>"
  exit 1
fi

echo "==> Render service : $SERVICE_URL"
echo "    Sites          : $SITES_ARG"
echo "    Runs           : $RUNS_ARG per site per runner"
if [[ "$BROWSER_ONLY" == "true" ]]; then
  echo "    Mode           : browser-only (init + goto + screenshot, no LLM)"
fi

# ---------------------------------------------------------------------------
# 1. Confirm the service is reachable
# ---------------------------------------------------------------------------
echo "==> Checking service health..."
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/health" 2>/dev/null || echo "000")
if [[ "$HTTP" != "200" ]]; then
  echo "ERROR: Service returned HTTP $HTTP on GET /health."
  echo "       Make sure the Render service is deployed and running: $SERVICE_URL"
  exit 1
fi
echo "    Service is healthy."

# ---------------------------------------------------------------------------
# 2. Trigger benchmark
# ---------------------------------------------------------------------------
echo "==> Starting benchmark..."
REQUEST_BODY=$(python3 -c 'import json,sys; print(json.dumps({"sites":sys.argv[1],"runs":int(sys.argv[2]),"browserOnly":sys.argv[3]=="true"}))' "$SITES_ARG" "$RUNS_ARG" "$BROWSER_ONLY")
HTTP=$(curl --config "$AUTH_CONFIG" -s -o "$RESPONSE_FILE" -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" -d "$REQUEST_BODY" "$SERVICE_URL/run")
if [[ "$HTTP" != "202" ]]; then
  echo "ERROR: Start rejected (HTTP $HTTP). No results will be downloaded."
  exit 1
fi
RUN_ID=$(python3 -c 'import json,re,sys; value=json.load(open(sys.argv[1])).get("runId"); assert isinstance(value,str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*",value), "Missing or invalid runId; update the service"; print(value)' "$RESPONSE_FILE")
echo "    Accepted run: $RUN_ID"

# ---------------------------------------------------------------------------
# 3. Poll /results until complete (up to 30 min)
# ---------------------------------------------------------------------------
echo "==> Waiting for benchmark to complete (this takes ~10-20 min)..."
for i in $(seq 1 120); do
  sleep 15
  HTTP=$(curl --config "$AUTH_CONFIG" -s -o "$RESPONSE_FILE" -w "%{http_code}" \
    "$SERVICE_URL/results?runId=$RUN_ID" 2>/dev/null || echo "000")

  if [[ "$HTTP" == "200" ]]; then
    echo "    Results ready."
    break
  elif [[ "$HTTP" == "500" ]]; then
    ERROR=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("error","unknown"))' "$RESPONSE_FILE" 2>/dev/null || echo "unknown")
    echo "ERROR: Benchmark failed on Render: $ERROR"
    exit 1
  elif [[ "$HTTP" == "000" ]]; then
    echo "ERROR: Service unreachable (HTTP 000). The container may have OOM-crashed."
    echo "       Check Render dashboard logs: $SERVICE_URL"
    exit 1
  fi

  if [[ "$HTTP" != "202" ]]; then
    echo "ERROR: Cannot retrieve run $RUN_ID (HTTP $HTTP)."
    exit 1
  fi
  echo "    [$i] HTTP=$HTTP — still running..."

  if [[ $i -eq 120 ]]; then
    echo "ERROR: Benchmark did not complete within 30 minutes."
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# 4. Save results and generate report
# ---------------------------------------------------------------------------
mkdir -p "$PROJECT_DIR/results"
RESULTS_FILE="$PROJECT_DIR/results/${RUN_ID}.json"
cp "$RESPONSE_FILE" "$RESULTS_FILE"
echo "    Results saved to: $RESULTS_FILE"

echo "==> Generating report..."
cd "$PROJECT_DIR"
node --env-file=.env dist/report.js --file "$RESULTS_FILE"
open report.html 2>/dev/null || xdg-open report.html 2>/dev/null || echo "Open report.html manually"

echo ""
echo "Done! Report: $PROJECT_DIR/report.html"
