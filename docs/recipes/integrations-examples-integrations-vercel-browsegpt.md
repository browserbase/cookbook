# Vercel · browse gpt

BrowseGPT

> [!CAUTION]
> Demo and reference code only. This recipe is not a vetted production implementation. Independently review it, obtain authorization, and validate security, privacy, compliance, cost, and site-term requirements before use. Use at your own risk.

**Status:** current · public · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `integrations/examples/integrations/vercel/BrowseGPT`.
- Languages: javascript, typescript.
- Frameworks: next.
- [Upstream setup and behavior](../../integrations/examples/integrations/vercel/BrowseGPT/README.md).
- [Dependency manifest `integrations/examples/integrations/vercel/BrowseGPT/package.json`](../../integrations/examples/integrations/vercel/BrowseGPT/package.json).
- [Source `integrations/examples/integrations/vercel/BrowseGPT/app/api/chat/route.ts`](../../integrations/examples/integrations/vercel/BrowseGPT/app/api/chat/route.ts).

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd integrations/examples/integrations/vercel/BrowseGPT
npm install
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run dev
npm run start
```

## Environment

### Required

| Variable | Provider and purpose | Safe example | Validation and default |
| --- | --- | --- | --- |
| `BROWSERBASE_API_KEY` | [Browserbase](https://www.browserbase.com/settings). Authenticates requests to Browserbase. Secret. | `<set-locally>` | Must be non-empty when used. No default. |


## Dependencies

Declared runtime dependencies from [integrations/examples/integrations/vercel/BrowseGPT/package.json](../../integrations/examples/integrations/vercel/BrowseGPT/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@ai-sdk/anthropic` | `4.0.46` |
| `@ai-sdk/openai` | `4.0.52` |
| `@ai-sdk/react` | `4.0.89` |
| `@headlessui/react` | `^2.1.10` |
| `@mozilla/readability` | `0.6.0` |
| `@radix-ui/react-icons` | `^1.3.0` |
| `ai` | `7.0.86` |
| `class-variance-authority` | `0.7.1` |
| `clsx` | `2.1.1` |
| `framer-motion` | `13.1.1` |
| `geist` | `1.7.2` |
| `jsdom` | `30.0.1` |
| `lucide-react` | `1.38.0` |
| `next` | `16.3.3` |
| `playwright` | `1.62.1` |
| `react` | `19.2.4` |
| `react-dom` | `19.2.4` |
| `react-markdown` | `10.1.0` |
| `remark-gfm` | `4.0.1` |
| `tailwind-merge` | `3.6.0` |
| `tailwindcss-animate` | `^1.0.7` |
| `zod` | `4.4.3` |

## Caveats and verification

Source and setup metadata were inspected. No passing authenticated live-workflow check is recorded for this recipe. Websites, model access, paid services, permissions, costs, and operator-specific configuration remain unverified.

- Use Node 24.19.0 from the package .nvmrc; the selected Node 24 baseline is separate from dependency-installation and live-runtime verification.

## Provenance

[Pinned upstream source](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458/examples/integrations/vercel/BrowseGPT) at commit `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.

Related topics: [Integrations and orchestration](../topics/integrations-and-orchestration.md).
