# Three public-registry implementation patterns

These are reviewed implementation patterns, not promises of access or automatic recovery. Respect site terms and use only public, read-only records. Current release and verification limits are in the [README](README.md).

## Colorado: deterministic search, independent identity, typed detail

Official entry: [Colorado business search](https://www.sos.state.co.us/biz/BusinessEntityCriteriaExt.do).

Fill `#searchCriteria`, submit the native form, and inspect the eight-column results table. The detail link displays an ID, **not the entity name**; the name and status come from their own cells. Select the exact name/ID/status, then follow the official `BusinessEntityDetail` href. Validate `Name`, `ID number`, and `Status` on detail before scoped Pydantic extraction. Detail has both entity and registered-agent `Name` rows: keep the first entity value rather than accidentally overwriting it with the agent.

Stop on schema drift, missing independent identity fields, conflicting extraction, or unresolved duplicate filings. Do not use a former-name relationship or inactive record as a current exact match. October 7, 2026 acceptance checks completed three fresh extractions for one independently selected public record; this is not general coverage proof.

## Ohio: frontend security context, advertised public reads

Official entry: [Ohio business search](https://businesssearch.ohiosos.gov/).

Let the frontend establish its normal browser security context. The tested configuration uses managed proxies, advanced stealth, and a Windows profile. A security redirect may replace the inspected document; allow that same navigation to settle, then poll for the real visible `#bSearch` input. Read the frontend's public `/ajax/endPoints.json` and require it to advertise the official `NS_` and `VD_` prefixes. Never infer an endpoint from model output or explore private routes. The API is a distinct official subdomain; the frontend's own public code uses credentialed cross-origin requests. The adapter mirrors that with browser-context `fetch(..., {credentials: 'include'})`, still subject to browser CORS and site access rules. Do not export security credentials or move reads to an unauthenticated HTTP client.

Parse the public search JSON, filter exact names/IDs/status, and request only the selected detail. A `503` detail response permits one in-page read retry after backoff; continued transport/service failure permits at most one fresh session. Non-JSON, empty identity fields, changed schemas, access rejection, or CORS failure remain non-success. Optional fields have explicit known aliases; update only after inspecting current public responses.

The detail response has multiple sections, not a flat one-record `data` array. Validate the unique `firstpanel` record and its selected identifier; use the `registrant` section only when its filing type represents an agent rather than an applicant. `effect_date` is the filing date. A business-location city is not a principal street address: preserve `null` rather than relabeling it. October 7, 2026 acceptance checks completed three fresh extractions for one public corporate record. Earlier navigation and credential-mode failures are diagnostic context, not continuing coverage claims.

## Wyoming: explicit challenge states, result warm-up, reviewed control

Official entry: [Wyoming business search](https://wyobiz.wyo.gov/Business/FilingSearch.aspx).

Browserbase is configured with `captcha_image_selector` and `captcha_input_selector` for the supported custom image/input challenge. Synchronize `browserbase-solving-started` / `browserbase-solving-finished` console events, confirm a populated answer, and replay only that legitimately solved value through the native input. Submit once, then inspect whether the application or a replacement challenge appeared. Share the three-submission cap across search and detail. Never invent an answer, reuse another session's token, or attempt unlimited challenge submissions.

If intercepted XHR leaves `Loading...`, preserve that failure state. A result-state warm-up is allowed only through a public result route actually advertised by the page, followed by a normal state assertion. No guessed URL or hidden security endpoint. If none is advertised or the result remains absent, stop. A fresh session is reserved for a classified transient access/transport error, not repeated solver rejection.

Results are cards, not table rows. Parse the first line's legal name and public filing ID plus displayed status. The detail href contains an application token, **not the public filing ID**; never compare that token to the requested ID. Follow the exact official href deterministically, then wait for `#txtFilingName2` (detail IDs do not retain the search form's `MainContent_` prefix). Validate `Name`, `Filing ID`, and `Status` from the detail DOM before typed extraction. If a future layout requires a variable control instead of a stable href, adapt the tested `reviewed_detail_click` helper rather than accepting an unreviewed model action.

October 7, 2026 acceptance checks completed three fresh detail extractions for one public record. Those successful runs did not exercise the replacement-challenge or result-warm-up branches; those paths remain supported configuration and bounded implementation patterns with offline checks, not newly demonstrated live recovery guarantees.

## Add another registry

1. Inspect its official landing page, terms, search/detail flow, and available official bulk/API data. Prefer a documented bulk-data source when the UI is unsuitable; do not present bulk availability as interactive access.
2. Add a narrow origin allowlist, adapter, typed input support, and per-registry semaphore. Never allow arbitrary URLs supplied by page/model text to become trusted destinations.
3. Keep known navigation, form fields, and result parsing deterministic. Add explicit waits for real states and check every Boolean wait result. Treat empty shells and spinners as incomplete.
4. Select exactly by normalized legal name, exact identifier, and requested status. Return ambiguity rather than picking the first plausible row. Establish identity from deterministic detail DOM or official structured data, independently of model extraction.
5. Use scoped atomic `observe` → local review → `act` only for variable controls; restrict accepted methods, destinations, and cardinality. Use typed `extract` only after the selected detail is open. Treat all page text as untrusted data, not agent instructions.
6. Define bounded challenge/service recovery and explicit stop conditions. Never manufacture tokens, disable site protections, scrape private endpoints, or hide an unsuccessful result.
7. Add synthetic parser, drift, no-match, ambiguity, wrong-status, failure, deadline, and cleanup tests. Then obtain live-run approval and validate neutral public records against their official details.
8. Date the evidence and keep raw snapshots, recordings, and session references private. Record demonstrated coverage separately from included code, and distinguish a registry fact from your organization's KYB policy decision.
