"""Console narration for the demo."""

from __future__ import annotations

import asyncio
from typing import Any, Iterable, Mapping, Sequence


def step(label: str, message: str) -> None:
    print(f"\n[{label}] {message}")


def tool_call(owner: str, name: str, detail: str = "") -> None:
    suffix = f" {detail}" if detail else ""
    print(f"  [{owner}] {name}{suffix}")


def short_url(url: str | None) -> str:
    if not url:
        return "unknown"
    return url if len(url) <= 80 else f"{url[:77]}..."


async def pause(message: str, ms: int) -> None:
    if ms <= 0:
        return
    print(f"[demo pause] {message} ({ms}ms)")
    await asyncio.sleep(ms / 1000)


def table(rows: Sequence[Mapping[str, Any]], columns: Iterable[str] | None = None) -> None:
    """Minimal console table, standing in for Node's console.table."""
    if not rows:
        print("  (no rows)")
        return

    keys = list(columns) if columns is not None else list(rows[0].keys())
    widths = {
        key: max(len(key), *(len(_cell(row.get(key))) for row in rows))
        for key in keys
    }
    header = "  " + " | ".join(key.ljust(widths[key]) for key in keys)
    print(header)
    print("  " + "-+-".join("-" * widths[key] for key in keys))
    for row in rows:
        print("  " + " | ".join(_cell(row.get(key)).ljust(widths[key]) for key in keys))


def _cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float):
        return f"{value:g}"
    return str(value)
