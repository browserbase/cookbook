## Summary

Describe the user-visible recipe or catalog change.

## Verification

- [ ] `python3 scripts/catalog.py check`
- [ ] `python3 scripts/verify.py`
- [ ] `python3 -B -m unittest discover -s tests`
- [ ] I tested the changed recipe at the level claimed in its catalog metadata.

List exact commands and distinguish installation, compilation, offline tests,
and live browser execution.

## Publication and provenance

- [ ] No credentials, cookies, session URLs, customer data, generated runtime
      files, or prompt logs are included.
- [ ] Imported changes have reviewed provenance; cookbook-authored collection
      files are recorded in `COOKBOOK_AUTHORED.json`.
- [ ] Documentation, catalog metadata, and generated indexes are current.
