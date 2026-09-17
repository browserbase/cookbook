# Stagehand + Browserbase: Download Apple's Quarterly Financial Statements

## AT A GLANCE

- Goal: automate downloading Apple's quarterly financial statements (PDFs) from their investor relations site.
- Download Handling: Browserbase automatically captures PDFs opened during the session and bundles them into a ZIP file.
- Retry Logic: polls Browserbase downloads API with configurable timeout to ensure files are ready before retrieval.
- Live Debugging: the session can be monitored from the Browserbase Sessions dashboard without logging a signed URL.

## GLOSSARY

- act / extract: navigate investor relations semantically and discover the intended statement URLs
  Docs → https://docs.stagehand.dev/v4/basics/extract
- downloads API: retrieve files downloaded during a Browserbase session as a ZIP archive
  Docs → https://docs.browserbase.com/features/screenshots#pdfs
- live view: real-time browser debugging interface for monitoring automation
  Docs → https://docs.browserbase.com/features/session-live-view

## QUICKSTART

Use pnpm **10.24.0**, as declared in `package.json`. Run these steps from the cookbook root.

1. `cd examples/typescript/download-financial-statements`
2. pnpm install
3. cp .env.example .env
4. Add your Browserbase API key to .env
5. pnpm start

## EXPECTED OUTPUT

- Initializes Stagehand session with Browserbase
- Uses `act()` to navigate from Apple.com to the FY2025 investor statements
- Discovers the FY2025 Financial Statements PDF URLs
- Opens each statement to trigger Browserbase downloads
- Polls Browserbase API until downloads are ready
- Saves all PDFs as `downloaded_files.zip` in current directory
- Displays Stagehand metrics and closes cleanly

## COMMON PITFALLS

- "Cannot find module": ensure all dependencies are installed
- Missing credentials: verify .env contains BROWSERBASE_API_KEY
- Download timeout: increase `retryForSeconds` parameter if downloads take longer than 45 seconds
- Empty ZIP file: ensure PDFs were actually triggered (inspect the session in the Browserbase dashboard)
- Network issues: check internet connection and Apple website accessibility

## USE CASES

• Financial reporting automation: Download quarterly/annual reports from investor relations sites for analysis, archiving, or compliance.
• Document batch retrieval: Collect multiple PDFs (contracts, invoices, statements) from web portals without manual clicking.
• Scheduled data collection: Run on cron/Lambda to automatically fetch latest financial filings or regulatory documents.

## NEXT STEPS

• Generalize for other sites: Adapt URL/link matching and support multiple companies or document types.
• Parse downloaded PDFs: Unzip, OCR/parse text (PyPDF2/pdfplumber), and load into structured format (CSV/DB/JSON).
• Add validation: Check file count, sizes, naming conventions; alert on failures; retry missing quarters.

## HELPFUL RESOURCES

📚 Stagehand Docs: https://docs.stagehand.dev/v4/first-steps/introduction
🎮 Browserbase: https://www.browserbase.com
💡 Try it out: https://www.browserbase.com/playground
🔧 Templates: https://www.browserbase.com/templates
📧 Need help? support@browserbase.com
💬 Discord: http://stagehand.dev/discord

## Archive completeness and local verification

`statements.json` records the official FY2025 Q1–Q4 PDF URLs, byte lengths, and SHA-256 hashes. `archive-validation.ts` uses `adm-zip` to read ZIP members and verify their CRC and exact contents. Four distinct reference PDFs are required before `downloaded_files.zip` is saved; Browserbase's timestamped filenames do not affect matching. Empty and partial snapshots keep polling. Changed, duplicate, non-PDF, corrupt, or unsafe members fail. Compressed and expanded data are limited to 32 MiB.

URL preflight requires four identified FY2025 statement filenames, one per quarter, on the listed Apple hosts or Apple's Q4 CDN account. It preserves supported aliases and query strings and orders the links Q4 through Q1. Review official revisions before deliberately updating the hash references. Current investor-page link extraction and live Browserbase PDF capture remain unverified.

Polling is serialized. Each request and body read shares a deadline abort signal; partial or late responses cannot write the archive. A timeout reports observed coverage rather than claiming completion.

Run `pnpm test` with Node.js 24. Fifteen tests cover the actual ZIP validator and polling function with synthetic inputs, including empty/partial/complete archives, duplicate or changed documents, URL coverage, late responses, and aborted body reads. A scoped check against Stagehand 4.0.2 and Browserbase SDK 2.19.1 declarations also passed. The ZIP dependency installed independently under the existing release-age policy; this is not a full recipe installation or live workflow test.
