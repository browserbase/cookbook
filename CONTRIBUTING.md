# Contribute a recipe

Add code that solves a specific browser task, then make it discoverable in the catalog. Each recipe needs a real execution boundary and enough setup detail for another developer to run it.

## Add a recipe

1. Choose a collection. Use `examples/` for standalone templates, `integrations/` for framework adapters, `playbook/` for imported Browserbase Playbook patterns, or `use-cases/` for private business applications.
2. Put the recipe's dependencies, entrypoint, and configuration sample together. For a workspace package, keep its local dependency graph intact.
3. Write its source README. Describe the result, prerequisites, exact working directory, install and launch commands, required credentials, expected output, and side effects.
4. Add a record to [catalog.json](catalog.json). Follow a nearby entry. Keep IDs stable and use the topic slugs defined in [scripts/catalog.py](scripts/catalog.py).
5. Regenerate navigation and validate it.

```sh
python3 scripts/catalog.py build
python3 scripts/verify.py
python3 -B -m unittest discover -s tests
```

Generated recipe guides and topic pages are committed. Edit their catalog fields and generator rather than editing generated Markdown directly.

By contributing, you agree that your contribution may be distributed under the
repository's [Apache License 2.0](LICENSE), except where [NOTICE](NOTICE) or a
nested license applies. Follow the [Code of Conduct](CODE_OF_CONDUCT.md)

## Catalog contract

| Field                                 | Meaning                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `id`                                  | Stable lowercase recipe identifier                                                              |
| `title`, `summary`                    | Task name and the observable result                                                             |
| `collection`, `path`                  | Owning collection and local source location                                                     |
| `topics`, `languages`, `frameworks`   | Discovery metadata                                                                              |
| `readme`, `upstream_readme`           | Generated guide and retained source README                                                      |
| `working_directory`, `entrypoints`    | Setup boundary and actual code files, relative to the cookbook root                             |
| `setup_commands`, `run_commands`      | Commands grounded in the package manifest and source                                            |
| `environment_variables`               | Names referenced by the code, including optional settings                                       |
| `dependencies`, `caveats`             | Declared dependencies and known limitations                                                     |
| `source`                              | Repository URL, full commit SHA, and original path                                              |
| `lifecycle`, `access`, `verification` | SDK status, source visibility, and strongest passing evidence level                             |
| `verification_evidence`               | Dated check kind, runtime, exact command, result, and limits; required above `source-inspected` |

Current records describe imported upstream units. For a new upstream-derived recipe, update the pinned import and its provenance first. For a new cookbook-native recipe, extend the catalog's provenance contract and validator together instead of assigning a false upstream path.

Cookbook-authored files added inside `examples/`, `integrations/`, `playbook/`, or `use-cases/` belong in `COOKBOOK_AUTHORED.json`; imported files stay in `SOURCE_MANIFEST.json`. Review the file first, then run `python3 scripts/authored_manifest.py refresh`. The two manifests must cover disjoint paths.

## Refresh imported source

Use separate clean source checkouts. Inspect upstream changes before changing a pin. Keep `private_workflows` access-controlled.

```sh
python3 scripts/import_sources.py --source-dir /path/to/public-source-checkouts --scope public
```

Public refresh requires only `templates`, `playbook`, and `integrations` at the intended revisions. `--scope private` requires only the access-controlled `private_workflows` checkout; `--scope all` requires all four. When an existing manifest is present, unselected source records remain unchanged. A fresh public destination contains no private records or paths. The importer reads committed Git blobs, so uncommitted source edits do not enter the cookbook. It refuses differing existing files by default.

After reviewing differences, `--refresh` updates files that still match their previous recorded digest. It refuses unrecorded edits and manifest-recorded downstream adaptations, so a routine refresh cannot silently erase migrations. Retire a reviewed adaptation only with the explicit `--replace-adaptations` flag. The importer is not a general merge tool. Reconcile removed or newly excluded files using the previous manifest, then check coverage against the source snapshots.

```sh
python3 scripts/import_sources.py --source-dir /path/to/public-source-checkouts --scope public --refresh
python3 scripts/catalog.py build
python3 scripts/verify.py --source-dir /path/to/source-checkouts
```

Update catalog metadata and source SHAs for affected recipes. The importer does not rewrite editorial metadata. Imported file digests make undocumented local changes fail validation. If an adaptation belongs in an imported file, record the new digest, original source digest, transformation reason, and the change in the source documentation. Do not quietly disable the digest check.

## Code style

Repository-owned Python uses Ruff, while repository-owned Markdown and configuration files use Prettier. Imported collections retain their own package-level formatting rules.

```bash
ruff check scripts tests
npx --yes prettier@3.9.6 --check . --ignore-unknown
```

To apply safe fixes locally:

```bash
ruff check --fix scripts tests
npx --yes prettier@3.9.6 --write . --ignore-unknown
```

## Review a change

Check the actual selected example. A syntax check does not prove a live automation works. Record dependency installation, compilation, and live execution separately. For a browser run, report the page result or replay and how the browser session was closed.

Keep secrets, captured sensitive data, and local `.env` files out of Git. Environment samples contain names and safe placeholders. Preserve source license notices and private access labels. This consolidation is not permission to republish customer material.

Use `source-inspected`, `install-verified`, `typechecked`, `offline-tested`, or `live-tested` for the strongest established evidence. Any value above `source-inspected` needs a matching passing `verification_evidence` record with `kind`, ISO date, runtime and dependency versions, the exact command, `result`, and a concrete `limits` statement. A failed check may be recorded as evidence but cannot raise the recipe's level. Never promote an install or typecheck to a live result.

## Independent installation evidence

Validate each recipe in its own clean package directory. A passing check against an existing `node_modules` tree, especially one linked to a temporary shared install, does not prove that the recipe installs independently. Record the runtime version, package-manager command, lockfile used, and result. Keep installation, compilation, synthetic tests, and live workflow results separate.

When regenerating a lockfile, use a disposable directory with the package's own manifests and required workspace files. Do not copy dependency trees into it. Preserve the configured release-age policy. Remove only generated dependency trees created by your task, after confirming their ownership. Never serialize temporary filesystem paths into a portable lockfile.

TypeScript regenerates `*.tsbuildinfo` during incremental compilation. These files are excluded from source imports and Git. Keep them out of source refreshes and publication artifacts.
