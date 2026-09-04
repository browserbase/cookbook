# Sample Organization x Square Browserbase Functions

Browserbase Functions version of the Square-to-Sample Organization migration workflows. The functions run against a
saved Square login context and return import-ready CSV exports that match the Sample Organization/Sho schema.

## What this demonstrates

- Packaging customer-specific migration workflows as Browserbase Functions.
- Reusing a saved Browserbase context for authenticated Square extraction.
- Returning large outputs through Browserbase session downloads instead of inline function results.
- Combining deterministic Square API replays with a hosted Stagehand agent only where Square has no list API.

## Workflows

The deterministic workflows replay Square dashboard APIs from the function's authenticated runtime session:

- `services-list`
- `team-members`
- `unavailabilities`
- `packages`
- `reviews`
- `client-packages`
- `appointments-list`
- `products`
- `customer-list`

The agent-assisted workflows use Square dashboard exports when the data is only exposed through the UI:

- `customer-notes`
- `client-packages-agent`

## Required Environment

Do not commit live Browserbase keys or saved context IDs. Configure them in the function runtime or local
shell before publishing/invoking:

```bash
export BROWSERBASE_API_KEY=<browserbase-api-key>
export SQUARE_CLIENT_PACKAGES_CONTEXT_ID=<saved-square-context-id>
export SQUARE_CUSTOMER_NOTES_CONTEXT_ID=<saved-square-context-id>
```

Use `.env.example` as the local template. `.env` and generated `results/` output are intentionally ignored.

## Output

Each function returns a small JSON metadata result because function results are size-limited. The CSV is
written to the Browserbase session's downloads and retrieved with the Downloads API.

Example result:

```json
{ "ok": true, "sessionId": "<id>", "filename": "services.csv", "rows": 36, "zipBytes": 2724 }
```

Fetch the generated CSV bundle:

```bash
curl -s "https://api.browserbase.com/v1/sessions/<sessionId>/downloads" \
  -H "x-bb-api-key: $BROWSERBASE_API_KEY" \
  -o out.zip
unzip out.zip
```

## Usage

Install with the locked dependency set:

```bash
npm ci
npm run typecheck
```

Publish the login functions and run login once to create or refresh a Square context:

```bash
browse functions publish functions/login-start.ts --api-key "$BROWSERBASE_API_KEY"
browse functions invoke <login-start-id> --params '{}' --api-key "$BROWSERBASE_API_KEY"

# Open the returned liveViewUrl, sign in to Square, then finish the context.
browse functions publish functions/login-finish.ts --api-key "$BROWSERBASE_API_KEY"
browse functions invoke <login-finish-id> \
  --params '{"sessionId":"<id>","contextId":"<id>"}' \
  --api-key "$BROWSERBASE_API_KEY"
```

Invoke a workflow by passing the saved context through `sessionCreateParams`. Workflow `params` stay empty:

```bash
browse functions publish functions/services-list.ts --api-key "$BROWSERBASE_API_KEY"

curl -s -X POST "https://api.browserbase.com/v1/functions/<function-id>/invoke" \
  -H "x-bb-api-key: $BROWSERBASE_API_KEY" \
  -H "content-type: application/json" \
  -d '{"params":{},
       "sessionCreateParams":{"browserSettings":{"context":{"id":"<contextId>","persist":false}}}}'
```

## Schema Notes

Columns are left blank when the selected Square API path does not expose that field:

- `customer-list`: marketing consent flags
- `products`: stock count / low quantity
- `reviews`: client email
- `unavailabilities`: location name
- `customer-notes`: client email / phone and note author

## Status

The 9 deterministic workflows plus login were validated end-to-end during the POC. `customer-notes` reliably
downloads Square's native notes export, but schema-mapping that export to `client-notes.csv` still needs a
zip-reader fix in `shared/deliver.ts`.

## Safety

- Keep Browserbase API keys and context IDs in runtime env or the team password manager.
- Do not commit generated CSV exports; they can contain customer-like names, emails, phone numbers, and
  account-specific context IDs.
- Rotate any Browserbase key that was previously committed in an older version of this branch.

## Appointment timestamp export

Appointment start and end timestamps must be ISO date-times with an explicit `Z` or numeric `±HH:MM` offset. The exporter converts the start instant to UTC before formatting the existing `YYYY-MM-DD HH:mm GMT` column. For example, `2026-09-05T10:00:00-07:00` becomes `2026-09-05 17:00 GMT`.

Missing, timezone-free, malformed, or invalid calendar timestamps fail the export before CSV delivery. The unknown-offset notation `-00:00` is rejected. No timezone is inferred from the host, business address, or client. A bad row prevents the whole appointment CSV from being delivered; correct the source timestamp and rerun.

