# Historical court demo observations

Private historical source notes from July 2026. These describe an older runner and are not validation of the Stagehand 4.0.2 migration. Session links, commands, flags and success claims below are retained as historical evidence only. Do not use them as current setup instructions.

## Browserbase Findings

Observed July 2, 2026:

| Site | Search UI shape | Browserbase pass/fail | Anti-bot / policy surfaced | Next step |
| --- | --- | --- | --- | --- |
| FL Hillsborough HOVER | Public case search with Party, Business, Attorney, case category, case type, date range, and case-status controls. Criminal is available as a case category. | Not passing yet. Browserbase reaches the search form, but PerimeterX presents `iframe#px-captcha-modal` before submit. The hidden `#captchaToken` did not populate. | PerimeterX / px-cloud. Browserbase session logs show px-cloud collector traffic; the visible blocker is the press-and-hold iframe modal. A scripted hold fallback did not clear it. | Next step is Browserbase PerimeterX tuning/escalation for this exact `PXx9LbctPG` flow, or HITL completion in the live session. |
| FL Lee MATRIX | Public records form with case-type checkboxes, first/middle/last name, case number, citation number, and date range. Criminal categories include Adult - Felony, Misdemeanor, CriminalTraffic, County Ordinance, and Municipal Ordinance. | Passing in an earlier Browserbase Windows/no-proxy run, but current Stagehand 3 gateway-mode reruns are blocked on submit by Akamai `Access Denied`. | Akamai challenge validation. No-proxy Windows profile has passed before; the current gateway runner still surfaces Akamai blocking after submit. | Keep no proxy, `os=windows`, `verified=true`, `advancedStealth=true`, `solveCaptchas=true`; next step is Akamai timing/session tuning for the Stagehand 3 runner. Lee rejects pure last-name-only searches, so the runner first tries last name `Smith`, then falls back to accepted `Jo*` only if validation requires first-name criteria. |
| MI Wayne MiCOURT D36 | Redirects through a terms page, then exposes D36 name search fields, status filters, criminal/traffic/civil-infraction filter, date filters, and submit. | Passing under current Stagehand 3 gateway mode. Runner clicks Continue, searches last name `Smith` over the last 14 days, applies criminal/traffic, applies filed-date filters, and reaches `/court/D36/search?...`. | hCaptcha protection is present, but the latest run did not stop on a terms/policy blocker. | Use no proxy, `os=windows`, `verified=true`, `advancedStealth=true`, `solveCaptchas=true`; MiCOURT uses a 120s result wait plus Stagehand gateway extraction. Latest extract completed and reported the result area still loading. |

## Successful Demo Sessions

Use these Browserbase sessions in the customer meeting:

| Site | Browserbase session URL | Outcome |
| --- | --- | --- |
| MI Wayne MiCOURT D36 | https://browserbase.com/sessions/32bc1807-a5b5-48d5-8b7b-4ef45bbabb59 | Current Stagehand 3 gateway run: D36 search submitted with last name `Smith`, criminal/traffic, and filed-date filters for `06/18/2026-07/02/2026`; gateway extract completed with `Results are loading`. |
| FL Lee MATRIX | https://browserbase.com/sessions/50632b77-25a1-408c-bf27-ccb8f2ce5901 | Earlier Browserbase Windows/no-proxy run: Akamai path passed; Smith search over `06/18/2026-07/02/2026` reached the records results UI with `0` returned records. Current Stagehand 3 gateway reruns are blocked, see matrix. |

## Browserbase Run Matrix

