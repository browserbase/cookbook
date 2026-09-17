# Raw Playwright Browserbase quickstart (TypeScript)

Create a Browserbase session, connect with raw Playwright over CDP, and print its session replay URL; Search and Fetch modes are also available.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · offline behavior tested.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `examples/typescript/getting-started-with-browserbase`.
- Languages: typescript.
- Frameworks: Playwright, Browserbase SDK.
- [Upstream setup and behavior](../../examples/typescript/getting-started-with-browserbase/README.md).
- [Dependency manifest `examples/typescript/getting-started-with-browserbase/package.json`](../../examples/typescript/getting-started-with-browserbase/package.json).
- [Source `examples/typescript/getting-started-with-browserbase/index.ts`](../../examples/typescript/getting-started-with-browserbase/index.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd examples/typescript/getting-started-with-browserbase
npm install
test -f .env || cp .env.example .env
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm start -- browser
```

## Environment

[Environment template](../../examples/typescript/getting-started-with-browserbase/.env.example) lists example configuration. Fill in your own values locally.

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [examples/typescript/getting-started-with-browserbase/package.json](../../examples/typescript/getting-started-with-browserbase/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `dotenv` | `^16.4.5` |
| `playwright-core` | `1.63.0` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

| Check | Date | Runtime | Command | Result and limits |
| --- | --- | --- | --- | --- |
| Clean install verified | 2026-09-05 | `Node.js; @browserbasehq/sdk 2.19.0` | `npm install --ignore-scripts --package-lock=false` | passed. Isolated dependency installation only; no Browserbase session or external request was run. |
| Typechecked | 2026-09-05 | `TypeScript; @browserbasehq/sdk 2.19.0` | `tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext index.ts` | passed. Static typecheck only; no Browserbase session or external request was run. |
| Offline behavior tested | 2026-09-05 | `Node.js; mocked Fetch response` | `offline Fetch boundary fixture` | passed. Accepted HTML text and rejected structured content; no network or authenticated service was used. |

- Cookbook adaptation narrows Fetch content to text before HTML parsing. The installed Browserbase SDK permits structured content as well.

## Provenance

[Pinned upstream source](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8/typescript/getting-started-with-browserbase) at commit `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.

Related topics: [Getting started](../topics/getting-started.md), [Extraction and research](../topics/extraction-and-research.md).
