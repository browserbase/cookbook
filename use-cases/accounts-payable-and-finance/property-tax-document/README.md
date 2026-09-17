# County tax bill → AP platform

Fetch a property-tax PDF from a county portal, review its invoice fields, then attach it to a AP platform bill. The uploader requires a reviewed record tied to the exact PDF bytes; it has no fixed customer invoice or default document path.

## Install and fetch

```bash
npm install
npm test
cp .env.example .env
```

Configure the Browserbase and model credentials described in [stagehand/README.md](stagehand/README.md). The fetch implementations can be adapted to an authorized property search:

```bash
npm run fetch -- "YOUR PROPERTY SEARCH"
# Alternatively:
npm run fetch:agent
./fetch-bill.sh "YOUR PROPERTY SEARCH"
```

The existing fetchers write `~/Desktop/tax-bill.pdf`. Inspect the result and move or copy the selected document to a deliberate review location. Fetching a different property does not automatically create invoice metadata or authorize uploading it.

## Review the selected document

Copy [reviewed-bill.example.json](reviewed-bill.example.json) to a secure location outside this repository. Its values are synthetic and its incomplete review deliberately fails validation.

Open the selected PDF and fill every field from the document or verified payee information: vendor name/address/contact, invoice number, amount, currency, issue/due dates, property address, parcel and tax period. Keep identifiers as strings to preserve leading zeros. This uploader supports US vendor addresses and USD amounts with exactly two decimal places.

Compute the selected file's digest:

```bash
shasum -a 256 /absolute/path/to/selected-bill.pdf
```

Set `document.sha256` to that lowercase digest. After checking **all** fields against this exact document, enter the reviewer name and UTC timestamp such as `2026-09-07T12:00:00.000Z`, and set `confirmedFieldsMatchDocument` to `true`. Recheck the record and recompute the digest whenever the PDF changes. Store the reviewed JSON and PDF together privately.

This is a reviewer attestation tied to document bytes. The script validates field formats and the digest; it does not parse the PDF to independently establish its amount, ownership, invoice identity, or the truth of the review. Anyone able to edit the record can make a new attestation. The PDF header check is only a file-format sanity check.

## Upload the reviewed bill

Configure AP platform authentication using [.env.ap.example](.env.ap.example), then pass both explicit paths:

```bash
node upload-bill.mjs /absolute/path/to/selected-bill.pdf /absolute/path/to/reviewed-bill.json
```

Both files are required. Validation happens before authentication, vendor lookup, or bill creation. The JSON limit is 64 KiB and the PDF limit is 25 MiB. The uploader reads the PDF once, verifies its SHA-256 digest, and attaches that same buffer even if the source file subsequently changes. Both the bill memo and line-item memo derive from the reviewed property, parcel and tax period.

The default is `AP_ENV=sandbox` and `AP_BILL_MODE=draft`. Submitted mode requires both `AP_BILL_MODE=bill` and `AP_ALLOW_SUBMIT_BILL=true`; production requires `AP_ENV=production`. These flags change remote behavior. The local regression tests never contact AP platform or create a bill.

The current API flow selects the primary business entity (or the first returned entity), reuses a unique exact-name vendor match in the returned search page, or creates a vendor from the reviewed fields. That lookup does not independently verify an existing vendor's address or identity and is not a substitute for reviewing the target AP platform account. Adapt entity/vendor selection explicitly for accounts where those assumptions do not hold.

Bill creation and attachment are separate API operations. Attachment failure reports the created bill ID and stops; inspect that bill before retrying. A timeout or malformed creation response can also leave an unconfirmed remote result. The script does not implement idempotent retries or roll back remote bills. Do not rerun blindly and create a duplicate.

## Verification

```bash
node --test tests/reviewed-bill.test.mjs
```

Synthetic local tests cover metadata-to-request mapping, hash mismatch, invalid fields/dates/amounts, missing review, bounded files, changed PDFs, sandbox/draft defaults, explicit submitted mode, and attachment failure. They call the real uploader with a mocked HTTP transport and temporary fixture files. No real tax documents, credentials, AP platformI calls or bill writes were used. Full portal fetching and live AP platform compatibility remain unverified by these checks.

## Files

- [upload-bill.mjs](upload-bill.mjs): authenticated AP platform upload flow and explicit CLI inputs.
- [reviewed-bill.mjs](reviewed-bill.mjs): bounded reads, digest and reviewed-field validation.
- [reviewed-bill.example.json](reviewed-bill.example.json): deliberately incomplete synthetic review template.
- [stagehand/](stagehand/): controlled and agent-based portal fetchers.
- [fetch-bill.sh](fetch-bill.sh): existing Browserbase CLI fetcher.
