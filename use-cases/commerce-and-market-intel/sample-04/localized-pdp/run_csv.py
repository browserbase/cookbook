#!/usr/bin/env python3
"""
Orchestrator: process the customer's CSV using cached Browserbase Contexts.

Workflow:
  1. Read CSV (columns: domain, agent, product_id, localization_value, localization_kind)
  2. For each unique (domain, kind, value) — bootstrap a Context if missing
  3. Fan out product fetches in parallel against existing contexts

Usage:
    python run_csv.py path/to/tc_and_hd_pdp_input_sample.csv [--limit N] [--workers W]

The CSV has 3 localization_kind values:
    - "zip" (HD + TSC): we type the ZIP into the store-locator UI
    - "store_id" (HD): a 4-digit store number — needs entry in STOREID_TO_ZIP
    - "store_id_4digit_hint" (TSC): same idea

For store_id rows, fill in STOREID_TO_ZIP in proxy_geo.py with the ZIP for
each store. Without that mapping, those rows will fail with a clear message.
"""
import argparse
import csv
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import bootstrap_context as boot
import fetch_product as fp

HERE = Path(__file__).parent
REQUIRED_COLUMNS = (
    "domain", "product_id", "localization_value", "localization_kind"
)


def build_product_url(domain: str, product_id: str) -> str:
    if domain == "homedepot":
        # HD canonicalizes /p/<id> -> /p/<slug>/<id> automatically
        return f"https://www.homedepot.com/p/{product_id}"
    if domain == "tractorsupply":
        return f"https://www.tractorsupply.com/tsc/product/{product_id}"
    raise ValueError(f"unknown domain: {domain}")


def ensure_context(domain: str, kind: str, value: str) -> str | None:
    """Return context_id, bootstrapping if missing. None on bootstrap failure."""
    m = boot.load_map()
    key = f"{domain}:{kind}:{value}"
    if key in m:
        return m[key]
    print(f"[bootstrap] {key} — running one-time ceremony...")
    try:
        return boot.bootstrap(domain, kind, value)
    except Exception as e:
        print(f"[bootstrap] FAILED for {key}: {type(e).__name__}: {e}")
        return None


def process_row(row: dict) -> dict:
    domain = row["domain"]
    kind = row["localization_kind"]
    val = row["localization_value"]
    product_id = row["product_id"]

    url = build_product_url(domain, product_id)
    try:
        result = fp.fetch(domain, kind, val, url)
        return {**result, "product_id": product_id}
    except Exception as e:
        return {"domain": domain, "product_id": product_id,
                "kind": kind, "value": val,
                "url": url, "pass": False, "error": f"{type(e).__name__}: {e}"}


def validate_row(row: dict, row_number: int) -> tuple[dict | None, dict | None]:
    missing = [name for name in REQUIRED_COLUMNS if not (row.get(name) or "").strip()]
    if missing:
        return None, {
            "row_number": row_number,
            "pass": False,
            "error": f"missing required CSV fields: {', '.join(missing)}",
        }
    clean = {key: (value or "").strip() for key, value in row.items()}
    if clean["domain"] not in boot.SITE_CONFIG:
        return None, {
            "row_number": row_number,
            "domain": clean["domain"],
            "product_id": clean["product_id"],
            "pass": False,
            "error": f"unsupported domain: {clean['domain']}",
        }
    if clean["localization_kind"] not in ("zip", "store_id", "store_id_4digit_hint"):
        return None, {
            "row_number": row_number,
            "domain": clean["domain"],
            "product_id": clean["product_id"],
            "pass": False,
            "error": f"unsupported localization_kind: {clean['localization_kind']}",
        }
    return clean, None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", help="Input CSV")
    ap.add_argument("--limit", type=int, default=None, help="Cap rows for testing")
    ap.add_argument("--workers", type=int, default=4, help="Parallel product fetches")
    args = ap.parse_args()

    rows = []
    invalid_results = []
    with open(args.csv) as fh:
        for row_number, row in enumerate(csv.DictReader(fh), 2):
            if args.limit and len(rows) + len(invalid_results) >= args.limit:
                break
            valid, invalid = validate_row(row, row_number)
            if valid is not None:
                rows.append(valid)
            else:
                invalid_results.append(invalid)
    print(f"loaded {len(rows) + len(invalid_results)} rows")

    # Phase 1: bootstrap contexts for every unique (domain, kind, value) tuple
    keys = sorted({(r["domain"], r["localization_kind"], r["localization_value"])
                   for r in rows})
    print(f"unique localization keys: {len(keys)}")
    for domain, kind, value in keys:
        ensure_context(domain, kind, value)

    # Phase 2: fan out product fetches in parallel
    t0 = time.time()
    results = list(invalid_results)
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(process_row, r): r for r in rows}
        for i, fut in enumerate(as_completed(futures), 1):
            res = fut.result()
            results.append(res)
            status = "PASS" if res.get("pass") else "FAIL"
            print(f"[{i}/{len(rows)}] {status} {res.get('domain')} "
                  f"{res.get('product_id')} {res.get('kind')}={res.get('value')} "
                  f"({res.get('duration_ms', '-')}ms)")

    elapsed = time.time() - t0
    n_pass = sum(1 for r in results if r.get("pass"))
    n_fail = sum(1 for r in results if not r.get("pass"))

    summary = {
        "rows": len(results),
        "pass": n_pass,
        "fail": n_fail,
        "elapsed_sec": round(elapsed, 1),
        "avg_per_row_sec": round(elapsed / max(len(results), 1), 1),
    }
    print("\n=== SUMMARY ===")
    print(json.dumps(summary, indent=2))

    (HERE / "run_results.json").write_text(json.dumps(
        {"summary": summary, "results": results}, indent=2))
    print(f"\nfull results written to: {HERE / 'run_results.json'}")
    return 0 if n_fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
