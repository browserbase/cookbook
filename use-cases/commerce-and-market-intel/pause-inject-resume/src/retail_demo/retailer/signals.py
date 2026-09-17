"""Retailer-owned decision logic.

This module is the stand-in for Retailer's real internal price-affinity and
customer-segmentation service. It is deliberately the only place in the demo
that "knows" anything about customers: Stagehand never sees it, and the agent
reaches it only through the ``retailer_signals`` MCP server.

To make this real, replace the body of ``fetch_internal_signals`` with a call
to the internal API from inside Retailer's own network context. Nothing else in
the demo has to change.
"""

from __future__ import annotations

import asyncio
import math
import re
from datetime import datetime, timezone

from pydantic import BaseModel, Field

CUSTOMER_ID = "wmt-customer-1047"
SEARCH_INTENT = "family back to school essentials"

_VALUE_BRANDS = re.compile(r"Mainstays|Great Value|Parent's Choice")


class Product(BaseModel):
    id: str = Field(description="The data-product-id attribute of the shelf card")
    name: str = Field(description="Product display name")
    price: float = Field(description="Price in dollars")
    category: str = Field(description="One of: school, grocery, household, electronics")
    inventory: int = Field(description="Units available")
    badge: str = Field(description="Merchandising badge shown on the card")


class Shelf(BaseModel):
    """Extraction target for ``stagehand.extract``."""

    products: list[Product]


class ProductSignal(BaseModel):
    product_id: str
    affinity_score: int
    price_affinity: int
    segment_fit: int
    reason: str


class RetailerSignalResponse(BaseModel):
    customer_id: str
    segment: str
    budget_ceiling: float
    generated_at: str
    recommended_product_id: str
    signals: list[ProductSignal]


def _js_round(value: float) -> int:
    """Match JavaScript's Math.round (half away from zero on .5)."""
    return math.floor(value + 0.5)


async def fetch_internal_signals(
    customer_id: str,
    search_intent: str,
    products: list[Product],
) -> RetailerSignalResponse:
    # Stands in for the latency of a real internal service call.
    await asyncio.sleep(0.65)

    segment = "value-family"
    budget_ceiling = 45.0

    signals: list[ProductSignal] = []
    for product in products:
        price_affinity = max(0, _js_round(100 - abs(product.price - budget_ceiling) * 1.8))
        category_boost = 18 if product.category == "school" else 10 if product.category == "household" else 0
        brand_boost = 12 if _VALUE_BRANDS.search(product.name) else 4
        inventory_boost = 8 if product.inventory > 50 else 4 if product.inventory > 20 else 0
        signals.append(
            ProductSignal(
                product_id=product.id,
                affinity_score=min(99, price_affinity + category_boost + brand_boost + inventory_boost),
                price_affinity=price_affinity,
                segment_fit=category_boost + brand_boost,
                reason=(
                    "Within value-family budget and aligned to the trip intent."
                    if product.price <= budget_ceiling
                    else "Relevant, but above this customer segment's preferred price band."
                ),
            )
        )

    signals.sort(key=lambda signal: signal.affinity_score, reverse=True)
    recommended = signals[0].product_id if signals else (products[0].id if products else "unknown")

    return RetailerSignalResponse(
        customer_id=customer_id,
        segment=segment,
        budget_ceiling=budget_ceiling,
        generated_at=datetime.now(timezone.utc).isoformat(),
        recommended_product_id=recommended,
        signals=signals,
    )
