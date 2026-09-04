#!/usr/bin/env bash
# run.sh — one-command benchmark orchestrator
# Usage: ./scripts/run.sh [--local-only] [--render] [--no-destroy] [--sites URL,...] [--runs N]
# npm run run:ec2    — EC2 (self-hosted Chromium) vs Browserbase
# npm run run:render — Render (self-hosted Chromium) vs Browserbase
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------------------------------------------------------------------------
# Parse flags
# ---------------------------------------------------------------------------
LOCAL_ONLY=false
NO_DESTROY=false
RENDER_MODE=false
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local-only)  LOCAL_ONLY=true; shift ;;
    --no-destroy)  NO_DESTROY=true; shift ;;
    --render)       RENDER_MODE=true; shift ;;
    --sites|--runs) EXTRA_ARGS+=("$1" "$2"); shift 2 ;;
    --browser-only) EXTRA_ARGS+=("$1"); shift ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Load .env if present
# ---------------------------------------------------------------------------
if [[ -f "$PROJECT_DIR/.env" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip blank lines and full-line comments
    [[ -z "$line" || "$line" =~ ^\s*# ]] && continue
    # Strip inline comments, then export
    line="${line%%#*}"
    line="${line%"${line##*[![:space:]]}"}"  # rtrim
    [[ -z "$line" ]] && continue
    export "$line"
  done < "$PROJECT_DIR/.env"
fi

# ---------------------------------------------------------------------------
# Validate required env vars
# ---------------------------------------------------------------------------
check_var() {
  if [[ -z "${!1:-}" ]]; then
    echo "ERROR: $1 is not set. Fill it in your .env file."
    exit 1
  fi
}

check_var GOOGLE_API_KEY

if [[ "$RENDER_MODE" == "true" ]]; then
  check_var BROWSERBASE_API_KEY
  check_var BROWSERBASE_PROJECT_ID
  check_var RENDER_SERVICE_URL
elif [[ "$LOCAL_ONLY" == "false" ]]; then
  check_var BROWSERBASE_API_KEY
  check_var BROWSERBASE_PROJECT_ID
  check_var AWS_ACCESS_KEY_ID
  check_var AWS_SECRET_ACCESS_KEY
fi

# ---------------------------------------------------------------------------
# Build TypeScript
# ---------------------------------------------------------------------------
echo "==> Building TypeScript..."
cd "$PROJECT_DIR"
npm run build

# ---------------------------------------------------------------------------
# Local-only mode — skip Terraform and Render
# ---------------------------------------------------------------------------
if [[ "$LOCAL_ONLY" == "true" ]]; then
  echo "==> Running benchmark locally (--local-only)..."
  node --env-file=.env dist/runner.js --local-only ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}
  echo "==> Generating report..."
  node --env-file=.env dist/report.js
  open report.html 2>/dev/null || xdg-open report.html 2>/dev/null || echo "Open report.html manually"
  exit 0
fi

# ---------------------------------------------------------------------------
# Render mode — provision web service, run, retrieve results, destroy
# ---------------------------------------------------------------------------
if [[ "$RENDER_MODE" == "true" ]]; then
  bash "$SCRIPT_DIR/render-run.sh" ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}
  exit 0
fi

# ---------------------------------------------------------------------------
# Full AWS run
# ---------------------------------------------------------------------------
REGION="${AWS_REGION:-us-west-2}"
mkdir -p "$PROJECT_DIR/.benchmark-runs"
INFRA_DIR=$(mktemp -d "$PROJECT_DIR/.benchmark-runs/run.XXXXXX")
cp "$PROJECT_DIR/infra/"*.tf "$PROJECT_DIR/infra/user_data.sh" "$INFRA_DIR/"
export TF_DATA_DIR="$INFRA_DIR/.terraform"
export TF_WORKSPACE=default
APPLY_STARTED=false

cleanup_infra() {
  local run_status=$?
  trap - EXIT
  if [[ "$APPLY_STARTED" == "true" && "$NO_DESTROY" == "false" ]]; then
    echo "==> Destroying EC2 sandbox..."
    if ! (cd "$INFRA_DIR" && terraform destroy -auto-approve -var "region=$REGION" 2>&1 | tail -10); then
      echo "ERROR: Cleanup failed. Recover using Terraform in: $INFRA_DIR" >&2
      if [[ "$run_status" == "0" ]]; then run_status=1; fi
    fi
  fi
  echo "Terraform state retained in: $INFRA_DIR (region: $REGION)"
  exit "$run_status"
}
trap cleanup_infra EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "==> Provisioning EC2 sandbox (region: $REGION)..."
echo "    Isolated Terraform directory: $INFRA_DIR"
cd "$INFRA_DIR"
terraform init -input=false -upgrade -backend=false 2>&1 | tail -5
APPLY_STARTED=true
terraform apply -auto-approve \
  -var "region=$REGION" 2>&1 | tail -20

INSTANCE_ID="$(terraform output -raw instance_id)"
echo "    Instance: $INSTANCE_ID"

# ---------------------------------------------------------------------------
# Wait for SSM agent to become available (~60-90 sec after launch)
# ---------------------------------------------------------------------------
echo "==> Waiting for SSM agent on $INSTANCE_ID..."
for i in $(seq 1 30); do
  STATUS=$(aws ssm describe-instance-information \
    --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
    --region "$REGION" \
    --query "InstanceInformationList[0].PingStatus" \
    --output text 2>/dev/null || echo "None")
  if [[ "$STATUS" == "Online" ]]; then
    echo "    SSM agent is online."
    break
  fi
  echo "    Attempt $i/30: SSM status=$STATUS — waiting 15s..."
  sleep 15
  if [[ $i -eq 30 ]]; then
    echo "ERROR: SSM agent never came online. Check the EC2 instance."
    exit 1
  fi
done

# Also wait for user_data to finish (Chromium install takes ~2 min)
echo "==> Waiting for user_data bootstrap to complete (up to 5 min)..."
sleep 120

# ---------------------------------------------------------------------------
# Package benchmark + clean .env as base64 (no S3 needed)
# ---------------------------------------------------------------------------
echo "==> Packaging benchmark (~$(du -sh "$PROJECT_DIR/dist" 2>/dev/null | cut -f1) dist)..."
cd "$PROJECT_DIR"

# Write a comment-free .env for EC2 (source-safe: no inline comments)
CLEAN_ENV=/tmp/bb-clean.env
: > "$CLEAN_ENV"
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" =~ ^\s*# ]] && continue
  line="${line%%#*}"
  line="${line%"${line##*[![:space:]]}"}"
  [[ -z "$line" ]] && continue
  echo "$line" >> "$CLEAN_ENV"
done < "$PROJECT_DIR/.env"

# Bundle dist/ + package.json + clean .env into one archive
# gtar (GNU tar) avoids macOS xattr metadata; fall back to bsdtar with 2>/dev/null
PKG_B64=$(
  if command -v gtar &>/dev/null; then
    gtar czf - -C "$PROJECT_DIR" dist package.json -C /tmp bb-clean.env
  else
    tar czf - -C "$PROJECT_DIR" dist package.json -C /tmp bb-clean.env 2>/dev/null
  fi | base64 | tr -d '\n'   # tr -d '\n' strips line-wrap chars (works on macOS + Linux)
)

# ---------------------------------------------------------------------------
# Build the remote run script and send it via SSM
# ---------------------------------------------------------------------------
echo "==> Running benchmark on EC2 via SSM..."
EXTRA_ARGS_STR=""
for arg in ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}; do
  printf -v QUOTED_ARG '%q' "$arg"
  EXTRA_ARGS_STR+="$QUOTED_ARG "
done

# Write the script to a temp file — avoids all quoting/newline issues with
# embedding multiline content directly inside a JSON parameter value.
REMOTE_SCRIPT=$(cat <<'SCRIPT'
#!/usr/bin/env bash
set -eo pipefail

cd /opt/bb-benchmark

# Unpack (stderr suppressed — macOS xattr warnings are harmless)
echo "PKG_B64_PLACEHOLDER" | base64 -d | tar xzf - 2>/dev/null
mv bb-clean.env .env 2>/dev/null || true

echo "==> npm install..."
npm install --omit=dev --quiet > /dev/null 2>&1 && echo "npm install OK"

echo "==> Installing Chromium (project playwright-core version)..."
./node_modules/.bin/playwright install chromium > /dev/null 2>&1 && echo "Chromium installed OK" || { echo "Chromium install FAILED"; exit 1; }

# Find the installed Chromium binary (non-headless-shell) in the playwright cache
CHROMIUM_PATH=$(find /root/.cache/ms-playwright/chromium-* -name "chrome" 2>/dev/null \
  | grep -v headless_shell | head -1)
echo "==> Chromium path: $CHROMIUM_PATH"
if [[ ! -f "$CHROMIUM_PATH" ]]; then
  echo "ERROR: Chromium not found at $CHROMIUM_PATH"
  echo "ms-playwright contents:"
  ls ~/.cache/ms-playwright/ 2>/dev/null || echo "(empty)"
  exit 1
fi
# Append/overwrite LOCAL_CHROMIUM_EXECUTABLE in .env so node picks it up via --env-file
grep -v '^LOCAL_CHROMIUM_EXECUTABLE' .env > .env.tmp && mv .env.tmp .env
echo "LOCAL_CHROMIUM_EXECUTABLE=$CHROMIUM_PATH" >> .env

echo "==> Running benchmark..."
set -a; source .env; set +a
node dist/runner.js EXTRA_ARGS_PLACEHOLDER

echo '---RESULTS_START---'
base64 results/*.json | tr -d '\n'
echo
echo '---RESULTS_END---'
SCRIPT
)

# Substitute placeholders
REMOTE_SCRIPT="${REMOTE_SCRIPT/PKG_B64_PLACEHOLDER/$PKG_B64}"
REMOTE_SCRIPT="${REMOTE_SCRIPT/EXTRA_ARGS_PLACEHOLDER/$EXTRA_ARGS_STR}"

# SSM requires the script as a JSON array of lines
SCRIPT_LINES=$(echo "$REMOTE_SCRIPT" | python3 -c "
import sys, json
lines = sys.stdin.read().splitlines()
print(json.dumps(lines))
")

COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --region "$REGION" \
  --timeout-seconds 1800 \
  --parameters "commands=$SCRIPT_LINES" \
  --output text \
  --query "Command.CommandId")

echo "    SSM command ID: $COMMAND_ID"

# Poll until complete
echo "==> Waiting for benchmark to complete (this takes several minutes)..."
for i in $(seq 1 120); do
  sleep 15
  STATUS=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$REGION" \
    --query "Status" \
    --output text 2>/dev/null || echo "Pending")

  if [[ "$STATUS" == "InProgress" || "$STATUS" == "Pending" || "$STATUS" == "Delayed" ]]; then
    echo "    [$i] Still running..."
    continue
  fi

  echo "    SSM status: $STATUS"

  if [[ "$STATUS" != "Success" ]]; then
    echo "--- STDOUT ---"
    aws ssm get-command-invocation \
      --command-id "$COMMAND_ID" \
      --instance-id "$INSTANCE_ID" \
      --region "$REGION" \
      --query "StandardOutputContent" \
      --output text
    echo "--- STDERR ---"
    aws ssm get-command-invocation \
      --command-id "$COMMAND_ID" \
      --instance-id "$INSTANCE_ID" \
      --region "$REGION" \
      --query "StandardErrorContent" \
      --output text
    exit 1
  fi
  break
done

# ---------------------------------------------------------------------------
# Extract results from SSM stdout
# ---------------------------------------------------------------------------
echo "==> Retrieving results..."
FULL_OUTPUT=$(aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  --query "StandardOutputContent" \
  --output text)

RESULTS_B64=$(echo "$FULL_OUTPUT" \
  | sed -n '/---RESULTS_START---/,/---RESULTS_END---/p' \
  | grep -v '^---RESULTS' \
  | tr -d '\n')

mkdir -p "$PROJECT_DIR/results"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M")
RESULTS_FILE="$PROJECT_DIR/results/${TIMESTAMP}.json"
echo "$RESULTS_B64" | base64 -d > "$RESULTS_FILE"
echo "    Results saved to: $RESULTS_FILE"

# ---------------------------------------------------------------------------
# Generate report
# ---------------------------------------------------------------------------
echo "==> Generating report..."
cd "$PROJECT_DIR"
node --env-file=.env dist/report.js
open report.html 2>/dev/null || xdg-open report.html 2>/dev/null || echo "Open report.html manually"

if [[ "$NO_DESTROY" == "true" ]]; then
  echo "==> --no-destroy: EC2 instance $INSTANCE_ID left running."
fi

echo ""
echo "Done! Report: $PROJECT_DIR/report.html"
