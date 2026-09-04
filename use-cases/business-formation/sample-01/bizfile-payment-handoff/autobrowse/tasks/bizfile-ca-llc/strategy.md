# bizfile-ca-llc Navigation Strategy

Learned across iterations. Refine with one targeted heuristic per iteration.

## Environment — hybrid mode

- A Playwright script has already driven the wizard through Steps 1-8 and left the browser **parked on Step 9 (Review and Signature)**. The wizard's draft state holds the filled values (LLC name, addresses, agent, signature placeholder).
- Your job starts at Step 9. **Do not `browse open` any URL at the start** — that destroys the draft state. Just `browse snapshot` first to confirm starting state.
- Browser is pre-attached to a Browserbase session bound to a persistent context with bizfile cookies. **Skip session lifecycle commands** (`browse env`, `browse stop`, `browse status`) — they are no-ops.
- After Phase 1 you should see the wizard summary with `Robert Browder` info on Step 9. If the snapshot shows the bizfile dashboard, login page, or anything else, return `success: false, reason: "unexpected-starting-state"`.

## Bail-out heuristics — stop spiraling

When you hit one of these conditions, **return `success: false` immediately** with the listed `reason`. Do NOT improvise alternatives, retry with new values, or spend turns trying to recover. Spiraling is the most expensive failure mode of this task (run-003 burned $29.65 because the agent kept trying to recover from a dead session).

| Condition | Reason | Do NOT |
|---|---|---|
| Bizfile shows "name is already taken" or similar duplicate-name error on Step 4 | `llc-name-taken` | invent a new name. The name comes from `$LLC_NAME` only. |
| ANY `browse` command fails with `session resume missing connectUrl` | `session-died` | retry. This error means the BB session is gone; commands cannot recover. Return on the FIRST occurrence. |
| 3+ consecutive `browse` commands fail with the same non-connectUrl error (e.g. `StagehandEvalError`, `browser daemon not running`) | `browser-tooling-broken` | keep retrying. Try ONE recovery (e.g. one `browse env remote`); if the next command still fails, return. |
| You find yourself one click away from any forbidden submit button (see hard guardrail) and unsure which is safe | `would-violate-guardrail` | guess. Capture state and return. |
| Total turns spent on a single wizard step exceeds 15 | `stuck-on-step-<N>` | continue past 15. Return with whatever state you have. |
| The bizfile dashboard does NOT show the logged-in user's name (e.g. "Gemma Sloan") | `auth-expired` | try to log in. Return immediately. |

The goal is **fail fast, fail cheap**. A `success: false` with a clear reason is more useful for the next iteration than a 100-turn $30 spiral that ends in confusion.

## Hard guardrail — the only one

This is a real filing portal. The wizard is 11 steps; after Step 11's "File Online" button click, a **payment screen** appears with a Visa/Mastercard form. The legal-filing + card-charge trigger is the submit button on the payment screen — NOT the File Online button on Step 11.

Before beginning, confirm `$BIZFILE_ALLOW_PAYMENT_HANDOFF` is `true`. If it is not exactly `true`, stop immediately and report `success: false, reason: "payment-handoff-not-authorized"`.

Per the captured Step 11 screenshot, the page body text reads: *"Click File Online below to pay for your filing with a Visa or Mastercard. … Once your payment is submitted, the filing will be forwarded for review."* This confirms:

- **The Step 11 "File Online" button is SAFE to click** (opens the payment form; no charge, no filing).
- **The payment-screen submit button is the only forbidden click.** Its exact label is unknown until observed — treat ANY button on the payment screen whose label contains "Pay", "Submit", "File", "Place Order", "Complete Order", "Confirm Payment", or similar as forbidden.

Scope summary:

- OK to click: all "Next Step" buttons on Steps 1–10, the "One Signature" radio on Step 9, the typed-signature input, the **"File Online"** button on Step 11, and any input field (text, radio, select, checkbox) on the payment screen.
- NOT OK to click: any submit-action button on the payment screen.

If something on Step 10 (Processing Fees) looks like an input field or its advance button is labeled with a charge verb, the form may have changed — stop and return `success: false, reason: "step-10-shape-unexpected"`.

## `browse eval` quoting trap — observed in run-002

When a `browse eval` command contains a CSS attribute selector with quotes inside the outer double-quoted command, escaping breaks. Run-002 burned 6 turns on `StagehandEvalError: Uncaught` before finding the unquoted form works:

