import importlib.util
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts/publication_boundary.py"
SPEC = importlib.util.spec_from_file_location("publication_boundary_privacy", MODULE_PATH)
publication = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(publication)

BINARY_SUFFIXES = {".gif", ".ico", ".jpeg", ".jpg", ".pdf", ".png", ".webp"}
SCENARIO_IDENTITY_PATTERNS = (
    re.compile(r"\bbill\.com\b|\bBILL(?:'s|’s)?\b"),
    re.compile(r"\bAccuPay\b|\bSpend Workflow\b|\bPayment Provider Atlas\b", re.I),
    re.compile(r"\bProductApp\b|\bWorkday\b|\bT-Mobile\b|\bAT&T\b|\bVerizon\b", re.I),
    re.compile(r"\bSouvla\b|\bOpenTable\b|\bVagaro\b|\bAnthem\b|\bBankrate\b", re.I),
    re.compile(r"\bZillow\b|\bImportYeti\b|\bMagic Apron\b|\bHome Depot\b", re.I),
    re.compile(r"\bWalmart\b|\bInstacart\b|\bOneHealthcareID\b", re.I),
)


class SemanticPrivacyTests(unittest.TestCase):
    def test_use_cases_have_no_files_in_sample_number_directories(self):
        problems = [
            str(path.relative_to(ROOT))
            for path in (ROOT / "use-cases").rglob("sample-*")
            if path.is_dir() and any(child.is_file() for child in path.rglob("*"))
        ]
        self.assertEqual(problems, [])

    def test_use_cases_have_no_customer_or_scenario_company_names(self):
        problems = []
        for path in (ROOT / "use-cases").rglob("*"):
            if (not path.is_file() or path.suffix.lower() in BINARY_SUFFIXES or
                    path.name in {"package-lock.json", "pnpm-lock.yaml", "uv.lock"} or
                    any(part in {"node_modules", ".next", "dist", ".git"} for part in path.parts)):
                continue
            searchable = path.relative_to(ROOT).as_posix() + "\n" + path.read_text(errors="replace")
            for pattern in SCENARIO_IDENTITY_PATTERNS:
                if pattern.search(searchable):
                    problems.append(f"{path.relative_to(ROOT)}: {pattern.pattern}")
        self.assertEqual(problems, [])

    def test_readmes_have_no_organization_provenance_surrogate(self):
        patterns = (
            re.compile(r"sample[ _-]?(?:org(?:anization)?)", re.I),
            re.compile(r"\bbuilt (?:specifically )?for\b", re.I),
            re.compile(r"customer-derived|discovery call|\*\*AE\*\*|\*\*SE\*\*", re.I),
        )
        for path in ROOT.rglob("README.md"):
            if any(part in {"node_modules", ".next", "dist", ".git"} for part in path.parts):
                continue
            text = path.read_text(errors="replace")
            for pattern in patterns:
                with self.subTest(path=path.relative_to(ROOT), pattern=pattern.pattern):
                    self.assertIsNone(pattern.search(text))

    def test_use_case_readmes_do_not_expose_repository_access_policy(self):
        pattern = re.compile(r"\b(?:private|restricted|internal|provenance)\b|access[- ]controlled", re.I)
        for path in (ROOT / "use-cases").rglob("*README*.md"):
            if any(part in {"node_modules", ".next", "dist", ".git"} for part in path.parts):
                continue
            text = path.read_text(errors="replace").replace("data-private", "")
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertIsNone(pattern.search(text))

    def test_use_cases_have_no_customer_demo_framing(self):
        pattern = re.compile(
            r"customer-specific|customer demo|customer call|customer hands|sales narrative|"
            r"sales team|browserbase ce|for this customer|enterprise customers|"
            r"customer success team|discovery call|built specifically for|customer-derived|\bCEs?\b|leadership report|forward to (?:a|their) CTO",
            re.I,
        )
        problems = []
        for path in (ROOT / "use-cases").rglob("*"):
            if (not path.is_file() or path.suffix.lower() in BINARY_SUFFIXES or
                    path.name in {"package-lock.json", "pnpm-lock.yaml", "uv.lock"} or
                    any(part in {"node_modules", ".next", "dist", ".git"} for part in path.parts)):
                continue
            if pattern.search(path.read_text(errors="replace")):
                problems.append(str(path.relative_to(ROOT)))
        self.assertEqual(problems, [])

    def test_use_case_email_literals_are_synthetic_or_public_support(self):
        email = re.compile(r"[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})", re.I)
        allowed_exact = {"example.com", "example.org", "example.net", "resend.dev", "browserbase.com", "lever.co"}
        allowed_suffixes = (".example", ".invalid", ".test")
        problems = []
        for path in (ROOT / "use-cases").rglob("*"):
            if (not path.is_file() or path.suffix.lower() in BINARY_SUFFIXES or
                    path.name in {"package-lock.json", "pnpm-lock.yaml", "uv.lock"} or
                    any(part in {"node_modules", ".next", "dist", ".git"} for part in path.parts)):
                continue
            for domain in email.findall(path.read_text(errors="replace")):
                domain = domain.lower()
                if domain not in allowed_exact and not domain.endswith(allowed_suffixes):
                    problems.append(f"{path.relative_to(ROOT)}: {domain}")
        self.assertEqual(problems, [])

    def test_no_deprecated_stealth_terminology(self):
        pattern = re.compile(r"advanced[_ -]?" r"stealth|adv[_ -]?" r"stealth", re.I)
        problems = []
        for path in ROOT.rglob("*"):
            if (not path.is_file() or path.suffix.lower() in BINARY_SUFFIXES or
                    path.name in {"SOURCE_MANIFEST.json", "catalog.json", "package-lock.json", "pnpm-lock.yaml", "uv.lock"} or
                    any(part in {"node_modules", ".next", "dist", ".git", ".source-checkouts"} for part in path.parts)):
                continue
            text = path.read_text(errors="replace")
            text = "\n".join(
                line for line in text.splitlines()
                if "Pinned upstream source" not in line and "[pinned import]" not in line
            )
            if pattern.search(path.relative_to(ROOT).as_posix() + "\n" + text):
                problems.append(str(path.relative_to(ROOT)))
        self.assertEqual(problems, [])

    def test_restricted_tree_has_no_known_semantic_identity_markers(self):
        problems = []
        for path in (ROOT / "use-cases").rglob("*"):
            if (not path.is_file() or path.suffix.lower() in BINARY_SUFFIXES or
                    path.name in {"package-lock.json", "pnpm-lock.yaml", "uv.lock"} or
                    any(part in {"node_modules", ".next", "dist", ".git"} for part in path.parts)):
                continue
            text = path.read_text(errors="replace")
            searchable = path.relative_to(ROOT).as_posix() + "\n" + text
            for label, pattern in publication.SEMANTIC_DENY_PATTERNS:
                if pattern.search(searchable):
                    problems.append(f"{path.relative_to(ROOT)}: {label}")
        self.assertEqual(problems, [])

    def test_saved_resource_areas_contain_no_uuid(self):
        paths = (
            ROOT / "use-cases/retail-pricing-intelligence",
            ROOT / "use-cases/data-migration/functions-migration/DEV_NOTES.md",
            ROOT / "use-cases/sales-support-and-ops/job-site-browser/stagehand.config.ts",
            ROOT / "use-cases/automotive-market-research/.browserbase-agent.json",
        )
        for path in paths:
            files = path.rglob("*") if path.is_dir() else (path,)
            for file in files:
                if file.is_file():
                    with self.subTest(path=file.relative_to(ROOT)):
                        self.assertIsNone(publication.UUID_PATTERN.search(file.read_text(errors="replace")))


if __name__ == "__main__":
    unittest.main()
