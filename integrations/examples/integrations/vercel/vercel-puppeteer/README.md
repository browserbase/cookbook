# Browserbase routes in Next.js

A small Next.js application that exports page content through Browserbase. The home page uses the HTML, Markdown, and screenshot routes. A separate `/api/form` route demonstrates Stagehand form filling with synthetic data.

## Local setup

Install dependencies inside this directory with `npm install`, configure `BROWSERBASE_API_KEY` and a random `EXPORT_API_TOKEN` of at least 24 characters in your local environment, and run `npm run dev`. Enter that access token in the local exporter UI. The form route also requires a model provider configured for Stagehand. Open `http://localhost:3000` for the exporter. Production startup requires `npm run build` before `npm start`.

The HTML and screenshot routes accept authenticated POST requests, enforce a small per-process request/concurrency limit before allocation, and accept credential-free HTTPS targets. The token and in-memory limits are suitable for a single local example process. A public multi-instance deployment needs managed identity, shared rate limiting, and an application-specific target policy.

## Form example

The form route opens the configured tax-estimator URL and uses fixed example values. Invoking it contacts the external site and model; the local verification described below does not. It fills observed supported fields without submitting the form. Example values are synthetic and are not tax advice or a completed tax calculation.

The model identifies candidate inputs. Values are selected from exact DOM labels or identifiers, never substring matches in model descriptions. A target must resolve to one visible, enabled supported input. Unknown fields, conflicting labels, duplicate targets, and non-fill actions fail before filling begins. The route binds observation and actions to its own page and checks actual DOM values after each action and again before returning a count. A successful response describes verified fields, not submission or calculation completion.

The supported label aliases are defined in `app/api/form/route.ts`. Inspect the target form before adding aliases. The resolver supports ordinary document CSS and XPath selectors; iframe and shadow-root fields are unsupported. Live site markup can change, so an unrecognized form fails instead of guessing.

## Local verification

The tests in `tests/form.test.mjs` run the actual route and DOM resolver against isolated local Chrome fixtures, with synthetic Browserbase and Stagehand adapters. They cover wages and dependent counts with misleading age descriptions, ambiguous or unsupported targets, unsuccessful actions, and values changed by later actions. They do not execute a model, contact the tax site, or create Browserbase sessions.

Run with Node 24 and an installed `playwright-core` module:

```sh
COOKBOOK_PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs node --test tests/form.test.mjs
```

The fixture currently uses `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Complete dependency installation, the full Next.js production build, live providers, and the other routes remain outside this focused verification.
