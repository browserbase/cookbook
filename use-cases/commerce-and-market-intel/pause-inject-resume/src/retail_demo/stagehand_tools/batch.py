"""Stagehand v4 exposed as a code-mode tool -- the batching path.

Instead of one tool call per browser action, the model writes a Stagehand script
and Stagehand ships it to the extension running next to the browser, where the
whole sequence executes inside one batch invocation. Same SDK, same session, same
Retailer tools in the loop -- only the granularity changes.

Note that the Python SDK takes ``experimental_batch(source: str, ...)``: the
script is JavaScript, because it runs in the browser worker, not in this
process.
"""

from __future__ import annotations

from typing import Any

from claude_agent_sdk import create_sdk_mcp_server, tool
from stagehand import Stagehand

from .. import log
from ..config import Config
from ..mcp_result import error_result, text_result
from ..state import RunState
from .mcp import SERVER_NAME, make_inject_signals_tool

TOOL_NAMES = ["stagehand_batch", "stagehand_inject_signals"]

_BATCH_DESCRIPTION = """Run a Stagehand script inside the browser through one batch invocation.

`source` is a JavaScript arrow function: async (batch, input) => { ... }

CRITICAL: the script is serialized and executed next to the browser, NOT in the
host process. It cannot reference anything outside itself -- no host variables,
no imports, no closures. Everything it needs must arrive through `input`, which
must be JSON-serializable. Return a JSON-serializable value.

`batch` gives you the full Stagehand object model:
  batch.page          goto, locator(sel).click()/fill(), snapshot(),
                      wait_for_selector(), evaluate(), url(), title()
  batch.context       new_page(url), pages(), cookies()
  batch.act(instruction)            natural-language action
  batch.observe(instruction)        candidate selectors
  batch.extract(instruction, schema) structured data
  batch.metrics()                   token usage so far

Example:
  async (batch, input) => {
    await batch.page.goto(input.url);
    await batch.page.locator("#search-input").fill(input.query);
    await batch.page.locator("#apply-search").click();
    await batch.page.waitForSelector('body[data-search-applied="true"]');
    return await batch.page.evaluate(`Array.from(document.querySelectorAll("[data-product-id]")).length`);
  }

Prefer packing several actions into one script -- that is the entire point of
this mode."""


def create_batch_server(stagehand: Stagehand, state: RunState, config: Config) -> Any:
    @tool(
        "stagehand_batch",
        _BATCH_DESCRIPTION,
        {
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "description": "JavaScript arrow function: async (batch, input) => {...}",
                },
                "input": {
                    "type": "object",
                    "description": "JSON-serializable values the script needs. It cannot see anything else.",
                },
                "why": {
                    "type": "string",
                    "description": "One sentence on what this script accomplishes.",
                },
            },
            "required": ["source"],
        },
    )
    async def stagehand_batch(args: dict[str, Any]) -> dict[str, Any]:
        state.stagehand_tool_invocations += 1
        log.tool_call("stagehand-v4", "stagehand_batch", args.get("why", ""))
        try:
            value = await stagehand.experimental_batch(
                args["source"],
                args.get("input") or {},
                timeout=60_000,
            )
        except Exception as error:  # surfaced to the model so it can repair the script
            return error_result(f"{type(error).__name__}: {error}")
        await log.pause("Batch invocation finished.", config.action_delay_ms)
        return text_result({"value": value})

    return create_sdk_mcp_server(
        name=SERVER_NAME,
        version="1.0.0",
        tools=[stagehand_batch, make_inject_signals_tool(stagehand, state, config)],
    )
