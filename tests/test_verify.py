import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


spec = importlib.util.spec_from_file_location("verify", Path(__file__).resolve().parents[1] / "scripts/verify.py")
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class VerificationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.check = verify.Verification(self.root)

    def tearDown(self):
        self.directory.cleanup()

    def test_path_escape_is_rejected_even_when_target_exists(self):
        self.check.path("../", "fixture")
        self.assertTrue(any("escapes" in error for error in self.check.errors))

    def test_transformed_digest_and_exclusion_reason_are_required(self):
        (self.root / "example.py").write_text("print('changed')\n")
        source = {"repository": "owner/repo", "commit": "a" * 40, "destination": "examples", "files": [
            {"source_path": "example.py", "path": "example.py", "action": "transformed", "sha256": "0" * 64},
            {"source_path": "private.json", "path": "private.json", "action": "excluded"},
        ]}
        (self.root / "SOURCE_MANIFEST.json").write_text(json.dumps({"sources": [source]}))
        self.check.manifest()
        self.assertTrue(any("source digest" in error for error in self.check.errors))
        self.assertTrue(any("digest mismatch" in error for error in self.check.errors))
        self.assertTrue(any("needs a reason" in error for error in self.check.errors))

    def test_recorded_adaptation_preserves_import_digest_and_checks_current_file(self):
        import hashlib
        original = hashlib.sha256(b"original").hexdigest()
        adapted = hashlib.sha256(b"adapted").hexdigest()
        (self.root / "example.py").write_text("adapted")
        item = {"source_path": "example.py", "path": "example.py", "action": "imported",
                "sha256": original, "source_sha256": original,
                "adaptation": {"sha256": adapted, "reason": "Migrate the entrypoint to the installed SDK"}}
        source = {"repository": "owner/repo", "commit": "a" * 40, "destination": "examples", "files": [item]}
        (self.root / "SOURCE_MANIFEST.json").write_text(json.dumps({"sources": [source]}))
        self.check.manifest()
        self.assertEqual(self.check.errors, [])
        (self.root / "example.py").write_text("unrecorded edit")
        self.check.manifest()
        self.assertTrue(any("digest mismatch" in error for error in self.check.errors))

    def test_adaptation_requires_a_reason_and_cannot_override_exclusion(self):
        item = {"source_path": "example.py", "path": "example.py", "action": "excluded", "reason": "runtime output",
                "adaptation": {"sha256": "b" * 64, "reason": ""}}
        source = {"repository": "owner/repo", "commit": "a" * 40, "destination": "examples", "files": [item]}
        (self.root / "SOURCE_MANIFEST.json").write_text(json.dumps({"sources": [source]}))
        self.check.manifest()
        self.assertTrue(any("adaptation" in error for error in self.check.errors))

    def test_malformed_adaptations_are_rejected(self):
        import hashlib
        digest = hashlib.sha256(b"example").hexdigest()
        (self.root / "example.py").write_text("example")
        for adaptation in [None, [], {"sha256": "invalid", "reason": "upgrade"},
                           {"sha256": digest, "reason": "  "},
                           {"sha256": digest, "reason": 42},
                           {"sha256": digest, "reason": "upgrade", "removed": True}]:
            with self.subTest(adaptation=adaptation):
                item = {"source_path": "example.py", "path": "example.py", "action": "imported",
                        "sha256": digest, "source_sha256": digest, "adaptation": adaptation}
                source = {"repository": "owner/repo", "commit": "a" * 40, "destination": "examples", "files": [item]}
                (self.root / "SOURCE_MANIFEST.json").write_text(json.dumps({"sources": [source]}))
                check = verify.Verification(self.root)
                check.manifest()
                self.assertTrue(any("adaptation" in error for error in check.errors))

    def test_links_decode_paths_skip_fences_and_report_broken_links(self):
        (self.root / "with space.md").write_text("# Present\n")
        (self.root / "README.md").write_text("[good](with%20space.md#title)\n```md\n[fake](absent.md)\n```\n[bad](missing.md)\n")
        self.check.markdown()
        self.assertEqual(len(self.check.errors), 1)
        self.assertIn("README.md:5", self.check.errors[0])

    def test_links_cover_imported_markdown_and_html_image_attributes(self):
        (self.root / "imported.md").write_text('<img src="missing.png" srcset="also-missing.png 2x">\n')
        self.check.imported.add("imported.md")
        self.check.markdown()
        self.assertEqual(len(self.check.errors), 2)
        self.assertTrue(all("imported.md:1" in error for error in self.check.errors))

    def test_secret_diagnostic_omits_token_and_respects_boundary(self):
        token = "sk-" + "A" * 40
        (self.root / "sample.py").write_text("prefix" + token + "\n" + token + "\n")
        self.check.hygiene()
        self.assertEqual(len(self.check.errors), 1)
        self.assertIn("sample.py:2", self.check.errors[0])
        self.assertNotIn(token, self.check.errors[0])

    def test_excluded_file_cannot_be_reintroduced(self):
        (self.root / "private.json").write_text("{}")
        source = {"repository": "owner/repo", "commit": "a" * 40, "destination": "examples", "files": [
            {"source_path": "private.json", "path": "private.json", "action": "excluded", "reason": "captured data"},
        ]}
        (self.root / "SOURCE_MANIFEST.json").write_text(json.dumps({"sources": [source]}))
        self.check.manifest()
        self.assertTrue(any("reintroduced" in error for error in self.check.errors))

    def test_invalid_catalog_enums_are_rejected(self):
        recipe = {"id": "sample", "path": ".", "working_directory": ".", "readme": ".", "title": "Example", "summary": "Example summary", "languages": ["Python"], "collection": "typo", "access": "public", "lifecycle": "ready", "verification": "tested", "source": {"repository": "owner/repo", "commit": "a" * 40, "path": "sample"}}
        (self.root / "catalog.json").write_text(json.dumps({"schema_version": 1, "recipes": [recipe]}))
        self.check.catalog({"owner/repo": "a" * 40})
        for field in ("collection", "lifecycle", "verification"):
            self.assertTrue(any("invalid " + field in error for error in self.check.errors))

    def test_catalog_rejects_unsubstantiated_verification_level(self):
        recipe = {"id": "sample", "path": ".", "working_directory": ".", "readme": ".", "title": "Example", "summary": "Example summary", "languages": ["Python"], "collection": "examples", "access": "public", "lifecycle": "current", "verification": "live-tested", "verification_evidence": [], "source": {"repository": "owner/repo", "commit": "a" * 40, "path": "sample"}}
        (self.root / "catalog.json").write_text(json.dumps({"schema_version": 1, "recipes": [recipe]}))
        self.check.catalog({"owner/repo": "a" * 40})
        self.assertTrue(any("lacks matching passing evidence" in error for error in self.check.errors))

    def test_catalog_accepts_precise_offline_evidence(self):
        evidence = {"kind": "offline-tested", "date": "2026-09-07", "runtime": "Python 3.13", "command": "python test_fixture.py", "result": "passed", "limits": "Synthetic fixture; no network."}
        recipe = {"id": "sample", "path": ".", "working_directory": ".", "readme": ".", "title": "Example", "summary": "Example summary", "languages": ["Python"], "collection": "examples", "access": "public", "lifecycle": "current", "verification": "offline-tested", "verification_evidence": [evidence], "source": {"repository": "owner/repo", "commit": "a" * 40, "path": "sample"}}
        (self.root / "catalog.json").write_text(json.dumps({"schema_version": 1, "recipes": [recipe]}))
        self.check.catalog({"owner/repo": "a" * 40})
        self.assertFalse(any("verification" in error for error in self.check.errors))

    def test_catalog_checks_setup_artifacts_and_package_scripts(self):
        (self.root / "package.json").write_text(json.dumps({"scripts": {"start": "node index.js"}}))
        recipe = {"id": "sample", "path": ".", "working_directory": ".", "readme": ".", "title": "Example", "summary": "Example summary", "languages": ["JavaScript"], "collection": "examples", "access": "public", "lifecycle": "current", "verification": "source-inspected", "setup_commands": [], "run_commands": ["npm run missing"], "manifests": ["absent.json"], "environment_template": "absent.env", "source": {"repository": "owner/repo", "commit": "a" * 40, "path": "sample"}}
        (self.root / "catalog.json").write_text(json.dumps({"schema_version": 1, "recipes": [recipe]}))
        self.check.catalog({"owner/repo": "a" * 40})
        self.assertTrue(any("missing path absent.json" in error for error in self.check.errors))
        self.assertTrue(any("missing path absent.env" in error for error in self.check.errors))
        self.assertTrue(any("missing package script missing" in error for error in self.check.errors))

    def test_local_generated_directories_are_not_scanned(self):
        (self.root / ".venv").mkdir()
        (self.root / ".venv" / ".env").write_text("sk-" + "A" * 40)
        self.check.hygiene()
        self.assertEqual(self.check.errors, [])

    def test_npm_lock_rejects_external_graph_and_link_targets(self):
        lock = {"lockfileVersion": 3, "packages": {
            "../../private/tmp/toolchain/node_modules/library": {"version": "1.0.0"},
            "node_modules/library": {"link": True, "resolved": "../../private/tmp/toolchain/node_modules/library"},
        }}
        self.check.npm_lock("recipe/package-lock.json", json.dumps(lock))
        self.assertTrue(any("nonportable filesystem references" in e for e in self.check.errors))

    def test_npm_lock_rejects_absolute_and_encoded_filesystem_targets(self):
        for target in ["/tmp/external", "C:\\temp\\external", "file:../../external", "file:%2Ftmp%2Fexternal"]:
            with self.subTest(target=target):
                check = verify.Verification(self.root)
                lock = {"packages": {"node_modules/library": {"link": True, "resolved": target}}}
                check.npm_lock("recipe/package-lock.json", json.dumps(lock))
                self.assertTrue(check.errors)

    def test_npm_lock_allows_registry_packages_and_internal_workspaces(self):
        lock = {"packages": {
            "": {"dependencies": {"library": "file:../library"}},
            "node_modules/library": {"link": True, "resolved": "../library"},
            "../library": {"version": "1.0.0"},
            "node_modules/registry": {"version": "2.0.0", "resolved": "https://registry.npmjs.org/registry/-/registry-2.0.0.tgz", "integrity": "synthetic"},
        }}
        self.check.npm_lock("recipe/package-lock.json", json.dumps(lock))
        self.assertEqual(self.check.errors, [])

    def test_hygiene_checks_npm_lock_portability(self):
        (self.root / "package-lock.json").write_text(json.dumps({"packages": {
            "node_modules/library": {"resolved": "file:/tmp/external"},
        }}))
        self.check.hygiene()
        self.assertTrue(any("nonportable filesystem references" in e for e in self.check.errors))

    def test_lock_root_manifest_snapshot_does_not_prove_complete_graph(self):
        manifest = {"dependencies": {"runtime": "1.0.0"}, "devDependencies": {"compiler": "2.0.0"}}
        (self.root / "package.json").write_text(json.dumps(manifest))
        lock = {"lockfileVersion": 3, "packages": {"": manifest, "node_modules/runtime": {"version": "1.0.0"}}}
        self.check.npm_lock("package-lock.json", json.dumps(lock))
        self.assertTrue(any("omits 1 direct dependency graph entries: compiler" in error for error in self.check.errors))

    def test_lock_checks_current_manifest_instead_of_stale_lock_snapshot(self):
        (self.root / "package.json").write_text(json.dumps({"dependencies": {"added": "1.0.0"}}))
        self.check.npm_lock("package-lock.json", json.dumps({"lockfileVersion": 3, "packages": {"": {}}}))
        self.assertTrue(any("entries: added" in error for error in self.check.errors))

    def test_direct_graph_allows_complete_packages_and_omitted_optional_dependency(self):
        manifest = {"dependencies": {"required": "1", "optional": "2"}, "optionalDependencies": {"optional": "2"}}
        (self.root / "package.json").write_text(json.dumps(manifest))
        lock = {"lockfileVersion": 3, "packages": {"node_modules/required": {"version": "1.0.0"}}}
        self.check.npm_lock("package-lock.json", json.dumps(lock))
        self.assertEqual(self.check.errors, [])


if __name__ == "__main__":
    unittest.main()
