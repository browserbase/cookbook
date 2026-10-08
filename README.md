<p align="center">
  <a href="https://www.browserbase.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/brand/browserbase-logo-dark.svg" />
      <img src="assets/brand/browserbase-logo-color.svg" alt="Browserbase" width="306" />
    </picture>
  </a>
</p>

<h1 align="center">Browserbase cookbook</h1>

<p align="center">
  <a href="https://github.com/browserbase/stagehand"><img src="https://img.shields.io/github/stars/browserbase/stagehand?style=flat-square&amp;logo=github&amp;label=Stagehand%20stars&amp;color=FF4500" alt="Stagehand GitHub stars" /></a>
  <a href="https://www.npmjs.com/package/@browserbasehq/stagehand"><img src="https://img.shields.io/npm/v/%40browserbasehq%2Fstagehand?style=flat-square&amp;label=Stagehand&amp;color=FF4500" alt="Latest Stagehand npm version" /></a>
  <a href="https://www.npmjs.com/package/@browserbasehq/sdk"><img src="https://img.shields.io/npm/dm/%40browserbasehq%2Fsdk?style=flat-square&amp;label=Browserbase%20SDK%20downloads&amp;color=FF4500" alt="Browserbase SDK monthly npm downloads" /></a>
</p>

Find a working starting point for browser automation. Browse by task, choose your language or framework, and open the recipe's setup guide and code.

This cookbook brings together Browserbase's public templates, complete projects, Playbook patterns, and integrations. It includes the source code, with each project's dependencies kept together. Imported examples have been inspected, but have not all been run against live services.

> [!CAUTION]
> **Demo and reference code only.** Browserbase does not claim that any recipe, integration, target, data source, vendor, or workflow in this repository has been vetted, approved, secured, or validated for production use. Independently review the code and obtain all required authorization before running it. You are responsible for compliance, site terms, privacy, security, costs, and outcomes. **Use at your own risk.**

[Browse every recipe](docs/catalog.md) · [Use the coding-agent skill](docs/agents.md) · [Run your first example](docs/getting-started.md) · [Source provenance](docs/sources.md)

## Start here

| You want to                                           | Start with                                                                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Try Search, Fetch, and a cloud browser without an LLM | [Python](examples/python/getting-started-with-browserbase/) or [TypeScript](examples/typescript/getting-started-with-browserbase/) |
| Keep your existing Playwright code                    | [Python](examples/python/playwright/) or [TypeScript](examples/typescript/playwright/)                                             |
| Extract structured product data with Stagehand        | [Python](examples/python/amazon-product-scraping/) or [TypeScript](examples/typescript/amazon-product-scraping/)                   |
| Save a login and handle MFA                           | [Authentication recipes](docs/topics/authentication.md)                                                                            |
| Pause an agent for a person                           | [Human-in-the-loop app](examples/typescript/agent-with-human-in-loop/)                                                             |
| Style Live View pointers for people and agents        | [JavaScript pointer UI](examples/javascript/live-view-cursor-ui/)                                                                  |
| Add Browserbase to an agent framework                 | [Integrations](integrations/README.md)                                                                                             |
| Study a complete consumer browser agent               | [Browsie](projects/browsie/)                                                                                                       |

## Browse by task

| Task                                                                            | Examples you'll find                                           |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [Getting started](docs/topics/getting-started.md)                               | Browserbase SDK, Playwright, Puppeteer, Selenium, and Go       |
| [Authentication](docs/topics/authentication.md)                                 | Persistent contexts, MFA, and login flows                      |
| [Browser features](docs/topics/browser-features.md)                             | Proxies, caching, session configuration, and CAPTCHA handling  |
| [Downloads and documents](docs/topics/downloads-and-documents.md)               | File downloads, uploads, PDFs, and document extraction         |
| [Extraction and research](docs/topics/extraction-and-research.md)               | Web research, company data, filings, and structured extraction |
| [Forms and transactions](docs/topics/forms-and-transactions.md)                 | Forms, applications, and checkout workflows                    |
| [Agents and human handoff](docs/topics/agents-and-human-handoff.md)             | Computer use, tool calling, and human input                    |
| [Integrations and orchestration](docs/topics/integrations-and-orchestration.md) | Framework adapters, durable workflows, and platform packages   |
| [Testing and observability](docs/topics/testing-and-observability.md)           | Link checks, traces, and evaluation integrations               |
| [Commerce and travel](docs/topics/commerce-and-travel.md)                       | Pricing, products, flights, and hospitality                    |
| [Business operations](docs/topics/business-operations.md)                       | Finance, healthcare, public records, and internal operations   |

