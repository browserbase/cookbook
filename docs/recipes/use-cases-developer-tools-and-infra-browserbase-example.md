# Example

Private source-inspected example for example.

**Status:** current · private · source inspected.

**Recipe type:** runnable example.
**LLM requirement:** not required (derived from the inspected framework and configuration metadata).

## Code and prerequisites

- Working directory from the cookbook root: `use-cases/developer-tools-and-infra/browserbase/example`.
- Languages: typescript.
- Frameworks: See dependency manifest.
- [Upstream setup and behavior](../../use-cases/UPSTREAM_README.md).
- [Dependency manifest `use-cases/developer-tools-and-infra/browserbase/example/package.json`](../../use-cases/developer-tools-and-infra/browserbase/example/package.json).
- [Source `use-cases/developer-tools-and-infra/browserbase/example/adv_stealth_ex.ts`](../../use-cases/developer-tools-and-infra/browserbase/example/adv_stealth_ex.ts).
- [Source `use-cases/developer-tools-and-infra/browserbase/example/dewa.ts`](../../use-cases/developer-tools-and-infra/browserbase/example/dewa.ts).
- [Source `use-cases/developer-tools-and-infra/browserbase/example/one_healthcare.ts`](../../use-cases/developer-tools-and-infra/browserbase/example/one_healthcare.ts).
- [Source `use-cases/developer-tools-and-infra/browserbase/example/expense-platform.ts`](../../use-cases/developer-tools-and-infra/browserbase/example/expense-platform.ts).
- Original use-case taxonomy: developer-tools-and-infra.

## Setup and run

Run from this directory. Commands come from the package manifest, upstream setup guide, or inspected entrypoint. Configure credentials before starting.

```sh
cd use-cases/developer-tools-and-infra/browserbase/example
npm install
npm run typecheck
```

Available launch commands are listed below. For applications with separate workers or servers, read the upstream guide for process order. A production `start` command may require a build first.

```sh
npm run adv_stealth_ex
```

## Environment

No direct environment variable references were extracted. SDK defaults, external configuration, and deployment settings may still require credentials. Read the source before running.

## Dependencies

Declared runtime dependencies from [use-cases/developer-tools-and-infra/browserbase/example/package.json](../../use-cases/developer-tools-and-infra/browserbase/example/package.json). Alternate manifests may differ; use the documented setup path.

| Package | Declared version |
| --- | --- |
| `@browserbasehq/sdk` | `2.19.0` |
| `dotenv` | `17.4.2` |
| `playwright-core` | `1.62.1` |

## Caveats and verification

Source and setup metadata were inspected. This cookbook has not executed this recipe against authenticated services. Live websites, model access, paid services, permissions, and account-specific setup remain unverified.

- Private source; keep local or access-controlled. Public adaptation requires separate review and removal of customer specifics and artifacts.
- The new local package uses the cookbook migration dependency versions. Scripts run live account workflows and still need source-specific configuration; package installation/typechecking alone does not verify those workflows.

This recipe came from a private repository. Keep its source and derived artifacts access-controlled.

## Provenance

[Pinned upstream source](https://example.invalid/private-source/tree/0000000000000000000000000000000000000000/developer-tools-and-infra/browserbase/example) at commit `0000000000000000000000000000000000000000`.

Related topics: [Browser configuration](../topics/browser-features.md).
