"""Stagehand v4 exposed as MCP tools -- "direct tool calls" mode.

Each tool is a one-line wrapper over a real Stagehand SDK method. That thinness
is the point: v4 has no agent loop of its own, so what Retailer registers here is
exactly what the model can do, and every call is theirs to intercept, log, or
deny.

The set below is 10 of the 90+ methods the SDK exposes, chosen to span both
layers:

  AI-powered        stagehand.act / .observe / .extract
  deterministic     page.goto, page.locator(...).click/fill, page.snapshot,
                    page.evaluate, page.wait_for_selector
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from claude_agent_sdk import create_sdk_mcp_server, tool
from stagehand import Stagehand

from .. import log
from ..config import Config
from ..mcp_result import error_result, text_result
from ..state import RunState
from ..retailer.signals import Shelf
from .inject import inject_signals_expression

# Named for the adapter, not the SDK. Stagehand is the browser intelligence
# layer this server calls into -- it is not itself an MCP server, and a
# namespace like `mcp__stagehand__*` would imply otherwise in every log line.
SERVER_NAME = "browser_tools"

TOOL_NAMES = [
    "browser_open_page",
    "page_wait_for_selector",
    "page_fill",
    "page_click",
    "page_snapshot",
    "page_evaluate",
    "stagehand_act",
    "stagehand_observe",
    "stagehand_extract_shelf",
    "stagehand_inject_signals",
]


def _ai_error(operation: str, error: Exception) -> dict[str, Any]:
    """Surface a failed AI call loudly instead of letting the model route around it.

    A bad model credential is the most common setup mistake, and the failure mode
    without this is a run that "succeeds" via the deterministic tools while the
    AI layer never executed at all.
    """
    message = f"{type(error).__name__}: {error}"
    lowered = message.lower()
    if any(token in lowered for token in ("api key", "unauthorized", "401", "authentication", "credential")):
        message += (
            " -- this is a model credential problem, not a page problem. Check the key for "
            "RETAILER_DEMO_MODEL_NAME's provider. Do not work around it with page_evaluate; "
            "report it and stop."
        )
    print(f"  [stagehand-v4] {operation}() FAILED: {message}")
    return error_result(message)


def make_inject_signals_tool(stagehand: Stagehand, state: RunState, config: Config) -> Any:
    """Shared by both modes: writing Retailer's decision back into the live page."""

    @tool(
        "stagehand_inject_signals",
        "Resume browser work by writing Retailer's decision data into the live page: "
        "highlights the recommended SKU, renders affinity scores, and reorders the "
        "shelf. Requires retailer_signals__price_affinity to have run first. "
        "Wraps page.evaluate(expression).",
        {"type": "object", "properties": {}, "required": []},
    )
    async def stagehand_inject_signals(args: dict[str, Any]) -> dict[str, Any]:
        if state.signal_response is None:
            return error_result(
                "No Retailer signals yet. Call mcp__retailer_signals__price_affinity first."
            )
        state.stagehand_tool_invocations += 1
        log.tool_call("stagehand-v4", "stagehand_inject_signals", state.signal_response.recommended_product_id)
        token = str(uuid4())
        state.final_state = None
        state.injection_receipt = None
        state.injection_page = None
        page = state.require_page()
        value = await page.evaluate(
            inject_signals_expression(state.signal_response.model_dump(mode="json"), token)
        )
        if not isinstance(value, dict) or value.get("injected") is not True or value.get("token") != token:
            return error_result("Injection did not return a valid observation receipt.")
        state.injection_receipt = value
        state.injection_page = page
        await log.pause(
            "Injected signals are visible in the page. The same session resumes from here.",
            config.step_delay_ms,
        )
        return text_result(value)

    return stagehand_inject_signals


