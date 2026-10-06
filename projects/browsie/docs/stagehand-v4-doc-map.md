# Stagehand v4 documentation map

This map covers the current Stagehand v4 documentation index. Browsie uses it as the source list for
code, templates, and future videos. Source index: [Stagehand llms.txt](https://docs.stagehand.dev/llms.txt).

## First steps

| Document                                                               | Use in Browsie                                      |
| ---------------------------------------------------------------------- | --------------------------------------------------- |
| [Introduction](https://docs.stagehand.dev/v4/first-steps/introduction) | Product mental model and Stagehand primitive choice |
| [Quickstart](https://docs.stagehand.dev/v4/first-steps/quickstart)     | Setup and first browser session                     |
| [Installation](https://docs.stagehand.dev/v4/first-steps/installation) | Package and runtime requirements                    |
| [AI rules](https://docs.stagehand.dev/v4/first-steps/ai-rules)         | Correct Stagehand v4 code rules                     |

## Browser primitives

| Document                                                | Use in Browsie                              |
| ------------------------------------------------------- | ------------------------------------------- |
| [Act](https://docs.stagehand.dev/v4/basics/act)         | Optional AI action path after exact tools   |
| [Extract](https://docs.stagehand.dev/v4/basics/extract) | Future structured research results          |
| [Observe](https://docs.stagehand.dev/v4/basics/observe) | Future action planning and selector caching |
| [WebMCP](https://docs.stagehand.dev/v4/basics/webmcp)   | Future use of tools supplied by a page      |

## Configuration

| Document                                                                   | Use in Browsie                               |
| -------------------------------------------------------------------------- | -------------------------------------------- |
| [Browser](https://docs.stagehand.dev/v4/configuration/browser)             | Local and Browserbase factories              |
| [Models](https://docs.stagehand.dev/v4/configuration/models)               | Separate harness and Stagehand model choices |
| [Logging](https://docs.stagehand.dev/v4/configuration/logging)             | Future Stagehand log forwarding              |
| [Observability](https://docs.stagehand.dev/v4/configuration/observability) | Session and trace view design                |

## Harness integrations

The integration pages define Browsie's persistent browser and three-tool design. See
[Stagehand harness design](stagehand-harness.md) for the detailed comparison.

| Document                                                                    | Connection                                          |
| --------------------------------------------------------------------------- | --------------------------------------------------- |
| [Integration overview](https://docs.stagehand.dev/v4/integrations/overview) | Shared `run`, `snapshot`, and `screenshot` contract |
| [Claude Code](https://docs.stagehand.dev/v4/integrations/claude-code)       | MCP over standard input and output                  |
| [Codex](https://docs.stagehand.dev/v4/integrations/codex)                   | MCP over standard input and output                  |
| [Eve](https://docs.stagehand.dev/v4/integrations/eve)                       | Native tools and a durable browser                  |
| [Deep Agents](https://docs.stagehand.dev/v4/integrations/deep-agents)       | Local MCP or managed native tools                   |
| [CrewAI](https://docs.stagehand.dev/v4/integrations/crewai)                 | Python harness and MCP                              |
| [Mastra](https://docs.stagehand.dev/v4/integrations/mastra)                 | One MCP client around the model loop                |
| [fx](https://docs.stagehand.dev/v4/integrations/fx)                         | MCP and tool discovery limits                       |
| [Pi](https://docs.stagehand.dev/v4/integrations/pi)                         | Native extension with lazy browser start            |
| [Vercel AI SDK](https://docs.stagehand.dev/v4/integrations/vercel-ai-sdk)   | Web agent loop and MCP                              |

## Best practices

| Document                                                                              | Use in Browsie                          |
| ------------------------------------------------------------------------------------- | --------------------------------------- |
| [Prompting](https://docs.stagehand.dev/v4/best-practices/prompting-best-practices)    | Clear, specific browser requests        |
| [Observe use cases](https://docs.stagehand.dev/v4/best-practices/usecase-observe)     | Future planning patterns                |
| [Caching actions](https://docs.stagehand.dev/v4/best-practices/caching)               | Future repeated-task speed path         |
| [Multiple tabs](https://docs.stagehand.dev/v4/best-practices/using-multiple-tabs)     | Future tab-aware worker state           |
| [User data](https://docs.stagehand.dev/v4/best-practices/user-data)                   | Browserbase Context behavior            |
| [Speed optimization](https://docs.stagehand.dev/v4/best-practices/speed-optimization) | Short batches and fewer model calls     |
| [Cost optimization](https://docs.stagehand.dev/v4/best-practices/cost-optimization)   | Exact actions before AI actions         |
| [Deployments](https://docs.stagehand.dev/v4/best-practices/deployments)               | Long-lived worker deployment needs      |
| [MCP integrations](https://docs.stagehand.dev/v4/best-practices/mcp-integrations)     | Future tools outside the browser worker |

## Migration

| Document                                                                | Use in Browsie                         |
| ----------------------------------------------------------------------- | -------------------------------------- |
| [Stagehand v3 to v4](https://docs.stagehand.dev/v4/migrations/v3)       | Keep examples on v4 factories and APIs |
| [Playwright to v4](https://docs.stagehand.dev/v4/migrations/playwright) | Explain exact APIs to Playwright users |

## API reference

| Document                                                           | Use in Browsie                                      |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| [Stagehand](https://docs.stagehand.dev/v4/reference/stagehand)     | Client creation and close lifecycle                 |
| [Context](https://docs.stagehand.dev/v4/reference/context)         | Pages, cookies, headers, and clipboard              |
| [Clipboard](https://docs.stagehand.dev/v4/reference/clipboard)     | Future copy and paste tasks                         |
| [Page](https://docs.stagehand.dev/v4/reference/page)               | Navigation, snapshot, screenshot, and exact actions |
| [WebMCP reference](https://docs.stagehand.dev/v4/reference/webmcp) | Page tool inspection and invocation                 |
| [Response](https://docs.stagehand.dev/v4/reference/response)       | Future navigation and error evidence                |
| [Locator](https://docs.stagehand.dev/v4/reference/locator)         | Exact field and element interaction                 |

## Other primary sources

- [Stagehand GitHub repository](https://github.com/browserbase/stagehand)
- [Stagehand releases](https://github.com/browserbase/stagehand/releases)
- [Stagehand OpenAPI specification](https://app.stainless.com/api/spec/documented/stagehand/openapi.documented.yml)
