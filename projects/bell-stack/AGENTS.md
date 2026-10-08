# Bell-Stack

Bell is a separate cookbook app with a local package dependency on Browsie.
Keep Bell-specific tools and configuration here; import the shared browser runtime through
`browsie/runtime`. Do not copy the Browsie application or start a second browser-control service.

Use Node.js 24 and pnpm. Run test, typecheck, lint, and build before proposing a PR.
Do not commit secrets or expose credentials in tool outputs, prompts, or logs.
Keep tests with their implementation. Document which live services were actually tested.
