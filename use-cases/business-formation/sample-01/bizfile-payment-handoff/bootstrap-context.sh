#!/usr/bin/env bash
#
# bootstrap-context.sh — one-time setup: create a Browserbase context, open
# a live-view session inside it, wait for the human to log into bizfile,
# then release the session (cookies persist on the context).
#
# The resulting BROWSERBASE_CONTEXT_ID is appended to .env and reused by
# every subsequent autobrowse iteration and by the exported Playwright
# script. No login flailing during training.

set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "ERROR: no .env in $(pwd) — copy .env.example to .env and fill it in first."
  exit 1
fi

# shellcheck disable=SC1091
set -o allexport; source .env; set +o allexport

: "${BROWSERBASE_API_KEY:?BROWSERBASE_API_KEY missing from .env}"
: "${BROWSERBASE_PROJECT_ID:?BROWSERBASE_PROJECT_ID missing from .env}"
: "${BIZFILE_USER:?BIZFILE_USER missing from .env}"

if [[ -n "${BROWSERBASE_CONTEXT_ID:-}" ]]; then
  echo "BROWSERBASE_CONTEXT_ID already set in .env: $BROWSERBASE_CONTEXT_ID"
  read -r -p "Re-bootstrap and replace it? [y/N] " yn
  [[ "$yn" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

echo "→ Creating Browserbase context (uses BROWSERBASE_PROJECT_ID from env)…"
CTX=$(bb contexts create | jq -r '.id')
if [[ -z "$CTX" || "$CTX" == "null" ]]; then
  echo "ERROR: bb contexts create returned no id. Check BROWSERBASE_PROJECT_ID / BROWSERBASE_API_KEY." >&2
  exit 1
fi
echo "   context-id: $CTX"

echo "→ Creating BB session bound to context (verified mode, captcha solving)…"
SESSION_JSON=$(bb sessions create \
  --context-id "$CTX" \
  --persist \
  --advanced-stealth \
  --solve-captchas \
  --keep-alive)
SID=$(echo "$SESSION_JSON" | jq -r '.id')
echo "   session-id: $SID"

echo "→ Fetching live-view URL…"
LIVE=$(bb sessions debug "$SID" | jq -r '.debuggerFullscreenUrl // .pages[0].debuggerFullscreenUrl // empty')
if [[ -z "$LIVE" ]]; then
  echo "   (live-view URL unavailable — open https://www.browserbase.com/sessions/$SID in your browser instead)"
fi

trap 'echo; echo "→ Releasing session…"; bb sessions update "$SID" --status REQUEST_RELEASE >/dev/null 2>&1 || true; echo "   Context $CTX preserved with cookies."' EXIT

cat <<EOF

==========================================================
  Open this URL to drive the browser:

    $LIVE

  Steps (in the live-view browser):
    1. Go to https://bizfileonline.sos.ca.gov/
    2. Click "Sign In"
    3. Log in with:
         user: $BIZFILE_USER
         pass: (from .env, BIZFILE_PASS)
    4. Confirm you can see the bizfile dashboard
    5. Come back here and press Enter
==========================================================

EOF
read -r -p "Press Enter when you have successfully logged in (or Ctrl+C to abort): " _

echo "BROWSERBASE_CONTEXT_ID=$CTX" >> .env
echo
echo "→ Saved BROWSERBASE_CONTEXT_ID to .env"
echo "→ Done. The session will be released on exit; cookies persist on the context."
