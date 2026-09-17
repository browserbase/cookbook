# Browser playbook patterns

These scripts came from the Browserbase Playbook and now live in `playbook/`. Choose a pattern by its capability and inspect its recipe guide for dependencies and outstanding limitations. The [templates](../examples/README.md) provide additional starting points.

## Shared setup

The Node scripts share `node/package.json`, `node/tsconfig.json`, and `node/useful_browserbase_functions.ts`. Use Node 24.19.0 from `node/.nvmrc`, install dependencies from `playbook/node`, then use the recipe guide's working directory and relative entrypoint. The selected Node 24 baseline satisfies the strictest declared runtime among the shared package's current direct dependencies. Moving one file without its helpers can break imports.

The Python scripts share `python/requirements.txt`; the 1Password guides have separate Node and Python manifests. Read each guide for its exact installation boundary. The 1Password guide also needs a locally prepared browser extension; the captured extension archive is excluded.

## Migration and verification

The Node playbook now declares Stagehand 4.0.2, and its Stagehand entrypoints use the migrated browser/factory APIs. Dependency migration does not prove that every script works against its target website. Remaining setup, cleanup, and workflow findings are tracked separately in the repository review. Login scripts and form scripts may act on external accounts. Adapt inputs and inspect side effects before running them.

Generated downloads and Python caches are excluded. File paths that referenced those artifacts need your own local fixture. The [original overview](UPSTREAM_README.md) remains for historical context; prefix its repository-relative paths with `playbook/` when using them from the cookbook root.

## Recipes

<!-- recipes:start -->

