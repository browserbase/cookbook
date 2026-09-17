from datetime import datetime, timezone
import importlib.util
import os
import sys
import types
import unittest


reference = types.ModuleType("reference")
reference.search_reservation_portal = lambda **kwargs: {}
reference._SIMPLE_BTN = None
reference._TIERED_BTN = None
sys.modules["reference"] = reference
spec = importlib.util.spec_from_file_location("canary_fixture", os.path.join(os.path.dirname(__file__), "canary.py"))
canary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(canary)


class CanaryInputTests(unittest.TestCase):
    def test_reservation_date_is_computed_fourteen_days_ahead(self):
        now = datetime(2026, 9, 7, 8, 30, tzinfo=timezone.utc)
        query = canary.build_expected_query(now)
        self.assertEqual(query["date_time"], "2026-09-21T19:00+00:00")
        self.assertEqual(query["covers"], 2)


if __name__ == "__main__":
    unittest.main()
