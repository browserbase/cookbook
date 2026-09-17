# SF business-code lookup

This recipe searches San Francisco's business registry, extracts business/NAICS information, and asks an OpenAI classifier to select up to three MCC codes from a local reference CSV. These are model suggestions, not independently verified classifications.

## Setup

Use Node.js 22 or newer, and work in this recipe directory:

```bash
pnpm --config.minimumReleaseAge=10080 install
cp .env.example .env
```

Set `BROWSERBASE_API_KEY`, `GOOGLE_API_KEY`, and `OPENAI_API_KEY`. The current Stagehand primitive model is `google/gemini-3.6-flash`; the outer browser agent and classifier use OpenAI. Keys are checked for presence before browser allocation; this does not verify account access or model availability. The start command loads the copied `.env` with Node's `--env-file` option.

Provide your own authorized `mcc_codes.csv` in this working directory. Do not commit proprietary or sensitive reference data. The required six-column header order is:

```csv
mcc,edited_description,combined_description,usda_description,irs_description,irs_reportable
1234,"Synthetic category, illustration",,Synthetic description,,Yes
```

The row above is a parsing example, not an MCC recommendation. Header names are case-insensitive and separators are normalized. Every record must have six fields, a unique four-digit code, and at least one description. The parser preserves empty fields, leading-zero codes, quoted commas, escaped quotes, multiline fields, and a UTF-8 BOM. Empty, malformed, duplicate, or missing references fail before browser work. The complete validated reference is sent to the classifier; ensure it fits the selected model's context.

## Run

```bash
pnpm start "Business Name"
```

The workflow opens the registry, runs the browser search, and requires the agent to report completion before extracting business details. It then classifies against the local CSV. It does not download an MCC database from GitHub.

A successful classifier response must be HTTP-successful, have a completed model response, and contain a JSON array of zero to three unique reference codes with nonempty reasoning. Code descriptions and reporting fields are copied from the CSV, not trusted from model text. Unknown codes, malformed output, truncation, network errors, and unsuccessful browser searches fail the lookup. A valid `[]` means the classifier selected no matching code; it is not used to represent a service failure.

The CLI prints the business and classification summary. Successful execution exits zero; lookup or cleanup failure exits nonzero. The browser agent's completion signal and model-extracted fields remain observations, not independent proof of business identity or code accuracy.

## Local checks

```bash
pnpm test
```

Tests use the actual CSV parser and workflow with synthetic reference data, HTTP responses, and browser stubs. They cover quoted/empty CSV fields, invalid references, unknown or duplicate selections, malformed and failed classifier responses, valid no-match, unsuccessful search propagation, and CLI exit status. Scoped installed-SDK type checking also passes. No customer CSV, live provider, or cloud browser is used by these checks; a fresh full dependency installation and live workflow remain separate verification steps.
