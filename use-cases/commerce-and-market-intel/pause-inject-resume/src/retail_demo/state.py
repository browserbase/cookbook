"""Run state shared between the two MCP servers.

Both servers close over one instance. That sharing is the point of running them
in-process: Retailer-owned tools and Stagehand tools operate on the same live
browser session and the same application state, without a serialization layer
between them.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from stagehand import Page

from .retailer.signals import Product, RetailerSignalResponse


@dataclass
class RunState:
    page: Page | None = None
    products: list[Product] = field(default_factory=list)
    signal_response: RetailerSignalResponse | None = None
    final_state: dict[str, Any] | None = None
    injection_receipt: dict[str, Any] | None = None
    injection_page: Page | None = None

    # Dispatches counted by the Stagehand adapters; not network requests.
    stagehand_tool_invocations: int = 0
    cache_events: list[tuple[str, str]] = field(default_factory=list)

    def require_page(self) -> Page:
        if self.page is None:
            raise RuntimeError("No page is open yet. Call browser_open_page first.")
        return self.page

    def record_cache(self, operation: str, status: str) -> None:
        self.cache_events.append((operation, status))
