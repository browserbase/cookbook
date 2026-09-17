# Work in the Browserbase cookbook

Use `skills/browserbase-cookbook/SKILL.md` to select and adapt examples. Read only the matching topic references, then the recipe guide, dependency manifest, and entrypoint.

`catalog.json` owns recipe metadata. `scripts/catalog.py build` generates recipe guides, task indexes, and skill references. Run `python3 scripts/verify.py` and `python3 -B -m unittest discover -s tests` after changes.

Keep each example's package boundary intact. There is no root dependency installation. Imported source digests are recorded in `SOURCE_MANIFEST.json`; source refreshes must update provenance deliberately.

The `use-cases/` collection is restricted source. Keep it and derived artifacts private. Do not commit credentials, runtime data, or prompt logs. Source-inspected recipes are not runtime-verified.
