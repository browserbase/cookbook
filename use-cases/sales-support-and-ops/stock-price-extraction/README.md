# Research App stock-price example

Opens Yahoo Finance, searches the configured ticker, and extracts its ticker and stock price. The ticker is currently set in `index.ts`.

## Setup

Run commands from this recipe directory. Use Node.js 22.18 or later and an installed Chrome browser for local mode. Stagehand v4 uses system Chrome for local runs; Browserbase runs do not require a local browser. See the [Browserbase migration guide](https://www.browserbase.com/blog/playwright-to-stagehand-migration).

```bash
corepack enable
pnpm install
test -f .env || cp .env.example .env
```

Edit `.env` before starting. The current [stagehand.config.ts](stagehand.config.ts) uses:

| Setting | Current value |
| --- | --- |
| Browser launcher | Local Chrome with a 1024 × 768 viewport |
| Stagehand model | `google/gemini-2.0-flash` |
| Model key | `GOOGLE_API_KEY` |

For Browserbase, also set `BROWSERBASE_API_KEY`. Local mode still needs the configured model key. The package's `postinstall` script invokes `playwright install`; that inherited script does not replace the system-Chrome prerequisite for Stagehand v4.

After configuring the browser and keys:

```bash
pnpm run build
pnpm run start
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

## Verification status

These instructions match the inspected configuration and package scripts. They do not establish that dependency installation, provider access, authentication, or the target-site workflow succeeds. Review target authorization and generated artifacts before use.

## Cached action recovery

`actWithCache` validates cached action shapes and checks the Stagehand 4 result’s `data.success`. A successful cache hit returns immediately. An explicit `false` evicts that entry, observes once, and attempts the first validated candidate once. The replacement is saved only after confirmed success. Empty or malformed observations and unsuccessful replacement actions throw, preventing the caller from continuing as though the action succeeded. There are at most two action attempts and one observation per call.

A thrown or ambiguous cached execution is evicted but not automatically retried: the action may have had effects before its result was lost. Inspect the page before retrying. Even explicit failure is SDK execution feedback, not a transaction guarantee; this helper is intended for the recipe’s search/fill interactions. Optional visual overlays no longer delay or interfere with the cached-action path; their standalone helper functions remain available.

Cache updates preserve unrelated instructions, serialize writes within this process, and atomically rename a temporary file over `cache.json`. This is not a cross-process lock. Invalid JSON or an unreadable cache fails explicitly instead of silently discarding it. If a confirmed action succeeds but its cache cannot be saved, the helper warns and returns success rather than inviting a duplicate action. Treat `cache.json` and its temporary files as sensitive; they can contain action arguments. Both are ignored by Git.

Run `node --test tests/cache.test.mjs` on Node 24 with this recipe’s dependencies installed; `ZOD_MODULE_PATH` can select an existing Zod installation for isolated verification. All 25 tests pass using the actual helper code, real Zod, synthetic SDK responses and real filesystem operations confined to fresh temporary directories. They cover recovery ordering, bounded attempts, persistent failure, ambiguous outcomes, validation, atomic replacement and post-success cache-write failure. The utility also passes a scoped TypeScript check against installed SDK types. The original explicit-failure regression was reproduced. No real cache, credentials, browser session or provider calls were used; this is not a fresh recipe installation or live action test.
