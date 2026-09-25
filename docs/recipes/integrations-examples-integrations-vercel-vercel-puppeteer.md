# Vercel · vercel Puppeteer

Export page content in Next.js and fill synthetic form inputs with verified DOM field mapping.

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/examples/integrations/vercel/vercel-puppeteer`.
- Languages: javascript, typescript.
- Frameworks: @browserbasehq/stagehand, next.
- [Upstream setup and behavior](../../integrations/examples/integrations/vercel/vercel-puppeteer/README.md).
- [Dependency manifest `integrations/examples/integrations/vercel/vercel-puppeteer/package.json`](../../integrations/examples/integrations/vercel/vercel-puppeteer/package.json).
- [Source `integrations/examples/integrations/vercel/vercel-puppeteer/app/api/form/route.ts`](../../integrations/examples/integrations/vercel/vercel-puppeteer/app/api/form/route.ts).
- [Source `integrations/examples/integrations/vercel/vercel-puppeteer/app/api/screenshot/route.ts`](../../integrations/examples/integrations/vercel/vercel-puppeteer/app/api/screenshot/route.ts).
- [Source `integrations/examples/integrations/vercel/vercel-puppeteer/app/api/html/route.ts`](../../integrations/examples/integrations/vercel/vercel-puppeteer/app/api/html/route.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/examples/integrations/vercel/vercel-puppeteer
npm install
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run dev
```

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/vercel/vercel-puppeteer/package.json](../../integrations/examples/integrations/vercel/vercel-puppeteer/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.1` |
| `@browserbasehq/stagehand` | `4.0.2` |
| `next` | `16.3.4` |
| `node-html-markdown` | `^1.3.0` |
| `playwright-core` | `1.63.0` |
| `prettier` | `3.9.6` |
| `puppeteer-core` | `25.10.0` |
| `react` | `19.2.4` |
| `react-dom` | `19.2.4` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Unauthenticated routes can allocate billable browser sessions. Authentication, limits and target restrictions remain required before deployment.
- Form mapping uses exact DOM labels and verifies filled values. Local Chrome fixtures use synthetic providers; live site compatibility and full Next.js production build remain unverified.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/vercel/vercel-puppeteer) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Integrations and orchestration](../topics/integrations-and-orchestration.md).
