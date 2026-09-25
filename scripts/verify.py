#!/usr/bin/env python3
"""Check cookbook structure and provenance without executing recipe code."""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path, PureWindowsPath
from urllib.parse import unquote, urlsplit

GENERATED_DIRECTORIES = {".venv", "node_modules", "__pycache__", ".next"}

class Verification:
    def __init__(self, root, source_dir=None):
        self.root = Path(root).resolve()
        self.errors = []
        self.imported = set()
        self.counts = {}
        self.sources = {}
        self.source_dir = Path(source_dir).resolve() if source_dir else None

    def fail(self, location, message):
        self.errors.append(f"{location}: {message}")

    def read_json(self, relative):
        try:
            value = json.loads((self.root / relative).read_text())
            if not isinstance(value, dict):
                self.fail(relative, "JSON root must be an object")
                return {}
            return value
        except (OSError, ValueError) as error:
            self.fail(relative, f"cannot read JSON ({type(error).__name__})")
            return {}

    def path(self, value, location, exists=True):
        if not isinstance(value, str) or not value or Path(value).is_absolute():
            self.fail(location, "expected a nonempty relative path")
            return None
        candidate = (self.root / value).resolve()
        if not candidate.is_relative_to(self.root):
            self.fail(location, "path escapes repository")
            return None
        if exists and not candidate.exists():
            self.fail(location, f"missing path {value}")
            return None
        return candidate

    def manifest(self):
        manifest = self.read_json("SOURCE_MANIFEST.json")
        sources = manifest.get("sources", [])
        if not sources:
            self.fail("SOURCE_MANIFEST.json", "sources must not be empty")
        pins = {}
        seen = set()
        for source in sources:
            repository = source.get("repository")
            commit = source.get("commit", "")
            if not re.fullmatch(r"[0-9a-f]{40}", commit):
                self.fail("SOURCE_MANIFEST.json", "source commit must be a full SHA")
            if repository in pins:
                self.fail("SOURCE_MANIFEST.json", "duplicate source repository")
            pins[repository] = commit
            self.sources[repository] = source
            self.path(source.get("destination"), "SOURCE_MANIFEST.json", exists=False)
            for item in source.get("files", []):
                name = item.get("path")
                action = item.get("action")
                location = f"SOURCE_MANIFEST.json ({name})"
                file = self.path(name, location, exists=action != "excluded")
                if item.get("source_identity") == "sha256":
                    if "source_path" in item or not re.fullmatch(r"[0-9a-f]{64}", item.get("source_sha256", "")):
                        self.fail(location, "content-addressed source needs a SHA-256 digest and no source_path")
                else:
                    self.path(item.get("source_path"), location, exists=False)
                if name in seen:
                    self.fail(location, "duplicate destination")
                seen.add(name)
                if action != "excluded" and any(part in GENERATED_DIRECTORIES for part in Path(name or "").parts):
                    self.fail(location, "generated directory must not appear in manifest")
                if action not in {"imported", "transformed", "excluded"}:
                    self.fail(location, "unknown action")
                expected_digest = item.get("sha256")
                if "adaptation" in item:
                    adaptation = item["adaptation"]
                    if action == "excluded":
                        self.fail(location, "excluded file cannot have a local adaptation")
                    if not isinstance(adaptation, dict):
                        self.fail(location, "adaptation must be an object")
                    else:
                        if set(adaptation) != {"sha256", "reason"}:
                            self.fail(location, "adaptation accepts only sha256 and reason")
                        reason = adaptation.get("reason")
                        digest = adaptation.get("sha256")
                        if not isinstance(reason, str) or not reason.strip():
                            self.fail(location, "adaptation needs a nonempty reason")
                        if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
                            self.fail(location, "adaptation needs a SHA-256 digest")
                        else:
                            expected_digest = digest
                if action == "excluded":
                    if not item.get("reason"):
                        self.fail(location, "excluded file needs a reason")
                    if file and (file.exists() or file.is_symlink()):
                        self.fail(location, "excluded destination was reintroduced")
                    continue
                self.imported.add(name)
                if action == "transformed" and not re.fullmatch(r"[0-9a-f]{64}", item.get("source_sha256", "")):
                    self.fail(location, "transformed file needs its source digest")
                if action == "imported" and item.get("source_sha256") != item.get("sha256"):
                    self.fail(location, "untransformed file differs from its source digest")
                if file and file.is_file():
                    digest = hashlib.sha256(file.read_bytes()).hexdigest()
                    if digest != expected_digest:
                        self.fail(location, "destination digest mismatch")
                elif file:
                    self.fail(location, "manifest entry must be a file")
        self.counts["source files"] = len(self.imported)
        return pins

    def catalog(self, pins):
        catalog = self.read_json("catalog.json")
        authored_manifest = self.read_json("COOKBOOK_AUTHORED.json")
        authored_paths = {
            item.get("path") for item in authored_manifest.get("files", [])
            if isinstance(item, dict) and isinstance(item.get("path"), str)
        }
        if catalog.get("schema_version") != 1:
            self.fail("catalog.json", "unsupported schema_version")
        recipes = catalog.get("recipes", [])
        if not recipes:
            self.fail("catalog.json", "recipes must not be empty")
        ids = set()
        for recipe in recipes:
            identifier = recipe.get("id")
            location = f"catalog.json ({identifier})"
            if not isinstance(identifier, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", identifier):
                self.fail(location, "id must be a lowercase slug")
            if identifier in ids:
                self.fail(location, "duplicate id")
            ids.add(identifier)
            verification_levels = {"source-inspected", "install-verified", "typechecked", "offline-tested", "live-tested"}
            enums = {"collection": {"examples", "integrations", "playbook"}, "access": {"public"}, "lifecycle": {"current", "legacy", "retired"}, "verification": verification_levels}
            for field, values in enums.items():
                if recipe.get(field) not in values:
                    self.fail(location, f"invalid {field}")
            for field in ("title", "summary"):
                if not isinstance(recipe.get(field), str) or not recipe[field].strip():
                    self.fail(location, f"{field} must be nonempty text")
            languages = recipe.get("languages")
            if not isinstance(languages, list) or not languages or any(not isinstance(language, str) or not language.strip() for language in languages):
                self.fail(location, "languages must contain nonempty names")
            environment = recipe.get("environment_variables", [])
            environment_fields = {"name", "requirement", "provider", "purpose", "secret", "safe_example", "validation", "default", "setup_url"}
            if not isinstance(environment, list):
                self.fail(location, "environment_variables must be a list")
            else:
                names = set()
                for item in environment:
                    if not isinstance(item, dict) or set(item) != environment_fields:
                        self.fail(location, "environment variable metadata has invalid fields")
                        continue
                    name = item.get("name")
                    if not isinstance(name, str) or not re.fullmatch(r"[A-Z][A-Z0-9_]*", name) or name in names:
                        self.fail(location, "environment variable name must be unique uppercase text")
                    names.add(name)
                    if item.get("requirement") not in {"required", "optional", "conditional"}:
                        self.fail(location, "environment variable requirement is invalid")
                    if not isinstance(item.get("secret"), bool):
                        self.fail(location, "environment variable secret flag must be boolean")
                    for field in ("provider", "purpose", "safe_example", "validation"):
                        if not isinstance(item.get(field), str) or not item[field].strip():
                            self.fail(location, f"environment variable {field} must be nonempty text")
                    if item.get("default") is not None and not isinstance(item.get("default"), str):
                        self.fail(location, "environment variable default must be text or null")
                    setup_url = item.get("setup_url")
                    if setup_url is not None and (not isinstance(setup_url, str) or not setup_url.startswith("https://")):
                        self.fail(location, "environment variable setup_url must be HTTPS or null")
            evidence = recipe.get("verification_evidence", [])
            if not isinstance(evidence, list):
                self.fail(location, "verification_evidence must be a list")
                evidence = []
            for item in evidence:
                fields = {"kind", "date", "runtime", "command", "result", "limits"}
                if not isinstance(item, dict) or set(item) != fields:
                    self.fail(location, "verification evidence has invalid fields")
                    continue
                if item.get("kind") not in verification_levels - {"source-inspected"}:
                    self.fail(location, "verification evidence has invalid kind")
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", item.get("date", "")):
                    self.fail(location, "verification evidence has invalid date")
                if item.get("result") not in {"passed", "failed"}:
                    self.fail(location, "verification evidence has invalid result")
                for field in ("runtime", "command", "limits"):
                    if not isinstance(item.get(field), str) or not item[field].strip():
                        self.fail(location, f"verification evidence needs {field}")
            selected = recipe.get("verification")
            if selected in verification_levels - {"source-inspected"} and not any(
                    item.get("kind") == selected and item.get("result") == "passed" for item in evidence if isinstance(item, dict)):
                self.fail(location, "verification level lacks matching passing evidence")
            for key in ("path", "working_directory", "readme"):
                self.path(recipe.get(key), f"{location}.{key}")
            for entry in recipe.get("entrypoints", []):
                self.path(entry, f"{location}.entrypoints")
            for manifest in recipe.get("manifests", []):
                self.path(manifest, f"{location}.manifests")
            if recipe.get("environment_template"):
                self.path(recipe["environment_template"], f"{location}.environment_template")
            for field in ("setup_commands", "run_commands"):
                commands = recipe.get(field)
                if not isinstance(commands, list) or any(not isinstance(command, str) or not command.strip() for command in commands):
                    self.fail(location, f"{field} must be a list of nonempty commands")
            working = self.path(recipe.get("working_directory"), f"{location}.working_directory")
            package = working / "package.json" if working else None
            if package and package.is_file():
                try:
                    scripts = json.loads(package.read_text()).get("scripts", {})
                except (OSError, ValueError):
                    scripts = {}
                for command in recipe.get("run_commands", []):
                    match = re.match(r"^(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?([a-zA-Z0-9:_-]+)(?:\s|$)", command)
                    if (match and not match.group(1).startswith("-")
                            and match.group(1) not in {"install", "add", "exec", "dlx"}
                            and match.group(1) not in scripts):
                        self.fail(location, f"run command references missing package script {match.group(1)}")
            if recipe.get("upstream_readme"):
                self.path(recipe["upstream_readme"], f"{location}.upstream_readme")
            source = recipe.get("source", {})
            if source.get("kind") == "cookbook-authored":
                if set(source) != {"kind", "path"}:
                    self.fail(location, "cookbook-authored source accepts only kind and path")
                source_path = source.get("path")
                if self.path(source_path, location + ".source.path"):
                    prefix = source_path.rstrip("/") + "/"
                    if source_path not in authored_paths and not any(path.startswith(prefix) for path in authored_paths):
                        self.fail(location, "source path has no cookbook-authored manifest coverage")
                continue
            if source.get("repository") not in pins or source.get("commit") != pins.get(source.get("repository")):
                self.fail(location, "source commit differs from manifest pin")
            source_path = source.get("path")
            if self.path(source_path, location + ".source.path", exists=False):
                records = self.sources.get(source.get("repository"), {}).get("files", [])
                prefix = source_path.rstrip("/") + "/"
                matching = [item for item in records if item.get("source_path") == source_path or item.get("source_path", "").startswith(prefix)]
                if not matching or not any(item.get("action") != "excluded" for item in matching):
                    self.fail(location, "source path has no imported manifest coverage")
        self.counts["recipes"] = len(recipes)

    def markdown(self):
        count = 0
        for file in self.root.rglob("*.md"):
            relative = file.relative_to(self.root).as_posix()
            if any(part in GENERATED_DIRECTORIES | {".git", ".audit"} for part in file.parts):
                continue
            count += 1
            fence = None
            for number, line in enumerate(file.read_text().splitlines(), 1):
                marker = re.match(r"^\s*(`{3,}|~{3,})", line)
                if marker:
                    if fence is None:
                        fence = marker.group(1)[0]
                    elif marker.group(1)[0] == fence:
                        fence = None
                    continue
                if fence:
                    continue
                targets = re.findall(r"!?\[[^\]]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)", line)
                targets.extend(re.findall(r"(?:src|href)=[\"']([^\"']+)[\"']", line, re.I))
                for srcset in re.findall(r"srcset=[\"']([^\"']+)[\"']", line, re.I):
                    targets.extend(candidate.strip().split()[0] for candidate in srcset.split(",") if candidate.strip())
                reference = re.match(r"^\s*\[[^\]]+\]:\s*(<[^>]+>|\S+)", line)
                if reference:
                    targets.append(reference.group(1))
                for target in targets:
                    target = target.strip("<>")
                    parsed = urlsplit(target)
                    if parsed.scheme or parsed.netloc or not parsed.path:
                        continue
                    path = unquote(parsed.path)
                    candidate = self.root / path.lstrip("/") if path.startswith("/") else file.parent / path
                    if not candidate.resolve().is_relative_to(self.root):
                        self.fail(f"{relative}:{number}", "local Markdown link escapes repository")
                    elif not candidate.exists():
                        self.fail(f"{relative}:{number}", "broken local Markdown link")
        self.counts["authored Markdown files"] = count

    def plugins(self):
        for file in self.root.rglob("plugin.json"):
            relative = file.relative_to(self.root).as_posix()
            if relative in self.imported or any(part in GENERATED_DIRECTORIES | {".git", ".audit"} for part in file.parts):
                continue
            data = self.read_json(relative)
            for key in ("skills", "commands", "agents", "hooks"):
                values = data.get(key, [])
                if isinstance(values, str):
                    values = [values]
                if not isinstance(values, list):
                    continue
                for value in values:
                    if isinstance(value, str):
                        self.path(value.removeprefix("./"), f"{relative}.{key}")
        for skill in self.root.rglob("SKILL.md"):
            relative = skill.relative_to(self.root).as_posix()
            if relative in self.imported or any(part in GENERATED_DIRECTORIES | {".git", ".audit"} for part in skill.parts):
                continue
            text = skill.read_text()
            if not text.startswith("---\n") or not re.search(r"^name:\s*\S+", text, re.M) or not re.search(r"^description:\s*\S+", text, re.M):
                self.fail(relative, "skill needs name and description frontmatter")

    def npm_lock(self, relative, content):
        try:
            lock = json.loads(content)
        except ValueError:
            self.fail(relative, "npm lock is not valid JSON")
            return
        if not isinstance(lock, dict):
            self.fail(relative, "npm lock root must be an object")
            return
        outside = set()
        base = (self.root / relative).parent
        manifest_file = base / "package.json"
        if lock.get("lockfileVersion") in {2, 3} and manifest_file.is_file():
            manifest = self.read_json(manifest_file.relative_to(self.root))
            direct = set()
            for field in ("dependencies", "devDependencies"):
                declarations = manifest.get(field, {})
                if isinstance(declarations, dict):
                    direct.update(declarations)
            # Optional dependencies may be deliberately absent on a platform.
            direct.difference_update(manifest.get("optionalDependencies", {}))
            graph = lock.get("packages", {})
            if not isinstance(graph, dict):
                graph = {}
            missing = sorted(name for name in direct if not isinstance(graph.get(f"node_modules/{name}"), dict))
            if missing:
                self.fail(relative, f"npm lock omits {len(missing)} direct dependency graph entries: {', '.join(missing)}")

        def check_reference(value):
            if not isinstance(value, str) or not value:
                return
            if value.startswith("file:"):
                value = unquote(value[5:])
            value = value.replace("\\", "/")
            # Check lexical locations, independently of generated node_modules
            # symlinks currently installed on this computer.
            if Path(value).is_absolute() or PureWindowsPath(value).is_absolute():
                outside.add(value)
                return
            destination = Path(os.path.abspath(base / value))
            if not destination.is_relative_to(self.root):
                outside.add(value)

        packages = lock.get("packages", {})
        if isinstance(packages, dict):
            for key, entry in packages.items():
                check_reference(key)
                if not isinstance(entry, dict):
                    continue
                resolved = entry.get("resolved")
                if isinstance(resolved, str) and (
                    entry.get("link") or resolved.startswith(("file:", "./", "../", "/", "\\"))
                    or PureWindowsPath(resolved).is_absolute()
                ):
                    check_reference(resolved)
                for field in ("dependencies", "devDependencies", "optionalDependencies"):
                    declarations = entry.get(field) or {}
                    if not isinstance(declarations, dict):
                        self.fail(relative, f"npm lock {field} must be an object")
                        continue
                    for value in declarations.values():
                        if isinstance(value, str) and value.startswith("file:"):
                            check_reference(value)
        if outside:
            self.fail(relative, f"npm lock contains {len(outside)} nonportable filesystem references")

    def hygiene(self):
        patterns = [
            re.compile(r"(?<![\w-])sk-(?:proj-)?[A-Za-z0-9_-]{32,}(?![\w-])"),
            re.compile(r"(?<!\w)(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}(?!\w)"),
            re.compile(r"(?<!\w)bb_live_[A-Za-z0-9]{20,}(?!\w)"),
            re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
            re.compile(r"socket-firewall\.tail[0-9]+\.ts\.net", re.I),
            re.compile(r"https://(?:www\.)?browserbase\.com/sessions/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", re.I),
        ]
        count = 0
        tracked = None
        if (self.root / ".git").exists():
            result = subprocess.run(["git", "ls-files", "-z"], cwd=self.root, capture_output=True)
            if result.returncode == 0:
                tracked = set(result.stdout.decode().split("\0"))
            else:
                self.fail(".git", "cannot inspect tracked files")
        files = []
        for directory, names, filenames in os.walk(self.root):
            names[:] = [name for name in names if name not in GENERATED_DIRECTORIES | {".git", ".audit"}]
            files.extend(Path(directory) / name for name in filenames)
        for file in files:
            relative = file.relative_to(self.root)
            if any(part in {".git", ".audit"} for part in relative.parts):
                continue
            if file.name.startswith(".env") and not file.name.endswith((".example", ".sample", ".template")):
                if tracked is None or relative.as_posix() in tracked:
                    self.fail(relative, "real environment file must not be tracked")
                continue
            if file.is_symlink() and not file.resolve().is_relative_to(self.root):
                self.fail(relative, "symlink escapes repository")
                continue
            if not file.is_file():
                continue
            count += 1
            try:
                content = file.read_text()
            except (UnicodeError, OSError):
                continue
            if file.name in {"package-lock.json", "npm-shrinkwrap.json"}:
                self.npm_lock(relative, content)
            for number, line in enumerate(content.splitlines(), 1):
                if any(pattern.search(line) for pattern in patterns):
                    self.fail(f"{relative}:{number}", "credential-like token requires review")
        self.counts["files scanned"] = count

    def source_coverage(self):
        if self.source_dir is None:
            return
        count = 0
        for repository, source in self.sources.items():
            checkout = self.source_dir / repository.rstrip("/").split("/")[-1]
            if not checkout.is_dir():
                self.fail("SOURCE_MANIFEST.json", f"missing source checkout {checkout.name}")
                continue
            head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=checkout, capture_output=True, text=True)
            if head.returncode or head.stdout.strip() != source["commit"]:
                self.fail("SOURCE_MANIFEST.json", f"source HEAD differs from pin for {checkout.name}")
                continue
            tree = subprocess.run(["git", "ls-tree", "-rz", "--name-only", source["commit"]], cwd=checkout, capture_output=True)
            if tree.returncode:
                self.fail("SOURCE_MANIFEST.json", f"cannot read source tree for {checkout.name}")
                continue
            original = set(tree.stdout.decode().rstrip("\0").split("\0"))
            records = source.get("files", [])
            recorded = [item["source_path"] for item in records if "source_path" in item]
            unresolved = sorted(original - set(recorded))
            for item in records:
                if item.get("source_identity") != "sha256":
                    continue
                matched = None
                for path in unresolved:
                    blob = subprocess.run(["git", "show", source["commit"] + ":" + path],
                                          cwd=checkout, capture_output=True)
                    if blob.returncode == 0 and hashlib.sha256(blob.stdout).hexdigest() == item["source_sha256"]:
                        matched = path
                        break
                if matched is None:
                    self.fail("SOURCE_MANIFEST.json", "content-addressed source absent from pinned tree")
                else:
                    recorded.append(matched)
                    unresolved.remove(matched)
            if len(recorded) != len(set(recorded)):
                self.fail("SOURCE_MANIFEST.json", f"duplicate source paths for {checkout.name}")
            for path in sorted(original - set(recorded)):
                self.fail(f"{checkout.name}/{path}", "source file missing from manifest")
            for path in sorted(set(recorded) - original):
                self.fail(f"{checkout.name}/{path}", "manifest file absent from pinned source tree")
            count += len(original)
        self.counts["pinned source files checked"] = count

    def generated(self):
        command = self.root / "scripts/catalog.py"
        if not command.exists():
            self.fail("scripts/catalog.py", "missing generator")
            return
        result = subprocess.run([sys.executable, str(command), "check"], cwd=self.root, capture_output=True, text=True)
        if result.returncode:
            self.fail("scripts/catalog.py", "generated content check failed; run python3 scripts/catalog.py check for details")

    def authored_provenance(self):
        command = self.root / "scripts/authored_manifest.py"
        if not command.exists():
            self.fail("scripts/authored_manifest.py", "missing cookbook-authored provenance checker")
            return
        result = subprocess.run([sys.executable, str(command), "check", "--root", str(self.root)], cwd=self.root,
                                capture_output=True, text=True)
        if result.returncode:
            self.fail("COOKBOOK_AUTHORED.json", "cookbook-authored provenance drift; run python3 scripts/authored_manifest.py check for details")

    def run(self):
        pins = self.manifest()
        self.catalog(pins)
        self.source_coverage()
        self.markdown()
        self.plugins()
        self.hygiene()
        self.authored_provenance()
        self.generated()
        return not self.errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--source-dir", type=Path, help="Directory containing pinned source checkouts for complete tree coverage checks")
    args = parser.parse_args()
    verification = Verification(args.root, args.source_dir)
    passed = verification.run()
    for error in verification.errors:
        print(error, file=sys.stderr)
    print("Structural verification " + ("passed" if passed else "failed") + ".")
    print(", ".join(f"{count} {name}" for name, count in verification.counts.items()) + ".")
    print("Recipe execution and external services were not tested.")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
