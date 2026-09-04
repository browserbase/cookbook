#!/usr/bin/env bash
# ============================================================================
#  Momentic × Browserbase demo
#  Shows the REAL Momentic CLI running an E2E test on a Browserbase CLOUD
#  browser against a localhost-only app — the exact thing CDP "can't" do.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")"
DEMO_DIR="$(pwd)"
ENV_FILE="${ENV_FILE:-$DEMO_DIR/.env}"   # local, gitignored — see .env.example
SHIM_PORT=8000
APP_PORT=3000
PAUSE="${PAUSE:-5}"           # seconds to pause so you can open the live view
# Which test to run. Default = real natural-language AI test. Pass a filename to
# override, e.g. ./run-demo.sh acme-signin.test.yaml (the faster JS version).
TEST="${1:-acme-signin-ai.test.yaml}"

c(){ printf '\033[%sm%s\033[0m\n' "$1" "$2"; }
banner(){ echo; c "1;36" "▶ $1"; }

# Only this shell's running children and this run's session belong to cleanup.
OWNED_PIDS=()
KA_ID=""
RUN_DIR=""
cleanup(){
  local result=$? pid running
  trap - EXIT INT TERM
  set +e
  banner "Cleaning up"
  running="$(jobs -pr)"
  for pid in "${OWNED_PIDS[@]}"; do
    if printf '%s\n' "$running" | grep -qx "$pid"; then
      kill "$pid" 2>/dev/null
      wait "$pid" 2>/dev/null
    fi
  done
  if [[ "$KA_ID" =~ ^[A-Za-z0-9_-]+$ ]]; then
    curl --fail --silent --show-error --max-time 15 -X POST "https://api.browserbase.com/v1/sessions/$KA_ID" \
      -H "X-BB-API-Key: $BROWSERBASE_API_KEY" -H "Content-Type: application/json" \
      -d "{\"status\":\"REQUEST_RELEASE\",\"projectId\":\"$BROWSERBASE_PROJECT_ID\"}" >/dev/null 2>&1
  fi
  if [ -n "$RUN_DIR" ]; then rm -rf -- "$RUN_DIR"; fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

require_free_port(){
  local port="$1" status
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use. Stop its owner yourself before running this demo." >&2
    exit 1
  else
    status=$?
    if [ "$status" -ne 1 ]; then
      echo "Could not check port $port (lsof exit $status)." >&2
      exit 1
    fi
  fi
}
command -v lsof >/dev/null || { echo "Install lsof to check the demo ports." >&2; exit 1; }
require_free_port "$APP_PORT"
require_free_port "$SHIM_PORT"
umask 077
RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/momentic-demo.XXXXXXXX")"

# --- creds -----------------------------------------------------------------
set -a; [ -f "$ENV_FILE" ] && source "$ENV_FILE"; set +a
: "${BROWSERBASE_API_KEY:?set BROWSERBASE_API_KEY}"
: "${BROWSERBASE_PROJECT_ID:?set BROWSERBASE_PROJECT_ID}"
: "${MOMENTIC_API_KEY:?set MOMENTIC_API_KEY (in $ENV_FILE)}"

# --- 1. local app ----------------------------------------------------------
banner "Starting the localhost-only app on :$APP_PORT"
node "$DEMO_DIR/server.mjs" > "$RUN_DIR/app.log" 2>&1 &
APP_PID=$!
OWNED_PIDS+=("$APP_PID")
sleep 1
kill -0 "$APP_PID" 2>/dev/null || { echo "Local app exited; port may have become occupied." >&2; exit 1; }
curl --fail --silent --show-error "http://127.0.0.1:$APP_PORT" | grep -oE "<title>.*</title>" | sed 's/^/   /'
c "2"  "   (a normal dev server — only reachable on 127.0.0.1)"

# --- 2. auth-gated tunnel via the browserbase-localhost skill --------------
banner "Opening an auth-gated tunnel to localhost (browserbase-localhost skill)"
node "$HOME/.claude/skills/browserbase-localhost/scripts/launch.mjs" --port $APP_PORT \
  > "$RUN_DIR/tunnel.log" 2>&1 &
OWNED_PIDS+=("$!")
for i in $(seq 1 60); do grep -q "^---READY---$" "$RUN_DIR/tunnel.log" 2>/dev/null && break; sleep 1; done
grep -m1 '^{' "$RUN_DIR/tunnel.log" > "$RUN_DIR/tunnel.json"
TUNNEL_URL=$(jq -r .tunnelUrl "$RUN_DIR/tunnel.json")
SECRET=$(jq -r .secret "$RUN_DIR/tunnel.json")
c "0" "   tunnel: $TUNNEL_URL"
c "2" "   (gated by a per-session secret header — public scrapers get 401)"

# --- 3. keepAlive Browserbase session --------------------------------------
banner "Creating a Browserbase cloud session"
RESP=$(curl --fail --silent --show-error --max-time 30 -X POST "https://api.browserbase.com/v1/sessions" \
  -H "X-BB-API-Key: $BROWSERBASE_API_KEY" -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$BROWSERBASE_PROJECT_ID\",\"keepAlive\":true,\"timeout\":1800}")
KA_ID=$(printf '%s' "$RESP" | jq -er '.id | select(type == "string" and test("^[A-Za-z0-9_-]+$"))')
KA_CONNECT=$(printf '%s' "$RESP" | jq -er '.connectUrl | select(type == "string" and length > 0)')
DASH="https://www.browserbase.com/sessions/$KA_ID"

require_free_port "$SHIM_PORT"

# --- 4. the shim -----------------------------------------------------------
banner "Starting the Momentic→Browserbase shim on :$SHIM_PORT"
SHIM_PORT=$SHIM_PORT BB_CONNECT_URL="$KA_CONNECT" node "$DEMO_DIR/shim.mjs" > "$RUN_DIR/shim.log" 2>&1 &
SHIM_PID=$!
OWNED_PIDS+=("$SHIM_PID")
sleep 1
kill -0 "$SHIM_PID" 2>/dev/null || { echo "Shim exited; port may have become occupied." >&2; exit 1; }
c "2" "   (passes through to api.momentic.ai, except the browser-connection call)"

# --- 5. live view ----------------------------------------------------------
echo
c "1;33" "════════════════════════════════════════════════════════════════"
c "1;33" "  ▶▶▶  WATCH LIVE:  $DASH"
c "1;33" "════════════════════════════════════════════════════════════════"
c "2" "   Open that ^ now. It stays blank until the test starts, then you'll see"
c "2" "   the cloud browser type into the login form and land on the dashboard."
sleep "$PAUSE"

# --- 6. run Momentic -------------------------------------------------------
banner "Running the Momentic CLI — its browser is now Browserbase"
c "2" "   \$ momentic run $TEST  (via MOMENTIC_SERVER shim)"
echo
MOMENTIC_SERVER="http://localhost:$SHIM_PORT" MOMENTIC_API_KEY="$MOMENTIC_API_KEY" \
  momentic run "$TEST" \
    --url-override "$TUNNEL_URL" \
    --custom-headers "X-Tunnel-Auth=$SECRET" \
    --yes 2>&1 | grep -vE '^\{' | grep -viE "^[[:space:]]*$"

# --- 7. wrap up ------------------------------------------------------------
echo
c "1;32" "✓ Momentic test PASSED on a Browserbase cloud browser, against localhost."
c "1;33" "  Replay + network logs: $DASH"
echo
read -r -p "Press Enter to tear everything down… " _
