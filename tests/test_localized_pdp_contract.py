import importlib.util
import os
import sys
import types
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "use-cases/commerce-and-market-intel/sample-04/localized-pdp"


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, PACKAGE / filename)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


class FakeContext:
    def __init__(self, cookies):
        self._cookies = [{"name": key, "value": value} for key, value in cookies.items()]

    def cookies(self):
        return self._cookies


class LocalizedPdpContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.setdefault("BROWSERBASE_API_KEY", "synthetic")
        os.environ.setdefault("BROWSERBASE_PROJECT_ID", "synthetic")
        sys.path.insert(0, str(PACKAGE))
        browserbase = types.ModuleType("browserbase")
        browserbase.Browserbase = object
        playwright = types.ModuleType("playwright")
        playwright_sync = types.ModuleType("playwright.sync_api")
        playwright_sync.sync_playwright = lambda: None
        sys.modules.setdefault("browserbase", browserbase)
        sys.modules.setdefault("playwright", playwright)
        sys.modules.setdefault("playwright.sync_api", playwright_sync)
        cls.bootstrap = load_module("bootstrap_context", "bootstrap_context.py")
        cls.fetch = load_module("fetch_product", "fetch_product.py")
        cls.run_csv = load_module("run_csv_contract", "run_csv.py")

    def test_store_id_requires_exact_home_depot_store(self):
        localizer = '%7B%22THD_LOCSTORE%22%3A%220915%22%7D'
        ctx = FakeContext({"DELIVERY_ZIP": "07088", "THD_LOCALIZER": localizer})
        self.assertTrue(self.bootstrap.verify_homedepot(ctx, "07088", "0915"))
        self.assertFalse(self.bootstrap.verify_homedepot(ctx, "07088", "6003"))

    def test_store_id_requires_exact_tractor_supply_store(self):
        ctx = FakeContext({"lpZipCode": "77566", "lpStoreNum": "0915"})
        self.assertTrue(self.bootstrap.verify_tractorsupply(ctx, "77566", "0915"))
        self.assertFalse(self.bootstrap.verify_tractorsupply(ctx, "77566", "0916"))

    def test_localization_does_not_pass_for_another_product_page(self):
        html = "x" * 400_001
        cookies = {"DELIVERY_ZIP": "90210", "THD_LOCALIZER": '%7B%22THD_LOCSTORE%22%3A%22121%22%7D'}
        passed, signals = self.fetch.check_localized(
            "homedepot", "90210", 200, html, cookies,
            "https://www.homedepot.com/p/123", "https://www.homedepot.com/p/999")
        self.assertFalse(passed)
        self.assertFalse(signals["product_page_matches"])

    def test_csv_row_errors_are_results_instead_of_exceptions(self):
        valid, error = self.run_csv.validate_row({
            "domain": "homedepot", "product_id": "",
            "localization_kind": "zip", "localization_value": "90210",
        }, 7)
        self.assertIsNone(valid)
        self.assertEqual(error["row_number"], 7)
        self.assertIn("product_id", error["error"])

    def test_distinct_store_keys_produce_distinct_output_names(self):
        source = (PACKAGE / "fetch_product.py").read_text()
        self.assertIn('f"{kind}_{value}"', source)
        self.assertIn('f"{domain}_{product_id}_{localization_key}.html"', source)


if __name__ == "__main__":
    unittest.main()
