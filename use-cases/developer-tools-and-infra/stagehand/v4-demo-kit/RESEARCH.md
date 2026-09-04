# Why these demos exist

Research date: August 28, 2026.

## Current product facts

Stagehand v4 is the public 4.0.2 TypeScript package. The current source also has Python and Go SDKs.
It gives a developer two control layers in one script:

- Exact, Playwright-shaped page methods for known actions.
- `act`, `observe`, and `extract` for page parts that need model interpretation.

The current integration work gives an outside agent one persistent browser and three tools:
`run`, `snapshot`, and `screenshot`. The agent is the brain. Stagehand is the browser control layer.
The official integration adapters are still experimental and are not separate public packages.

## Internal source findings

Recent Slack, Notion, and Linear research supports four sales stories:

1. Give an existing agent or harness a small Stagehand tool surface.
2. Let a coding agent write a full browser program, then review and run that file again.
3. Mix exact browser steps with self-healing AI methods.
4. Put a stable program behind a protected endpoint or Browser Function.

The `demo:agent` command is the direct example of the first story. A model receives the Stagehand
tools, selects them during the task, reads each result, and then selects the next tool.

The same research found repeat customer confusion about the removed v3 agent primitive, MCP setup,
and model errors when models try to write old Stagehand syntax. This kit uses Playwright-shaped code
and a small tool surface to reduce that confusion.

Useful internal examples include:

- [RealPage migration question](https://browserbase.slack.com/archives/C0AEP1T0V0W/p1787924852656409)
- [Stripe MCP, harness, and eval discussion](https://browserbase.slack.com/archives/C082FBA7951/p1787941931245709)
- [Why models need a Playwright-shaped facade](https://browserbase.slack.com/archives/C0B379B3TEY/p1787268592046719)
- [Generated v4 code to Browser Function](https://browserbase.slack.com/archives/C0BQT321TNW/p1787261108979869)
- [Justworks v4 and Function workflow](https://browserbase.slack.com/archives/C0BGE5N1465/p1787424340408349)

## Plan compared with delivery

BB reported that the v4 launch, main docs, Playwright migration guide, tool bindings, and code-mode
surface are complete in Linear. The Eve code-mode change and dashboard v4 views were in review. CLI
migration and the Ruby SDK spike were in progress. The benchmark page was in backlog.

This means the SDK demos in this kit are ready now. Treat the integration adapter and hosted
code-mode packaging as active product work. Do not promise a public standalone adapter package.

## Research gap

BB could not read Circleback because the Circleback refresh token was invalid. The findings above
use Slack, Notion, Linear, the local sales-engine memory, and the Stagehand source. They do not claim
Circleback coverage.
