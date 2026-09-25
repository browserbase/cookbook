# Browserbase examples

Start with a standalone example in Python, TypeScript, or Go. These templates cover Browserbase APIs, browser frameworks, Stagehand agents, authentication, extraction, and research.

## Choose a starting point

- [First API and browser session in Python](python/getting-started-with-browserbase/).
- [First API and browser session in TypeScript](typescript/getting-started-with-browserbase/).
- [Saved sessions and MFA](../docs/topics/authentication.md).
- [Extraction and research](../docs/topics/extraction-and-research.md).
- [Human-in-the-loop agent app](typescript/agent-with-human-in-loop/).

## Install the selected example

Each template owns its dependency manifest. Open its cookbook guide below before installing anything. TypeScript templates may use npm or a pinned pnpm version. Python templates usually use `uv` with `pyproject.toml`. The Go example has its own `go.mod`.

Several modern TypeScript examples require Node 22.18 or newer and a specific pnpm version. Some code-mode examples use a Git-pinned integration package. Preserve their overrides. The `examples/package.json` tooling uses pnpm 9.0.0; run `pnpm install` from `examples/` only when working on that tooling. It does not install every recipe.

Copy the selected environment sample to a local `.env` only if one does not already exist, then fill the variables that the source requires. Some templates use Browserbase's model gateway; others require a separate provider credential. Read the code's configuration checks.

## What is preserved

The original `typescript/`, `python/`, and `go/` paths stay together. Source maintenance scripts remain under `scripts/`; upstream deployment workflows and hooks are excluded. The [original overview](UPSTREAM_README.md) is retained for context.

All entries below were inspected at their pinned source revision. Live website behavior and API access remain unverified for the imported collection. The [verification report](../docs/verification.md) separates repository checks from recipe execution.

## Recipes

<!-- recipes:start -->

