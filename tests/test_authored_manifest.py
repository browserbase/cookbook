import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts/authored_manifest.py"
SPEC = importlib.util.spec_from_file_location("authored_manifest", MODULE_PATH)
authored = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(authored)


class AuthoredManifestTests(unittest.TestCase):
    def test_imported_and_generated_files_are_not_claimed_as_authored(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "examples/node_modules").mkdir(parents=True)
            (root / "examples/imported.py").write_text("upstream")
            (root / "examples/local_test.py").write_text("local")
            (root / "examples/node_modules/cache.js").write_text("generated")
            source = {"sources": [{"files": [{"path": "examples/imported.py"}]}]}
            (root / "SOURCE_MANIFEST.json").write_text(json.dumps(source))
            self.assertEqual(authored.authored_paths(root), ["examples/local_test.py"])
            records = authored.records(root)
            self.assertEqual(records[0]["path"], "examples/local_test.py")
            self.assertEqual(len(records[0]["sha256"]), 64)

    def test_new_or_changed_authored_file_changes_expected_records(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "examples").mkdir()
            (root / "SOURCE_MANIFEST.json").write_text('{"sources": [{"files": []}]}')
            (root / "examples/helper.ts").write_text("one")
            before = authored.records(root)
            (root / "examples/helper.ts").write_text("two")
            after = authored.records(root)
            self.assertNotEqual(before, after)
            (root / "examples/another.ts").write_text("new")
            self.assertEqual(len(authored.records(root)), 2)


if __name__ == "__main__":
    unittest.main()
