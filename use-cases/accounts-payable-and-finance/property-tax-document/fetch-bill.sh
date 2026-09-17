#!/usr/bin/env bash
# the cookbook example demo — fetch a property-tax bill PDF from a county portal
# (lowtaxinfo.com / Allen County, IN) using a Browserbase cloud browser.
#
# This version DRIVES the portal like a person: visible cursor, types the
# address, clicks Search, opens the matching property, clicks "View Tax Bill",
# and saves the PDF. Watch it live via the Browserbase session URL printed at
# the end. Demonstrates the hard part Jeremy described: navigating a fragmented
# public portal end-to-end.
#
# Usage:  ./fetch-bill.sh ["123 Some St"]      (defaults to the demo address)
set -euo pipefail
cd "$(dirname "$0")"
source ./.env 2>/dev/null || true   # BROWSERBASE_API_KEY (see .env.example)

ADDRESS="${1:-1010 Boulder Ridge Trl}"
PORTAL="https://lowtaxinfo.com/allencounty"
OUT="$HOME/Desktop/tax-bill.pdf"            # land on the Desktop for the demo
R() { browse "$@" --remote 2>/dev/null | grep -v "Update available\|npm i -g\|Run:"; }   # remote + quiet
JGET() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).result??"")}catch{console.log("")}})'; }

echo "🌐  Opening the Allen County portal in a Browserbase cloud browser…"
browse stop --session default >/dev/null 2>&1 || true
browse open "$PORTAL" --remote --timeout 60000 >/dev/null
browse cursor --remote >/dev/null 2>&1 || true     # show a visible cursor in the recording

SESSION_ID=$(browse cloud sessions list 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{let a=JSON.parse(s);a=Array.isArray(a)?a:(a.data||a.sessions||[]);console.log((a[0]||{}).id||"")}catch{console.log("")}})')
SESSION_URL="https://www.browserbase.com/sessions/$SESSION_ID"
echo "🎥  Watch it live:  $SESSION_URL"

echo "⌨️   Typing the address:  \"$ADDRESS\""
R click "#address" >/dev/null
R type "$ADDRESS" >/dev/null

echo "🔎  Clicking Search…"
R click 'button[type=submit]' >/dev/null

echo "⏳  Waiting for results…"
for i in $(seq 1 25); do
  N=$(R eval "document.querySelectorAll('a[title=\"Click For Property Details\"]').length" | JGET)
  [ "${N:-0}" -gt 0 ] 2>/dev/null && break
  sleep 0.6
done
[ "${N:-0}" -gt 0 ] 2>/dev/null || { echo "❌ No results for \"$ADDRESS\""; exit 1; }
echo "    ↳ found $N matching properties"

echo "🏠  Opening the top matching property…"
R click 'a[title="Click For Property Details"]' >/dev/null   # first result = best match
sleep 2

# Tag the "View Tax Bill" link, and force it to open in THIS tab (it's normally
# target="_blank") so the click visibly navigates to the rendered PDF on camera.
PDF_URL=$(R eval "(()=>{const a=[...document.querySelectorAll('a')].find(a=>/view tax bill/i.test(a.textContent)); if(!a)return ''; a.id='demo-viewbill'; a.target='_self'; return a.href})()" | JGET)
[ -z "$PDF_URL" ] && { echo "❌ Could not find the View Tax Bill link"; exit 1; }

echo "🧾  Clicking \"View Tax Bill\"…"
R click "#demo-viewbill" >/dev/null 2>&1 || true   # visible cursor click on the link
sleep 1
echo "📄  The tax bill opens in the browser…"
R open "$PDF_URL" >/dev/null 2>&1 || true          # load the PDF into the active tab so it renders on camera
sleep 4                                             # let the in-browser PDF viewer render
echo "    ↳ $PDF_URL"

echo "⬇️   Downloading the same PDF to your Desktop…"
curl -sS -L -o "$OUT" "$PDF_URL"
echo ""
echo "✅  Saved $OUT  ($(du -h "$OUT" | cut -f1)) — $(file -b "$OUT")"
echo "🎥  Replay the whole run:  $SESSION_URL"