| Recipe | Language | Type | Status | Collection |
| --- | --- | --- | --- | --- |
| [Hackernews (Go)](../docs/recipes/examples-go-hackernews.md) | go | runnable example | current / public | examples |
| [Amazon global price comparison (Python)](../docs/recipes/examples-python-amazon-global-price-comparison.md) | python | runnable example | current / public | examples |
| [Amazon product scraping (Python)](../docs/recipes/examples-python-amazon-product-scraping.md) | python | runnable example | current / public | examples |
| [Anthropic Claude browser agent (Python)](../docs/recipes/examples-python-anthropic-cua.md) | python | runnable example | current / public | examples |
| [Basic caching (Python)](../docs/recipes/examples-python-basic-caching.md) | python | runnable example | current / public | examples |
| [Basic CAPTCHA (Python)](../docs/recipes/examples-python-basic-captcha.md) | python | runnable example | current / public | examples |
| [Browserbase reducto (Python)](../docs/recipes/examples-python-browserbase-reducto.md) | python | runnable example | current / public | examples |
| [Business lookup (Python)](../docs/recipes/examples-python-business-lookup.md) | python | runnable example | current / public | examples |
| [Cartesia form filling (Python)](../docs/recipes/examples-python-cartesia-form-filling.md) | python | runnable example | current / public | examples |
| [Cerebras docs checker (Python)](../docs/recipes/examples-python-cerebras-docs-checker.md) | python | runnable example | current / public | examples |
| [Company address finder (Python)](../docs/recipes/examples-python-company-address-finder.md) | python | runnable example | current / public | examples |
| [Company value prop generator (Python)](../docs/recipes/examples-python-company-value-prop-generator.md) | python | runnable example | current / public | examples |
| [Context (Python)](../docs/recipes/examples-python-context.md) | python | runnable example | current / public | examples |
| [Council events (Python)](../docs/recipes/examples-python-council-events.md) | python | runnable example | current / public | examples |
| [Download financial statements (Python)](../docs/recipes/examples-python-download-financial-statements.md) | python | runnable example | current / public | examples |
| [Exa Browserbase (Python)](../docs/recipes/examples-python-exa-browserbase.md) | python | runnable example | current / public | examples |
| [Extend Browserbase (Python)](../docs/recipes/examples-python-extend-browserbase.md) | python | runnable example | current / public | examples |
| [File upload (Python)](../docs/recipes/examples-python-file-upload.md) | python | runnable example | current / public | examples |
| [Form filling (Python)](../docs/recipes/examples-python-form-filling.md) | python | runnable example | current / public | examples |
| [Gemini CUA (Python)](../docs/recipes/examples-python-gemini-cua.md) | python | runnable example | current / public | examples |
| [Getting started with Browserbase (Python)](../docs/recipes/examples-python-getting-started-with-browserbase.md) | python | runnable example | current / public | examples |
| [Gift finder (Python)](../docs/recipes/examples-python-gift-finder.md) | python | runnable example | current / public | examples |
| [Google trends (Python)](../docs/recipes/examples-python-google-trends.md) | python | runnable example | current / public | examples |
| [Human-in-the-loop handoff (Python)](../docs/recipes/examples-python-human-in-the-loop.md) | python | runnable example | current / public | examples |
| [Image url download (Python)](../docs/recipes/examples-python-image-url-download.md) | python | runnable example | current / public | examples |
| [Job application (Python)](../docs/recipes/examples-python-job-application.md) | python | runnable example | current / public | examples |
| [License verification (Python)](../docs/recipes/examples-python-license-verification.md) | python | runnable example | current / public | examples |
| [Manual MFA with contexts (Python)](../docs/recipes/examples-python-manual-mfa-with-contexts.md) | python | runnable example | current / public | examples |
| [MFA handling (Python)](../docs/recipes/examples-python-mfa-handling.md) | python | runnable example | current / public | examples |
| [Nurse verification (Python)](../docs/recipes/examples-python-nurse-verification.md) | python | runnable example | current / public | examples |
| [OpenAI browser agent (Python)](../docs/recipes/examples-python-openai-cua.md) | python | runnable example | current / public | examples |
| [Pickleball (Python)](../docs/recipes/examples-python-pickleball.md) | python | runnable example | current / public | examples |
| [Basic CAPTCHA (Python)](../docs/recipes/examples-python-playwright-basic-captcha.md) | python | runnable example | current / public | examples |
| [Playwright MFA handling (Python)](../docs/recipes/examples-python-playwright-mfa-handling.md) | python | runnable example | current / public | examples |
| [Quickstart Playwright (Python)](../docs/recipes/examples-python-playwright-quickstart-playwright.md) | python | runnable example | current / public | examples |
| [Polymarket research (Python)](../docs/recipes/examples-python-polymarket-research.md) | python | runnable example | current / public | examples |
| [Proxies (Python)](../docs/recipes/examples-python-proxies.md) | python | runnable example | current / public | examples |
| [Proxies weather (Python)](../docs/recipes/examples-python-proxies-weather.md) | python | runnable example | current / public | examples |
| [SEC filing research (Python)](../docs/recipes/examples-python-sec-filing-research.md) | python | runnable example | current / public | examples |
| [Quickstart Selenium (Python)](../docs/recipes/examples-python-selenium-quickstart-selenium.md) | python | runnable example | current / public | examples |
| [Smart fetch scraper (Python)](../docs/recipes/examples-python-smart-fetch-scraper.md) | python | runnable example | current / public | examples |
| [Website link tester (Python)](../docs/recipes/examples-python-website-link-tester.md) | python | runnable example | current / public | examples |
| [Agent with human in loop (TypeScript)](../docs/recipes/examples-typescript-agent-with-human-in-loop.md) | typescript | runnable example | current / public | examples |
| [Amazon global price comparison (TypeScript)](../docs/recipes/examples-typescript-amazon-global-price-comparison.md) | typescript | runnable example | current / public | examples |
| [Amazon product scraping (TypeScript)](../docs/recipes/examples-typescript-amazon-product-scraping.md) | typescript | runnable example | current / public | examples |
| [Basic caching (TypeScript)](../docs/recipes/examples-typescript-basic-caching.md) | typescript | runnable example | current / public | examples |
| [Basic CAPTCHA (TypeScript)](../docs/recipes/examples-typescript-basic-captcha.md) | typescript | runnable example | current / public | examples |
| [Browser agent demo (TypeScript)](../docs/recipes/examples-typescript-browser-agent-demo.md) | typescript | runnable example | current / public | examples |
| [Browserbase reducto (TypeScript)](../docs/recipes/examples-typescript-browserbase-reducto.md) | typescript | runnable example | current / public | examples |
| [Business lookup (TypeScript)](../docs/recipes/examples-typescript-business-lookup.md) | typescript | runnable example | current / public | examples |
| [Company address finder (TypeScript)](../docs/recipes/examples-typescript-company-address-finder.md) | typescript | runnable example | current / public | examples |
| [Company value prop generator (TypeScript)](../docs/recipes/examples-typescript-company-value-prop-generator.md) | typescript | runnable example | current / public | examples |
| [Context (TypeScript)](../docs/recipes/examples-typescript-context.md) | typescript | runnable example | current / public | examples |
| [Council events (TypeScript)](../docs/recipes/examples-typescript-council-events.md) | typescript | runnable example | current / public | examples |
| [Download financial statements (TypeScript)](../docs/recipes/examples-typescript-download-financial-statements.md) | typescript | runnable example | current / public | examples |
| [Dynamic form filling (TypeScript)](../docs/recipes/examples-typescript-dynamic-form-filling.md) | typescript | runnable example | current / public | examples |
| [Exa Browserbase (TypeScript)](../docs/recipes/examples-typescript-exa-browserbase.md) | typescript | runnable example | current / public | examples |
| [Extend Browserbase (TypeScript)](../docs/recipes/examples-typescript-extend-browserbase.md) | typescript | runnable example | current / public | examples |
| [Form filling (TypeScript)](../docs/recipes/examples-typescript-form-filling.md) | typescript | runnable example | current / public | examples |
| [Gemini 3 flash (TypeScript)](../docs/recipes/examples-typescript-gemini-3-flash.md) | typescript | runnable example | current / public | examples |
| [Gemini CUA (TypeScript)](../docs/recipes/examples-typescript-gemini-cua.md) | typescript | runnable example | current / public | examples |
| [Raw Playwright Browserbase quickstart (TypeScript)](../docs/recipes/examples-typescript-getting-started-with-browserbase.md) | typescript | runnable example | current / public | examples |
| [Gift finder (TypeScript)](../docs/recipes/examples-typescript-gift-finder.md) | typescript | runnable example | current / public | examples |
| [Google trends (TypeScript)](../docs/recipes/examples-typescript-google-trends.md) | typescript | runnable example | current / public | examples |
| [Image url download (TypeScript)](../docs/recipes/examples-typescript-image-url-download.md) | typescript | runnable example | current / public | examples |
| [Job application (TypeScript)](../docs/recipes/examples-typescript-job-application.md) | typescript | runnable example | current / public | examples |
| [License verification (TypeScript)](../docs/recipes/examples-typescript-license-verification.md) | typescript | runnable example | current / public | examples |
| [Manual MFA with contexts (TypeScript)](../docs/recipes/examples-typescript-manual-mfa-with-contexts.md) | typescript | runnable example | current / public | examples |
| [MFA handling (TypeScript)](../docs/recipes/examples-typescript-mfa-handling.md) | typescript | runnable example | current / public | examples |
| [Microsoft CUA (TypeScript)](../docs/recipes/examples-typescript-microsoft-cua.md) | typescript | runnable example | current / public | examples |
| [Nurse verification (TypeScript)](../docs/recipes/examples-typescript-nurse-verification.md) | typescript | runnable example | current / public | examples |
| [Pickleball (TypeScript)](../docs/recipes/examples-typescript-pickleball.md) | typescript | runnable example | current / public | examples |
| [Basic CAPTCHA (TypeScript)](../docs/recipes/examples-typescript-playwright-basic-captcha.md) | typescript | runnable example | current / public | examples |
| [Playwright MFA handling (TypeScript)](../docs/recipes/examples-typescript-playwright-mfa-handling.md) | typescript | runnable example | current / public | examples |
| [Quickstart Playwright (TypeScript)](../docs/recipes/examples-typescript-playwright-quickstart-playwright.md) | typescript | runnable example | current / public | examples |
| [Polymarket research (TypeScript)](../docs/recipes/examples-typescript-polymarket-research.md) | typescript | runnable example | current / public | examples |
| [Proxies (TypeScript)](../docs/recipes/examples-typescript-proxies.md) | typescript | runnable example | current / public | examples |
| [Proxies weather (TypeScript)](../docs/recipes/examples-typescript-proxies-weather.md) | typescript | runnable example | current / public | examples |
| [Quickstart Puppeteer (TypeScript)](../docs/recipes/examples-typescript-puppeteer-quickstart-puppeteer.md) | typescript | runnable example | current / public | examples |
| [SEC filing research (TypeScript)](../docs/recipes/examples-typescript-sec-filing-research.md) | typescript | runnable example | current / public | examples |
| [Quickstart Selenium (TypeScript)](../docs/recipes/examples-typescript-selenium-quickstart-selenium.md) | typescript | runnable example | current / public | examples |
| [Smart fetch scraper (TypeScript)](../docs/recipes/examples-typescript-smart-fetch-scraper.md) | typescript | runnable example | current / public | examples |
| [Website link tester (TypeScript)](../docs/recipes/examples-typescript-website-link-tester.md) | typescript | runnable example | current / public | examples |

<!-- recipes:end -->