| Recipe | Language | Type | Status | Collection |
| --- | --- | --- | --- | --- |
| [Create extension (TypeScript, Browserbase)](../docs/recipes/playbook-guides-1password-node-createextension.md) | typescript | runnable example | current / public | playbook |
| [Playwright (TypeScript, Browserbase)](../docs/recipes/playbook-guides-1password-node-playwright.md) | typescript | runnable example | current / public | playbook |
| [Stagehand (TypeScript, Browserbase)](../docs/recipes/playbook-guides-1password-node-stagehand.md) | typescript | runnable example | current / public | playbook |
| [Create extension (Python, Browserbase)](../docs/recipes/playbook-guides-1password-python-create-extension.md) | python | runnable example | current / public | playbook |
| [Run Playwright (Python, Browserbase)](../docs/recipes/playbook-guides-1password-python-run-playwright.md) | python | runnable example | current / public | playbook |
| [Run Stagehand (Python, Browserbase)](../docs/recipes/playbook-guides-1password-python-run-stagehand.md) | python | runnable example | current / public | playbook |
| [Basic login (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-authenticate-basiclogin.md) | typescript | runnable example | current / public | playbook |
| [Create context (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-authenticate-createcontext.md) | typescript | runnable example | current / public | playbook |
| [Book search (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-research-booksearch.md) | typescript | runnable example | current / public | playbook |
| [Search alaska flights (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-research-searchalaskaflights.md) | typescript | runnable example | current / public | playbook |
| [Eharmony form (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-task-eharmonyform.md) | typescript | runnable example | current / public | playbook |
| [Tik tok form (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-task-tiktokform.md) | typescript | runnable example | current / public | playbook |
| [Live debug URL and CDP context (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-tools-context-initialize-context.md) | typescript | runnable example | current / public | playbook |
| [Wikipedia login (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-tools-context-wikipedia-login.md) | typescript | runnable example | current / public | playbook |
| [Cloud download retrieve (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-tools-download-cloud-download-retrieve.md) | typescript | runnable example | current / public | playbook |
| [Cloud download save (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-tools-download-cloud-download-save.md) | typescript | runnable example | current / public | playbook |
| [Generate PDF (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-tools-download-generate-pdf.md) | typescript | runnable example | current / public | playbook |
| [Local PDF (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-tools-download-local-pdf.md) | typescript | runnable example | current / public | playbook |
| [Local screenshot (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-tools-download-local-screenshot.md) | typescript | runnable example | current / public | playbook |
| [List metadata (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-tools-metadata-listmetadata.md) | typescript | runnable example | current / public | playbook |
| [Set metadata (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-tools-metadata-setmetadata.md) | typescript | runnable example | current / public | playbook |
| [Custom captcha (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-tools-stealth-customcaptcha.md) | typescript | runnable example | current / public | playbook |
| [Verified (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-tools-stealth-verified.md) | typescript | runnable example | current / public | playbook |
| [Live view upload (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-tools-uploads-live-view-upload.md) | typescript | runnable example | current / public | playbook |
| [Local upload (TypeScript, Playwright)](../docs/recipes/playbook-node-playwright-tools-uploads-local-upload.md) | typescript | runnable example | current / public | playbook |
| [GitHub login (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-authenticate-githublogin.md) | typescript | runnable example | current / public | playbook |
| [Contact form (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-complete-task-contactform.md) | typescript | runnable example | current / public | playbook |
| [Google form (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-complete-task-googleform.md) | typescript | runnable example | current / public | playbook |
| [Job app agent (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-complete-task-jobappagent.md) | typescript | runnable example | current / public | playbook |
| [Job app explicit (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-complete-task-jobappexplicit.md) | typescript | runnable example | current / public | playbook |
| [Search docs (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-complete-task-searchdocs.md) | typescript | runnable example | current / public | playbook |
| [SF ticket agent (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-complete-task-sfticketagent.md) | typescript | runnable example | current / public | playbook |
| [Workday (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-complete-task-workday.md) | typescript | runnable example | current / public | playbook |
| [Appt search (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-research-apptsearch.md) | typescript | runnable example | current / public | playbook |
| [City council search (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-research-citycouncilsearch.md) | typescript | runnable example | current / public | playbook |
| [Polymarket (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-research-polymarket.md) | typescript | runnable example | current / public | playbook |
| [Pull news (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-research-pullnews.md) | typescript | runnable example | current / public | playbook |
| [Search alaska flights (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-research-searchalaskaflights.md) | typescript | runnable example | current / public | playbook |
| [Search southwest flights (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-research-searchsouthwestflights.md) | typescript | runnable example | current / public | playbook |
| [Validate nurses (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-research-validatenurses.md) | typescript | runnable example | current / public | playbook |
| [Create extension (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-tools-1password-createextension.md) | typescript | runnable example | current / public | playbook |
| [Main (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-tools-1password-main.md) | typescript | runnable example | current / public | playbook |
| [Blank (TypeScript, Stagehand)](../docs/recipes/playbook-node-stagehand-tools-blank.md) | typescript | runnable example | current / public | playbook |
| [Captcha listening (Python, Playwright)](../docs/recipes/playbook-python-playwright-captcha-captcha-listening.md) | python | runnable example | current / public | playbook |
| [Custom captcha (Python, Playwright)](../docs/recipes/playbook-python-playwright-captcha-custom-captcha.md) | python | runnable example | current / public | playbook |
| [Initialize context (Python, Playwright)](../docs/recipes/playbook-python-playwright-context-initialize-context.md) | python | runnable example | current / public | playbook |
| [Download retrieve (Python, Playwright)](../docs/recipes/playbook-python-playwright-download-download-retrieve.md) | python | runnable example | current / public | playbook |
| [Download save (Python, Playwright)](../docs/recipes/playbook-python-playwright-download-download-save.md) | python | runnable example | current / public | playbook |
| [Upload extension (Python, Playwright)](../docs/recipes/playbook-python-playwright-extensions-upload-extension.md) | python | runnable example | current / public | playbook |
| [Captcha listening (Python, Browserbase)](../docs/recipes/playbook-python-selenium-stealth-captcha-listening.md) | python | runnable example | current / public | playbook |

<!-- recipes:end -->
