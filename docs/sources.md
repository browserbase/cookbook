# Source provenance

The cookbook preserves source dependency boundaries and adds one task-based catalog. [SOURCE_MANIFEST.json](../SOURCE_MANIFEST.json) accounts for every tracked file at each imported commit.

[COOKBOOK_AUTHORED.json](../COOKBOOK_AUTHORED.json) separately records files added inside imported collection directories by the cookbook migration. Each record has a current digest and an authorship reason. This prevents a new helper, test, package file, or collection document from falling outside both provenance classes.

| Original repository | Local collection |
| --- | --- |
| [browserbase/templates](https://github.com/browserbase/templates) | [examples](../examples/README.md) |
| [browserbase/playbook](https://github.com/browserbase/playbook) | [playbook](../playbook/README.md) |
| [browserbase/integrations](https://github.com/browserbase/integrations) | [integrations](../integrations/README.md) |

## What an import record means

`imported` records retain source bytes. `transformed` records retain the original digest and explain the change, such as clearing credential assignments in an environment sample or renaming the root README. `excluded` records explain an omission.

Each source has a full Git commit SHA. Each retained file has a SHA-256 digest. Each recipe links to its original path at that commit. The importer reads committed Git objects rather than whatever files happen to be in a source working tree.

The new collection landing pages use `README.md`. Original root documentation remains in each collection's `UPSTREAM_README.md`. Existing recipe READMEs remain beside the code. Their old repository-relative instructions may need the new collection prefix. Cookbook recipe guides record that prefix.

## Exclusions and adaptations

The Python and TypeScript basic CAPTCHA examples use general CAPTCHA-solving language in their READMEs, descriptions, code comments, and console messages. These documentation adaptations retain the original source digests in the manifest. Local recipe directories, package identifiers, and generated guide names use `basic-captcha`. For these renamed examples, source identity uses the original SHA-256 digest rather than the historical path. Source links point to the pinned language directory. Full source verification matches each content-addressed record to one upstream file, including duplicate content.

Source repository release workflows, agent configurations, dependency caches, TypeScript incremental compiler state, generated downloads, selected sensitive captured artifacts, and persisted authentication data are excluded. Mock applications and source fixtures remain when they support the recipe.

Secret-like assignments in environment samples are cleared. This bounded
import check is not a security certification; review each recipe before use.

The repository intentionally retains a small set of public upstream test fixtures, including `browser-tests-alpha.vercel.app`, `agent-job-board.vercel.app`, `pod-search.kalmservices.net`, `v0-reimburse-me-expense-portal.vercel.app`, and the public Stagehand reference host. These are documented third-party or synthetic test targets, not private infrastructure; recipes that use them should still be reviewed for availability and terms before execution.

Some applications referenced captured inputs or outputs that were excluded. Provide your own authorized local data before using those paths. See the file-level reasons in the manifest and the recipe's caveats.

The TypeScript getting-started example has one code adaptation. It validates that Fetch content is text before parsing HTML, matching the installed SDK response type. The importer applies that exact change and fails if the expected upstream snippet changes. Its original and adapted digests are recorded in the manifest.

## Licenses

The integrations collection retains its upstream MIT license. Other imported source roots did not include a license file at the pinned revisions. Review the root license and retained package notices before redistribution.

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

## Security dependency updates

The [Dependabot remediation report](security-remediation.md) records dependency upgrades, regenerated lockfiles, validation limits, and unresolved upstream advisories. Imported dependency files retain their original source digests; their reviewed local versions are recorded as adaptations.