- BREAKS: `browse eval "document.querySelector('input[type=\"checkbox\"]').click()"`
- WORKS: `browse eval "document.querySelector('input[type=checkbox]').click()"`

CSS allows unquoted attribute values when they're simple identifiers. Use the unquoted form in any `browse eval` body. Same applies to `[role=button]`, `[name=foo]`, etc.

## Tab management — bizfile opens new tabs

bizfile clicks (especially "Articles of Organization - CA LLC" and "FILE ONLINE") open the wizard in a new browser tab. The `browse` daemon's "current page" follows the new tab, which is what you want — BUT the old tab stays open. Leaving orphan tabs around is dangerous because the live-view inspector shows them all, and a human watcher can accidentally close one and disconnect the session.

After every navigation event that might have opened a new tab, run `browse pages` once. If you see more than one page open, close the inactive ones:

```
browse pages
# returns something like [{index: 0, url: ".../dashboard"}, {index: 1, url: ".../forms/new/5072"}]
# the wizard is the one with /forms/ in the URL; close the others
browse tab_close 0
```

Always run `browse pages` BEFORE `tab_close` so you know the current index of the wizard page (closing the wrong one will disconnect the session).

If `browse pages` returns just one page, no action needed.

## Button-enumeration pattern — observed in run-002

When you need to click a button by text but the `browse snapshot` tree truncates before reaching it (or `getByText` selectors fail), enumerate buttons by index:

```
browse eval "Array.from(document.querySelectorAll('button')).map((b,i) => i+': '+b.textContent.trim().substring(0,40)).join(String.fromCharCode(10))"
```

Then click the one you want by index:

```
browse eval "document.querySelectorAll('button')[16].click()"
```

(Note: `String.fromCharCode(10)` instead of `\n` avoids the same backslash-escape trap.)

## General anti-patterns (apply throughout)

- **Do NOT use `browse wait selector "<css>"`** with timeouts — observed `spawnSync browse ETIMEDOUT` after waiting on `button[type='submit']`. Prefer direct action.
- **Do NOT use xpath-flavored selectors like `.step-content`** — CSS selectors starting with `.` get treated as xpath; use a tag prefix (e.g., `div.step-content`) or skip dot-class selectors.

## Form-filling — CRITICAL EFFICIENCY RULES

Run-002 and run-003 burned ~80 turns each because of three anti-patterns. Encode the fixes in muscle memory:

1. **The bizfile text fields are React autocompletes that strip spaces.** Both `browse fill` and `browse type` truncate multi-word values (e.g., a name like `"Example LLC"` becomes just `"Example"`) because they fire keystrokes one-at-a-time, and the autocomplete intercepts space. **For ANY text field on bizfile**, use the **`browse eval` React-input bypass** below — do NOT use `fill` or `type` for text values that contain spaces.

2. **No click-then-type pattern.** When you DO use `fill`, use `browse fill <ref> <value>` directly (focuses + clears + sets in one turn). Don't `click` then `type`.

3. **Snapshot once per page, not after every fill.** Within a single wizard step, fill multiple fields in sequence and snapshot only when the DOM changes (after a Next Step click or a radio that reveals new fields).

4. **Wait timeouts: 1000ms is usually enough** for in-page transitions. 2000ms only after navigation.

5. **Look for "same as principal" or "copy from principal" checkboxes** before manually filling mailing/agent addresses. Saves 5+ turns per page.

### The `browse eval` React-input bypass (use for every text field on bizfile)

The native HTMLInputElement value setter — when called via `Object.getOwnPropertyDescriptor` and paired with synthetic `input`/`change` events — sets the React-tracked value atomically without firing any keystroke handlers. The autocomplete never sees the space character, so nothing gets stripped.

**Recipe** (3 turns per field):

```bash
# 1. Click to focus the field
browse click [REF_OF_FIELD]

# 2. Set the value via the React-aware DOM setter and fire input events.
#    document.activeElement is the field you just clicked, so we don't need
#    a CSS selector. Returns the resulting .value so you can verify the
#    full text landed (not just the first word).
browse eval "
  const el = document.activeElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, '<value from .env, e.g. $LLC_NAME>');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.value
"

# 3. (Optional) snapshot to confirm — only needed before the next Next Step click
```

