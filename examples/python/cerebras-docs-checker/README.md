# Stagehand + Browserbase: Cerebras Documentation Checker

Stagehand is the SDK for browser agents.

## AT A GLANCE

- Goal: Crawl any documentation site, discover its source repo, and verify docs accuracy against the actual codebase using Cerebras LLMs.
- Parallel Browserbase workers crawl docs pages and capture Playwright accessibility snapshots.
- A Deep Agents verification agent uses Cerebras for planning and Stagehand V4 code-mode browser tools for fallback research, while local code tools cross-reference functions, parameters, and examples.
- Falls back to content-only analysis when no source repository is found.
- Docs → https://docs.stagehand.dev

## GLOSSARY

- snapshot: capture the current page's structured accessibility representation.
- code mode: Stagehand's `snapshot`, `run`, and `screenshot` tools, exposed to a bring-your-own Deep Agents loop over MCP.
- Deep Agents: the external agent framework; Stagehand V4 does not expose `stagehand.agent()`.

## QUICKSTART

1. uv sync
2. cp .env.example .env # Add your CEREBRAS_API_KEY and BROWSERBASE_API_KEY
3. uv run python main.py https://your-docs-site.com

## EXPECTED OUTPUT

- Spins up parallel crawl workers with live Browserbase session links
- BFS-crawls the docs site, extracting aria trees and checking for broken links/anchors
- Discovers the GitHub source repository from crawled page content
- Clones the repo and runs a Cerebras verification agent on each page
- Prints a summary table with issue counts by severity and type
- Saves a detailed Markdown report to `docs_report_YYYYMMDD_HHMM.md`

## COMMON PITFALLS

- "Missing required API keys": verify .env contains CEREBRAS_API_KEY and BROWSERBASE_API_KEY
- Playwright not installed: run `playwright install chromium` after `uv sync`
- Cerebras 422 errors: the model may rate-limit under heavy load — reduce MAX_PAGES or MAX_CRAWL_WORKERS in main.py
- Clone failures: ensure the target docs site links to a public GitHub repo
- Find more information on your Browserbase dashboard -> https://www.browserbase.com/sign-in

## USE CASES

- Documentation audits: Automatically verify that API docs match the actual source code before a release.
- Broken link detection: Crawl a docs site and surface all broken external links and internal anchors.
- CI/CD integration: Run as a scheduled check to catch documentation drift as the codebase evolves.

## NEXT STEPS

- Add JSON export: Extend the output to include a machine-readable JSON issues file for downstream tooling.
- Configurable models: Set `CEREBRAS_MODEL` to any model available to your Cerebras account; the template defaults to `gpt-oss-120b`.
- Incremental checks: Cache previously verified pages and only re-check pages whose content has changed.

## HELPFUL RESOURCES

📚 Stagehand Docs: https://docs.stagehand.dev/v4/first-steps/introduction
🎮 Browserbase: https://www.browserbase.com
💡 Try it out: https://www.browserbase.com/playground
🔧 Templates: https://www.browserbase.com/templates
📧 Need help? support@browserbase.com
💬 Discord: http://stagehand.dev/discord

## Repository file access

The verification agent's `read_file` tool accepts repository-relative paths and returns at most 8,000 UTF-8 characters. It rejects absolute paths, parent traversal, symlinks (including links to files inside the clone), directories, special files, and invalid UTF-8. Hidden paths (including `.env`, `.npmrc`, and `.git`), conventional credentials/secrets files, and private-key/certificate-store extensions are unavailable to this tool. Each directory and the final file is opened relative to an owned directory descriptor with symlink following disabled, so replacing a selected path with a symlink cannot redirect that read.

This reader requires descriptor-relative file opening and `O_NOFOLLOW`/`O_DIRECTORY`/`O_NONBLOCK`, available on supported POSIX platforms. It returns an error on platforms without those primitives. The clone root is application-owned; these checks constrain model-selected file paths, not other processes with permission to modify the clone's file contents.

Run the synthetic containment tests from this recipe directory:

```sh
python -B -m unittest discover -s tests -v
```

The tests use temporary fixture files and a synthetic model client. They cover directory swaps, symlinks, special files, and the actual tool result sent into the verification conversation, without reading private files or contacting a provider.

## Analysis completeness

Each crawled page records `analysis_status` (`not_started`, `complete`, or `failed`) and `analysis_mode` (`source` or `content`). A complete model response must contain an `issues` array with valid issue entries. Only a valid empty array means the model reported no findings; malformed JSON, missing fields, provider failures, and unexpected worker exceptions mark the page failed.

The terminal summary and Markdown export include coverage counts and per-page status. Existing crawl findings are retained even if model analysis fails. Source verification that falls back to a tool-free model response is labeled content analysis. Severity filtering does not turn an incomplete run into a clean report.

The application writes its incomplete report, then exits unsuccessfully if any page remains failed or unprocessed. A complete status means the configured analysis returned a valid result for every crawled page; it does not prove the model's findings are accurate or the crawl covered the whole site.
