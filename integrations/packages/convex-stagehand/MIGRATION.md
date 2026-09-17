# Stagehand v4 migration

This component now runs Stagehand 4.0.2 directly in Convex Node actions. It no longer calls the removed v3 HTTP endpoints. Install with `npm ci`, then `npm run build` and `npm test`. The component client keeps its existing `startSession`, `endSession`, `act`, `extract`, `observe`, and `agent` methods.

Use Node 24 for Convex actions and externalize `@browserbasehq/stagehand` as shown in `convex.json`, so its packaged browser extension remains available. Metadata mutations and queries run separately in Convex's default runtime. Deployment and generated application bindings still require your own Convex project: run `npx convex dev` in `example/` before its typecheck. No deployment or credential-backed browser operation was run during this migration.

Sessions use `keepAlive: true`; each action attaches and disconnects, while `endSession` explicitly releases the remote Browserbase session. Always call `endSession` for manually managed sessions. Automatic workflows continue to release their sessions in their cleanup paths.

Schemas now use Zod 4's native JSON Schema conversion. Zod is pinned to 4.4.3 because Stagehand 4.0.2 ships that nominal schema contract. TypeScript is 6.0.3, the latest stable release compatible with typescript-eslint 8.69.0; that linter does not yet support TypeScript 7.

The `agent` method uses an AI SDK 7 tool loop. DOM mode inspects snapshots and performs individual actions; hybrid mode adds screenshots and pointer/keyboard tools; CUA mode uses screenshots and pointer/keyboard tools. Completion requires an explicit verification tool result. The loop has both a step limit and a timeout. It supports OpenAI, Anthropic, and Google model providers, with their corresponding API keys. Microsoft provider selection now fails explicitly; use a supported provider configuration.

The removed v3 trace-cache option (`shouldCache: true`), cursor highlighting, selector-scoped `extract`/`observe`, and navigation `referer` throw explicit migration errors. Put extraction scope in the instruction, persist results in Convex, and configure session headers when needed. These are exposed migration limitations, not silently ignored options.
