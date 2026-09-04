import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE = Path(__file__).resolve().parents[1] / "scripts/import_sources.py"
SPEC = importlib.util.spec_from_file_location("import_sources", MODULE)
imports = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(imports)


class ImportSourceTests(unittest.TestCase):
    def make_repo(self, root, name, content="first\n"):
        repo = root / name
        repo.mkdir()
        subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
        subprocess.run(["git", "config", "user.email", "fixture@example.com"], cwd=repo, check=True)
        subprocess.run(["git", "config", "user.name", "Fixture"], cwd=repo, check=True)
        (repo / "fixture.txt").write_text(content)
        subprocess.run(["git", "add", "fixture.txt"], cwd=repo, check=True)
        subprocess.run(["git", "commit", "-qm", "fixture"], cwd=repo, check=True)
        return repo

    def run_import(self, source, destination, *extra):
        argv = ["import_sources.py", "--source-dir", str(source), "--destination", str(destination), *extra]
        with patch.object(sys, "argv", argv):
            return imports.main()

    def test_public_scope_needs_no_private_checkout_and_retains_private_manifest(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source, destination = root / "source", root / "destination"
            source.mkdir()
            destination.mkdir()
            for name in ("templates", "playbook", "integrations"):
                self.make_repo(source, name)
            private = {"repository": "https://github.com/browserbase/private_workflows", "commit": "a" * 40,
                       "visibility": "private", "destination": "use-cases", "files": []}
            (destination / "SOURCE_MANIFEST.json").write_text(json.dumps({"schema_version": 1, "sources": [private]}))
            self.assertEqual(self.run_import(source, destination, "--scope", "public", "--refresh"), 0)
            manifest = json.loads((destination / "SOURCE_MANIFEST.json").read_text())
            self.assertEqual(len(manifest["sources"]), 4)
            self.assertEqual(manifest["sources"][0], private)

    def test_refresh_preserves_recorded_adaptation_without_explicit_retirement(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source, destination = root / "source", root / "destination"
            source.mkdir()
            destination.mkdir()
            for name in ("templates", "playbook", "integrations"):
                self.make_repo(source, name)
            self.assertEqual(self.run_import(source, destination, "--scope", "public", "--refresh"), 0)
            target = destination / "examples/fixture.txt"
            target.write_text("reviewed adaptation\n")
            manifest_path = destination / "SOURCE_MANIFEST.json"
            manifest = json.loads(manifest_path.read_text())
            record = next(item for source_record in manifest["sources"]
                          if source_record["repository"].endswith("/templates")
                          for item in source_record["files"] if item["path"] == "examples/fixture.txt")
            record["adaptation"] = {
                "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                "reason": "Synthetic reviewed migration",
            }
            manifest_path.write_text(json.dumps(manifest))
            repo = source / "templates"
            (repo / "fixture.txt").write_text("upstream changed\n")
            subprocess.run(["git", "add", "fixture.txt"], cwd=repo, check=True)
            subprocess.run(["git", "commit", "-qm", "upstream"], cwd=repo, check=True)
            self.assertEqual(self.run_import(source, destination, "--scope", "public", "--refresh"), 2)
            self.assertEqual(target.read_text(), "reviewed adaptation\n")


if __name__ == "__main__":
    unittest.main()
