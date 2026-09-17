import ast
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import List, Dict, Any, Optional
import sys
import unittest
from unittest.mock import AsyncMock, Mock
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from product_urls import normalize_product_url

source = ROOT / "main.py"
tree = ast.parse(source.read_text())
tree.body = [node for node in tree.body if isinstance(node, ast.ClassDef)]
namespace = dict(globals(), Stagehand=object, Page=object, console=SimpleNamespace(print=Mock()),
    ASCENDING=1, DESCENDING=-1, IndexModel=lambda keys, **kw: SimpleNamespace(document={"key": keys, **kw}),
    DuplicateKeyError=type("DuplicateKeyError", (Exception,), {}))
exec(compile(tree, str(source), "exec"), namespace)
Product, ProductExtraction, ProductListExtraction = [namespace[name] for name in ("Product", "ProductExtraction", "ProductListExtraction")]

class URLs(unittest.TestCase):
    def test_normalization(self):
        base = "https://shop.example/catalog/current?category=1"
        for raw, expected in [
            ("/products/1?color=red#reviews", "https://shop.example/products/1?color=red"),
            ("../products/2", "https://shop.example/products/2"),
            ("products/3", "https://shop.example/catalog/products/3"),
            ("?product=4", "https://shop.example/catalog/current?product=4"),
            ("https://SHOP.EXAMPLE:443/p?q=1&x=2#details", "https://shop.example/p?q=1&x=2"),
            ("//cdn.example/p", "https://cdn.example/p"),
            ("https://[::1]:8443/p", "https://[::1]:8443/p"),
        ]:
            with self.subTest(raw=raw):
                self.assertEqual(normalize_product_url(raw, base), expected)

    def test_unknowns_are_not_fabricated(self):
        for raw in (None, "", "Laptop", "Laptop Pro", "#product", "javascript:alert(1)", "mailto:a@example.com", "https://a:bad/p", "https://user:password@example.com/p", "https://example.com/\\x", "https://example.com/\nx"):
            with self.subTest(raw=raw):
                self.assertIsNone(normalize_product_url(raw, "https://shop.example/list"))

class Storage(unittest.IsolatedAsyncioTestCase):
    async def test_real_scraper_models_and_manager_preserve_identity_across_runs(self):
        manager = namespace["MongoDBManager"]("unused", "synthetic")
        rows, listings = {}, []
        def update(query, change, upsert):
            self.assertTrue(upsert)
            self.assertEqual(query, {"url": change["$set"]["url"]})
            rows[query["url"]] = dict(change["$set"])
        products = SimpleNamespace(update_one=Mock(side_effect=update))
        lists = SimpleNamespace(insert_one=Mock(side_effect=lambda doc: listings.append(doc)))
        manager.db = {"products": products, "product_lists": lists}
        page = SimpleNamespace(goto=AsyncMock(), wait_for_timeout=AsyncMock(), wait_for_selector=AsyncMock(), evaluate=AsyncMock(), url=AsyncMock(return_value="https://shop.example/redirected/list"))
        stagehand = SimpleNamespace(extract=AsyncMock())
        scraper = namespace["ProductScraper"](stagehand, page, manager)
        raw = [{"name": "One", "price": "$10", "url": "../p/1?variant=blue#reviews"}, {"name": "Unknown", "price": "$20", "url": None}, {"name": "No link", "price": "$30", "url": "Product name"}]
        for payload in ({"products": raw, "category": "Synthetic"}, ProductListExtraction(products=[ProductExtraction(**row) for row in raw], category="Synthetic")):
            stagehand.extract.return_value = SimpleNamespace(data=payload)
            result = await scraper.scrape_product_list("https://shop.example/original")
            self.assertEqual([row.url for row in result.products], ["https://shop.example/p/1?variant=blue", None, None])
            self.assertEqual([row.observation_index for row in result.products], [0, 1, 2])
            self.assertTrue(all(row.source_url == "https://shop.example/redirected/list" for row in result.products))
            self.assertTrue(all(row.date_scraped.tzinfo is not None for row in result.products))
        self.assertTrue(all(row["category"] == "Synthetic" for row in rows.values()))
        self.assertTrue(all(product["category"] == "Synthetic" for listing in listings for product in listing["products"]))
        groups = {}
        for row in rows.values():
            groups[row["category"]] = groups.get(row["category"], 0) + 1
        self.assertEqual(groups, {"Synthetic": 1})
        self.assertEqual(len(rows), 1)
        self.assertEqual(len(listings), 2)
        self.assertIsNone(listings[0]["products"][1]["url"])
        self.assertEqual(products.update_one.call_count, 2)
        self.assertNotIn("scraped_at=", next(iter(rows)))

    async def test_upsert_failure_is_not_reported_as_success(self):
        manager = namespace["MongoDBManager"]("unused", "synthetic")
        failure = RuntimeError("synthetic write failure")
        collection = SimpleNamespace(update_one=Mock(side_effect=failure))
        manager.db = {"products": collection}
        with self.assertRaises(RuntimeError) as caught:
            await manager.store_data("products", [{"url": "https://shop.example/p/1"}])
        self.assertIs(caught.exception, failure)

if __name__ == "__main__":
    unittest.main()
