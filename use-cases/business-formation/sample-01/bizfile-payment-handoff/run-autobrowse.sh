#!/usr/bin/env bash
#
# run-autobrowse.sh -- wrap autobrowse evaluate.mjs so the agent's `browse`
# commands actually use the persistent context.
#
# The autobrowse skill's evaluate.mjs spawns the browse CLI without a
# --connect flag, so each command lands in a fresh ephemeral BB session
# with no cookies. We work around that by:
#
#   1. Creating a single BB session bound to $BROWSERBASE_CONTEXT_ID
#   2. Running the deterministic Playwright handoff in that session
#   3. Leaving a verified payment page available for its human owner
#
# All extra args are forwarded to evaluate.mjs. Default: --task
# bizfile-ca-llc --workspace ./autobrowse --env remote.

set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "ERROR: no .env in $(pwd) -- copy .env.example to .env and fill it in first." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -o allexport; source .env; set +o allexport

: "${BROWSERBASE_API_KEY:?BROWSERBASE_API_KEY missing from .env}"
: "${BROWSERBASE_PROJECT_ID:?BROWSERBASE_PROJECT_ID missing from .env}"
: "${BROWSERBASE_CONTEXT_ID:?BROWSERBASE_CONTEXT_ID missing -- run ./bootstrap-context.sh first}"

if [[ "${BIZFILE_ALLOW_PAYMENT_HANDOFF:-}" != "true" ]]; then
  echo "ERROR: set BIZFILE_ALLOW_PAYMENT_HANDOFF=true to run the payment-handoff demo." >&2
  echo "       This flow signs Step 9, opens the payment form, fills card fields, and then stops for a human." >&2
  exit 1
fi

echo "-> Creating BB session bound to context $BROWSERBASE_CONTEXT_ID..."
SESSION_JSON=$(bb sessions create \
  --context-id "$BROWSERBASE_CONTEXT_ID" \
  --persist \
  --advanced-stealth \
  --solve-captchas \
  --keep-alive \
  --timeout 1800)
export BROWSERBASE_SESSION_ID=$(echo "$SESSION_JSON" | jq -r '.id')
if [[ -z "$BROWSERBASE_SESSION_ID" || "$BROWSERBASE_SESSION_ID" == "null" ]]; then
  echo "ERROR: bb sessions create returned no session id." >&2
  echo "$SESSION_JSON" >&2
  exit 1
fi
echo "   session-id: $BROWSERBASE_SESSION_ID"

LIVE=$(bb sessions debug "$BROWSERBASE_SESSION_ID" 2>/dev/null | jq -r '.debuggerFullscreenUrl // .pages[0].debuggerFullscreenUrl // empty')
DASHBOARD_URL="https://www.browserbase.com/sessions/$BROWSERBASE_SESSION_ID"
echo
echo "   +----------------------------------------------------------------------------------------------------------"
echo "   |  SAFE MONITORING (recommended) -- passive video feed, cannot kill the session if closed:"
echo "   |"
echo "   |    $DASHBOARD_URL"
echo "   |"
if [[ -n "$LIVE" ]]; then
  echo "   |  INTERACTIVE INSPECTOR -- WARNING: closing this tab CAN kill the session. Use only if needed:"
  echo "   |"
  echo "   |    $LIVE"
  echo "   |"
fi
echo "   |  Note: bizfile opens new browser tabs as you navigate. Inside the inspector, do not close any"
echo "   |  of those tabs -- closing the agent's active page disconnects the run and burns tokens."
echo "   +----------------------------------------------------------------------------------------------------------"
echo

# Default: leave the BB session alive after the script exits so the human can
# click "Submit Payment" in the live-view. Set RELEASE_ON_EXIT=1 to override
# (useful for failed runs you want cleaned up immediately).
KEEP_SESSION_ALIVE=1
cleanup() {
  echo
  if [[ "${RELEASE_ON_EXIT:-0}" == "1" || "$KEEP_SESSION_ALIVE" != "1" ]]; then
    echo "-> Releasing session $BROWSERBASE_SESSION_ID..."
    bb sessions update "$BROWSERBASE_SESSION_ID" --status REQUEST_RELEASE >/dev/null 2>&1 || true
  else
    echo "-> Session $BROWSERBASE_SESSION_ID LEFT ALIVE for human Submit Payment."
    echo "   Open https://www.browserbase.com/sessions/$BROWSERBASE_SESSION_ID"
    echo "   To release sooner: bb sessions update $BROWSERBASE_SESSION_ID --status REQUEST_RELEASE"
  fi
  echo "   Context $BROWSERBASE_CONTEXT_ID preserved."
}
trap cleanup EXIT

if [[ $# -eq 0 ]]; then
  set -- --task bizfile-ca-llc --workspace ./autobrowse --env remote
fi

# ==============================================================
# PHASE 1: Playwright drives Steps 1-8 deterministically.
# Uses BROWSERBASE_SESSION_ID we just created; does NOT release on exit.
# ~30-45 seconds, $0 in LLM tokens. Browser is left parked on Step 9.
# ==============================================================
echo "-> Phase 1: Playwright drives Steps 1-8 (deterministic, $0 LLM cost)..."
PLAYWRIGHT_DIR="./autobrowse/tasks/bizfile-ca-llc/playwright"
if [[ ! -d "$PLAYWRIGHT_DIR/node_modules" ]]; then
  echo "   Installing playwright deps (one-time)..."
  (cd "$PLAYWRIGHT_DIR" && npm install --silent --no-fund --no-audit) || {
    echo "ERROR: npm install failed in $PLAYWRIGHT_DIR" >&2
    exit 1
  }
fi

(
  cd "$PLAYWRIGHT_DIR"
  npx --no-install tsx bizfile-ca-llc.ts
) || {
  echo "ERROR: Phase 1 (Playwright) failed. Aborting before Phase 2 (autobrowse)." >&2
  echo "   The BB session is still alive; check the live-view URL above for the failure state." >&2
  exit 1
}
echo "-> Phase 1 complete. Browser is parked on the payment screen with all fields populated."
echo
echo "   Next step is the human's: open the live-view above, verify the form, click 'Submit Payment'."
echo
echo "   Note: autobrowse Phase 2 was removed — Playwright now covers the full flow end-to-end."
echo "   To re-enable autobrowse exploration (for future variations), see the git history of this file."

exit 0
