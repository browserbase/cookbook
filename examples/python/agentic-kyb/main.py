"""Single or batch public-registry research. Live execution is explicit."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

from models import Target
from runtime import run_batch


def parser() -> argparse.ArgumentParser:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument(
        "--live", action="store_true", help="authorize this invocation to launch browsers"
    )
    cli.add_argument("--state", choices=["CO", "OH", "WY"])
    cli.add_argument("--name")
    cli.add_argument("--entity-id")
    cli.add_argument("--expected-status")
    cli.add_argument(
        "--input",
        type=Path,
        help="JSONL records with state, legal_name, entity_id, expected_status",
    )
    cli.add_argument("--concurrency", type=int, choices=[1, 2, 3], default=1)
    cli.add_argument("--output", type=Path, default=Path("runs/latest"))
    return cli


async def main() -> int:
    cli = parser()
    args = cli.parse_args()
    if not args.live:
        cli.error("add --live to run browsers; offline tests require no credentials")
    if args.input:
        if args.state or args.name or args.entity_id or args.expected_status:
            cli.error("use either --input or single-request options")
        targets = [
            Target.model_validate_json(line)
            for line in args.input.read_text().splitlines()
            if line.strip()
        ]
    else:
        if not args.state or not args.name:
            cli.error("single lookup requires --state and --name")
        targets = [
            Target(
                state=args.state,
                legal_name=args.name,
                entity_id=args.entity_id,
                expected_status=args.expected_status,
            )
        ]
    if not targets:
        cli.error("input contains no targets")
    if args.output.exists():
        cli.error("choose a new output directory; existing evidence is preserved")
    load_dotenv()
    results, report = await run_batch(targets, args.output, args.concurrency)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "results.jsonl").write_text("".join(r.model_dump_json() + "\n" for r in results))
    (args.output / "summary.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report))
    return 0 if all(r.outcome == "success" for r in results) else 2


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except (ValueError, RuntimeError, OSError) as error:
        print(
            f"Configuration error: {type(error).__name__}. Check inputs and required environment variables.",
            file=sys.stderr,
        )
        raise SystemExit(1) from None
