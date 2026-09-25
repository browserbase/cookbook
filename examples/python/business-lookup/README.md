# Business lookup with a Python agent

Stagehand is the SDK for browser agents.

This template uses LangChain Deep Agents for the reasoning loop and Stagehand V4 code mode for the
browser. The agent opens San Francisco's official Open Data API, finds an exact DBA record, and
returns a Pydantic object, then checks the requested DBA and official source reference.

## How it works

- `create_deep_agent` owns planning, model calls, and structured output.
- Stagehand code mode exposes one persistent Browserbase session through `run`, `snapshot`, and
  `screenshot` MCP tools.
- Vercel AI Gateway supplies the bring-your-own agent model.
- The Stagehand MCP server runs in an isolated `uvx` environment because the current Stagehand and
  Deep Agents clients require different `websockets` versions.
- The template closes the MCP session and browser process automatically.

## Quickstart

Requirements: Python 3.11–3.13 and [uv](https://docs.astral.sh/uv/).

```bash
cp .env.example .env
# Add BROWSERBASE_API_KEY and AI_GATEWAY_API_KEY to .env.
uv sync
uv run python main.py
```

The first run installs the Stagehand Deep Agents integration from `stagehand/main` in `uvx`; the
integration pins its Stagehand server dependency to `stagehand==4.0.0`.

## Expected outcome

The agent opens the official SF Open Data JSON endpoint and returns the exact Jalebi Street record,
including its business account number, location ID, address, NAICS data when present, and the
official source URL. The script exits nonzero if the returned DBA or source reference does not match, or the account number is blank. Name matching ignores case and repeated whitespace, but preserves punctuation and suffixes. The source must identify the official dataset and the same requested query, without extra query clauses.

These checks validate the returned identity and reference. They do not independently prove that the model read the cited page or that every reported field matches the underlying record. Treat the result as research requiring review.

## Configuration

- `BROWSERBASE_API_KEY`: launches the Browserbase session.
- `AI_GATEWAY_API_KEY`: authenticates the Deep Agents model through Vercel AI Gateway.
- `DEEPAGENTS_MODEL`: optional model override; defaults to `anthropic/claude-sonnet-4.6`.
- `STAGEHAND_RUN_TIMEOUT_MS`: optional browser-tool timeout; defaults to 120 seconds.

## Resources

- [Stagehand V4 documentation](https://docs.stagehand.dev/v4)
- [Stagehand Deep Agents integration](https://github.com/browserbase/stagehand/tree/main/packages/integrations/deepagents)
- [Browserbase sessions](https://www.browserbase.com/overview/sessions)

## Local verification

Run `python3 -B -m unittest discover -s tests -v`. Five suites cover exact and near-matching names, URL encoding, the official origin/dataset/query, duplicate or injected query parameters, missing identifiers, and the actual caller's validation-before-output and session cleanup. Fixtures use synthetic businesses and mocked agent/model boundaries; no government lookup, model request, or real business record is used.
