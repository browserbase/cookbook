"""The agent loop.

There is no Stagehand agent here. Claude Agent SDK owns the loop, and Stagehand
is registered beside Retailer's own tools as one more MCP server. This file is
where you decide which tools exist, what order is acceptable, when to pause, and
what to log. In v3 it could not have been written: the loop lived inside
Stagehand.
"""

from __future__ import annotations

from typing import Any

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ResultMessage,
    ToolUseBlock,
    query,
)

from . import log
from .config import Config
from .stagehand_tools import batch as batch_tools
from .stagehand_tools import mcp as stagehand_mcp
from .retailer import mcp as retailer_mcp
from .retailer.signals import CUSTOMER_ID, SEARCH_INTENT

_SHARED_RULES = """You are a Retailer synthetic user-testing agent.

Persona: value-family parent, customer id {customer_id}.
Shopping intent: {search_intent}.

You have two independent tool families in this loop:
  mcp__browser_tools__*     Browser tools backed by Stagehand v4 -- they drive one live session.
  mcp__retailer_signals__*   Retailer-owned internal tools -- segmentation and price affinity.

The point of this run is that the browser session survives the pause. Do not try
to restart or reopen the browser after calling a Retailer tool; the same session
is still there and still on the same page.

Required outcome, in this order:
1. Get the Retailer shelf open in the browser.
2. Put the shopping intent into the search box and submit it.
3. Read the shelf products (id, name, price, category, inventory, badge).
4. PAUSE browser work and call mcp__retailer_signals__price_affinity with those products.
5. Call mcp__browser_tools__stagehand_inject_signals to write that decision into the live page.
6. RESUME browser work: add the recommended SKU to the cart. Its add-to-cart button is
   `[data-product-id="<recommended_product_id>"] [data-action="add-to-cart"]`.
7. Call mcp__retailer_signals__read_final_state and confirm the selected SKU matches the
   recommended one. Then stop and summarize in two sentences.

Useful page state you can wait on:
  body[data-search-applied="true"]           the search was submitted
  body[data-external-data-injected="true"]   Retailer signals are in the page
  #cart-status[data-added="true"]            an item reached the cart

Do not use filesystem, shell, or web-search tools; they are disabled."""

_TOOLS_MODE_RULES = """
This run is in DIRECT TOOL CALL mode. Choose one Stagehand tool at a time.
You have both AI-powered tools (stagehand_act, stagehand_observe,
stagehand_extract_shelf) and deterministic ones (page_click, page_fill,
page_snapshot, page_wait_for_selector, page_evaluate). Prefer the deterministic
tools when you already know the selector, and the AI tools when you need to
understand or interpret the page. Use stagehand_extract_shelf to read the
products in step 3."""

_CODE_MODE_RULES = """
This run is in CODE mode. Instead of one tool call per action, you write
Stagehand scripts and send them with mcp__browser_tools__stagehand_batch. Each call
executes the whole script next to the browser through one batch invocation.

Pack as much as possible into each script. Two scripts are enough for this task:

  Script 1 -- open the shelf, fill and submit the search, and read EVERY product
  card in full. Each record needs all six fields: id (the data-product-id
  attribute), name (the [data-name] text), price, category, inventory, badge.
  Read them all in this one script; do not come back for missing fields.

  Script 2 -- after the Retailer data is injected, add the recommended SKU to the
  cart and confirm the cart status.

The script cannot see anything in the host process. Pass the URL, the query, and
the recommended SKU through `input`. A page is already open for you, so start
with `await batch.page.goto(input.url)`."""

_PROMPT = """Run the Retailer synthetic user test for customer {customer_id}.

The shelf is at {url}.
Shopping intent: {search_intent}.

Demonstrate that the browser session can pause for Retailer's internal signals,
receive them, and resume -- and that the SKU that ends up in the cart is the one
Retailer's own logic recommended. Report the observed sequence without claiming proof of what caused the model's choice."""


def build_options(stagehand: Any, state: Any, config: Config) -> ClaudeAgentOptions:
    retailer_server = retailer_mcp.create_retailer_server(state, config)

    if config.harness_mode == "code":
        stagehand_server = batch_tools.create_batch_server(stagehand, state, config)
        stagehand_tool_names = batch_tools.TOOL_NAMES
        mode_rules = _CODE_MODE_RULES
    else:
        stagehand_server = stagehand_mcp.create_stagehand_server(stagehand, state, config)
        stagehand_tool_names = stagehand_mcp.TOOL_NAMES
        mode_rules = _TOOLS_MODE_RULES

    allowed_tools = [
        f"mcp__{stagehand_mcp.SERVER_NAME}__{name}" for name in stagehand_tool_names
    ] + [f"mcp__{retailer_mcp.SERVER_NAME}__{name}" for name in retailer_mcp.TOOL_NAMES]

    system_prompt = (
        _SHARED_RULES.format(customer_id=CUSTOMER_ID, search_intent=SEARCH_INTENT) + "\n" + mode_rules
    )

    options = ClaudeAgentOptions(
        mcp_servers={
            stagehand_mcp.SERVER_NAME: stagehand_server,
            retailer_mcp.SERVER_NAME: retailer_server,
        },
        allowed_tools=allowed_tools,
        # [] disables every built-in tool: no filesystem, shell, or web search.
        tools=[],
        # Do not inherit the operator's ~/.claude settings, so the run is the
        # same on Retailer's machines as on ours.
        setting_sources=[],
        permission_mode="dontAsk",
        max_turns=30,
        system_prompt=system_prompt,
    )
    if config.claude_model:
        options.model = config.claude_model
    return options


async def run_harness(stagehand: Any, state: Any, config: Config, url: str) -> None:
    options = build_options(stagehand, state, config)

    log.step(
        "agent loop",
        f"Claude Agent SDK owns the loop in '{config.harness_mode}' mode. "
        f"Stagehand v4 and Retailer tools are registered as two separate MCP servers.",
    )
    registered = []
    for qualified in options.allowed_tools:
        _, server, name = qualified.split("__", 2)
        registered.append({
            "owner": "stagehand-v4" if server == stagehand_mcp.SERVER_NAME else "retailer-custom",
            "server": server,
            "tool": name,
        })
    log.table(registered, ["owner", "server", "tool"])

    prompt = _PROMPT.format(customer_id=CUSTOMER_ID, url=url, search_intent=SEARCH_INTENT)

    try:
        async for message in query(prompt=prompt, options=options):
            _log_message(message)
    except Exception as error:
        raise RuntimeError(f"Claude Agent SDK harness failed: {_failure_message(error)}") from error


def _log_message(message: Any) -> None:
    if isinstance(message, AssistantMessage):
        for block in message.content:
            if isinstance(block, ToolUseBlock):
                print(f"\n[claude agent] requested {block.name}")
        return

    if isinstance(message, ResultMessage):
        status = "success" if message.subtype == "success" else message.subtype
        cost = getattr(message, "total_cost_usd", None)
        cost_text = f" cost=${cost}" if cost is not None else ""
        print(f"\n[claude agent] result={status} turns={message.num_turns}{cost_text}")


def _failure_message(error: Exception) -> str:
    message = str(error)
    lowered = message.lower()
    if any(token in lowered for token in ("anthropic_api_key", "authentication", "api key", "401", "oauth")):
        return f"{message} -- check ANTHROPIC_API_KEY or your Claude Agent SDK auth setup."
    if "claude code not found" in lowered:
        return (
            f"{message} -- claude-agent-sdk could not find its CLI. Install it with "
            "`npm install -g @anthropic-ai/claude-code`, or set cli_path in ClaudeAgentOptions."
        )
    return message
