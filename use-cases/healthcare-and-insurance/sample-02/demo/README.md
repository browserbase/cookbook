# 🤘 Welcome to Stagehand!

Hey! This is a project built with [Stagehand](https://github.com/browserbase/stagehand).

You can build your own web agent using: `npx create-browser-app`!

## Setting the Stage

Stagehand is an SDK for automating browsers. It's built on top of [Playwright](https://playwright.dev/) and provides a higher-level API for better debugging and AI fail-safes.

## Curtain Call

Get ready for a show-stopping development experience. Just run:

```bash
npm install && npm start
```

## What's Next?

### Add your API keys

Required API keys/environment variables are in the `.env.example` file. Copy it to `.env` and add your API keys.

```bash
cp .env.example .env && nano .env # Add your API keys to .env
```

### Custom .cursorrules

We have custom .cursorrules for this project. It'll help quite a bit with writing Stagehand easily.

### Run on Browserbase

To run on Browserbase, add your API keys to .env and change `env: "LOCAL"` to `env: "BROWSERBASE"` in [stagehand.config.ts](stagehand.config.ts).

### Use Anthropic Claude 3.5 Sonnet

1. Add your API key to .env
2. Change `modelName: "gpt-4o"` to `modelName: "claude-3-5-sonnet-latest"` in [stagehand.config.ts](stagehand.config.ts)
3. Change `modelClientOptions: { apiKey: process.env.OPENAI_API_KEY }` to `modelClientOptions: { apiKey: process.env.ANTHROPIC_API_KEY }` in [stagehand.config.ts](stagehand.config.ts)

## CSV input validation

Create `test_cases.csv` in this recipe's working directory. The required, case-sensitive columns are `Site`, `FirstName`, `LastName`, and `LicenseNumber`. Every nonblank record needs all four values. License numbers stay strings, including leading zeroes. Additional columns are preserved for the lookup prompt. If supplying CAPTCHA selectors, provide both `CaptchaImage` and `CaptchaInput`, or leave both blank.

Synthetic example:

```csv
Site,FirstName,LastName,LicenseNumber
https://example.com/license-search,Ada,Example,00123
```

Replace the example URL with your intended licensing lookup page. Targets must start with `http://` or `https://` and cannot contain credentials, whitespace, or backslashes. The parser supports quoted commas, escaped double quotes, multiline fields, CRLF, and a UTF-8 BOM. Completely blank records, including terminal newlines, are skipped.

The entire file is parsed and validated before creating the first browser session. Invalid headers, field counts, required values, URLs, or selector pairs stop the batch. Errors identify the physical line where a record ends without printing its contents. A header-only file performs no work.

After installing this package, run credential-free checks with Node 24:

```sh
node --test tests/license-records.test.cjs
```

These checks use synthetic CSV strings and the actual entrypoint's allocation loop with a stubbed session creator. They verify parsing and validation, not live licensing sites or Browserbase sessions.
