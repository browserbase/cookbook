# Job-site browser starter

Launches a browser and opens Glassdoor from `main.ts`. Add the desired workflow there.

## Setup

Run commands from this recipe directory. Use Node.js 22.18 or later and an installed Chrome browser for local mode. Stagehand v4 uses system Chrome for local runs; Browserbase runs do not require a local browser. See the [Browserbase migration guide](https://www.browserbase.com/blog/playwright-to-stagehand-migration).

```bash
npm install
test -f .env || cp .env.example .env
```

Edit `.env` before starting. The current [stagehand.config.ts](stagehand.config.ts) uses:

| Setting | Current value |
| --- | --- |
| Browser launcher | Browserbase |
| Stagehand model | `openai/gpt-4o` |
| Model key | `OPENAI_API_KEY` |

For Browserbase, also set `BROWSERBASE_API_KEY`. Local mode still needs the configured model key. The package's `postinstall` script invokes `playwright install`; that inherited script does not replace the system-Chrome prerequisite for Stagehand v4.

Before the first Browserbase run, replace the entire `browser` property with the minimal Browserbase block below. The checked-in configuration contains an inherited persistent-context ID and additional session settings. Only add a context that belongs to your project when your workflow needs one.

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
