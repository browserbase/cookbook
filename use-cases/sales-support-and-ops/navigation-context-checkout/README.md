# Browserbase × Product App Navigation Context Demo

This is a mock navigation-context demonstration using Stagehand v4 and Browserbase. `getMockProduct AppSignals()` always returns fixed fixture records with `source: "mock"`. Their descriptions become `stagehand.act()` instructions for the saucedemo checkout example. The fixture includes illustrative frequencies, order, and session-duration values; none are live Product App observations.

There is no MCP client, server discovery, authentication, tool invocation, or connection attempt in this package. The helper does not detect availability and has no live mode. This demo illustrates how an application can map navigation-context records into browser instructions.

## Setup and run

Run from this package directory:

```bash
corepack enable
pnpm install
test -f .env || cp .env.example .env
```

Set `BROWSERBASE_API_KEY` in `.env`. The configured `MODEL` in `demo.ts` is `openai/gpt-4o`; check model access for your Browserbase/provider configuration before running. The template's Anthropic key does not change the configured model. To use a different provider, update `MODEL` and configure that provider's access together.

```bash
pnpm demo
```

This launches a real cloud browser and attempts the fixture's checkout actions. The default target is saucedemo, with an Applitools page as a navigation fallback. The fixed checkout instructions are not adapted for that fallback page. The run stops on any action without an explicit success result and only prints its summary after structured extraction confirms a visible checkout message. Timings count Stagehand SDK invocations and their wall-clock duration; they are not inference counts or a controlled comparison. Session links and recordings are debugging aids.

## Add a live integration

A live path still needs an MCP client/transport, an explicitly configured server and authentication, tool discovery and invocation, validation of the server's actual response schema, and mapping into this example's navigation records. Report transport, authorization and schema errors explicitly. Only label data as live after it came from a successful server response; keep fixtures an explicitly selected mode. None of that connector work is implemented or verified here.

## Source and verification

Supporting material is intentionally excluded from this cookbook checkout. Runtime artifacts may contain target data; review and sanitize them before sharing.

The source and mock helper were inspected locally. No Product App server, model, browser session or target-site workflow was called to validate this documentation. Inspect the final page and action results before treating a run as successful.
