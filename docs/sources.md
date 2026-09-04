# Source provenance

The cookbook preserves source dependency boundaries and adds one task-based catalog. [SOURCE_MANIFEST.json](../SOURCE_MANIFEST.json) accounts for every tracked file at each imported commit.

[COOKBOOK_AUTHORED.json](../COOKBOOK_AUTHORED.json) separately records files added inside imported collection directories by the cookbook migration. Each record has a current digest and an authorship reason. This prevents a new helper, test, package file, or collection document from falling outside both provenance classes.

| Original repository | Local collection | Access |
| --- | --- | --- |
| [browserbase/templates](https://github.com/browserbase/templates) | [examples](../examples/README.md) | Public source |
| [browserbase/playbook](https://github.com/browserbase/playbook) | [playbook](../playbook/README.md) | Public source |
| [browserbase/integrations](https://github.com/browserbase/integrations) | [integrations](../integrations/README.md) | Public source |
| [browserbase/private_workflows](https://github.com/browserbase/private_workflows) | [use-cases](../use-cases/README.md) | Private source |

## What an import record means

`imported` records retain source bytes. `transformed` records retain the original digest and explain the change, such as clearing credential assignments in an environment sample or renaming the root README. `excluded` records explain an omission.

Each source has a full Git commit SHA. Each retained file has a SHA-256 digest. Each recipe links to its original path at that commit. The importer reads committed Git objects rather than whatever files happen to be in a source working tree.

The new collection landing pages use `README.md`. Original root documentation remains in each collection's `UPSTREAM_README.md`. Existing recipe READMEs remain beside the code. Their old repository-relative instructions may need the new collection prefix. Cookbook recipe guides record that prefix.

## Exclusions and adaptations

Source repository release workflows, agent configurations, dependency caches, TypeScript incremental compiler state, generated downloads, selected captured customer artifacts, and persisted authentication data are excluded. Mock applications and source fixtures remain when they support the recipe.

Secret-like assignments in environment samples are cleared. This is a bounded import check, not certification that every historical application is suitable for publication. Private code and customer-specific inputs still need review before any public adaptation.

Some applications referenced captured inputs or outputs that were excluded. Provide your own authorized local data before using those paths. See the file-level reasons in the manifest and the recipe's caveats.

The TypeScript getting-started example has one code adaptation. It validates that Fetch content is text before parsing HTML, matching the installed SDK response type. The importer applies that exact change and fails if the expected upstream snippet changes. Its original and adapted digests are recorded in the manifest.

## Licenses and access

The public edition uses the root [MIT license](../LICENSE) and records
source attribution and retained third-party terms in [NOTICE](../NOTICE). The
integrations repository's existing [MIT license](../integrations/LICENSE) also
remains with its code.

Templates and Playbook did not include license files at the pinned revisions.
Browserbase applies the root MIT license to the imported code. Keep this
consolidated checkout private because it also contains the private `use-cases/`
source collection.

## Reproduce the inventory

With the original repositories checked out at the manifest's commits:

```sh
python3 scripts/import_sources.py --source-dir /path/to/public-source-checkouts --scope public
python3 scripts/verify.py --source-dir /path/to/source-checkouts
```

An unchanged import writes zero files. The verifier compares source coverage, local paths, and file digests. See [Contributing](../CONTRIBUTING.md) for reviewed refreshes.

After adding or deliberately editing a cookbook-authored file inside a collection boundary, review the diff and refresh its separate manifest:

```sh
python3 scripts/authored_manifest.py refresh
python3 scripts/authored_manifest.py check
```

Do not use the refresh command to accept unknown files. The structural verifier fails when the set or bytes differ.

## Pinned revisions

- [examples](https://github.com/browserbase/templates/tree/088ff598518cf69b4edf1e1260dd57ff11ca55d8) at `088ff598518cf69b4edf1e1260dd57ff11ca55d8`.
- [playbook](https://github.com/browserbase/playbook/tree/001362e91bf6af47c03f16258cb1126e2043bff1) at `001362e91bf6af47c03f16258cb1126e2043bff1`.
- [integrations](https://github.com/browserbase/integrations/tree/b7bc81c6fd4e089ab0c0df2b82529b200739e458) at `b7bc81c6fd4e089ab0c0df2b82529b200739e458`.
- [use-cases](https://github.com/browserbase/private_workflows/tree/aa64b46d0fc3c27eb40da13fa9ba63b81a3be13a) at `aa64b46d0fc3c27eb40da13fa9ba63b81a3be13a`.

## Recording local adaptations

Keep `source_sha256` as the pinned upstream blob digest and `sha256` as the original imported destination digest. When an imported file is deliberately edited locally, record an `adaptation` object on that file's manifest entry:

```json
{
  "adaptation": {
    "sha256": "<SHA-256 of the reviewed local file>",
    "reason": "Describe the concrete local change and its verification"
  }
}
```

The verifier checks the current file against the adaptation digest while retaining the original import/source relationship. The digest must contain64 lowercase hexadecimal characters and the reason must be nonempty. Excluded files cannot use this field. Missing files and edits without a matching adaptation still fail.

Record adaptations after reviewing and verifying each change. Do not refresh all hashes merely to suppress drift. This record describes intentional divergence; it does not establish runtime correctness. Source refresh tooling and deletion/rename reconciliation still require explicit review before replacing an adapted file.
