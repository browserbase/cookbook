import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts/publication_boundary.py"
SPEC = importlib.util.spec_from_file_location("publication_boundary", MODULE_PATH)
publication = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(publication)


class PublicationBoundaryTests(unittest.TestCase):
    def fixture(self, root):
        for relative in publication.PUBLIC_ROOT_FILES:
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("fixture\n")
        for tree in publication.PUBLIC_ROOT_TREES:
            path = root / tree / ".keep"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("fixture\n")
        script = root / "scripts/catalog.py"
        script.write_text("raise SystemExit(0)\n")
        for name in publication.PUBLIC_DOCS:
            path = root / "docs" / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(f"# {name}\n")
        (root / "README.md").write_text("# Cookbook\n")
        (root / "COOKBOOK_AUTHORED.json").write_text('{"schema_version": 1, "files": []}')
        source = root / "examples/public/main.py"
        source.parent.mkdir(parents=True)
        source.write_text("print('public')\n")
        guide = root / "docs/recipes/public.md"
        guide.parent.mkdir(parents=True)
        guide.write_text("# Public recipe\n")
        catalog = {"schema_version": 1, "recipes": [
            {"id": "public", "access": "public", "path": "examples/public", "working_directory": "examples/public", "readme": "docs/recipes/public.md"},
            {"id": "use-cases-private-customer", "access": "private", "path": "use-cases/private-customer", "working_directory": "use-cases/private-customer", "source": {"path": "sector/private-customer/demo"}},
        ]}
        manifest = {"schema_version": 1, "sources": [
            {"repository": "https://example.invalid/public", "visibility": "public", "destination": "examples", "files": [{"path": "examples/public/main.py"}]},
            {"repository": "https://example.invalid/private_workflows", "visibility": "private", "destination": "use-cases", "files": []},
        ]}
        (root / "catalog.json").write_text(json.dumps(catalog))
        (root / "SOURCE_MANIFEST.json").write_text(json.dumps(manifest))
        return catalog, manifest

    def test_export_is_history_free_and_public_only(self):
        with tempfile.TemporaryDirectory() as temporary:
            source, artifact = Path(temporary) / "source", Path(temporary) / "artifact"
            source.mkdir()
            catalog, manifest = self.fixture(source)
            (source / ".git").mkdir()
            publication.export_public(source, artifact)
            clean_catalog, clean_manifest = publication.load_metadata(artifact)
            self.assertEqual([r["id"] for r in clean_catalog["recipes"]], ["public"])
            self.assertEqual([s["destination"] for s in clean_manifest["sources"]], ["examples"])
            self.assertFalse((artifact / ".git").exists())
            self.assertFalse((artifact / "use-cases").exists())
            self.assertTrue((artifact / "docs/catalog.md").is_file())
            self.assertEqual(json.loads((artifact / "PUBLIC_EXPORT_REPORT.json").read_text())["skipped_missing_public_paths"], [])
            self.assertEqual(publication.violations(artifact, publication.private_markers(catalog, manifest)), ([], 0, 0))

    def test_private_checkout_boundary_accepts_only_use_cases_recipes(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.fixture(root)
            self.assertEqual(publication.private_boundary_violations(root), ([], 1, 1))
            catalog_path = root / "catalog.json"
            catalog = json.loads(catalog_path.read_text())
            catalog["recipes"][1]["path"] = "examples/private-customer"
            catalog_path.write_text(json.dumps(catalog))
            problems, _, _ = publication.private_boundary_violations(root)
            self.assertTrue(any("escapes use-cases" in problem for problem in problems))

    def test_export_is_deterministic(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "source"
            source.mkdir()
            self.fixture(source)
            first, second = Path(temporary) / "first", Path(temporary) / "second"
            publication.export_public(source, first)
            publication.export_public(source, second)
            self.assertEqual(publication.tree_digest(first), publication.tree_digest(second))

    def test_scanner_rejects_customer_metadata_and_secrets(self):
        with tempfile.TemporaryDirectory() as temporary:
            artifact = Path(temporary)
            (artifact / "leak.txt").write_text(
                "use-cases-private-customer github" + "_pat_" + "a" * 40
            )
            problems = publication.scan_artifact(artifact, {"use-cases-private-customer"})
            self.assertTrue(any("private metadata marker" in p for p in problems))
            self.assertTrue(any("secret-shaped value" in p for p in problems))

    def test_export_refuses_symlinked_source(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "source"
            source.mkdir()
            self.fixture(source)
            path = source / "examples/public/main.py"
            path.unlink()
            path.symlink_to(source / "catalog.json")
            with self.assertRaisesRegex(ValueError, "symlink"):
                publication.export_public(source, Path(temporary) / "artifact")

    def test_verifier_rejects_missing_public_catalog_target(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.fixture(root)
            (root / "examples/public/main.py").unlink()
            problems, _, _ = publication.violations(root)
            self.assertTrue(any("target is missing in path" in problem for problem in problems))

    def test_unreviewed_missing_manifest_file_blocks_export(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "source"
            source.mkdir()
            self.fixture(source)
            manifest_path = source / "SOURCE_MANIFEST.json"
            manifest = json.loads(manifest_path.read_text())
            manifest["sources"][0]["files"].append({"path": "examples/public/missing.py"})
            manifest_path.write_text(json.dumps(manifest))
            artifact = Path(temporary) / "artifact"
            with self.assertRaisesRegex(ValueError, "unexpected missing public provenance"):
                publication.export_public(source, artifact)

    def test_reviewed_missing_manifest_file_is_reported_with_reason(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "source"
            source.mkdir()
            self.fixture(source)
            manifest_path = source / "SOURCE_MANIFEST.json"
            manifest = json.loads(manifest_path.read_text())
            reviewed = "examples/.github/CODEOWNERS"
            manifest["sources"][0]["files"].append({"path": reviewed})
            manifest_path.write_text(json.dumps(manifest))
            artifact = Path(temporary) / "artifact"
            publication.export_public(source, artifact)
            report = json.loads((artifact / "PUBLIC_EXPORT_REPORT.json").read_text())
            self.assertEqual(report["unexpected_missing_public_paths"], [])
            self.assertEqual(report["reviewed_missing_public_paths"][reviewed], publication.REVIEWED_MISSING_PUBLIC_PATHS[reviewed])

    def test_single_file_recipe_and_unmanifested_recipe_files_are_exported(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "source"
            source.mkdir()
            self.fixture(source)
            extra = source / "examples/public/helper.py"
            extra.write_text("HELPER = True\n")
            catalog_path = source / "catalog.json"
            catalog = json.loads(catalog_path.read_text())
            catalog["recipes"].append({
                "id": "single-file", "access": "public",
                "path": "examples/public/helper.py",
                "working_directory": "examples/public",
                "readme": "docs/recipes/public.md",
            })
            catalog_path.write_text(json.dumps(catalog))
            artifact = Path(temporary) / "artifact"
            publication.export_public(source, artifact)
            self.assertTrue((artifact / "examples/public/helper.py").is_file())
            report = json.loads((artifact / "PUBLIC_EXPORT_REPORT.json").read_text())
            self.assertIn("examples/public/helper.py", report["additional_public_recipe_files"])


if __name__ == "__main__":
    unittest.main()