The existing minute-resolution CSV format omits seconds from the displayed start time. Durations use the parsed start/end instants and retain the existing nearest-minute rounding; positive durations shorter than 30 seconds round to zero minutes, while equal or reversed endpoints retain an empty duration. Fractional seconds are truncated to milliseconds. Recurrence rules are copied unchanged: this conversion does not establish correct recurring-series timezone or DST semantics. Other export formats are outside this appointment-specific change.

Run `node --test tests/appointment-time.test.mjs` with Node 24. The 28 synthetic cases cover offsets, UTC day/year rollover, leap days, DST elapsed duration, invalid inputs, and the actual handler's refusal to deliver invalid rows. They pass in the local timezone and with `TZ=UTC`; the schema also passes an isolated TypeScript check. No real appointment records, sessions, migration API calls, or CSV deliveries were used.

## Product extraction completeness

Products are delivered only after both ITEM and CATEGORY catalog enumerations finish with successful HTTP responses and validated object arrays. Empty arrays are accepted as a completed empty source; missing arrays, error payloads, malformed catalog objects, failed pages, repeated cursors or the 1,000-page bound reject the extraction. The handler requires `complete: true` before CSV delivery, so a legacy `{rows: []}` alone is no longer sufficient.

Run `node --test tests/products-extraction.test.mjs` with Node 24. These 20 synthetic tests execute the actual browser expression and handler boundary with mocked requests. Successful enumeration establishes source completeness under this response contract, not price accuracy, inventory completeness or live API compatibility. No real catalog records, browser sessions or exports were used.

## Package extraction completeness

Both package paths require `complete: true` and a validated customer-probe count before delivering mapped CSV. The token-sourced path requires every supplied customer to finish; the standalone path requires complete customer enumeration with a stable total. Catalog pages must also complete, and every returned pack must resolve to its catalog pricing rule and service names. A failed customer request does not count as a successfully probed customer.

HTTP failures, malformed protobuf, missing or conflicting identities, unresolved catalog references, repeated cursors and pagination bounds fail the extraction. No partial rows are delivered as a completed result. A successful zero-byte credit-pack protobuf response represents an empty pack list for that customer under the supported response contract.

The internal protobuf schema and live pagination envelope are not independently verified. Unknown credit-pack envelope fields are rejected explicitly, including possible error or continuation fields; they are not silently treated as an empty or complete result. If the service returns a different envelope, verify that contract and extend the parser before retrying. Local fixture checks do not establish live API compatibility or prove the correctness of a previously downloaded customer export.

Run `node --test tests/packages-extraction.test.mjs` for the 31 package regression cases. They execute both browser expressions and both delivery gates with synthetic catalog/protobuf/HTTP fixtures, including complete-empty results, later-page failures, partial customer failures, malformed wire data, and invalid completion counts. The product and package callers also pass an isolated check against their declared SDK types; this does not establish a fresh dependency install or deployed Functions compatibility.

## Confirming mapped CSV delivery

`deliverCsv` first reads a valid session archive and requires the requested filename to be absent. It then triggers the CSV download and polls until exactly one entry with that basename has exactly the expected UTF-8 bytes. An unrelated raw export, wrong content, duplicate basenames, or a corrupt/incomplete archive cannot confirm delivery. If the target filename already exists, use a fresh session or a unique filename; the helper does not treat an older matching file as a new download.

Each polling phase defaults to 90 seconds with a three-second interval. Requests use the remaining deadline, disable SDK retries within that request, and are aborted when the attempt ends. Archive reads are streamed and bounded for both the SDK's Node stream and native Web streams. A timeout leaves delivery unconfirmed; it does not prove that a remote download will never finish.

The dependency-free ZIP reader supports classic single-disk stored/deflated archives and data descriptors. It validates central/local headers, sizes, CRCs, and paths before exposing files. Limits are 25 MiB compressed archive, 20 MiB per expanded entry, 50 MiB total expansion, and 1,000 entries. ZIP64, encrypted entries, unsupported encodings/methods, unsafe paths and ambiguous duplicates are rejected. Native-export suffix selection also requires exactly one matching file; it never falls back to an unrelated entry.

Run `node --test tests/delivery.test.mjs` with Node 24 for the 34 local delivery/ZIP regressions, including the actual customer-notes handler. Fixtures cover stale archives, exact content, descriptors, corruption, limits, streamed responses and request cancellation. Additional Python-standard-library ZIP smoke fixtures passed for stored/deflated and descriptor variants. No real session downloads or customer archives were read. Successful byte verification establishes that the requested artifact is available in that archive; source-data completeness and live provider compatibility remain separate checks.
