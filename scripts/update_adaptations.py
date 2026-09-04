#!/usr/bin/env python3
"""Record reviewed destination adaptations without changing source provenance."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "SOURCE_MANIFEST.json"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reason", required=True)
    parser.add_argument(
        "--preserve-existing-reason",
        action="store_true",
        help="refresh an existing adaptation digest without replacing its reviewed reason",
    )
    parser.add_argument("paths", nargs="+")
    args = parser.parse_args()
    if not args.reason.strip():
        parser.error("--reason must not be blank")

    data = json.loads(MANIFEST.read_text())
    entries = {
        entry["path"]: entry
        for source in data["sources"]
        for entry in source["files"]
    }
    requested = []
    for raw in args.paths:
        path = Path(raw)
        absolute = path.resolve() if path.is_absolute() else (ROOT / path).resolve()
        try:
            relative = absolute.relative_to(ROOT).as_posix()
        except ValueError as error:
            parser.error(f"path is outside the repository: {raw}")
        if relative not in entries:
            parser.error(f"path is not an imported source entry: {relative}")
        if not absolute.is_file():
            parser.error(f"path is not a file: {relative}")
        requested.append((relative, absolute))

    for relative, absolute in requested:
        existing = entries[relative].get("adaptation")
        reason = (
            existing["reason"]
            if args.preserve_existing_reason and isinstance(existing, dict)
            and isinstance(existing.get("reason"), str) and existing["reason"].strip()
            else args.reason.strip()
        )
        entries[relative]["adaptation"] = {
            "sha256": hashlib.sha256(absolute.read_bytes()).hexdigest(),
            "reason": reason,
        }
    MANIFEST.write_text(json.dumps(data, indent=2) + "\n")
    for relative, _ in requested:
        print(relative)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