**Verification**: the eval's return value should be the full string you set. If it returns only the first word (truncated at a space), the autocomplete may also be running on the `input` event — try wrapping with `el.blur()` after the dispatches, or use `Event('beforeinput')` instead.

**Caveats**:
- If `document.activeElement` is the wrong element (e.g., the click missed), the eval writes to the wrong field. After the click, before the eval, verify focus by `browse get value <selector>` if needed.
- For dropdowns/`<select>` elements, use `browse select <ref> <value>` — not the eval recipe.
- For radios/checkboxes, use `browse click <ref>` — not the eval recipe. (Confirmed working in run-001 and run-003.)
- Multi-line textareas: same eval pattern, just `HTMLTextAreaElement` instead of `HTMLInputElement`.

## Wizard step-by-step (starting at Step 9; Steps 1-8 are handled by Playwright before you start)

- **Step 9 — Review and Signature** (~5-8 turns) — confirmed on `playwright/review-screen.png` and run-005 trace:
  - The page renders the wizard summary plus an "Electronic Signature" section with "Signature Options *" radios: "One Signature" / "Multiple Signatures".
  - Click the **"One Signature"** radio. Wait ~1000ms for the form to expand.
  - After selecting "One Signature" the page reveals:
    - An affirmation checkbox starting with "By signing, I affirm..." — click it.
    - An **"Add"** button to add a signature row (run-005 trace, turn 118). Click it. A signature input row appears.
  - In the signature row that appears, fill the typed-signature field with `Robert Browder` via the React-input bypass. If a "Title" or "Capacity" field is also in the row, fill with "Organizer".
  - Click Next Step.
- **Step 10 — Processing Fees** (~1 turn) — review-only:
  - No input fields. Displays a summary of fees (the $70 filing fee).
  - Just click Next Step.
  - If you see input fields here, or the advance button is labeled with a charge verb, the form has changed — stop and return `success: false, reason: "step-10-shape-unexpected"`.
- **Step 11 — File Document or Send for Signatures** (~1 turn) — confirmed via the screenshot the user provided 2026-05-18:
  - Informational page. Body text: *"Click File Online below to pay for your filing with a Visa or Mastercard. This document requires review by the Secretary of State's office for statutory adherence prior to acceptance. Once your payment is submitted, the filing will be forwarded for review."*
  - There is a "File Online" radio at the top (already selected). Visible buttons at the bottom: "Save Draft" (left), "Previous Step" + **"File Online"** (right).
  - Click the **"File Online"** button. This is safe — it opens the payment form; nothing is filed and nothing is charged.
  - Wait ~3000ms for the payment screen to render (may load a payment-processor iframe).
- **Payment screen** (post-Step-11, ~6-10 turns, exact fields TBD):
  - Expected fields (from `.env`'s `$PAYMENT_*` vars): card number, cardholder name, expiration month, expiration year, CVV, billing address (line 1 / city / state / zip).
  - Use the React-input bypass for all text fields (card number especially — Stripe-like inputs heavily intercept keystrokes).
  - State is a `<select>` — use `browse select <ref> CA`.
  - **Caveat**: the card number / CVV / expiration may live inside a payment-processor `<iframe>` (likely Authorize.net or a similar PCI-compliant processor for state portals). If `getByLabel` returns nothing on those fields, snapshot for an `<iframe>` and switch into it.
  - After all fields are populated, **STOP HERE**. Capture URL + a screenshot + every visible button label on the page. Return the final JSON. Do NOT click any submission button — its label may be "Submit Payment", "Pay", "File and Pay", "Complete Order", "Submit", or similar.

If any field cannot be located or filled, return `success: false` with a `reason`. If you find yourself one click away from payment submission and unsure which button is the trigger, **stop and return** rather than guessing.

## Snapshot strategy

Snapshots return up to ~285 refs but truncate visually-below-fold content on long pages. When you can't see what you expect:

- Try `browse get text body` or `browse get text form` to read content without the tree.
- Try `browse get text <css-selector>` to read a specific subtree.
- Use direct CSS clicks/fills (no ref needed) when the snapshot misses the element.

## Anti-patterns observed in run-001

- Treating CSS classes like xpaths (`.step-content` → error).
- Waiting on selectors that don't exist (`button[type='submit']` timed out after 30s).
- Using `fill` on text inputs without checking if the field is actually a button or checkbox first.
- Repeatedly snapshotting the same truncated view expecting different output.
