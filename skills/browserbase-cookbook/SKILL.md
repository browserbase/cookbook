---
name: browserbase-cookbook
description: Find and adapt Browserbase cookbook examples for browser automation, Stagehand, Playwright, authentication, extraction, agent frameworks, and business workflows. Use when selecting an example, implementing from a Browserbase recipe, or troubleshooting its setup.
---

# Browserbase cookbook

Treat every recipe as demo/reference code rather than a vetted production implementation. Preserve the repository disclaimer when adapting code, and require independent review, authorization, and validation for the target environment. Use at your own risk.

Route the user's task to an existing recipe. Inspect that recipe before writing a new implementation.

## Locate the source

If `BROWSERBASE_COOKBOOK_DIR` is set, look there for `catalog.json`. Otherwise look in the current repository, then two directories above this skill's resolved location. A cookbook root has both `catalog.json` and `SOURCE_MANIFEST.json`. A separately installed skill may have references without a checkout.

If no checkout is available, stop after identifying the topic and ask for the matching cookbook checkout. Topic references contain historical provenance links, but those pinned upstream files predate cookbook migrations and are not runnable substitutes for the local recipe. Do not assume `browserbase/cookbook` exists remotely. Restricted links require the user's existing repository access. Do not substitute invented private code when access fails.

Paths in topic references are relative to the cookbook root, not the skill directory.

## Choose a topic

Read only the reference that matches the request. Read a second reference when the task crosses topics.

| User intent                                                                                                                                                          | Reference                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| First session, Search, Fetch, raw Playwright, Puppeteer, Selenium, or Go                                                                                             | [Getting started](references/getting-started.md)                               |
| Login, saved cookies, contexts, MFA, or authentication                                                                                                               | [Authentication](references/authentication.md)                                 |
| Proxies, caching, CAPTCHA, session options, or browser configuration                                                                                                 | [Browser features](references/browser-features.md)                             |
| Download, upload, PDF, financial statements, or document parsing                                                                                                     | [Downloads and documents](references/downloads-and-documents.md)               |
| Scrape, extract, research, search, or collect structured data                                                                                                        | [Extraction and research](references/extraction-and-research.md)               |
| Fill a form, prepare an application, or adapt a transaction flow                                                                                                     | [Forms and transactions](references/forms-and-transactions.md)                 |
| Computer use, agents, tools, or pause for a human                                                                                                                    | [Agents and human handoff](references/agents-and-human-handoff.md)             |
| Convex, Eve, OpenClaw, AgentKit, Agno, Box, Braintrust, Browser Use, Cartesia, CrewAI, Inngest, LangChain, Mastra, MongoDB, Stripe, Temporal, Trigger.dev, or Vercel | [Integrations and orchestration](references/integrations-and-orchestration.md) |
| Link checks, traces, evaluation, or observability                                                                                                                    | [Testing and observability](references/testing-and-observability.md)           |
| Prices, products, flights, shopping, or travel                                                                                                                       | [Commerce and travel](references/commerce-and-travel.md)                       |
| Finance, healthcare, public records, support, or another business workflow                                                                                           | [Business operations](references/business-operations.md)                       |

## Select and inspect

Honor the requested language and framework. Prefer a matching current public template for a general task. Use Playbook code when it demonstrates a needed capability. Inspect a restricted reference only when the user explicitly identifies it or explicitly requests restricted examples and confirms authorized source access; never route an open-ended task to restricted material by default. Inspect the actual manifest and migrated entrypoint before adapting it.

Within a checkout, keyword search can narrow candidates without loading the full catalog:

```sh
python3 scripts/catalog.py search "persistent login" --language python --limit 5
```

Search defaults to public recipes. Do not add `--access any` or `--access private` for general discovery. Use one of those flags only for an explicit, authorized request to inspect restricted references.

Open the selected recipe guide, its dependency manifest, and its entrypoint. If a setup command disagrees with the manifest or source, explain the mismatch and use the actual contract. A filename match alone is insufficient. Check whether the example performs the user's intended operation.

The guide records a working directory. Preserve it for shared Playbook helpers and integration workspaces. Do not copy only a leaf file when relative imports or `workspace:*` dependencies need the surrounding project.

## Adapt and verify

Explain the selected recipe, why it fits, where the code lives, and what needs to change. Give a second option only if it exposes a useful tradeoff.

Keep the source SDK generation consistent. Do not mix Stagehand v2, v3, and v4 APIs. Use installed package contracts for code and the live [Browserbase docs](https://docs.browserbase.com/) or [Stagehand docs](https://docs.stagehand.dev/) for current product behavior.

Environment-variable lists include optional settings as well as credentials. Inspect defaults and the entrypoint before calling every variable mandatory. Never print credential values. Keep restricted recipe code and sensitive data within the authorized workspace.

Selecting a recipe does not authorize executing its business actions. Check form submissions, payments, messages, uploads, and account mutations against the user's actual task before running the example. Inspect the target and input data first.

Run an appropriate local check after adapting code. For live automation, verify the actual page result or session replay. Report source inspection, installation, compilation, and live execution separately. `current` and `source-inspected` do not mean runtime-verified.

If no example fits, say which part is missing and use the nearest verified building block. Do not invent a recipe, command, or verification result.
