# Browserbase integrations

Connect Browserbase to an existing agent framework or workflow engine. This collection preserves integration examples and the packages they depend on.

## Pick the integration layer

Use `examples/integrations/` to see a framework-specific application. Use `packages/` to inspect reusable adapters for Convex, Eve, and OpenClaw. The cookbook guides below link the actual source and setup boundary for each.

## Node runtime

Use Node **24.19.0** for the aggregate workspace tooling (`nvm install && nvm use` from this directory). The root `.nvmrc` and `engines.node` select the Node 24 line starting at that patch. The aggregate build includes Eve, whose package requires Node 24, and the root ESLint 10 tooling also supports that line. Leaf recipes keep their own package boundaries and version files.

This selected baseline does not establish that every package installs or builds. Lockfile portability and release-age restrictions remain separate checks.

## Dependency boundaries

The original workspace remains intact. Its root `package.json` declares pnpm 10.9.0. Most leaf examples have independent dependency manifests, so use the selected guide rather than assuming one installation works for the entire tree.

Examples using `workspace:*` need the local package and its workspace setup. In particular, the Eve example depends on the adjacent Eve Browserbase package. Preserve both when adapting it. Check `pnpm-workspace.yaml` before relying on workspace discovery; its upstream globs are narrower than the current nested example layout.

Do not use the root release scripts to run an example. Upstream publish and release workflows are excluded from this cookbook.

## Compatibility

The aggregate ESLint configuration uses TypeScript **6.0.3** and typescript-eslint **8.69.0**. The parser supports TypeScript `>=4.8.4 <6.1.0`, so TypeScript 7 is not a supported parser dependency here ([upstream support ranges](https://typescript-eslint.io/users/dependency-versions/)). This compiler serves the root lint tooling; leaf packages declare and validate their own compilers.

Examples span several Stagehand versions and framework generations. The current SDK template may be a better starting point if you do not need a specific framework. Each guide records declared dependencies and known setup gaps.

Known gaps include missing launch configuration in AgentKit Browserbase, incomplete Stripe dependencies, and an undeclared package in the LangChain Stagehand example. Those examples are useful references but need setup repairs before execution. The cookbook does not mark them as runtime-verified.

The [MIT license](LICENSE), [source notice](NOTICE), and
[original overview](UPSTREAM_README.md) remain with the source.

## Frameworks and packages

<!-- recipes:start -->

| Recipe | Language | Type | Status | Collection |
| --- | --- | --- | --- | --- |
| [AgentKit · Browserbase](../docs/recipes/integrations-examples-integrations-agentkit-browserbase.md) | typescript | runnable example | current / public | integrations |
| [AgentKit · Stagehand](../docs/recipes/integrations-examples-integrations-agentkit-stagehand.md) | typescript | runnable example | current / public | integrations |
| [Agno](../docs/recipes/integrations-examples-integrations-agno.md) | python | runnable example | current / public | integrations |
| [Box · agent](../docs/recipes/integrations-examples-integrations-box-agent.md) | typescript | runnable example | current / public | integrations |
| [Box · Stagehand](../docs/recipes/integrations-examples-integrations-box-stagehand.md) | typescript | runnable example | current / public | integrations |
| [Braintrust](../docs/recipes/integrations-examples-integrations-braintrust.md) | typescript | integration package | current / public | integrations |
| [Browser use](../docs/recipes/integrations-examples-integrations-browser-use.md) | python | runnable example | current / public | integrations |
| [Cartesia](../docs/recipes/integrations-examples-integrations-cartesia.md) | python | runnable example | current / public | integrations |
| [CrewAI · CrewAI tutorial](../docs/recipes/integrations-examples-integrations-crewai-crewai-tutorial.md) | python | runnable example | current / public | integrations |
| [CrewAI · quickstart](../docs/recipes/integrations-examples-integrations-crewai-quickstart.md) | python | runnable example | current / public | integrations |
| [CrewAI · Stagehand](../docs/recipes/integrations-examples-integrations-crewai-stagehand.md) | python | runnable example | current / public | integrations |
| [LangChain · Browserbase](../docs/recipes/integrations-examples-integrations-langchain-browserbase.md) | python | runnable example | current / public | integrations |
| [LangChain · deepagents Browserbase](../docs/recipes/integrations-examples-integrations-langchain-deepagents-browserbase.md) | python | runnable example | current / public | integrations |
| [LangChain · Stagehand](../docs/recipes/integrations-examples-integrations-langchain-stagehand.md) | javascript | integration package | current / public | integrations |
| [Mastra](../docs/recipes/integrations-examples-integrations-mastra.md) | typescript | runnable example | current / public | integrations |
| [MongoDB · Python](../docs/recipes/integrations-examples-integrations-mongodb-python.md) | python | runnable example | current / public | integrations |
| [MongoDB · TypeScript](../docs/recipes/integrations-examples-integrations-mongodb-typescript.md) | typescript | runnable example | current / public | integrations |
| [Stripe · node](../docs/recipes/integrations-examples-integrations-stripe-node.md) | typescript | runnable example | current / public | integrations |
| [Stripe · Python](../docs/recipes/integrations-examples-integrations-stripe-python.md) | python | runnable example | current / public | integrations |
| [Stripe · Stagehand](../docs/recipes/integrations-examples-integrations-stripe-stagehand.md) | typescript | runnable example | current / public | integrations |
| [Temporal](../docs/recipes/integrations-examples-integrations-temporal.md) | javascript, typescript | runnable example | current / public | integrations |
| [Trigger](../docs/recipes/integrations-examples-integrations-trigger.md) | javascript, typescript | runnable example | current / public | integrations |
| [Vercel · browse gpt](../docs/recipes/integrations-examples-integrations-vercel-browsegpt.md) | javascript, typescript | runnable example | current / public | integrations |
| [Vercel · Eve example](../docs/recipes/integrations-examples-integrations-vercel-eve-example.md) | typescript | runnable example | current / public | integrations |
| [Vercel · vercel Puppeteer](../docs/recipes/integrations-examples-integrations-vercel-vercel-puppeteer.md) | javascript, typescript | runnable example | current / public | integrations |
| [Convex Stagehand](../docs/recipes/integrations-packages-convex-stagehand.md) | javascript, typescript | runnable example | current / public | integrations |
| [Eve Browserbase](../docs/recipes/integrations-packages-eve-browserbase.md) | typescript | integration package | current / public | integrations |
| [OpenClaw Browserbase](../docs/recipes/integrations-packages-openclaw-browserbase.md) | typescript | integration package | current / public | integrations |

<!-- recipes:end -->
