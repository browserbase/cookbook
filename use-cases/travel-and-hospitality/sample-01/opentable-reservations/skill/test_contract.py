import importlib.util
import pathlib
import unittest
from unittest.mock import patch

MODULE_PATH = pathlib.Path(__file__).with_name("reference.py")
SPEC = importlib.util.spec_from_file_location("opentable_reference", MODULE_PATH)
reference = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(reference)


class OpenTableContractTests(unittest.TestCase):
    def test_slot_matching_requires_exact_normalized_venue(self):
        tree = "[1-1] button: 7:30 PM Reserve table at Example Annex"
        self.assertIsNone(reference.find_slot_ref(tree, "Example", "7:30 PM"))
        self.assertEqual(reference.find_slot_ref(tree, " Example Annex ", "7:30 PM"), "1-1")

    def test_confirmation_requires_venue_date_time_and_party(self):
        tree = "heading: Example Annex\nStaticText: September 20, 2026\nStaticText: 7:30 PM\nStaticText: Party of 2"
        self.assertTrue(reference.confirmation_matches(tree, "Example Annex", "7:30 PM", "2026-09-20T19:30", 2))
        self.assertFalse(reference.confirmation_matches(tree, "Example", "7:30 PM", "2026-09-20T19:30", 2))
        self.assertFalse(reference.confirmation_matches(tree, "Example Annex", "7:30 PM", "2026-09-20T19:30", 3))

    def test_handoff_transfers_session_without_release(self):
        releases = []
        def fake_browse(_session, *args):
            if args == ("get", "url"):
                return {"url": "https://www.opentable.com/account/signin"}
            return {}
        with patch.object(reference, "create_session", return_value="session_1234"), \
             patch.object(reference, "warmup"), \
             patch.object(reference, "wait_for_hydration", return_value=""), \
             patch.object(reference, "browse", side_effect=fake_browse), \
             patch.object(reference, "browse_stop"), \
             patch.object(reference, "release_session", side_effect=releases.append):
            result = reference.book_opentable(restaurant_name="Example", time_label="7:30 PM", date_time="2026-09-20T19:30", party_size=2)
        self.assertEqual(result["reason"], "auth_required")
        self.assertEqual(result["handoff_session_id"], "session_1234")
        self.assertEqual(releases, [])

    def test_explicit_handoff_release_uses_the_returned_session(self):
        with patch.object(reference, "browse_stop") as stop, patch.object(reference, "release_session", return_value=True) as release:
            result = reference.run_tool("release_opentable_handoff", {"session_id": "session_1234"})
        self.assertEqual(result, {"release_requested": True, "session_id": "session_1234"})
        stop.assert_called_once_with()
        release.assert_called_once_with("session_1234")

    def test_documented_booking_schema_matches_handler_requirement(self):
        schema = next(tool for tool in reference.TOOLS if tool["name"] == "book_opentable_reservation")["input_schema"]
        self.assertIn("time_label", schema["required"])
        payload = {"restaurant_name": "Example", "time_label": "7:30 PM", "date_time": "2026-09-20T19:30", "party_size": 2}
        with patch.object(reference, "book_opentable", return_value={"success": True}) as handler:
            self.assertTrue(reference.run_tool("book_opentable_reservation", payload)["success"])
        handler.assert_called_once_with(**payload)


if __name__ == "__main__":
    unittest.main()
