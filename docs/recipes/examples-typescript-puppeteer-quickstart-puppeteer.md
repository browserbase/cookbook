# Quickstart Puppeteer (TypeScript)

Connect to a cloud browser via Puppeteer and Browserbase, click interactive elements, navigate between pages, and extract page copy.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/typescript/puppeteer/quickstart-puppeteer`.
- Languages: typescript.
- Frameworks: Puppeteer, Browserbase SDK.
- [Upstream setup and behavior](../../examples/typescript/puppeteer/quickstart-puppeteer/README.md).
- [Dependency manifest `examples/typescript/puppeteer/quickstart-puppeteer/package.json`](../../examples/typescript/puppeteer/quickstart-puppeteer/package.json).
- [Source `examples/typescript/puppeteer/quickstart-puppeteer/index.ts`](../../examples/typescript/puppeteer/quickstart-puppeteer/index.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/typescript/puppeteer/quickstart-puppeteer
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm start
```

## Environment

[Environment template](../../examples/typescript/puppeteer/quickstart-puppeteer/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [examples/typescript/puppeteer/quickstart-puppeteer/package.json](../../examples/typescript/puppeteer/quickstart-puppeteer/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `dotenv` | `^16.4.5` |
| `puppeteer-core` | `^24.39.1` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/typescript/puppeteer/quickstart-puppeteer) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Getting started](../topics/getting-started.md), [Extraction and research](../topics/extraction-and-research.md).