Search locally without installing dependencies or calling an API.

```sh
python3 scripts/catalog.py search "persistent login" --language python
python3 scripts/catalog.py search "convex" --limit 3
python3 scripts/catalog.py search "human handoff" --json
```

Search is a keyword lookup. It ranks matched terms, public access, and match strength before using collection and recipe ID as tie-breakers. Lifecycle does not outrank a stronger task match. The coding-agent skill handles interpreting a task and comparing recipes.

## Quick start

From this repository's root, run the Python example's independent browser mode. It creates a cloud session without requiring Search or Fetch access.

```sh
cd examples/python/getting-started-with-browserbase
cp .env.example .env
```

Set `BROWSERBASE_API_KEY` in `.env`, then run with [uv](https://docs.astral.sh/uv/).

```sh
uv run python main.py browser
```

The script creates a Browserbase session, extracts content from Wikipedia, and prints its replay URL. Use `search`, `fetch`, or `all` instead of `browser` when you want those separately permissioned APIs. No model API key is required.

For TypeScript setup, expected output, and troubleshooting, read [Run your first example](docs/getting-started.md).

## For coding agents

One skill routes a request to the relevant topic, then to the recipe guide and executable source. It respects your language and framework and identifies relevant Playbook patterns.

[Read the skill](skills/browserbase-cookbook/SKILL.md) or [install it for Codex, Claude Code, or Cursor](docs/agents.md).

Example requests include:

- “Find a Python example that reuses a logged-in session.”
- “Add Browserbase to a Convex app.”
- “Build a TypeScript agent that can pause for human input.”
- “Download financial statements and extract their contents.”

## Repository layout

```text
examples/       Standalone Python, TypeScript, and Go templates
integrations/   Framework examples and integration packages
playbook/       Browserbase Playbook patterns and shared helpers
projects/       Complete applications built from Browserbase features
skills/         One cookbook skill with focused topic references
docs/           Recipe guides, task indexes, setup, and maintenance
scripts/        Import, catalog generation, search, and validation
```

Install dependencies inside the selected example. There is no root application or shared dependency installation. The integrations workspace and Playbook Node scripts have their own setup boundaries.

## Status and maintenance

`current` identifies recipes that use the cookbook's supported dependency baseline. It does not promise runtime verification. `legacy` is reserved for recipes that still require an SDK migration. Read each recipe's manifest and caveats before running it.

[Verification](docs/verification.md) records exactly what was checked. [Contributing](CONTRIBUTING.md) explains how to add or update a recipe. [Source provenance](docs/sources.md) records the upstream repositories, pinned commits, import exclusions, and license boundaries.

```sh
python3 scripts/verify.py
```

The catalog and routing experience take inspiration from the [Fireworks AI cookbook](https://github.com/fw-ai/cookbook). The Browserbase code comes from the three repositories recorded in the source manifest.

## Around the ecosystem

Track [Stagehand on GitHub](https://github.com/browserbase/stagehand), the browser automation framework used throughout this cookbook.

<p align="center">
  <a href="https://github.com/browserbase/stagehand/network/members"><img src="https://img.shields.io/github/forks/browserbase/stagehand?style=for-the-badge&amp;logo=github&amp;label=Forks&amp;color=FF4500" alt="Stagehand GitHub forks" /></a>
  <a href="https://github.com/browserbase/stagehand/graphs/contributors"><img src="https://img.shields.io/github/contributors/browserbase/stagehand?style=for-the-badge&amp;label=Contributors&amp;color=FF4500" alt="Stagehand GitHub contributors" /></a>
  <a href="https://github.com/browserbase/stagehand/releases"><img src="https://img.shields.io/github/v/release/browserbase/stagehand?style=for-the-badge&amp;label=Latest%20release&amp;color=FF4500" alt="Stagehand latest GitHub release" /></a>
</p>

[Explore Stagehand’s interactive star history](https://www.star-history.com/#browserbase/stagehand&Date).

The live badges show the upstream Stagehand project.

<img src="assets/brand/browserbase-landscape.png" alt="Browserbase media-kit artwork: an orange pixel-art mountain landscape" width="100%" />

<sub>Official artwork from the [Browserbase media kit](https://browserbase.notion.site/Browserbase-Media-Kit-1293c11b66148090a867cdeea85dbba0). [Asset provenance](assets/brand/README.md).</sub>
