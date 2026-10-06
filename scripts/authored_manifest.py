#!/usr/bin/env python3
"""Record cookbook-authored files inside imported collection boundaries."""

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COLLECTIONS = ("examples", "integrations", "playbook", "projects")
IGNORED_PARTS = {".git", ".audit", ".next", ".venv", "node_modules", "__pycache__"}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_paths(root):
    manifest = json.loads((root / "SOURCE_MANIFEST.json").read_text())
    return {item["path"] for source in manifest["sources"] for item in source.get("files", [])}


def authored_paths(root):
    imported = source_paths(root)
    paths = []
    for collection in COLLECTIONS:
        base = root / collection
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            relative = path.relative_to(root)
            if (
                any(part in IGNORED_PARTS or part.endswith(".egg-info") for part in relative.parts)
                or path.suffix == ".tsbuildinfo"
                or not path.is_file()
                or path.is_symlink()
            ):
                continue
            if relative.as_posix() not in imported:
                paths.append(relative.as_posix())
    return sorted(paths)


def records(root):
    return [
        {
            "path": relative,
            "sha256": digest(root / relative),
            "reason": "Cookbook-authored migration, test, configuration, or collection metadata outside the pinned upstream tree.",
        }
        for relative in authored_paths(root)
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("check", "refresh"))
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    root = args.root.resolve()
    expected = {"schema_version": 1, "files": records(root)}
    manifest = root / "COOKBOOK_AUTHORED.json"
    if args.command == "refresh":
        manifest.write_text(json.dumps(expected, indent=2) + "\n")
        print(f"Recorded {len(expected['files'])} cookbook-authored collection files.")
        return 0
    try:
        current = json.loads(manifest.read_text())
    except (OSError, ValueError):
        print("COOKBOOK_AUTHORED.json is missing or invalid.")
        return 1
    if current != expected:
        print("Cookbook-authored provenance drift. Review files, then run scripts/authored_manifest.py refresh.")
        return 1
    print(f"Cookbook-authored provenance is current ({len(expected['files'])} files).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
