# Sample Organization — login coverage test suite

A Browserbase diagnostic for the four sites Sample Organization needs proven out before
they'll commit to enterprise. It reaches each login page, classifies whatever
bot wall it lands on (captcha / WAF / access-denied), and — once real
credentials are supplied — attempts the full login and reports whether we got
past the wall.

Built with [Stagehand](https://docs.stagehand.dev) v3 + [Browserbase](https://browserbase.com).

## Background

In the original trial, an evaluator ran the enterprise
"verified" trial — verified browser + residential proxies + a persistent Context
— and still hit a **captcha/anti-bot block at the login step** on every site.
Reaching the login page worked; pressing **Sign in** got rejected. His takeaway
was that verified unblocked "zero extra platforms" vs the normal tier.

The plan (per Connor) is to **prove these out ourselves**, then hand off to the
TCSM + Customer Engineers for implementation. This suite is the reproduction +
experimentation harness for that.

## The four sites

| Site | URL | Suspected defense |
|---|---|---|
| OpenTable GuestCenter | `guestcenter.opentable.com/login` | Akamai Bot Manager (+ possible reCAPTCHA on submit) |
| Sitedish (mijn-test) | `mijn-test.sitedish.nl` | Unknown NL platform; likely reCAPTCHA — try a NL exit IP first |
| Aesthetic Record | `app.aestheticrecord.com/login` | reCAPTCHA / Cloudflare — **customer already found a workaround** |
| FedEx | `fedex.com/secure-login` | Akamai Bot Manager |

Suspected defenses are hypotheses for the SE — the harness reports what it
*actually* observes on each run.

## What we found (live, detection-only, profile `stealth`)

Run under **advanced stealth + `os:mac` + residential proxies** — the config the
internal Stealth x Support matrix prescribes, which the customer never used.

| Site | Anti-bot (detected) | Reached form? | Solvable? |
|---|---|---|---|
| OpenTable GuestCenter | **Akamai** (`abck`/`ak_bmsc`) | ✅ | ✅ adv stealth + mac/win fp (❌ on verified — the customer's bug) |
| FedEx | **Akamai** (`abck`/`ak_bmsc`) | ✅ | ✅ adv stealth + mac/win fp (❌ on verified) |
| Sitedish (mijn-test) | **reCAPTCHA v2** on the form | ✅ | ✅ adv stealth + proxies (retry for fresh proxy if no solve in ~60s) |
| Aesthetic Record | **Imperva/Incapsula + reCAPTCHA** (saw v2 widget; a v3 loader appeared on another run) | ✅ | ⚠️ Imperva needs manual sitekey; if v3 fires at submit it is **not** solvable |

**The headline:** the customer ran **verified** mode, but Akamai (OpenTable, FedEx)
is ❌ on verified and ✅ only on **advanced stealth** with a windows/mac fingerprint.
That single config gap explains "verified unblocked zero extra platforms." Under
advanced stealth all four reach the login form. The remaining risk is per-site at
the *submit* step — solvable for Akamai + reCAPTCHA v2, uncertain for Aesthetic
Record (Imperva + possible reCAPTCHA v3). Confirm each with `@whatantibot` in Slack
and a credentialed run.

## Quick start

```bash
npm ci
npm test

cp .env.example .env
# Fill in BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID.
# Site credentials are PLACEHOLDERS for now — leave them blank to run
# detection-only (reach each page + classify the wall). That needs no creds.

npm start                  # all sites, default "stealth" profile (adv stealth + os:mac)
npm start all verified     # reproduce the customer's failing setup (verified, no adv stealth)
npm start opentable        # one site, default profile
npm start fedex baseline   # one site, no-stealth comparison

RETRIES=2 npm start opentable      # retry once with a fresh proxy if blocked
SOLVE_WAIT_MS=75000 npm start ...  # how long to wait for a captcha solve post-submit
```

No LLM provider key is required — `extract`/`act` go through Browserbase's
managed model gateway, which handles model auth server-side.

## Credentials are placeholders

Credentials are intentionally omitted, so `.env.example` ships every site
credential blank. The harness attempts a real login **only when both the
username and password for a site are set to a non-placeholder value**. Until
then each site runs in detection-only mode:

- **Reach** the login page under the chosen profile.
- **Classify** the landing state (form / captcha / WAF / denied) and screenshot it.
- **Skip** the submit step and say so in the scorecard.

Drop real credentials into `.env` later and the same run additionally fills the
form, submits, and re-classifies the post-submit page — which is exactly where
the customer's captcha rejection happens.

## Stealth profiles (the experiment grid)

`stealth` is the **default** — it's the matrix-prescribed config (advanced stealth
+ pinned OS fingerprint), and it's what gets past Akamai. `verified` exists to
**reproduce the customer's failing setup** for an A/B.

| Profile | `verified` | `advancedStealth` | `os` pin | `proxies` | `solveCaptchas` | Purpose |
|---|---|---|---|---|---|---|
| `baseline` | — | — | — | — | — | "Normal tier" comparison |
| `verified` | ✓ | — | ✓ | ✓ | ✓ | Reproduce the customer's setup (fails Akamai) |
| `stealth` (default) | — | ✓ | ✓ | ✓ | ✓ | Matrix-recommended; passes Akamai |

The `os` pin comes from each site in `sites.ts` (all default to `mac`): Akamai needs
a windows/mac fingerprint, Cloudflare-on-advanced-stealth needs os ≠ windows, and
`mac` satisfies both. Run a site across all three profiles to see what moves the verdict.

## Reading the scorecard

Each run writes `output/scorecard.md`, `output/results.json`, and
`output/*.png` screenshots. Verdicts:

- ✅ **`reached_login`** — got to a usable form (a *solvable* captcha sitting on the form still counts — it's a gate, not a wall; needs creds to test the solve)
- ✅ **`login_succeeded`** — login actions reported success and visible logout plus account/profile/dashboard controls were observed, without a login entry or wall
- 🟡 **`login_failed`** — retained as a legacy report label; the diagnostic no longer infers credential rejection or coverage success from a remaining form.
- ⛔ **`blocked`** — an access-denied/interstitial message, or a captcha challenge with no form behind it. This is the customer's reported failure.
- ❔ **`unknown`** / ❌ **`error`**

The **Anti-bot (detected)** column is deterministic — the harness reads cookies
(`abck`→Akamai, `cf_clearance`→Cloudflare, `datadome`→DataDome, `_px*`→PerimeterX,
`incap_ses`→Imperva, …) and script tags (reCAPTCHA `?render=` v3 vs `g-recaptcha`
v2 widget) and maps each to its solver status from the internal matrix. This is
the signal that says whether a site is even *solvable*, not just whether it blocked.

## Tuning levers when a site is `blocked`

These are the knobs to turn, roughly in order:

1. **Profile** — try `stealth` (advanced stealth) before anything else.
2. **Proxy geolocation** — set `proxyCountry` on the site in `sites.ts` (Sitedish
   already defaults to `NL`). A local exit IP often matters for regional sites.
3. **Persistent Context** — set `BROWSERBASE_CONTEXT_ID` in `.env` to carry
   cookies + a warmed fingerprint across runs (the customer had one attached).
4. **Region** — `region` per site in `sites.ts`, nearest the origin.
5. **Captcha solving** — on in `verified`/`stealth`; confirm it's actually firing
   in the session replay if a captcha is the wall.

## Layout

```
sites.ts     # the four-site registry: URLs, field hints, per-site proxy/region
run.ts       # the engine: profiles, block detection, scorecard + CLI
.env.example # Browserbase keys + placeholder site credentials
output/      # scorecard.md, results.json, screenshots (gitignored)
```

## Docs

- [Verified browser mode](https://docs.browserbase.com/features/stealth-mode/verified-browser)
- [Advanced stealth](https://docs.browserbase.com/features/stealth-mode/advanced-stealth)
- [Proxies (residential / geolocation)](https://docs.browserbase.com/features/stealth-mode/proxies)
- [Captcha solving](https://docs.browserbase.com/features/stealth-mode/captcha-solving)
- [Contexts (persistent sessions)](https://docs.browserbase.com/features/contexts)
- [Stagehand configuration](https://docs.stagehand.dev/v3/configuration)

## Login-verdict verification

Each username, password and submit action must report success; a failed action stops the sequence. The diagnostic polls within `SOLVE_WAIT_MS` for positive DOM evidence: visible logout/sign-out and account/profile/dashboard controls, with no visible login entry. It overrides any model authentication claim with this DOM check. A blank/loading page, missing form, or unconfirmed account UI stays `unknown` at the deadline; visible walls remain `blocked`.

This generic control check can miss authenticated sites with different labels, and it does not independently verify account identity. `reached_login` only describes reachability without a credential attempt. Neither outcome is a blanket claim about authentication or anti-bot coverage.

Run `node --test tests/login-verdict.test.mjs` with Node 24 or newer. Synthetic fixtures exercise the actual attempt and observation functions, while local Chrome fixtures check visible controls. These checks use no real credentials, account, or provider and do not establish live site compatibility.

## Session evidence in reports

`finalUrl` is awaited and validated as an HTTP(S) URL; unavailable or invalid values become `null`. Session identity comes from the current Stagehand browser's `sessionId`. `sessionReplayUrl` is the session dashboard link. `liveViewUrl` is populated separately from the Browserbase session debug API's fullscreen URL, with a bounded metadata request; failure leaves the replay link intact and the live view unknown.

The scorecard lists replay and live-view links separately. Evidence fields are validated before writing the JSON report, so unresolved promises or malformed URL fields cannot silently serialize into empty objects. These links identify reported resources, not proof that a replay exists or a login succeeded. Local tests mock the metadata request and do not query Browserbase.

Run all diagnostic fixtures with `node --test tests/*.test.mjs` after installing this recipe's dependencies.
