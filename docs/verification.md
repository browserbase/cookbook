# Verification

The cookbook's checks verify repository structure, source provenance, generated documentation, and recipe discovery. They do not execute the imported business workflows.

## Reproduce the checks

Python 3.10 or newer is required for the repository tooling. Recipe runtimes have their own version requirements.

```sh
python3 scripts/verify.py
python3 -B -m unittest discover -s tests
python3 scripts/catalog.py check
```

With the original source checkouts available at the pinned revisions, also check coverage against Git:

```sh
python3 scripts/verify.py --source-dir /path/to/source-checkouts
```

The source directory contains `templates`, `playbook`, and `integrations`. No credentials are needed for offline checks against existing local checkouts.

## What the checks cover

- Every catalog recipe has a valid ID, status, access label, source path, setup directory, guide, and entrypoint path.
- Every retained source file matches its recorded digest.
- Every exclusion has a reason and its destination is absent.
- Source-checkout validation compares the complete tracked file sets and exact Git revisions.
- Local links and HTML image sources resolve in authored and retained upstream Markdown. Historical documents may remain factually stale, but broken paths cannot pass the structural gate.
- Generated guides, collection tables, topic indexes, and skill references match the catalog.
- The skill has valid metadata and linked resources. Plugin manifests parse and point to local resources.
- The bounded hygiene scan reports credential-like patterns by path and line without printing values.

Tests exercise failure behavior, including altered imports, invalid catalog metadata, path traversal, generated-output symlinks, and excluded files reintroduced into the repository. Search tests exercise language filtering, relevant matches, no-match behavior, and skill-reference coverage.

Pull requests also run five maintained public recipe boundaries in clean CI jobs: Python and TypeScript getting-started, the Go Stagehand example, the Node 1Password Playbook example, and the Temporal integration. Each job installs only inside its recipe boundary and runs the declared import, compile, typecheck, or offline-test command. Node jobs preserve the seven-day npm release-age policy. These jobs receive no credentials and do not call Browserbase or another external service; they establish installation and static or offline compatibility, not live workflow success.

The hygiene scan is not a full security audit. The hygiene scan is not a full security audit.

## Representative setup checks

The Python getting-started example was copied to an isolated temporary directory. `uv sync` succeeded under Python 3.13.2, resolving Browserbase 1.18.1 and Playwright 1.62.0. Its Browserbase, Playwright, and dotenv imports succeeded. No API calls were made.

The TypeScript getting-started example was copied to an isolated temporary directory. `npm install --ignore-scripts --package-lock=false` succeeded, resolving Browserbase SDK 2.19.0. The initial type check caught an upstream assumption that Fetch content is always a string. A recorded cookbook adaptation validates that response boundary before parsing HTML.

The type check passed after the adaptation. A mock of the actual Fetch demonstration accepted HTML text and rejected structured content. The importer reproduced the adaptation and wrote zero files on a second run.

The TypeScript check uses:

```sh
./node_modules/.bin/tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext index.ts
```

The repository ProductSpec was validated with `@productspec/parser`. The skill passed the host skill validator. Independent source review and routing exercises were performed with available agents. No cross-family model review was available.

Catalog evidence records the checked scope, date, runtime, command, result, and explicit limits when a recipe is promoted above source-inspected status. A recipe's top-level verification value is its strongest recorded passing check; source inspection remains the baseline for recipes without stronger evidence. Install, typecheck, offline behavior, and live workflow evidence are distinct values.

## Verification limits

No authenticated browser workflow, portal, payment, messaging action, or live integration was executed during the initial consolidation. Some retained Playbook recipes include separately recorded, scoped live-test evidence; only the stated date, command, result, and limits are claimed. Dependencies were not installed for every imported application. Some source READMEs retain outdated paths or version guidance. The generated guides identify known differences but do not promise a complete modernization.

Claude Code, Codex plugin installation, and Cursor installation were not exercised in those applications. The Markdown skill, bundled references, and plugin file paths were validated locally.

For a recipe you adapt, verify its actual result. Record the command, dependency versions, relevant configuration names, page output or session replay, and cleanup result. Do not change a recipe's verification label based only on a successful install or type check.

## Dependency metadata

`python3 scripts/catalog.py check` compares declared runtime dependencies with each recipe's recorded primary manifest as well as checking generated documents. After reviewing package changes, run `python3 scripts/catalog.py refresh-dependencies` and `python3 scripts/catalog.py build`. This refresh preserves package boundaries and changes dependency records only; it does not infer lifecycle status, setup commands, compatibility or runtime verification. Catalog tooling requires Python3.11 or newer for TOML parsing. Manifest precedence is package.json, then pyproject.toml, then requirements.txt. PEP621 project dependencies, simple Poetry dependency mappings, and plain requirements are supported. Requirements options/includes and dynamic dependency declarations fail explicitly; no remote dependency files are fetched. Alternate manifests are not silently merged into the primary list and may still require setup-path reconciliation.

For recipes with several packages, `primary_manifest` explicitly selects one recorded manifest for the main dependency metadata. Other manifests appear separately in the generated guide with their own declarations; generated-document checks detect changes to those dependencies too. Multiple manifests with the same filename require explicit selection. This preserves sibling package boundaries instead of merging their installations.

Dependency checks also reject recognized manifests in a recipe's working directory that are missing from its manifest list. This catches new or previously omitted package declarations without scanning unrelated directories. Nested package discovery still requires source review.

Recipes with `matching_dependency_manifests: true` promise equivalent runtime declarations across their listed manifests. Catalog checks compare each declaration to the primary one and reject differences; this currently covers the four Python examples offering both uv and pip setup.

Go metadata reads direct `require` declarations from `go.mod`, including require blocks. Indirect dependencies are omitted from the recipe's direct dependency table. Replacements/exclusions require explicit review and are rejected by the simple parser; it never invokes Go or downloads modules.
