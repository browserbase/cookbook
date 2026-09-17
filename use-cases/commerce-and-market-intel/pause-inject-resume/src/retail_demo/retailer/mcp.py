"""Retailer-owned tools, as their own MCP server.

This stands in for the internal MCP server your team already runs, exposing
Retailer's own signals. It is registered next to the Stagehand server in the same
agent loop, sharing the same run state and the same live browser session.
Nothing about it is Stagehand-aware -- which is the point. Swapping in the real
server means changing one entry in ``mcp_servers``.
"""

from __future__ import annotations

from typing import Any

from claude_agent_sdk import create_sdk_mcp_server, tool
from pydantic import ValidationError

from .. import log
from ..config import Config
from ..mcp_result import error_result, text_result
from ..state import RunState
from ..stagehand_tools.inject import FINAL_STATE_EXPRESSION
from .signals import CUSTOMER_ID, SEARCH_INTENT, Product, fetch_internal_signals

SERVER_NAME = "retailer_signals"

TOOL_NAMES = ["price_affinity", "read_final_state"]


def create_retailer_server(state: RunState, config: Config) -> Any:
    @tool(
        "price_affinity",
        "Retailer-internal customer segmentation and price affinity. Scores every "
        "product on the shelf for this shopper persona and returns the "
        "recommended SKU. Pass the products you read off the page, or omit them "
        "if a Stagehand extract already put them in run state.",
        {
            "type": "object",
            "properties": {
                "products": {
                    "type": "array",
                    "description": "Shelf products read from the page. Omit to reuse run state.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "name": {"type": "string"},
                            "price": {"type": "number"},
                            "category": {"type": "string"},
                            "inventory": {"type": "integer"},
                            "badge": {"type": "string"},
                        },
                        "required": ["id", "name", "price", "category", "inventory", "badge"],
                    },
                }
            },
            "required": [],
        },
    )
    async def price_affinity(args: dict[str, Any]) -> dict[str, Any]:
        if args.get("products"):
            try:
                state.products = [Product.model_validate(item) for item in args["products"]]
            except ValidationError as error:
                return error_result(f"products failed validation: {error}")

        if not state.products:
            return error_result(
                "No shelf products in state yet. Read the shelf from the page first, "
                "then pass them as `products`."
            )

        log.tool_call("retailer-custom", "price_affinity", f"{len(state.products)} products")
        response = await fetch_internal_signals(
            customer_id=CUSTOMER_ID,
            search_intent=SEARCH_INTENT,
            products=state.products,
        )
        state.signal_response = response
        state.injection_receipt = None
        state.injection_page = None
        state.final_state = None

        log.table(
            [signal.model_dump() for signal in response.signals],
            ["product_id", "affinity_score", "price_affinity", "segment_fit", "reason"],
        )
        await log.pause(
            "Internal affinity and segmentation signals are back. The browser session never ended.",
            config.step_delay_ms,
        )
        return text_result(response.model_dump(mode="json"))

    @tool(
        "read_final_state",
        "Verify the browser-visible outcome: cart status, whether Retailer's data "
        "was injected, and which SKU was selected.",
        {"type": "object", "properties": {}, "required": []},
    )
    async def read_final_state(args: dict[str, Any]) -> dict[str, Any]:
        log.tool_call("retailer-custom", "read_final_state")
        value = await state.require_page().evaluate(FINAL_STATE_EXPRESSION)
        state.final_state = value if isinstance(value, dict) else {"value": value}
        return text_result(state.final_state)

    return create_sdk_mcp_server(
        name=SERVER_NAME,
        version="1.0.0",
        tools=[price_affinity, read_final_state],
    )
