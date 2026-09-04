# LangChain Deep Agents + Browserbase (Python)

This example shows the implementation pattern that fits LangChain Deep Agents best in Python:

- Give the main Deep Agent cheap Browserbase-backed tools for `search` and `fetch`
- Add a specialized browser subagent for heavier rendered or interactive browser work
- Gate stateful browser actions behind Deep Agents `interrupt_on`

It intentionally does **not** route the agent through the Browserbase CLI. Deep Agents already wants Python tools, subagents, and interrupt handling, so the clean integration is to expose Browserbase as Python tools directly.

## Architecture

- `browserbase_search`: fast discovery with Browserbase Search
- `browserbase_fetch`: Browserbase Fetch / Fetch Extract for raw, markdown, or structured JSON retrieval
- `browserbase_rendered_extract`: Stagehand-backed rendered extraction for JS-heavy pages
- `browserbase_interactive_task`: a Deep Agents loop using persistent Stagehand code-mode MCP tools for clicks, typing, login, or form submission
- `browser-specialist` subagent: isolates browser-heavy work from the main planner

## Requirements

- Python 3.11+
- `BROWSERBASE_API_KEY` for Browserbase Search, Fetch, and browser sessions
- An OpenAI-compatible base URL for the Deep Agent model if you are not using direct OpenAI

Both the main planner and interactive browser model use `model_config.py`:

- `OPENAI_API_KEY` takes precedence when nonempty.
- Otherwise, `BROWSERBASE_API_KEY` is used only when a compatible gateway base URL is configured.
- `DEEPAGENT_BASE_URL` takes precedence over `OPENAI_BASE_URL`. Without either, an OpenAI key is required for direct OpenAI access.
- Browserbase tools always require `BROWSERBASE_API_KEY`, independently of model credentials.

Use a gateway that accepts the selected credential and model. Supplying a URL does not establish provider compatibility. Invalid or incomplete model configuration fails before an interactive MCP client is created, and missing Browserbase credentials fail agent construction.

The main planner defaults to `gpt-5.4` (`DEEPAGENT_MODEL` or `--model`). The interactive model also defaults to `gpt-5.4`, with an independent `STAGEHAND_AGENT_MODEL` override read at invocation time after `.env` loading. `--model` affects only the main planner. Rendered extraction uses the installed Stagehand SDK's default model.

## Install

```bash
cd integrations/examples/integrations/langchain/deepagents-browserbase
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Environment

```bash
export BROWSERBASE_API_KEY="bb_..."

# Choose direct OpenAI access:
export OPENAI_API_KEY="your-openai-key"

# Or omit OPENAI_API_KEY and use a compatible gateway with BROWSERBASE_API_KEY.
# Model and endpoint overrides:
export DEEPAGENT_MODEL="gpt-5.4"
export DEEPAGENT_BASE_URL="https://<your-openai-compatible-gateway>"
export STAGEHAND_AGENT_MODEL="anthropic/claude-sonnet-4-6"
```

## Run

Use the default research prompt:

```bash
python main.py
```

Or pass your own:

```bash
python main.py "Research the Browserbase Fetch API and explain when the agent should escalate to a full browser session."
```

## Approval flow

The sample configures `interrupt_on` for `browserbase_interactive_task`.

When the agent wants to click, type, log in, or submit a form, the script pauses and asks you to:

- `approve`
- `edit`
- `reject`

This is the right place to put human approval in a Deep Agents + Browserbase design, because the approval happens at the tool boundary instead of being hidden inside ad hoc shell calls.

## Notes

- The interactive tool creates an MCP client, loads the Stagehand code tools, and runs a nested Deep Agent within the client session context.
- Browserbase Fetch supports `raw`, `markdown`, and `json` output in the Python SDK starting with `browserbase` `1.11.0`, which is why this example now requires that version or newer.
- Browserbase’s Stagehand quickstart documents that Model Gateway works with just `BROWSERBASE_API_KEY` for Stagehand browser workflows.
- I did not hardcode a Browserbase model-gateway URL for the LangChain model client because I did not find an official doc page in the Browserbase docs that specifies a general-purpose OpenAI-compatible endpoint for LangChain. The sample therefore accepts `DEEPAGENT_BASE_URL` or `OPENAI_BASE_URL` explicitly.

## Local configuration checks

```bash
python -B -m unittest discover -s tests -v
```

These tests exercise the shared resolver and actual main/interactive function bodies with synthetic environment values, model constructors, and MCP sessions. They cover gateway-only credentials, direct OpenAI, precedence, invalid endpoints, startup rejection, and interactive session cleanup. They do not contact a provider or prove gateway compatibility, a live browser action, or the full Deep Agents interrupt flow.

## Suggested prompts

- `Research Browserbase Search, Fetch, and browser sessions. Give me a decision tree with citations.`
- `Use browserbase_fetch with markdown output on https://docs.browserbase.com/platform/fetch/overview and summarize the fetch limits.`
- `Use browserbase_fetch with JSON output to extract the page title and one-sentence summary from https://www.browserbase.com/.`
- `Open docs.browserbase.com and extract the limits of the Fetch API from the rendered docs page.`
- `Go to example.com and tell me whether any interactive action would be required to complete the task.`
