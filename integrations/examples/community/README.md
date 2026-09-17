# Community integrations

Build with Browserbase in the tools your team already uses. This directory is the home for integrations created and maintained by the Browserbase community.

> **Have an integration to share?** Open a pull request with a focused, runnable example. The checklist below covers everything needed to make it easy for someone else to adopt.

## Find an integration

There are no community integrations in the collection yet. Browse the [official framework examples](../integrations/) or the full [integrations catalog](../../README.md#frameworks-and-packages) for AgentKit, Agno, Box, Browser Use, CrewAI, LangChain, Mastra, Temporal, Vercel, and more.

You can also ask the cookbook routing skill to find the closest recipe for a task:

```text
Find a Browserbase cookbook example for using <framework> to <task>.
```

The skill checks the catalog, selects a matching recipe, and points to the setup guide and source files that need to stay together.

## Add an integration

Create one self-contained directory under `integrations/examples/community/`:

```text
your-integration/
├── README.md
├── .env.example
├── package.json        # or requirements.txt / pyproject.toml
└── src/                # entrypoint and supporting code
```

Keep the example small enough to understand in one sitting. It should demonstrate one useful workflow and preserve its own dependency boundary.

Your README should include:

- What the integration does and when to use it
- Prerequisites and exact installation commands
- Required environment variables, with placeholders only
- A command that runs the example
- The expected result
- Links to the Browserbase and partner documentation used
- Any limits, external side effects, or setup that cannot be tested locally

Start from this minimal environment contract:

```dotenv
BROWSERBASE_API_KEY=
```

Add partner credentials only when the integration requires them. Never commit real credentials, cookies, session data, recordings, customer data, or prompt logs.

## Register the recipe

Add the example to the root [`catalog.json`](../../../catalog.json). The catalog owns recipe metadata and generates cookbook guides, task indexes, and routing references.

From the repository root, rebuild and validate the generated files:

```bash
python3 scripts/catalog.py build
python3 scripts/verify.py
python3 -B -m unittest discover -s tests
```

Run the example's own formatter, type checker, and tests as well. If a live service or browser action was not exercised, state that plainly in the recipe guide and pull request.

## Review checklist

- [ ] The example solves one clear integration use case
- [ ] Setup works from a clean checkout
- [ ] Dependency versions are declared and lockfiles are included when appropriate
- [ ] Secrets and user-specific values are represented by safe placeholders
- [ ] Browser sessions close in success and error paths
- [ ] Business actions such as payments, messages, uploads, and submissions require deliberate user input
- [ ] `catalog.json` and generated cookbook documentation are current
- [ ] Repository verification passes

Community integrations are reviewed for cookbook quality and safety. Their maintainers remain responsible for partner APIs and compatibility as those products evolve.

## Need help?

Open an issue describing the framework, the browser workflow, and the closest existing recipe you found. That gives maintainers enough context to suggest an example or help shape a contribution.
