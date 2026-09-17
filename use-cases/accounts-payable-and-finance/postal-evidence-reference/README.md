# postal-service-postmark-proof

Prototype for synthetic filing service: automatically capture a postal service tracking-page
screenshot as PDF proof that an 83(b) filing was postmarked.

Rebuilds the service filing service abandoned due to postal service anti-bot measures, with
[Browserbase](https://browserbase.com) as the browser layer:

1. When an 83(b) filing is postmarked, call the service with the filing id +
   postal service certified-mail tracking number.
2. The service opens a Browserbase **verified** session (residential proxies,
   CAPTCHA solving) and navigates to the postal service tracking page.
3. Clicks **"See All Tracking History"** to expand the full event timeline.
4. Validates a `.tb-step` event in the timeline shows a postmark event and
   verifies the page is displaying the requested tracking number — a physical acceptance scan
   ("Accepted at postal service Facility", "postal service in possession of item", …).
   Pre-shipment events deliberately do **not** count.
5. Renders the page to PDF (print rendering; falls back to a full-page
   screenshot wrapped in a PDF).
6. Saves the PDF to `./out/<filing_id>/<file_id>.pdf` (stand-in for S3) and
   appends a `postmark_screenshot.captured` event to `out/events.jsonl` —
   the payload an Atlas consumer would ingest to attach the proof.

Deterministic by design: plain Playwright selectors, no LLM in the loop.
Every run is replayable in the Browserbase dashboard (`session_replay` in the
result/event) for auditability.

The fix, two tiers, both automatic:

1. **In-session reload.** On a blank page, wait a few seconds for the sensor
   to validate, then reload — the re-fired XHR carries a now-valid cookie and
   returns the timeline. Measured lift: **~1/4 single-shot → ~3/5** within one
   session.
2. **Fresh session.** If reloads are exhausted, the CLI retries in a new
   session (new IP + fingerprint), which clears sessions Akamai never
   validated. Compounded, effective success is **~90%+**.

Things that did **not** help (measured, not assumed): a homepage
"type-into-search" warm-up (added 30–60s latency, no lift — removed), and
`verified` (0/4 in testing). The winning lever was matching the retry
to the actual failure mode.

## Run

```bash
export BROWSERBASE_API_KEY=...

npm ci
npm test
npm start -- --tracking 92071902358909000032243561 --filing-id filing_demo_001
```

Flags:

- `--tracking <number>` — postal service tracking number (required)
- `--filing-id <id>` — filing identifier carried through to the event (default: generated)
- `--retries <n>` — max attempts; each retry is a fresh session = fresh proxy IP (default: 2)

Result JSON includes the extracted postmark event, latest status, PDF path,
and the session replay URL:

```json
{
  "ok": true,
  "filingId": "filing_demo_001",
  "fileId": "file_postal-service_32243561_...",
  "pdfPath": "out/filing_demo_001/file_postal-service_32243561_....pdf",
  "postmarkEvent": "Accepted at postal service Facility — NORTHWEST ROCHESTER NY DISTRIBUTION CENTER — May 27, 2025 6:34 PM",
  "latestStatus": "Your item was delivered to the front desk ...",
  "sessionReplayUrl": "https://www.browserbase.com/sessions/<id>",
  "durationMs": 8537
}
```

See `sample/captured-postmark-proof.pdf` for a checked-in example of the generated proof artifact.

## Failure modes

Failures include a stable `failureCode` and a human-readable `failureReason`.
The CLI opens a fresh session only for `anti_bot_blocked`,
`tracking_widget_timeout`, and `capture_failed`. Missing tracking data or a
timeline without acceptance evidence is nonretryable for that invocation.

- `tracking_widget_timeout` — the tracking widget never rendered after reloads;
  the
  sensor never validated this session even after in-session reloads; the CLI
  escalates to a fresh session automatically.
- `anti_bot_blocked` — hard Access Denied.
- `tracking_not_found` — expired or not yet in system.
- `tracking_identity_mismatch` — the visible record is not the requested one.
- `postmark_not_found` — no scoped timeline event proves acceptance;
  re-poll later.

## Production notes

- Swap the `writeFile` in `service.ts` for `s3.putObject` and the JSONL append
  for the real event bus.
- postal service retains certified-mail tracking data well past delivery (the May 2025
  sample number still resolved in July 2026), so re-captures are possible.
