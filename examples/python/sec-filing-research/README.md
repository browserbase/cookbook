# Stagehand + Browserbase: SEC Filing Research

Stagehand is the SDK for browser agents.

## AT A GLANCE

- Goal: automate searching SEC EDGAR for a company and extracting recent filing metadata (type, date, description, accession number, file number).
- Search: uses one `CompanyTarget` containing the expected company name and CIK, with an optional name, ticker, or CIK search query.
- Data Extraction: uses Stagehand act/extract with Pydantic schemas to navigate SEC.gov and pull structured filing data.
- Output: company name, CIK, and a configurable number of most recent filings, printed as summary and JSON.

## GLOSSARY

- act: perform UI actions from a natural language prompt (click, type, submit).
  Docs → https://docs.stagehand.dev/v4/basics/act
- extract: pull structured data from web pages into validated objects using a JSON schema.
  Docs → https://docs.stagehand.dev/v4/basics/extract
- schema: JSON schema definition for filing and company info; enforces types and validation.
- SEC EDGAR: SEC’s company and filing search and filing system.
  https://www.sec.gov/edgar/searchedgar/companysearch.html
- CIK: Central Index Key — unique numeric identifier for each company in EDGAR.

## QUICKSTART

1. cd python/sec-filing-research
2. Install dependencies with uv:

   ```bash
   uv sync
   ```

   Or with pip in a venv:

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -e .
   ```

3. cp .env.example .env
4. Add BROWSERBASE_API_KEY to .env
5. (Optional) Edit `TARGET_COMPANY` and `NUM_FILINGS` in `main.py`. Keep the company name, expected CIK, and optional search alias together.
6. Run the script:

   ```bash
   python main.py
   ```

   Or with uv:

   ```bash
   uv run python main.py
   ```

## EXPECTED OUTPUT

- Initializes the owned Browserbase and Stagehand handles
- Navigates to SEC EDGAR company search
- Enters search query, submits, and selects the matching company
- Requires the SEC company-page URL to identify the configured CIK
- Extracts company name and CIK and rejects a missing or different CIK before reading filings
- Extracts the N most recent filings (type, date, description, accession number, file number)
- Includes both the requested company identity and observed company header in the JSON output
- Outputs full result as JSON
- Closes session cleanly

## COMMON PITFALLS

- "ModuleNotFoundError": run `uv sync` or `pip install -e .` in sec-filing-research
- Missing credentials: ensure .env has BROWSERBASE_API_KEY
- No company match: use a valid company name, ticker, or CIK; SEC search is case-sensitive for some queries
- Extraction errors: if SEC changes its UI, inspect the session and adjust the act/extract prompts
- Rate limiting: avoid excessive runs; SEC may throttle heavy or automated traffic

## USE CASES

• Compliance and due diligence: quickly pull recent 10-K, 10-Q, 8-K metadata for a list of companies.
• Research pipelines: feed accession numbers into downstream tools to fetch full filings or parse specific sections.
• Monitoring: periodically extract latest filings for watchlists and alert on new filings.
• Data enrichment: attach official company name and CIK to internal records using SEC as source of truth.

## NEXT STEPS

• Parameterize search: accept a complete `CompanyTarget` and `NUM_FILINGS` from a CLI or configuration file for batch runs.
• Fetch full filings: use accession numbers with SEC’s full-text filing URLs or APIs to download documents.
• Multiple companies: loop over a list of tickers/names and aggregate results into a single report or JSON.
• Filter by type: restrict to 10-K/10-Q/8-K or other form types in the extract step or in post-processing.

## HELPFUL RESOURCES

📚 Stagehand Docs: https://docs.stagehand.dev/v4/first-steps/introduction
🎮 Browserbase: https://www.browserbase.com
💡 Try it out: https://www.browserbase.com/playground
🔧 Templates: https://www.browserbase.com/templates
📧 Need help? support@browserbase.com
💬 Discord: http://stagehand.dev/discord

## Company identity

Configure one target, for example:

```python
TARGET_COMPANY = CompanyTarget(
    name="Apple Inc",
    cik="0000320193",
    search_query="AAPL",  # Optional; defaults to the configured name.
)
```

When changing companies, supply that company's name and verified CIK together. A search alias does not change the expected identity. The same target supplies the result-selection prompt and direct EDGAR URL. If search navigation does not reach a company page, the runner explicitly reports navigation to the configured CIK. A company page for a different CIK fails instead of silently switching companies. Leading-zero differences are normalized; missing extracted identifiers are never filled from configuration.

Run `python3 -B -m unittest discover -s tests -v`. Six suites exercise the actual identity validators and main function with synthetic companies and SDK responses, including a non-Apple target, search failure, wrong-page CIK, empty header CIK, and cleanup. No SEC query or model request is performed. These checks establish configuration and returned-identifier consistency, not independent verification of the model's extracted filing contents.
