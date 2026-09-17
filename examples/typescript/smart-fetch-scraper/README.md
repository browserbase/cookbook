# Smart Fetch scraper

Try Browserbase Fetch first, then open a Stagehand browser session when basic checks reject the response. The fast path parses HTML with Cheerio; the browser path extracts the page title and a list of items using the schema in `index.ts`.

## Setup

Use pnpm **10.24.0**, as declared in `package.json`. From the cookbook root:

```sh
cd examples/typescript/smart-fetch-scraper
pnpm install --config.minimumReleaseAge=10080
cp .env.example .env
pnpm start https://news.ycombinator.com
```

Set `BROWSERBASE_API_KEY` in your local `.env` and configure model access for the Stagehand fallback. Each recipe has its own dependencies; there is no root installation.

## How it chooses a path

The request explicitly selects `format: "raw"` and follows redirects. A nonstring response, non-2xx status, fewer than 500 raw characters, a configured JavaScript/challenge message, or a text-density ratio below 5% requests browser fallback.

For text density, Cheerio parses the HTML and removes `script`, `style`, `template`, `noscript`, and elements with `hidden` attributes. Only the remaining body text is counted, with whitespace collapsed. Head metadata and comments do not count. Text density divides this text length by the original HTML length, so a large script bundle can still make a readable document fall below the threshold.

The fast path uses the parser to decode the document title and count actual body anchors outside those excluded subtrees. Strings resembling links inside scripts or comments do not become anchors. It prints the status, raw content length, parsed title, anchor count, and a raw preview.

These are approximate checks, not proof of rendered visibility, complete content, or the best retrieval method. Cheerio does not execute scripts or compute CSS. CSS-hidden content can pass, a genuine article discussing JavaScript can match a challenge pattern, and a short useful page can fall back. The logs identify that uncertainty. Tune `MIN_CONTENT_LENGTH`, `MIN_TEXT_DENSITY`, and `JS_REQUIRED_PATTERNS` for the target rather than assuming every JavaScript shell is detectable.

Fetch also supports Markdown and JSON, but those formats need different validation and parsing. Do not change only the format argument while leaving this HTML-specific path in place. See the [Fetch documentation](https://docs.browserbase.com/platform/fetch/overview).

## Browser fallback

When a check requests fallback or Fetch throws, the example starts a Browserbase browser with proxies and uses Stagehand to extract `PageDataSchema`. Adapt that schema and extraction prompt to the information you need. A successful model response is not an independent check of extraction accuracy.

No particular public URL is guaranteed to take one path: responses, authentication requirements, and site behavior change. The sample command is a starting point, not a current performance or availability claim.

## Local verification

```sh
pnpm test
pnpm typecheck
```

Fifteen tests passed with Node.js 24 and real Cheerio 1.2.0. They execute the actual heuristic, parser, and caller with synthetic API/browser responses: script/style/template/comment/hidden/head-only pages, malformed markup, entities, readable articles, challenge/status checks, fake links, and nonstring responses. Eleven of these tests failed against the saved pre-fix source.

The runner passed an isolated type check against Cheerio 1.2.0, Browserbase SDK 2.19.1, Stagehand 4.0.2, and Zod 4.4.3. Cheerio and its 23-package isolated installation used the normal seven-day package policy. This is not a fresh installation of the complete recipe dependency graph. The tests did not call Fetch, create a remote browser, or invoke a model.

Cheerio's [text-manipulation documentation](https://cheerio.js.org/docs/basics/manipulation/) explains the difference between parsed text and rendered text; this example removes excluded subtrees explicitly.
