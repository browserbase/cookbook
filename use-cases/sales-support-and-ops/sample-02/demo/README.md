# Mortgage rate table extraction

This script opens a visible local browser, visits the Bankrate mortgage rate search configured in `mortgage-rates.js`, and uses Stagehand with `openai/gpt-4o` to extract visible lender rows into a local JSON file.

## Setup and run

Use Node.js 22 or newer. Work inside this recipe directory and install its dependencies with the cookbook's seven-day release age policy:

```bash
pnpm --config.minimumReleaseAge=10080 install
cp .env.example .env
```

Set `OPENAI_API_KEY` in `.env` to a key with access to the configured OpenAI model. It is required and checked before launching the browser. This implementation uses `localBrowser.launch({ headless: false })`; it does not use a Browserbase session or require Browserbase credentials. A browser installation supported by Stagehand's local launcher is also required.

```bash
pnpm start
```

The start command uses Node's `--env-file=.env` option, so the copied file must exist. To use an already exported environment instead, run `node mortgage-rates.js` directly. Neither command switches providers automatically.

## Output and failure behavior

A successful extraction writes `mortgage-rates-results.json` in the working directory. Its shape is:

```json
{
  "lenders": [
    {
      "name": "Synthetic lender",
      "loanType": "Illustrative loan type",
      "rate": "Illustrative displayed rate"
    }
  ]
}
```

Each lender can include `name`, `loanType`, `rate`, `apr`, `payment`, `points`, `costs`, and `rating`, all optional strings. An empty `lenders` array is possible. Values reflect what the extraction returned from the visible page; the script does not verify offers, completeness, eligibility, or numeric values independently.

The file is first written to a unique temporary file with owner-only permissions, then renamed over the previous result. A failed extraction or write leaves an existing result untouched, so a file left after a failed run may belong to an earlier run. Output and temporary files are ignored by Git. The script prints progress and the output filename, rather than the extracted rows.

Configuration, browser, extraction, filesystem, and cleanup failures cause a nonzero CLI exit status. Both browser and Stagehand cleanup are attempted when allocated. A cleanup failure can happen after the new file was saved; the exit status describes the whole run, not just persistence.

## Change the search or model

Edit the Bankrate URL in `mortgage-rates.js` to choose the intended loan, property, and location criteria before running. Its existing query is a fixed example, not caller-specific input. The script clicks the “Skip and show me rates” link and extracts the visible table, so page changes may require adapting those instructions.

To change the model, update `model.modelName` and pass the matching provider key in `model.apiKey`. The current script explicitly reads `OPENAI_API_KEY`; a Google key alone will not configure it. There is no `env: LOCAL/BROWSERBASE` toggle in this implementation.

## Local verification

```bash
pnpm test
```

Tests execute the script with synthetic Stagehand/browser responses and real temporary filesystem writes. They cover saved JSON and permissions, missing-key preflight, initialization/extraction/write/rename/cleanup failures, preservation of previous output, and the CLI failure status. They do not launch a browser, call a model, or validate live mortgage data. A fresh dependency installation and a live extraction are separate verification steps.
