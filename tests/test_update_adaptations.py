import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path


class UpdateAdaptationsTests(unittest.TestCase):
    def test_records_current_digest_without_changing_original_digest(self):
        root = Path(__file__).resolve().parents[1]
        script = (root / "scripts/update_adaptations.py").read_text()
        with tempfile.TemporaryDirectory() as directory:
            checkout = Path(directory)
            (checkout / "scripts").mkdir()
            (checkout / "examples").mkdir()
            (checkout / "scripts/update_adaptations.py").write_text(script)
            target = checkout / "examples/demo.py"
            target.write_text("updated\n")
            original = "a" * 64
            manifest = {"sources": [{"files": [{"path": "examples/demo.py", "sha256": original, "source_sha256": original}]}]}
            (checkout / "SOURCE_MANIFEST.json").write_text(json.dumps(manifest))
            subprocess.run(
                ["python3", "scripts/update_adaptations.py", "--reason", "Reviewed migration", "examples/demo.py"],
                cwd=checkout, check=True, capture_output=True, text=True,
            )
            result = json.loads((checkout / "SOURCE_MANIFEST.json").read_text())["sources"][0]["files"][0]
            self.assertEqual(result["sha256"], original)
            self.assertEqual(result["source_sha256"], original)
            self.assertEqual(result["adaptation"], {
                "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                "reason": "Reviewed migration",
            })

    def test_rejects_untracked_paths(self):
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as directory:
            checkout = Path(directory)
            (checkout / "scripts").mkdir()
            (checkout / "scripts/update_adaptations.py").write_text((root / "scripts/update_adaptations.py").read_text())
            (checkout / "SOURCE_MANIFEST.json").write_text('{"sources": []}')
            result = subprocess.run(
                ["python3", "scripts/update_adaptations.py", "--reason", "Reviewed", "missing.py"],
                cwd=checkout, capture_output=True, text=True,
            )
            self.assertNotEqual(result.returncode, 0)

    def test_preserves_an_existing_reviewed_reason_while_refreshing_digest(self):
        root = Path(__file__).resolve().parents[1]
        script = (root / "scripts/update_adaptations.py").read_text()
        with tempfile.TemporaryDirectory() as directory:
            checkout = Path(directory)
            (checkout / "scripts").mkdir()
            (checkout / "examples").mkdir()
            (checkout / "scripts/update_adaptations.py").write_text(script)
            target = checkout / "examples/demo.py"
            target.write_text("latest\n")
            original = "a" * 64
            manifest = {"sources": [{"files": [{
                "path": "examples/demo.py",
                "sha256": original,
                "source_sha256": original,
                "adaptation": {"sha256": "b" * 64, "reason": "Specific prior review"},
            }]}]}
            (checkout / "SOURCE_MANIFEST.json").write_text(json.dumps(manifest))
            subprocess.run([
                "python3", "scripts/update_adaptations.py",
                "--reason", "Generic fallback",
                "--preserve-existing-reason", "examples/demo.py",
            ], cwd=checkout, check=True, capture_output=True, text=True)
            result = json.loads((checkout / "SOURCE_MANIFEST.json").read_text())["sources"][0]["files"][0]
            self.assertEqual(result["adaptation"], {
                "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                "reason": "Specific prior review",
            })


if __name__ == "__main__":
    unittest.main()