def create_stagehand_server(stagehand: Stagehand, state: RunState, config: Config) -> Any:
    def count(name: str, detail: str = "") -> None:
        state.stagehand_tool_invocations += 1
        log.tool_call("stagehand-v4", name, detail)

    @tool(
        "browser_open_page",
        "Open a URL in the live browser session. Navigates the tab that is already "
        "open, so the session keeps exactly one tab and is never torn down.",
        {"url": str},
    )
    async def browser_open_page(args: dict[str, Any]) -> dict[str, Any]:
        url = args["url"]
        count("browser_open_page", log.short_url(url))
        if state.page is None:
            # A session already ships with one about:blank tab. Navigating it
            # instead of calling new_page() keeps the run to a single tab --
            # otherwise the replay opens with an orphaned blank one.
            state.page = await stagehand.browser.context.active_page()
        if state.page is None:
            state.page = await stagehand.browser.context.new_page(url)
        else:
            await state.page.goto(url)
        return text_result({"opened": True, "url": await state.page.url()})

    @tool(
        "page_wait_for_selector",
        "Deterministically wait until a CSS selector reaches a state. "
        "Wraps page.wait_for_selector(selector, state=..., timeout=...).",
        {
            "type": "object",
            "properties": {
                "selector": {"type": "string", "description": "CSS selector to wait for"},
                "state": {
                    "type": "string",
                    "enum": ["attached", "detached", "visible", "hidden"],
                    "description": "Defaults to attached",
                },
                "timeout_ms": {"type": "integer", "description": "Defaults to 10000"},
            },
            "required": ["selector"],
        },
    )
    async def page_wait_for_selector(args: dict[str, Any]) -> dict[str, Any]:
        selector = args["selector"]
        count("page_wait_for_selector", selector)
        matched = await state.require_page().wait_for_selector(
            selector,
            state=args.get("state") or "attached",
            timeout=int(args.get("timeout_ms") or 10_000),
        )
        return text_result({"selector": selector, "matched": matched})

    @tool(
        "page_fill",
        "Fill an input deterministically. Wraps page.locator(selector).fill(value).",
        {"selector": str, "value": str},
    )
    async def page_fill(args: dict[str, Any]) -> dict[str, Any]:
        count("page_fill", args["selector"])
        await state.require_page().locator(args["selector"]).fill(args["value"])
        await log.pause("Search text filled. The harness can inspect or branch here.", config.action_delay_ms)
        return text_result({"filled": True, "selector": args["selector"]})

    @tool(
        "page_click",
        "Click an element deterministically. Wraps page.locator(selector).click().",
        {"selector": str},
    )
    async def page_click(args: dict[str, Any]) -> dict[str, Any]:
        count("page_click", args["selector"])
        await state.require_page().locator(args["selector"]).click()
        await log.pause("Click dispatched in the live session.", config.action_delay_ms)
        return text_result({"clicked": True, "selector": args["selector"]})

    @tool(
        "page_snapshot",
        "Token-efficient accessibility snapshot of the page, with a map of "
        "reusable XPaths. Wraps page.snapshot(). This is what replaces v3's "
        "observe-for-context step.",
        {"type": "object", "properties": {}, "required": []},
    )
    async def page_snapshot(args: dict[str, Any]) -> dict[str, Any]:
        count("page_snapshot")
        snapshot = await state.require_page().snapshot()
        tree = snapshot.formatted_tree
        return text_result({
            "formatted_tree": tree if len(tree) <= 4000 else tree[:4000] + "\n...(truncated)",
            "reusable_locator_count": len(snapshot.xpath_map),
            "tree_chars": len(tree),
        })

    @tool(
        "page_evaluate",
        "Run a JavaScript expression in the page and return its JSON value. "
        "Deterministic escape hatch for page state that has no dedicated tool. "
        "Wraps page.evaluate(expression).",
        {"expression": str},
    )
    async def page_evaluate(args: dict[str, Any]) -> dict[str, Any]:
        count("page_evaluate")
        value = await state.require_page().evaluate(args["expression"])
        return text_result({"value": value})

    @tool(
        "stagehand_act",
        "Take a natural-language action on the page. Self-healing: if the site "
        "changes, Stagehand re-resolves the target instead of failing. "
        "Wraps stagehand.act(instruction).",
        {"instruction": str},
    )
    async def stagehand_act(args: dict[str, Any]) -> dict[str, Any]:
        count("stagehand_act", args["instruction"])
        try:
            result = await stagehand.act(args["instruction"])
        except Exception as error:
            return _ai_error("act", error)
        state.record_cache("act", result.metadata.cache.status)
        await log.pause("act() completed.", config.action_delay_ms)
        return text_result({
            "success": result.data.success,
            "message": result.data.message,
            "action_description": result.data.action_description,
            "cache": result.metadata.cache.status,
        })

    @tool(
        "stagehand_observe",
        "Ask what is actionable on the page and get back candidate selectors with "
        "descriptions, which you can then drive deterministically with page_click "
        "or page_fill. Wraps stagehand.observe(instruction).",
        {"instruction": str},
    )
    async def stagehand_observe(args: dict[str, Any]) -> dict[str, Any]:
        count("stagehand_observe", args["instruction"])
        try:
            result = await stagehand.observe(args["instruction"])
        except Exception as error:
            return _ai_error("observe", error)
        state.record_cache("observe", result.metadata.cache.status)
        return text_result({
            "actions": [
                {"selector": action.selector, "description": action.description}
                for action in result.data
            ],
            "cache": result.metadata.cache.status,
        })

    @tool(
        "stagehand_extract_shelf",
        "Extract the product shelf into structured, schema-validated data "
        "(id, name, price, category, inventory, badge for every card). "
        "Wraps stagehand.extract(instruction, Shelf).",
        {"instruction": str},
    )
    async def stagehand_extract_shelf(args: dict[str, Any]) -> dict[str, Any]:
        count("stagehand_extract_shelf")
        try:
            result = await stagehand.extract(args["instruction"], Shelf)
        except Exception as error:
            return _ai_error("extract", error)
        state.products = result.data.products
        state.record_cache("extract", result.metadata.cache.status)
        log.table(
            [product.model_dump() for product in state.products],
            ["id", "name", "price", "category", "inventory"],
        )
        return text_result({
            "products": [product.model_dump() for product in state.products],
            "cache": result.metadata.cache.status,
        })

    server = create_sdk_mcp_server(
        name=SERVER_NAME,
        version="1.0.0",
        tools=[
            browser_open_page,
            page_wait_for_selector,
            page_fill,
            page_click,
            page_snapshot,
            page_evaluate,
            stagehand_act,
            stagehand_observe,
            stagehand_extract_shelf,
            make_inject_signals_tool(stagehand, state, config),
        ],
    )
    return server
