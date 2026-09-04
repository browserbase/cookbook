"""Shared helper for returning MCP tool results."""

from __future__ import annotations

import json
from typing import Any


def text_result(value: Any) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": json.dumps(value, default=str)}]}


def error_result(message: str) -> dict[str, Any]:
    return {
        "content": [{"type": "text", "text": json.dumps({"error": message})}],
        "isError": True,
    }
