# Stagehand + Browserbase: Download Apple's Quarterly Financial Statements

Stagehand is the SDK for browser agents.

## AT A GLANCE

- Goal: automate downloading Apple's quarterly financial statements (PDFs) from their investor relations site.
- Download Handling: Browserbase automatically captures PDFs opened during the session and bundles them into a ZIP file.
- Retry Logic: polls Browserbase downloads API with configurable timeout to ensure files are ready before retrieval.
- Live Debugging: the session remains available in the Browserbase Sessions dashboard without logging a signed URL.

## GLOSSARY

- act: perform UI actions from a prompt (click, scroll, navigate)
  Docs → https://docs.stagehand.dev/v4/basics/act
- downloads API: retrieve files downloaded during a Browserbase session as a ZIP archive
  Docs → https://docs.browserbase.com/features/screenshots#pdfs
- live view: real-time browser debugging interface for monitoring automation
  Docs → https://docs.browserbase.com/features/session-live-view

## QUICKSTART

1. `cd examples/python/download-financial-statements`
2. `uv sync --python 3.11`
3. `cp .env.example .env` and add your Browserbase API key
4. `uv run python main.py`

## EXPECTED OUTPUT

- Initializes Stagehand session with Browserbase
- Navigates to Apple.com → Investors section
- Locates Q1-Q4 2025 quarterly earnings reports
- Clicks each Financial Statements PDF link (triggers downloads)
- Polls Browserbase API until downloads are ready
- Saves all PDFs as `downloaded_files.zip` in current directory
- Displays session history and closes cleanly

## COMMON PITFALLS

- Import errors: run `uv sync --python 3.11` in this recipe directory, then use `uv run python main.py`
- Missing credentials: verify .env contains BROWSERBASE_API_KEY
- Download timeout: increase `retry_for_seconds` parameter if downloads take longer than 45 seconds
- Empty ZIP file: ensure PDFs were actually triggered (check live view link to debug)
- Network issues: check internet connection and Apple website accessibility

## USE CASES

• Financial reporting automation: Download quarterly/annual reports from investor relations sites for analysis, archiving, or compliance.
• Document batch retrieval: Collect multiple PDFs (contracts, invoices, statements) from web portals without manual clicking.
• Scheduled data collection: Run on cron/Lambda to automatically fetch latest financial filings or regulatory documents.

## NEXT STEPS

• Generalize for other sites: Extract URL patterns, adapt act() prompts, and support multiple companies/document types.
• Parse downloaded PDFs: Unzip, OCR/parse text (PyPDF2/pdfplumber), and load into structured format (CSV/DB/JSON).
• Add validation: Check file count, sizes, naming conventions; alert on failures; retry missing quarters.

## HELPFUL RESOURCES

📚 Stagehand Docs: https://docs.stagehand.dev/v4/first-steps/introduction
🎮 Browserbase: https://www.browserbase.com
💡 Try it out: https://www.browserbase.com/playground
🔧 Templates: https://www.browserbase.com/templates
📧 Need help? support@browserbase.com
💬 Discord: http://stagehand.dev/discord

## Archive completeness

`statements.json` pins the four FY2025 PDFs retrieved from Apple's official newsroom URLs, with their byte lengths and SHA-256 hashes. `archive_validation.py` reads ZIP members in memory and matches their contents to those references. Browserbase's timestamped filenames do not affect matching. An empty or partial archive keeps polling; only four distinct matching quarters permit a write to `downloaded_files.zip`. Unknown or changed content, duplicate quarters, corrupt archives, and unsafe member paths fail validation. Compressed and expanded data are limited to 32 MiB.

URL preflight requires one recognized FY2025 statement filename per quarter on the listed Apple hosts or Apple's Q4 CDN account, and orders the observed URLs Q4 through Q1. Supported host aliases and query strings are preserved. Revised PDF bytes fail verification. Review official source changes before deliberately refreshing these references. Investor-page URL compatibility and live Browserbase capture have not yet been verified.

Run `python3 -B -m unittest discover -s tests -v` in this recipe directory. Seven local suites use synthetic ZIPs and PDF byte fixtures to check completeness, integrity, URL coverage, partial-to-complete polling, timeout, and late responses. They execute the actual validator and polling function without provider calls. Polling is serialized; a network request can outlast the polling deadline, but a response observed after that deadline cannot write the archive. The TypeScript sibling independently validates ZIP contents and aborts pending reads at its polling deadline.
