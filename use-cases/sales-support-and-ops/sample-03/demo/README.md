# Sample Organization form-processing example

Detects form fields and uses CSV input to query a registry website. `index.ts` selects the target URL and CSV paths; `find_fields.ts` and `pull_data.ts` perform the work.

## Setup

Run commands from this recipe directory. Use Node.js 22.18 or later and an installed Chrome browser for local mode. Stagehand v4 uses system Chrome for local runs; Browserbase runs do not require a local browser. See the [Browserbase migration guide](https://www.browserbase.com/blog/playwright-to-stagehand-migration).

```bash
npm install
test -f .env || cp .env.example .env
```

Edit `.env` before starting. The current [stagehand.config.ts](stagehand.config.ts) uses:

| Setting | Current value |
| --- | --- |
| Browser launcher | Local Chrome with a visible window |
| Stagehand model | `openai/gpt-4o` |
| Model key | `OPENAI_API_KEY` |

For Browserbase, also set `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID`. Local mode still needs the configured model key. The package's `postinstall` script invokes `playwright install`; that inherited script does not replace the system-Chrome prerequisite for Stagehand v4.

After configuring the browser and keys:

```bash
npm run build
npm run start
```

## Choose the browser

`StagehandConfig` is an async factory consumed by `Stagehand.create(...)` in `index.ts`. In `stagehand.config.ts`, replace the entire `browser` property with one of these blocks. Both launcher imports are already present.

Local Chrome:

```ts
browser: await localBrowser.launch({
  headless: false,
  viewport: { width: 1024, height: 768 },
}),
```

Browserbase:

```ts
browser: await browserbase.launch({
  apiKey: process.env.BROWSERBASE_API_KEY!,
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
}),
```

Browser selection happens through the launcher that returns the `browser` handle.

## Choose the model

Replace the `model` object in `stagehand.config.ts`, keeping the provider's model identifier and key together. For example, to supply an Anthropic model, set `STAGEHAND_MODEL` to a supported provider-qualified identifier and `ANTHROPIC_API_KEY` to its key in `.env`, then use:

```ts
model: {
  modelName: process.env.STAGEHAND_MODEL!,
  apiKey: process.env.ANTHROPIC_API_KEY,
},
```

The model settings live directly under `model` in the returned configuration object.

`find_fields.ts` also creates an OpenAI client and uses `gpt-4o-mini`. Keep `OPENAI_API_KEY` for that separate call even if you change the Stagehand provider. To change that call too, update its client and model in `find_fields.ts`.

## Input and output

`index.ts` writes discovered fields to `csv_files/output_fields.csv`, reads `csv_files/rcp_user_input_data.csv`, and writes results to `csv_files/rcp_results.csv`. Review the input and target before running. Keep customer input and generated results private.

## Verification status

These instructions match the inspected configuration and package scripts. They do not establish that dependency installation, provider access, authentication, or the target-site workflow succeeds. Keep this customer-derived example and its artifacts private until separately reviewed for publication.

## CSV contract

The lookup accepts a CSV header and exactly one lookup record. Input parsing uses the already declared `fast-csv` dependency, preserving quoted commas, embedded line breaks, escaped quotes, Unicode, empty fields and significant whitespace. A UTF-8 BOM is accepted. Column names must be nonempty and unique, and the record width must match the header. Missing input, malformed quoting and multiple records fail before browser navigation. Multiple records are rejected explicitly because this workflow performs one lookup; they are not silently truncated to the first record.

The output follows the extracted column order, regardless of object property order. Every row must supply a string for every column. All fields are quoted with escaped internal quotes and CRLF record separators, including empty single-column values. A valid empty table still writes its header. Blank physical records are not silently discarded; use an explicitly quoted empty field for a one-column empty value. Input variables and extracted tables are no longer printed, and importing `pull_data.ts` no longer loads dotenv configuration; the application entrypoint owns configuration.

Run `node --test tests/csv-data.test.mjs` on Node 24 after installing this recipe’s dependencies. For isolated verification, `FAST_CSV_MODULE_PATH` and `ZOD_MODULE_PATH` can select existing installed modules. All 16 tests passed using actual fast-csv 5.0.7 and Zod, including the actual lookup function with synthetic files and mocked browser/model calls. Its scoped TypeScript check also passes against installed SDK types. The original lookup fails the retained quoted-input regression. fast-csv was installed in a temporary directory with the seven-day release-age policy and lifecycle scripts disabled; no full recipe installation, browser download, customer CSV read or live registry lookup was performed.
