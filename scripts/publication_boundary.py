#!/usr/bin/env python3
"""Build and verify a history-free artifact containing only public cookbook sources."""

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from copy import deepcopy
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
SECRET_PATTERNS = (
    re.compile(r"-----BEGIN (?:RSA )?PRIVATE KEY-----"),
    re.compile(r"ghp_[A-Za-z0-9]{30,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{40,}"),
    re.compile(r"sk-proj-[A-Za-z0-9_-]{20,}"),
    re.compile(r"sk_live_[A-Za-z0-9]{20,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
)
UUID_PATTERN = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", re.I)
UUID_ALLOWLIST = {
    "123e4567-" + "e89b-42d3-a456-426614174000",
    "12345678-" + "1234-4123-8123-123456789abc",
    "00000000-" + "0000-4000-8000-000000000001",
}
SEMANTIC_DENY_PATTERNS = (
    ("surrogate organization label", re.compile(r"sample[ _-]?(?:org(?:anization)?)", re.I)),
    ("named test vendor", re.compile("momen" + "tic", re.I)),
    ("named transport vendor", re.compile("e2" + "open", re.I)),
    ("named workspace product", re.compile(r"workspace\s+" + "app", re.I)),
    ("named requirements owner", re.compile("bian" + "ca", re.I)),
    ("named sales contact", re.compile("arik" + r"\s+bird", re.I)),
    ("named solutions contact", re.compile("shubhan" + "kar", re.I)),
    ("named compliance contact", re.compile("clar" + "ence", re.I)),
    ("named reporter", re.compile("paul" + r"\s+klein", re.I)),
    ("named operator", re.compile(r"\bsar" + r"ah\b", re.I)),
    ("Slack identity", re.compile(r"@what" + "antibot", re.I)),
    ("saved resource label", re.compile(r"retailer\s+" + "demo", re.I)),
    ("organization schema label", re.compile(r"sho\s+" + "schema", re.I)),
    ("customer login fingerprint", re.compile(r"opentable\s+" + r"guestcenter|site" + r"dish|aesthetic\s+record", re.I)),
    ("live transport host", re.compile(r"na-app\.tms\." + "e2" + "open" + r"\.com", re.I)),
    ("embedded legal-form identity", re.compile(r"tiktok\.com/legal/report/[^\s]+[?&]email=", re.I)),
    ("real reservation reference", re.compile(r"#(?:17165|44724|17166|2111422429)\b")),
    ("real street address", re.compile(r"166\s+geary\s+st", re.I)),
)

# These paths were tracked by the pinned public repositories but intentionally
# excluded during consolidation.  Keeping the allowlist here makes a source
# refresh fail closed: a newly missing path is never silently accepted.
REVIEWED_MISSING_PUBLIC_PATHS = {
    "examples/.github/CODEOWNERS": "upstream repository administration",
    "examples/.github/workflows/playground-production.yml": "upstream deployment workflow",
    "examples/.github/workflows/playground-test-production.yml": "upstream deployment workflow",
    "examples/.github/workflows/playground.yml": "upstream deployment workflow",
    "examples/.github/workflows/readme-template-index.yml": "upstream documentation workflow",
    "examples/.husky/pre-commit": "upstream repository hook",
    "integrations/.changeset/config.json": "upstream release configuration",
    "integrations/.changeset/warm-dingos-browse.md": "upstream release metadata",
    "integrations/.github/CODEOWNERS": "upstream repository administration",
    "integrations/.github/PULL_REQUEST_TEMPLATE.md": "upstream repository administration",
    "integrations/.github/dependabot.yml": "upstream repository administration",
    "integrations/.github/workflows/release.yml": "upstream release workflow",
    "integrations/examples/integrations/stripe/python/__pycache__/get_card.cpython-312.pyc": "generated Python bytecode",
    "integrations/examples/integrations/temporal/.eslintignore": "removed during ESLint migration",
    "integrations/examples/integrations/temporal/.eslintrc.js": "removed during ESLint migration",
    "playbook/guides/1password/1pass_new.zip": "obsolete generated extension archive",
    "playbook/guides/1password/python/__pycache__/playwright.cpython-312.pyc": "generated Python bytecode",
    "playbook/guides/1password/python/__pycache__/stagehand.cpython-312.pyc": "generated Python bytecode",
    "playbook/node/playwright/_tools/download/files/generate_pdf.pdf": "generated download output",
    "playbook/node/playwright/_tools/download/files/sandstorm-1739826419657.mp3": "generated download output",
    "playbook/node/playwright/_tools/download/files/screenshot.jpeg": "generated download output",
    "playbook/node/playwright/_tools/download/files/webpage.pdf": "generated download output",
}

PUBLIC_ROOT_FILES = (
    ".gitignore", ".gitleaks.toml", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "LICENSE",
    "MAINTAINERS.md", "NOTICE", "SECURITY.md", "SUPPORT.md", "llms.txt",
)
PUBLIC_ROOT_TREES = (
    ".claude-plugin", ".codex-plugin", ".github", "assets", "skills", "scripts", "tests",
)
PUBLIC_DOCS = ("agents.md", "getting-started.md", "sources.md", "verification.md")


def load_metadata(root):
    return json.loads((root / "catalog.json").read_text()), json.loads((root / "SOURCE_MANIFEST.json").read_text())


def safe_relative_path(value):
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or not path.parts:
        raise ValueError(f"unsafe artifact path: {value}")
    return path


def private_markers(catalog, manifest):
    markers = set()
    for recipe in catalog.get("recipes", []):
        if recipe.get("access") != "private":
            continue
        for value in (recipe.get("id"), recipe.get("path"), recipe.get("source", {}).get("path")):
            if isinstance(value, str) and value:
                markers.add(value)
    for source in manifest.get("sources", []):
        if source.get("visibility") == "private" and isinstance(source.get("repository"), str):
            markers.add(source["repository"])
    return markers


def public_metadata(catalog, manifest):
    recipes = [recipe for recipe in catalog.get("recipes", []) if recipe.get("access") == "public"]
    sources = [source for source in manifest.get("sources", []) if source.get("visibility") == "public" and source.get("destination") != "use-cases"]
    return ({"schema_version": catalog.get("schema_version", 1), "recipes": recipes},
            {"schema_version": manifest.get("schema_version", 1), "sources": sources})


def private_boundary_violations(root):
    catalog, manifest = load_metadata(root)
    problems = []
    private = [recipe for recipe in catalog.get("recipes", []) if recipe.get("access") == "private"]
    private_sources = [source for source in manifest.get("sources", [])
                       if source.get("visibility") == "private"]
    for recipe in private:
        for field in ("path", "working_directory"):
            if not str(recipe.get(field, "")).startswith("use-cases/"):
                problems.append(
                    f"private recipe escapes use-cases in {field}: {recipe.get('id')}"
                )
    customer_sources = [source for source in private_sources
                        if source.get("destination") == "use-cases"]
    if bool(private) != bool(customer_sources):
        problems.append("private catalog and source-manifest boundaries disagree")
    return problems, len(private), len(private_sources)


def working_tree_changes(root):
    if not (root / ".git").exists():
        return []
    result = subprocess.run(
        ["git", "status", "--porcelain=v1", "--untracked-files=all"],
        cwd=root,
        capture_output=True,
        text=True,
    )
    if result.returncode:
        raise RuntimeError("cannot inspect source working tree")
    return [entry for entry in result.stdout.splitlines() if entry]


def copy_public_file(source_root, artifact_root, relative):
    rel = safe_relative_path(relative)
    source = source_root.joinpath(*rel.parts)
    destination = artifact_root.joinpath(*rel.parts)
    if source.is_symlink():
        raise ValueError(f"public artifact source is a symlink: {relative}")
    if not source.is_file():
        raise FileNotFoundError(f"public artifact source is missing: {relative}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)


def recipe_files(source_root, recipe_path):
    rel = safe_relative_path(recipe_path)
    source = source_root.joinpath(*rel.parts)
    if source.is_symlink():
        raise ValueError(f"public recipe path is a symlink: {recipe_path}")
    if source.is_file():
        return [source]
    if not source.is_dir():
        return []
    ignored_parts = {".git", "node_modules", "__pycache__", ".pytest_cache", ".next", "dist", "traces"}
    files = []
    for path in source.rglob("*"):
        relative_parts = path.relative_to(source).parts
        if any(part in ignored_parts for part in relative_parts):
            continue
        if path.is_symlink():
            raise ValueError(f"public recipe contains a symlink: {path.relative_to(source_root)}")
        if path.is_file() and path.name != ".env" and not path.name.endswith(".log"):
            files.append(path)
    return sorted(files)


def copy_public_tree(source_root, artifact_root, relative):
    """Copy a reviewed public tree while applying runtime-artifact exclusions."""
    for source in recipe_files(source_root, relative):
        rel = source.relative_to(source_root).as_posix()
        copy_public_file(source_root, artifact_root, rel)


def public_readme(text, recipe_count):
    text = text.replace(
        "This cookbook brings together Browserbase's templates, playbook, integrations, and restricted workflow examples. It includes the source code, with each project's dependencies kept together. Restricted workflow examples remain access-controlled. Imported examples have been inspected, but have not all been run against live services.",
        "This cookbook brings together Browserbase's public templates, Playbook patterns, and integrations. It includes the source code, with each project's dependencies kept together. Imported examples have been inspected, but have not all been run against live services.",
    )
    text = re.sub(
        r"^\|\s*Adapt an end-to-end business workflow\s*\|\s*\[Restricted workflow examples\]\(use-cases/README\.md\)\s*\|\n?",
        "",
        text,
        flags=re.MULTILINE,
    )
    text = text.replace("It respects your language and framework, identifies Playbook patterns, and keeps restricted workflow examples labeled.", "It respects your language and framework and identifies relevant Playbook patterns.")
    text = text.replace("use-cases/      Private restricted applications, grouped by business use case\n", "")
    text = text.replace(" `private` identifies restricted source that requires controlled access.", "")
    text = text.replace(" [Publication boundary](docs/publication.md) explains why this checkout and its history must remain private and defines the release-artifact gate.", "")
    text = text.replace("the four repositories recorded", "the three repositories recorded")
    return text


def public_support_document(name, text):
    if name == "sources.md":
        if "| Original repository" not in text:
            return text
        start = text.index("| Original repository")
        end = text.index("\n\n## What an import record means", start)
        table = """| Original repository | Local collection |\n| --- | --- |\n| [browserbase/templates](https://github.com/browserbase/templates) | [examples](../examples/README.md) |\n| [browserbase/playbook](https://github.com/browserbase/playbook) | [playbook](../playbook/README.md) |\n| [browserbase/integrations](https://github.com/browserbase/integrations) | [integrations](../integrations/README.md) |"""
        text = text[:start] + table + text[end:]
        text = re.sub(r"\nSource repository release workflows.*?before using those paths\.\n", "\nSource repository release workflows, agent configurations, dependency caches, compiler state, and generated downloads are excluded. Secret-like assignments in environment samples are cleared. See the file-level reasons in the manifest.\n", text, flags=re.S)
        text = re.sub(r"## Licenses and access\n.*?## Reproduce the inventory", "## Licenses\n\nThe integrations collection retains its upstream MIT license. Other imported source roots did not include a license file at the pinned revisions. Review the root license and retained package notices before redistribution.\n\n## Reproduce the inventory", text, flags=re.S)
        text = text.replace("templates`, `playbook`, `integrations`, and `private_workflows`", "templates`, `playbook`, and `integrations`")
        text = re.sub(r"\n- \[use-cases\].*?\n", "\n", text)
    elif name == "verification.md":
        text = text.replace("The source directory contains `templates`, `playbook`, `integrations`, and `private_workflows`.", "The source directory contains `templates`, `playbook`, and `integrations`.")
        text = text.replace("Captured inputs were excluded conservatively, and remaining private source still requires access control.", "The hygiene scan is not a full security audit.")
    elif name == "agents.md":
        text = text.replace(" It does not create a public marketplace or upload this private cookbook.", "")
        text = re.sub(r"\nPrivate sources still require authorized access\.\n\nNo installation step needs to copy restricted applications into an agent's global skills directory\.\n", "\n", text)
        text = text.replace("- Find a customer workflow for insurance verification, keeping restricted sources access-controlled.\n", "")
    return text


def public_llms():
    return """# Browserbase public cookbook

> Public demo and reference code for Browserbase templates, Playbook patterns, and integrations. Independently review every recipe, obtain authorization, and use it at your own risk.

## Agent entrypoint

- [Browserbase cookbook skill](skills/browserbase-cookbook/SKILL.md): Task routing and source-selection rules.
- [Agent installation](docs/agents.md): Local setup for Codex, Claude Code, and Cursor.

## Browse

- [Recipe catalog](docs/catalog.md): Public recipes with language and lifecycle labels.
- [Getting started](docs/topics/getting-started.md)
- [Authentication](docs/topics/authentication.md)
- [Browser features](docs/topics/browser-features.md)
- [Downloads and documents](docs/topics/downloads-and-documents.md)
- [Extraction and research](docs/topics/extraction-and-research.md)
- [Forms and transactions](docs/topics/forms-and-transactions.md)
- [Agents and human handoff](docs/topics/agents-and-human-handoff.md)
- [Integrations and orchestration](docs/topics/integrations-and-orchestration.md)
- [Testing and observability](docs/topics/testing-and-observability.md)
- [Commerce and travel](docs/topics/commerce-and-travel.md)
- [Business operations](docs/topics/business-operations.md)

## Maintenance

- [Catalog data](catalog.json)
- [Source manifest](SOURCE_MANIFEST.json)
- [Verification](docs/verification.md)
- [Contributing](CONTRIBUTING.md)

Paths are relative to this public artifact. Source inspection is not runtime verification.
"""


def public_skill(text):
    text = text.replace(
        "Restricted links require the user's existing repository access. Do not substitute invented private code when access fails.",
        "Use only recipes present in this public artifact. Do not substitute invented code when a local source path is absent.",
    )
    text = text.replace(
        "Use a private restricted workflow when its end-to-end workflow is the relevant example and authorized source access exists. ",
        "",
    )
    text = text.replace(
        "Inspect a restricted reference only when the user explicitly identifies it or explicitly requests restricted examples and confirms authorized source access; never route an open-ended task to restricted material by default.",
        "",
    )
    text = text.replace(
        "Search defaults to public recipes. Do not add `--access any` or `--access private` for general discovery. Use one of those flags only for an explicit, authorized request to inspect restricted references.",
        "Search uses the public recipes in this artifact.",
    )
    text = re.sub(
        r"\nSearch defaults to public recipes\. When the user is authorized to use the\nrestricted workflow collection and that collection is relevant, add\n`--access any` \(or `--access private`\) so those recipes are considered\.\n",
        "\nSearch uses the public recipes in this artifact.\n",
        text,
    )
    text = text.replace(" Keep restricted recipe code and sensitive data within the authorized workspace.", "")
    return text


def public_contributing(text):
    text = text.replace(", or `use-cases/` for private business applications", "")
    text = text.replace("`, or `use-cases/`", "`")
    text = re.sub(r"\nUse separate clean source checkouts\. Inspect upstream changes before changing a pin\. Keep `private_workflows` access-controlled\.\n", "\nUse separate clean source checkouts. Inspect upstream changes before changing a pin.\n", text)
    text = re.sub(r"Public refresh requires only .*?It refuses differing existing files by default\.\n", "Public refresh requires `templates`, `playbook`, and `integrations` at the intended revisions. The importer reads committed Git blobs, so uncommitted source edits do not enter the cookbook. It refuses differing existing files by default.\n", text, flags=re.S)
    text = text.replace(" and private access labels", "")
    text = text.replace("This consolidation is not permission to republish customer material.", "")
    return text


def markdown_link_problems(root):
    """Return missing local Markdown links and HTML image sources."""
    problems = []
    markdown_link = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
    html_link = re.compile(r"(?:src|srcset|href)=[\"']([^\"']+)[\"']", re.I)
    for path in sorted(root.rglob("*.md")):
        text = path.read_text(errors="replace")
        for raw in markdown_link.findall(text) + html_link.findall(text):
            target = raw.strip().split()[0].strip("<>")
            if not target or target.startswith(("#", "http://", "https://", "mailto:", "data:")):
                continue
            target = target.split("#", 1)[0].split("?", 1)[0]
            if not target:
                continue
            candidate = (path.parent / target).resolve()
            try:
                candidate.relative_to(root.resolve())
            except ValueError:
                problems.append(f"local link escapes artifact in {path.relative_to(root)}: {raw}")
                continue
            if not candidate.exists():
                problems.append(f"local link target is missing in {path.relative_to(root)}: {raw}")
    return problems


def license_contract_problems(root):
    license_path = root / "LICENSE"
    contributing_path = root / "CONTRIBUTING.md"
    if not license_path.is_file() or not contributing_path.is_file():
        return []
    license_text = license_path.read_text(errors="replace").lower()
    contributing_text = contributing_path.read_text(errors="replace").lower()
    if "apache license" in license_text and "repository's [mit license](license)" in contributing_text:
        return ["CONTRIBUTING.md identifies the Apache-2.0 root license as MIT"]
    return []


def catalog_target_problems(root, catalog):
    problems = []
    for recipe in catalog.get("recipes", []):
        for field in ("path", "readme", "working_directory", "upstream_readme", "environment_template"):
            value = recipe.get(field)
            if value is None and field in {"environment_template", "upstream_readme"}:
                continue
            if not isinstance(value, str) or not root.joinpath(*safe_relative_path(value).parts).exists():
                problems.append(f"catalog recipe target is missing in {field}: {recipe.get('id')}")
        for field in ("entrypoints", "manifests"):
            for value in recipe.get(field, []):
                if not root.joinpath(*safe_relative_path(value).parts).is_file():
                    problems.append(f"catalog recipe target is missing in {field}: {recipe.get('id')}: {value}")
    return problems


def write_public_indexes(artifact_root, recipes):
    docs = artifact_root / "docs"
    topics_dir = docs / "topics"
    topics_dir.mkdir(parents=True, exist_ok=True)
    lines = ["# Public cookbook catalog", "", "| Recipe | Collection |", "| --- | --- |"]
    for recipe in sorted(recipes, key=lambda item: (item.get("title", ""), item.get("id", ""))):
        guide = PurePosixPath(recipe["readme"]).relative_to("docs")
        title = recipe.get("title", recipe["id"])
        lines.append(f"| [{title}]({guide.as_posix()}) | {recipe.get('collection', '')} |")
    (docs / "catalog.md").write_text("\n".join(lines) + "\n")
    topics = sorted({topic for recipe in recipes for topic in recipe.get("topics", [])})
    for topic in topics:
        topic_recipes = [recipe for recipe in recipes if topic in recipe.get("topics", [])]
        topic_lines = [f"# {topic.replace('-', ' ').title()}", "", "| Recipe | Language |", "| --- | --- |"]
        for recipe in sorted(topic_recipes, key=lambda item: (item.get("title", ""), item.get("id", ""))):
            guide = PurePosixPath("..").joinpath(PurePosixPath(recipe["readme"]).relative_to("docs"))
            languages = ", ".join(recipe.get("languages", []))
            title = recipe.get("title", recipe["id"])
            topic_lines.append(f"| [{title}]({guide.as_posix()}) | {languages} |")
        (topics_dir / f"{topic}.md").write_text("\n".join(topic_lines) + "\n")


def export_public(source_root, artifact_root):
    source_root, artifact_root = source_root.resolve(), artifact_root.resolve()
    if artifact_root.exists() and any(artifact_root.iterdir()):
        raise ValueError(f"artifact destination must be empty: {artifact_root}")
    artifact_root.mkdir(parents=True, exist_ok=True)
    catalog, manifest = load_metadata(source_root)
    clean_catalog, clean_manifest = public_metadata(catalog, manifest)
    copied = set()
    skipped = []
    for relative in PUBLIC_ROOT_FILES:
        copy_public_file(source_root, artifact_root, relative)
        copied.add(relative)
    (artifact_root / "CONTRIBUTING.md").write_text(public_contributing((source_root / "CONTRIBUTING.md").read_text()))
    (artifact_root / "llms.txt").write_text(public_llms())
    for relative in PUBLIC_ROOT_TREES:
        copy_public_tree(source_root, artifact_root, relative)
        copied.update(path.relative_to(artifact_root).as_posix() for path in (artifact_root / relative).rglob("*") if path.is_file())
    skill = artifact_root / "skills/browserbase-cookbook/SKILL.md"
    skill.write_text(public_skill(skill.read_text()))
    # This contract test targets a private application and has no meaning in the
    # public artifact.
    for relative in (
        "tests/test_localized_pdp_contract.py",
        "tests/test_semantic_privacy.py",
    ):
        private_test = artifact_root / relative
        if private_test.exists():
            private_test.unlink()
    for name in PUBLIC_DOCS:
        relative = f"docs/{name}"
        destination = artifact_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(public_support_document(name, (source_root / relative).read_text()))
        copied.add(relative)
    artifact_sources = []
    for source in clean_manifest["sources"]:
        artifact_source = deepcopy(source)
        artifact_source["files"] = []
        for record in source.get("files", []):
            relative = record.get("path")
            if not isinstance(relative, str):
                raise ValueError("public provenance file has no path")
            if not source_root.joinpath(*safe_relative_path(relative).parts).exists():
                skipped.append(relative)
                continue
            if relative not in copied:
                copy_public_file(source_root, artifact_root, relative)
                copied.add(relative)
            artifact_source["files"].append(record)
        artifact_sources.append(artifact_source)
    clean_manifest["sources"] = artifact_sources
    artifact_recipes = []
    extra_files = {}
    for recipe in clean_catalog["recipes"]:
        relative = recipe.get("readme")
        recipe_path = recipe.get("path")
        if not isinstance(recipe_path, str) or not source_root.joinpath(*safe_relative_path(recipe_path).parts).exists():
            skipped.append(str(recipe_path))
            continue
        if not isinstance(relative, str) or not source_root.joinpath(*safe_relative_path(relative).parts).is_file():
            skipped.append(str(relative))
            continue
        if relative not in copied:
            copy_public_file(source_root, artifact_root, relative)
            copied.add(relative)
        # The working directory is the executable package boundary. Copying only
        # a leaf recipe loses manifests, helpers, workspace packages, and fixtures.
        package_root = recipe.get("working_directory") or recipe_path
        for source_file in recipe_files(source_root, package_root):
            file_relative = source_file.relative_to(source_root).as_posix()
            if file_relative not in copied:
                copy_public_file(source_root, artifact_root, file_relative)
                copied.add(file_relative)
                extra_files[file_relative] = hashlib.sha256(source_file.read_bytes()).hexdigest()
        artifact_recipes.append(recipe)
    clean_catalog["recipes"] = artifact_recipes
    write_public_indexes(artifact_root, artifact_recipes)
    (artifact_root / "catalog.json").write_text(json.dumps(clean_catalog, indent=2, sort_keys=True) + "\n")
    (artifact_root / "SOURCE_MANIFEST.json").write_text(json.dumps(clean_manifest, indent=2, sort_keys=True) + "\n")
    authored = json.loads((source_root / "COOKBOOK_AUTHORED.json").read_text())
    authored["files"] = [item for item in authored.get("files", []) if not item["path"].startswith("use-cases/")]
    for item in authored["files"]:
        relative = item["path"]
        if relative not in copied:
            copy_public_file(source_root, artifact_root, relative)
            copied.add(relative)
    (artifact_root / "COOKBOOK_AUTHORED.json").write_text(json.dumps(authored, indent=2, sort_keys=True) + "\n")
    (artifact_root / "README.md").write_text(public_readme((source_root / "README.md").read_text(), len(artifact_recipes)))

    # Remove the one private package override from the otherwise shared catalog
    # tool. The filtered catalog cannot exercise it.
    catalog_tool = artifact_root / "scripts/catalog.py"
    catalog_text = catalog_tool.read_text()
    for marker in private_markers(catalog, manifest):
        catalog_text = "\n".join(line for line in catalog_text.splitlines() if marker not in line) + "\n"
    catalog_text = catalog_text.replace("['examples', 'integrations', 'playbook', 'use-cases']", "['examples', 'integrations', 'playbook']")
    catalog_text = catalog_text.replace("Playbook patterns and private applications retain their original execution boundaries.", "Playbook patterns retain their original execution boundaries.")
    catalog_text = catalog_text.replace(" Private sources require access.", "")
    catalog_tool.write_text(catalog_text)
    catalog_tests = artifact_root / "tests/test_catalog.py"
    if catalog_tests.exists():
        catalog_tests.write_text(catalog_tests.read_text().replace(
            "['examples', 'integrations', 'playbook', 'use-cases']",
            "['examples', 'integrations', 'playbook']",
        ))

    malformed = artifact_root / "integrations/examples/integrations/mastra/README.md"
    if malformed.exists():
        malformed.write_text(malformed.read_text().replace("https:/stagehand.dev", "https://stagehand.dev"))
        for source in clean_manifest["sources"]:
            for record in source.get("files", []):
                if record.get("path") == "integrations/examples/integrations/mastra/README.md":
                    record["adaptation"] = {
                        "sha256": hashlib.sha256(malformed.read_bytes()).hexdigest(),
                        "reason": "Repair malformed Stagehand documentation URL in the public artifact.",
                    }
        (artifact_root / "SOURCE_MANIFEST.json").write_text(json.dumps(clean_manifest, indent=2, sort_keys=True) + "\n")

    # Regenerate recipe guides, indexes, collection tables, skill references,
    # and the stats card from the filtered catalog.
    result = subprocess.run(
        [sys.executable, "scripts/catalog.py", "build"], cwd=artifact_root,
        text=True, capture_output=True,
    )
    if result.returncode:
        raise RuntimeError(f"public catalog generation failed: {result.stderr or result.stdout}")

    reviewed = {path: REVIEWED_MISSING_PUBLIC_PATHS[path] for path in sorted(skipped) if path in REVIEWED_MISSING_PUBLIC_PATHS}
    unexpected = sorted(set(skipped) - REVIEWED_MISSING_PUBLIC_PATHS.keys())
    (artifact_root / "PUBLIC_EXPORT_REPORT.json").write_text(json.dumps({
        "schema_version": 1,
        "exported_recipes": len(clean_catalog["recipes"]),
        "copied_source_and_guide_files": len(copied),
        "skipped_missing_public_paths": sorted(skipped),
        "reviewed_missing_public_paths": reviewed,
        "unexpected_missing_public_paths": unexpected,
        "additional_public_recipe_files": dict(sorted(extra_files.items())),
    }, indent=2, sort_keys=True) + "\n")
    if unexpected:
        raise ValueError("unexpected missing public provenance paths: " + ", ".join(unexpected))
    return len(clean_catalog["recipes"]), len(copied), skipped


def scan_artifact(root, forbidden=()):
    problems = []
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root).as_posix()
        if path.is_symlink():
            problems.append(f"symlink is not allowed: {relative}")
            continue
        if not path.is_file():
            continue
        try:
            lowered = path.read_text().lower()
        except UnicodeDecodeError:
            continue
        for marker in forbidden:
            if marker.lower() in lowered:
                problems.append(f"private metadata marker found in {relative}: {marker}")
        original = path.read_text(errors="replace")
        for pattern in SECRET_PATTERNS:
            if pattern.search(original):
                problems.append(f"secret-shaped value found in {relative}: {pattern.pattern}")
        for match in UUID_PATTERN.finditer(original):
            if match.group(0).lower() not in UUID_ALLOWLIST:
                problems.append(f"UUID-shaped resource identifier found in {relative}")
        searchable = relative + "\n" + original
        for label, pattern in SEMANTIC_DENY_PATTERNS:
            if pattern.search(searchable):
                problems.append(f"semantic denylist match in {relative}: {label}")
    return problems


def violations(root, forbidden=()):
    problems = []
    try:
        catalog, manifest = load_metadata(root)
    except (FileNotFoundError, json.JSONDecodeError) as error:
        return [f"artifact metadata could not be read: {error}"], 0, 0
    private = [recipe for recipe in catalog.get("recipes", []) if recipe.get("access") != "public"]
    private_sources = [source for source in manifest.get("sources", []) if source.get("visibility") != "public" or source.get("destination") == "use-cases"]
    for recipe in catalog.get("recipes", []):
        for field in ("path", "working_directory"):
            if str(recipe.get(field, "")).startswith("use-cases/"):
                problems.append(f"catalog recipe enters private collection in {field}: {recipe.get('id')}")
    problems.extend(catalog_target_problems(root, catalog))
    problems.extend(markdown_link_problems(root))
    problems.extend(license_contract_problems(root))
    problems.extend(scan_artifact(root, forbidden))
    return problems, len(private), len(private_sources)


def tree_digest(root):
    digest = hashlib.sha256()
    for path in sorted(p for p in root.rglob("*") if p.is_file() and not p.is_symlink()):
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--export", type=Path, dest="export_path")
    parser.add_argument("--require-public", action="store_true")
    parser.add_argument(
        "--allow-dirty",
        action="store_true",
        help="allow a development export from an uncommitted source tree",
    )
    args = parser.parse_args()
    root = args.root.resolve()
    if not args.export_path and not args.require_public:
        problems, private_count, source_count = private_boundary_violations(root)
        for problem in problems:
            print(problem, file=sys.stderr)
        if problems:
            return 1
        print(
            f"Private boundary is internally consistent "
            f"({private_count} recipes, {source_count} source record)."
        )
        return 0
    forbidden = ()
    if args.export_path:
        changes = working_tree_changes(root)
        if changes and not args.allow_dirty:
            print(
                f"refusing public export from dirty source tree ({len(changes)} status entries); "
                "commit reviewed changes or pass --allow-dirty for local development only",
                file=sys.stderr,
            )
            return 1
        catalog, manifest = load_metadata(root)
        forbidden = private_markers(catalog, manifest)
        recipe_count, file_count, skipped = export_public(root, args.export_path)
        root = args.export_path.resolve()
        print(f"Exported {recipe_count} public recipes and {file_count} source/doc files to {root}")
        if skipped:
            print(f"Skipped {len(skipped)} stale public metadata path(s) absent from the source checkout.")
    problems, private_count, source_count = violations(root, forbidden)
    if args.require_public:
        if private_count:
            problems.append(f"catalog contains {private_count} non-public recipes")
        if source_count:
            problems.append(f"source manifest contains {source_count} non-public source records")
        if (root / "use-cases").exists():
            problems.append("use-cases tree is present")
        if (root / ".git").exists():
            problems.append("Git history is present")
    for problem in problems:
        print(problem, file=sys.stderr)
    if problems:
        return 1
    print(f"Public boundary verified ({tree_digest(root)}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