| Site | Browserbase settings | Session | Result | Report |
| --- | --- | --- | --- | --- |
| MiCOURT D36 | `stagehandApi=true`, `proxies=false`, `os=windows`, `advancedStealth=true`, `solveCaptchas=true`, `verified=true`, `captchaSettleMs=10000` | `32bc1807-a5b5-48d5-8b7b-4ef45bbabb59` | `results_reached` / D36 search URL includes last name, criminal/traffic, and filed-date filters; gateway extract completed with loading state | `results/court-assessment-1783013909862.json` |
| Lee | `stagehandApi=true`, `proxies=false`, `os=windows`, `advancedStealth=true`, `solveCaptchas=true`, `verified=true`, `captchaSettleMs=20000`, `waitForCaptchaSolves=false` | `3a2263d1-96c2-4654-a849-4809393b081c` | `blocked_human_check` / Akamai access denied on submit | `results/court-assessment-1783013994206.json` |
| Lee | `stagehandApi=true`, `proxies=false`, `os=windows`, `advancedStealth=true`, `solveCaptchas=true`, `verified=true`, `waitForCaptchaSolves=true` | `d19bd433-d940-4fe5-8c59-f94e37ceeffa` | `blocked_human_check` / Akamai access denied on submit | `results/court-assessment-1783014029327.json` |
| Lee | `stagehandApi=false`, `proxies=false`, `os=windows`, `advancedStealth=true`, `solveCaptchas=true`, `verified=true`, `captchaSettleMs=20000` | `50632b77-25a1-408c-bf27-ccb8f2ce5901` | `results_reached` / Smith 14-day search reached results UI, 0 records | `results/court-assessment-1783012234242.json` |
| Hillsborough | `proxies=false`, `advancedStealth=true`, `solveCaptchas=true`, `waitForCaptchaSolves=true`, `verified=true` | `fae2be26-41ec-4e1e-bf1d-a5881ad3a5ea` | `blocked_human_check` / PerimeterX iframe modal | `results/court-assessment-1782956986189.json` |
| Lee | `proxies=false`, `advancedStealth=true`, `solveCaptchas=true`, `waitForCaptchaSolves=true`, `verified=true` | `45bc8480-b004-4113-86d8-1ad784187fa7` | `results_reached` / Akamai solved | `results/court-assessment-1782956305121.json` |
| MiCOURT D36 | `proxies=false`, `advancedStealth=true`, `solveCaptchas=true`, `waitForCaptchaSolves=true`, `verified=true` | `f16c91c3-e682-4715-aa73-cc254c6ba60f` | `results_reached` / D36 search URL reached | `results/court-assessment-1782956389398.json` |
| Lee | `proxies=true`, `advancedStealth=true`, `solveCaptchas=true`, `verified=true` | `55671271-b181-4af7-b9dd-38c483b700c2` | `blocked_human_check` / Akamai access denied | `results/court-assessment-1782955671579.json` |


## Validation Notes

Validation completed:

- `npm run build` passes.
- The runner is on `@browserbasehq/stagehand@^3.6.0` and uses Browserbase Stagehand API/model gateway mode by default for Browserbase runs.
- `USE_BROWSERBASE=false SITE=miwayne npm run assess` returns `blocked_terms`.
- `USE_BROWSERBASE=false SITE=hillsborough npm run assess` returns `blocked_site_denial`.
- `USE_BROWSERBASE=false SITE=lee npm run assess` hit `net::ERR_HTTP2_PROTOCOL_ERROR` before the form in local headless Chromium. In the manual browser pass, the form loaded and the submit path redirected to Akamai challenge validation.
- Browserbase real-settings runs are recorded in the matrix above. Lee and MiCOURT pass; Hillsborough reaches the form but remains blocked by PerimeterX `px-captcha-modal`.

## Demo Positioning

This is best framed as a fit assessment:

1. Browserbase is useful for realistic browser execution, session persistence, and live human takeover.
2. Stagehand is useful for resilient form interaction and result extraction once a site permits access; model-backed steps are routed through Browserbase's gateway in this demo.
3. Lee and MiCOURT are solid demos for Browserbase-supported anti-bot handling.
4. Hillsborough is the escalation case: the customer-facing demo should show the live session reaching the PerimeterX modal, then explain that this exact px-cloud flow needs Browserbase PerimeterX tuning or HITL completion.
